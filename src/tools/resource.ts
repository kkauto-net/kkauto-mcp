import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { ApiEnvelope, KkAutoMcpConfig } from '../types.js';
import { appliedLimit, jsonResult } from './shared.js';
import { buildImageFilesFormData } from './media-form-data.js';

export interface ActionSpec {
  title: string;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** API path with `{token}` placeholders resolved from the action input. */
  path: string;
  /** Action fields; every `{token}` in `path` must be declared here. */
  input?: z.ZodRawShape;
  /** Input keys forwarded as query parameters instead of a JSON body. */
  query?: string[];
  /** How the remaining input keys are sent: JSON body (default) or multipart (`media_files` + fields). */
  body?: 'fields' | 'form';
  /** Multipart file field name (default `images[]`). */
  filesField?: string;
  /** `delete` = KK_MCP_ENABLE_DELETE + confirm + reason + preflight; `confirm` = confirm + reason. */
  guard?: 'delete' | 'confirm';
  /** Input key → API body field, for params whose MCP name cannot match (`action`, `confirm`, `reason`). */
  bodyNames?: Record<string, string>;
  /** Documentation only; the API enforces apiv2.admin. */
  admin?: boolean;
}

export interface ResourceSpec {
  /** MCP tool name, e.g. `manage_fb_post`. */
  name: string;
  title: string;
  description: string;
  actions: Record<string, ActionSpec>;
}

export interface ActionCapability {
  action: string;
  method: string;
  path: string;
  query_params: string[];
  body_params: string[];
  required_params: string[];
  guard: 'delete' | 'confirm' | null;
  read_only: boolean;
  destructive: boolean;
}

function pathTokens(path: string): string[] {
  return Array.from(path.matchAll(/\{([a-zA-Z0-9_]+)\}/g), (match) => match[1]);
}

function guardShape(spec: ActionSpec): z.ZodRawShape {
  if (spec.guard === 'delete') {
    return {
      confirm: z.boolean().describe('Must be true for deletion.'),
      reason: z.string().min(1).describe('Human-readable reason for audit context.'),
      expected_name: z.string().min(1).optional().describe('Optional name guard checked before delete.'),
    };
  }

  if (spec.guard === 'confirm') {
    return {
      confirm: z.literal(true).describe('Must be true: this action has side effects.'),
      reason: z.string().min(1).describe('Human-readable reason recorded for audit context.'),
    };
  }

  return {};
}

/** Every field an action accepts: declared input plus the guard fields. */
function actionShape(action: ActionSpec): Record<string, z.ZodTypeAny> {
  const declared = (action.input ?? {}) as Record<string, z.ZodTypeAny>;

  return { ...declared, ...(guardShape(action) as Record<string, z.ZodTypeAny>) };
}

function isOptionalField(schema: z.ZodTypeAny): boolean {
  try {
    return schema.safeParse(undefined).success;
  } catch {
    return false;
  }
}

/** `.describe()` lives on the innermost schema, so unwrap optional/transform wrappers. */
function schemaDescription(schema: z.ZodTypeAny): string {
  let current: Record<string, any> | undefined = schema as unknown as Record<string, any>;

  for (let depth = 0; depth < 10 && current !== undefined; depth += 1) {
    if (typeof current.description === 'string' && current.description !== '') {
      return current.description;
    }
    current = current._zod?.def?.innerType ?? current._def?.innerType;
  }

  return '';
}

/** Dedupe key ignoring `.describe()` text, so identical shapes collapse into one union member. */
function schemaSignature(schema: z.ZodTypeAny): string {
  try {
    return JSON.stringify(z.toJSONSchema(schema, { io: 'input' }), (key, value) =>
      key === 'description' ? undefined : value,
    );
  } catch {
    return `unrepresentable:${Math.random()}`;
  }
}

/**
 * The `tools/list` schema. The SDK only converts a root `z.object` to JSON Schema
 * (`normalizeObjectSchema` drops discriminated unions), so every action field is
 * merged into one object and per-action strictness moves into the handler.
 */
export function buildToolObjectSchema(spec: ResourceSpec): z.ZodObject<any> {
  const entries = Object.entries(spec.actions);

  if (entries.length === 0) {
    throw new Error(`${spec.name} needs at least one action`);
  }

  type FieldUsage = { schemas: Map<string, z.ZodTypeAny>; description: string; usedBy: string[]; requiredBy: string[] };
  const used = new Map<string, FieldUsage>();

  const actionDocs = entries.map(([actionName, action]) => {
    const fields = actionShape(action);
    const required: string[] = [];

    for (const [field, schema] of Object.entries(fields)) {
      const entry: FieldUsage = used.get(field) ?? { schemas: new Map(), description: '', usedBy: [], requiredBy: [] };
      entry.schemas.set(schemaSignature(schema), schema);
      entry.description ||= schemaDescription(schema);
      entry.usedBy.push(actionName);

      if (!isOptionalField(schema)) {
        entry.requiredBy.push(actionName);
        required.push(field);
      }

      used.set(field, entry);
    }

    const requires = required.length > 0 ? ` (requires ${required.join(', ')})` : '';

    return `${actionName}: ${action.method} ${action.path}${requires}`;
  });

  const mergedShape: Record<string, z.ZodTypeAny> = {
    action: z.enum(entries.map(([name]) => name) as [string, ...string[]]).describe(`Action to run. ${actionDocs.join('; ')}.`),
  };

  for (const [field, entry] of used) {
    const members = [...entry.schemas.values()];
    const base: z.ZodTypeAny = members.length === 1 ? members[0] : z.union(members as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
    const actions = entry.usedBy.map((name) => (entry.requiredBy.includes(name) ? `${name}*` : name)).join(', ');
    const description = entry.description === '' ? '' : `${entry.description} `;

    mergedShape[field] = base.optional().describe(`${description}[Actions: ${actions}]`);
  }

  return z.object(mergedShape);
}

/** Capability metadata for one spec, published by `get_api_capabilities`. */
export function describeActionCapabilities(spec: ResourceSpec): ActionCapability[] {
  return Object.entries(spec.actions).map(([actionName, action]) => {
    const tokens = pathTokens(action.path);
    const queryKeys = action.query ?? [];
    const shape = actionShape(action);
    const required = Object.entries(shape)
      .filter(([, schema]) => !isOptionalField(schema))
      .map(([field]) => field);

    return {
      action: actionName,
      method: action.method,
      path: action.path,
      query_params: queryKeys,
      body_params:
        action.method === 'GET'
          ? []
          : Object.keys(shape)
              .filter((field) => !tokens.includes(field) && !queryKeys.includes(field))
              .map((field) => action.bodyNames?.[field] ?? field),
      required_params: [...tokens, ...required.filter((field) => !tokens.includes(field))],
      guard: action.guard ?? null,
      read_only: action.method === 'GET',
      destructive: action.guard === 'delete',
    };
  });
}

const registeredSpecs: ResourceSpec[] = [];

/** Specs registered so far, used by capability discovery. */
export function getRegisteredSpecs(): ResourceSpec[] {
  return registeredSpecs;
}

/**
 * Register one grouped `manage_<resource>` tool. `tools/list` publishes the merged
 * object schema; the handler then validates the input against the strict schema of
 * the selected action, so an unknown field is an error instead of being stripped.
 */
export function registerResourceTools(
  server: McpServer,
  client: KkAutoApiClient,
  config: KkAutoMcpConfig,
  spec: ResourceSpec,
): void {
  const entries = Object.entries(spec.actions);
  const byName: Record<string, ActionSpec> = spec.actions;

  // Strict per-action schemas: required fields and unknown-field rejection live here.
  const actionSchemas: Record<string, z.ZodObject<any>> = {};
  for (const [actionName, action] of entries) {
    for (const token of pathTokens(action.path)) {
      if ((action.input ?? {})[token] === undefined) {
        throw new Error(`${spec.name}.${actionName} path token {${token}} has no schema field`);
      }
    }

    actionSchemas[actionName] = z.object({ action: z.literal(actionName), ...actionShape(action) }).strict();
  }

  if (!registeredSpecs.includes(spec)) {
    registeredSpecs.push(spec);
  }

  const actions = entries.map(([name, action]) => `${name} (${action.method} ${action.path})`).join(', ');

  server.registerTool(
    spec.name,
    {
      title: spec.title,
      description: `${spec.description} Actions: ${actions}.`,
      inputSchema: buildToolObjectSchema(spec).passthrough(),
    },
    async (input: Record<string, unknown>) => {
      const actionName = String(input.action ?? '');
      const action = Object.prototype.hasOwnProperty.call(byName, actionName) ? byName[actionName] : undefined;
      if (action === undefined) {
        throw new Error(`${spec.name} does not support action "${actionName}"`);
      }

      const actionSchema = actionSchemas[actionName];
      const parsed = actionSchema.safeParse(input);
      if (!parsed.success) {
        const issues = parsed.error.issues
          .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
          .join('; ');
        const valid = Object.keys(actionShape(action)).join(', ');
        throw new Error(`${spec.name}.${actionName} rejected the input — ${issues}. Valid fields: ${valid}`);
      }

      const args = parsed.data as Record<string, unknown>;
      const tokens = pathTokens(action.path);
      const queryKeys = action.query ?? [];
      // The discriminator is never forwarded; guard fields only exist on guarded actions.
      const guardKeys = ['action', ...(action.guard === undefined ? [] : ['confirm', 'reason', 'expected_name'])];

      let path = action.path;
      for (const token of tokens) {
        const value = args[token];
        if (value === undefined || value === null || value === '') {
          throw new Error(`${spec.name}.${actionName} requires ${token}`);
        }
        path = path.replace(`{${token}}`, encodeURIComponent(String(value)));
      }

      const query: Record<string, string | number | boolean> = {};
      for (const key of queryKeys) {
        const value = args[key];
        if (value === undefined || value === null || value === '') {
          continue;
        }
        query[key] = value as string | number | boolean;
      }
      if ('limit' in args && args.limit !== undefined) {
        query.limit = appliedLimit(args.limit as number, config);
      }

      const body: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(args)) {
        if (tokens.includes(key) || queryKeys.includes(key) || guardKeys.includes(key) || value === undefined) {
          continue;
        }
        body[action.bodyNames?.[key] ?? key] = value;
      }

      if (action.guard === 'delete') {
        if (!config.enableDelete) {
          throw new Error(`${spec.name}.${actionName} is disabled. Set KK_MCP_ENABLE_DELETE=true to enable it.`);
        }
        if (args.confirm !== true) {
          throw new Error(`${spec.name}.${actionName} requires confirm=true`);
        }
      }

      if (action.guard !== undefined && String(args.reason ?? '').trim() === '') {
        throw new Error(`${spec.name}.${actionName} requires a non-empty reason`);
      }

      const hasBody = Object.keys(body).length > 0;
      const sendBody = action.method !== 'GET' && (hasBody || action.guard !== undefined);

      if (action.body === 'form') {
        const files = Array.isArray(args.media_files) ? (args.media_files as string[]) : [];
        const formData = await buildImageFilesFormData(files, body, action.filesField);
        const response = await client.request<ApiEnvelope>(action.method, path, {
          query: Object.keys(query).length > 0 ? query : undefined,
          formData,
        });

        return jsonResult(response ?? { status: 'success', data: null });
      }

      const response = await client.request<ApiEnvelope>(action.method, path, {
        query: Object.keys(query).length > 0 ? query : undefined,
        body: sendBody ? { ...body, ...(action.guard !== undefined ? { confirm: true } : {}) } : undefined,
      });

      if (action.guard !== undefined) {
        return jsonResult({
          status: response?.status ?? 'success',
          reason: args.reason,
          data: response?.data ?? response,
        });
      }

      return jsonResult(response ?? { status: 'success', data: null });
    },
  );
}
