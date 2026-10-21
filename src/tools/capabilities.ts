import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { ApiEnvelope, KkAutoMcpConfig } from '../types.js';
import { jsonResult } from './shared.js';

/**
 * Capability discovery: the API returns the live family catalogue read from its
 * own route collection, so an agent can enumerate families/actions before writing.
 */
export function registerCapabilityTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  void config;

  server.registerTool(
    'get_api_capabilities',
    {
      title: 'Get API capabilities',
      description:
        'List every API v2 family with its base path, required token scope, MCP tool name and live endpoints. Use filter to narrow to one family key.',
      inputSchema: {
        filter: z.string().optional().describe('Family key to narrow the response, e.g. fb-posts or hashtags.'),
      },
    },
    async (input: { filter?: string }) => {
      const response = await client.get<ApiEnvelope & { data?: { families?: unknown[] } }>('/api/v2/system/capabilities', {
        query: { filter: input.filter },
      });

      return jsonResult(response ?? { status: 'success', data: { families: [] } });
    },
  );
}
