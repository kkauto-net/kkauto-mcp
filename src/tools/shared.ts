import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { ApiEnvelope, KkAutoMcpConfig } from '../types.js';

export function jsonResult(value: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

export function pruneUndefined<T extends Record<string, unknown>>(value: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

/** Cap the requested list limit with the configured maximum. */
export function appliedLimit(limit: number | undefined, config: KkAutoMcpConfig): number {
  return limit !== undefined ? Math.min(limit, config.maxListLimit) : config.maxListLimit;
}

export interface GuardedDeleteInput {
  confirm: boolean;
  reason: string;
  expected_name?: string;
}

export interface GuardedDeleteOptions {
  client: KkAutoApiClient;
  config: KkAutoMcpConfig;
  toolName: string;
  id: unknown;
  getPath: string;
  deletePath: string;
  input: GuardedDeleteInput;
  extractName: (data: Record<string, unknown>) => string | undefined;
}

/**
 * Shared destructive-tool guard: disabled unless KK_MCP_ENABLE_DELETE=true,
 * requires confirm=true + reason, preflights the current resource, and
 * optionally verifies a human-readable name before the DELETE call.
 */
export async function guardedDelete(options: GuardedDeleteOptions): Promise<ReturnType<typeof jsonResult>> {
  const { client, config, toolName } = options;

  if (!config.enableDelete) {
    throw new Error(`${toolName} is disabled. Set KK_MCP_ENABLE_DELETE=true to enable it.`);
  }

  if (!options.input.confirm) {
    throw new Error(`${toolName} requires confirm=true`);
  }

  if (options.input.reason.trim() === '') {
    throw new Error(`${toolName} requires a non-empty reason`);
  }

  const preflight = await client.get<ApiEnvelope<Record<string, unknown>>>(options.getPath);
  const name = options.extractName(preflight?.data ?? {});

  if (options.input.expected_name !== undefined && options.input.expected_name !== name) {
    throw new Error('expected_name did not match the current resource name; delete aborted');
  }

  const response = await client.delete<ApiEnvelope>(options.deletePath);

  return jsonResult({
    status: 'success',
    deleted_id: options.id,
    deleted_name: name,
    reason: options.input.reason,
    api_response: response,
  });
}