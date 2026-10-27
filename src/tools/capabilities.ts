import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { ApiEnvelope, KkAutoMcpConfig } from '../types.js';
import { describeActionCapabilities, getRegisteredSpecs } from './resource.js';
import { jsonResult } from './shared.js';

interface FamilyPayload {
  key?: string;
  mcp?: string | null;
  base?: string;
  actions?: unknown[];
  endpoints?: Array<{ method?: string; path?: string }>;
  [key: string]: unknown;
}

/**
 * Capability discovery: the API returns the live family catalogue read from its
 * own route collection; each family is enriched with the MCP action metadata so an
 * agent can see the exact action names, params and guards before writing.
 */
export function registerCapabilityTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  const pagination = { default_limit: 40, max_limit: 200, mcp_max_limit: config.maxListLimit };

  server.registerTool(
    'get_api_capabilities',
    {
      title: 'Get API capabilities',
      description:
        'List every API v2 family with its base path, required token scope, MCP tool name, its actions (method, path, params, read_only, destructive) and pagination limits. Use filter to narrow to one family key.',
      inputSchema: {
        filter: z.string().optional().describe('Family key to narrow the response, e.g. fb-posts or hashtags.'),
      },
    },
    async (input: { filter?: string }) => {
      const response = await client.get<ApiEnvelope & { data?: { families?: FamilyPayload[] } }>(
        '/api/v2/system/capabilities',
        { query: { filter: input.filter } },
      );

      const specs = new Map(getRegisteredSpecs().map((spec) => [spec.name, spec]));
      const families = (response?.data?.families ?? []).map((family) => {
        const spec = typeof family.mcp === 'string' ? specs.get(family.mcp) : undefined;

        return {
          ...family,
          actions: spec !== undefined
            ? describeActionCapabilities(spec)
            : (family.endpoints ?? []).map((endpoint) => ({
                action: null,
                method: endpoint.method ?? '',
                path: endpoint.path ?? '',
                query_params: [],
                body_params: [],
                required_params: [],
                guard: null,
                read_only: endpoint.method === 'GET',
                destructive: false,
              })),
          pagination,
        };
      });

      return jsonResult({ ...response, data: { ...response?.data, families, count: families.length, pagination } });
    },
  );
}
