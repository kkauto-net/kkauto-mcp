import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { id, limit, page, search, sortBy, sortOrder } from './schemas.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

/**
 * fb-keywords: the keyword queue the group scanner consumes.
 */

export const fbKeywordSpec: ResourceSpec = {
  name: 'manage_fb_keyword',
  title: 'Manage scan keywords',
  description: 'kkAuto API v2 keyword queue: list, read, bulk add, update, mark used/using, record scanned groups and delete.',
  actions: {
    list: {
      title: 'List keywords',
      description: 'Paginated keyword queue with keyword search and status filter.',
      method: 'GET',
      path: '/api/v2/fb-keywords',
      query: ['page', 'limit', 'search', 'sort_by', 'sort_order', 'status'],
      input: {
        page: page(),
        limit: limit(),
        search: search('Partial match on the keyword.'),
        sort_by: sortBy(['id', 'keyword', 'status', 'used_at', 'created_at']),
        sort_order: sortOrder(),
        status: z.enum(['new', 'used', 'using']).optional().describe('Status filter.'),
      },
    },
    get: {
      title: 'Get keyword',
      description: 'One keyword row by id.',
      method: 'GET',
      path: '/api/v2/fb-keywords/{id}',
      input: { id: id('Keyword id.') },
    },
    create: {
      title: 'Add keywords',
      description: 'Bulk add keywords from a comma, pipe or newline separated string or a list.',
      method: 'POST',
      path: '/api/v2/fb-keywords',
      input: {
        keywords: z.union([z.string().min(1), z.array(z.string().min(1))]).describe('Keywords to add.'),
      },
    },
    update: {
      title: 'Update keyword',
      description: 'Update the keyword text or its status.',
      method: 'PUT',
      path: '/api/v2/fb-keywords/{id}',
      input: {
        id: id('Keyword id.'),
        keyword: z.string().min(2).max(255).optional().describe('Keyword text.'),
        status: z.enum(['new', 'used', 'using']).optional().describe('Status.'),
        used_at: z.string().optional().describe('Last use timestamp.'),
      },
    },
    status: {
      title: 'Mark keyword used',
      description: 'Mark one keyword as used and stamp the use time.',
      method: 'PATCH',
      path: '/api/v2/fb-keywords/{id}/status',
      input: { id: id('Keyword id.') },
    },
    'status-using': {
      title: 'Mark keyword using',
      description: 'Mark a keyword as currently in use.',
      method: 'GET',
      path: '/api/v2/fb-keywords/status-using',
      query: ['id'],
      input: { id: id('Keyword id.').optional() },
    },
    'groups-scanned': {
      title: 'Record groups scanned',
      description: 'Set the number of groups the scanner has covered for this keyword.',
      method: 'GET',
      path: '/api/v2/fb-keywords/{id}/groups-scanned',
      query: ['total_groups'],
      input: {
        id: id('Keyword id.'),
        total_groups: z.number().int().min(0).describe('Groups scanned so far.'),
      },
    },
    delete: {
      title: 'Delete keyword',
      description: 'Delete one keyword. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/fb-keywords/{id}',
      input: { id: id('Keyword id.') },
      guard: 'delete',
    },
  },
};

export function registerFbKeywordTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, fbKeywordSpec);
}
