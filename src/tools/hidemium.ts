import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

/**
 * integrations: Hidemium ADS sync state and profile import.
 */

export const hidemiumSpec: ResourceSpec = {
  name: 'manage_hidemium_sync',
  title: 'Manage Hidemium sync',
  description: 'kkAuto API v2 Hidemium integration: current sync state, which uuids already exist, and profile import.',
  actions: {
    status: {
      title: 'Hidemium status',
      description: 'Stored Hidemium sync configuration and counters.',
      method: 'GET',
      path: '/api/v2/hidemium',
    },
    'check-existing': {
      title: 'Check existing uuids',
      description: 'Which Hidemium profile uuids are already imported.',
      method: 'GET',
      path: '/api/v2/hidemium/check-existing',
      query: ['uuids'],
      input: { uuids: z.string().describe('Comma-separated Hidemium profile uuids.') },
    },
    'sync-profiles': {
      title: 'Sync profiles',
      description: 'Import the supplied Hidemium profiles and refresh the sync counter.',
      method: 'POST',
      path: '/api/v2/hidemium/sync-profiles',
      input: {
        profiles: z.array(z.record(z.string(), z.unknown())).min(1).describe('Hidemium profile rows to import.'),
      },
      guard: 'confirm',
    },
  },
};

export function registerHidemiumTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, hidemiumSpec);
}
