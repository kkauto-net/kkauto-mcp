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

/**
 * Register one grouped `manage_<resource>` tool whose `action` discriminator
 * selects a strict per-action schema (discriminated union).
 */
export function registerResourceTools(
  server: McpServer,
  client: KkAutoApiClient,
  config: KkAutoMcpConfig,
  spec: ResourceSpec,
): void {
  const entries = Object.entries(spec.actions);
  const byName: Record<string, ActionSpec> = spec.actions;

  // Path tokens are required; other declared fields stay optional per action.
  const members = entries.map(([actionName, action]) => {
    const declaredInput = action.input ?? {};
    const shape: Record<string, unknown> = { action: z.literal(actionName) };

    for (const token of pathTokens(action.path)) {
      const declared = declaredInput[token];
      if (declared === undefined) {
        throw new Error(`${spec.name}.${actionName} path token {${token}} has no schema field`);
      }
      shape[token] = declared;
    }

    for (const [key, value] of Object.entries(declaredInput)) {
      shape[key] ??= value;
    }

    Object.assign(shape, guardShape(action));

    return z.object(shape as z.ZodRawShape);
  });

  if (members.length < 2) {
    throw new Error(`${spec.name} needs at least two actions to build a discriminated union`);
  }

  const actions = entries.map(([name, action]) => `${name} (${action.method} ${action.path})`).join(', ');

  server.registerTool(
    spec.name,
    {
      title: spec.title,
      description: `${spec.description} Actions: ${actions}.`,
      // The SDK accepts any schema; a discriminated union keeps each action strict.
      inputSchema: z.discriminatedUnion('action', members as unknown as [typeof members[number], ...Array<typeof members[number]>]),
    },
    async (input: Record<string, unknown>) => {
      const actionName = String(input.action ?? '');
      const action = Object.prototype.hasOwnProperty.call(byName, actionName) ? byName[actionName] : undefined;
      if (action === undefined) {
        throw new Error(`${spec.name} does not support action "${actionName}"`);
      }

      const tokens = pathTokens(action.path);
      const queryKeys = action.query ?? [];
      const GUARD_KEYS = ['action', 'confirm', 'reason', 'expected_name'];

      let path = action.path;
      for (const token of tokens) {
        const value = input[token];
        if (value === undefined || value === null || value === '') {
          throw new Error(`${spec.name}.${actionName} requires ${token}`);
        }
        path = path.replace(`{${token}}`, encodeURIComponent(String(value)));
      }

      const query: Record<string, string | number | boolean> = {};
      for (const key of queryKeys) {
        const value = input[key];
        if (value === undefined || value === null || value === '') {
          continue;
        }
        query[key] = value as string | number | boolean;
      }
      if ('limit' in input && input.limit !== undefined) {
        query.limit = appliedLimit(input.limit as number, config);
      }

      const body: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(input)) {
        if (tokens.includes(key) || queryKeys.includes(key) || GUARD_KEYS.includes(key) || value === undefined) {
          continue;
        }
        body[key] = value;
      }

      if (action.guard === 'delete') {
        if (!config.enableDelete) {
          throw new Error(`${spec.name}.${actionName} is disabled. Set KK_MCP_ENABLE_DELETE=true to enable it.`);
        }
        if (input.confirm !== true) {
          throw new Error(`${spec.name}.${actionName} requires confirm=true`);
        }
      }

      if (action.guard !== undefined && String(input.reason ?? '').trim() === '') {
        throw new Error(`${spec.name}.${actionName} requires a non-empty reason`);
      }

      const hasBody = Object.keys(body).length > 0;
      const sendBody = action.method !== 'GET' && (hasBody || action.guard !== undefined);

      if (action.body === 'form') {
        const files = Array.isArray(input.media_files) ? (input.media_files as string[]) : [];
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
          reason: input.reason,
          data: response?.data ?? response,
        });
      }

      return jsonResult(response ?? { status: 'success', data: null });
    },
  );
}
