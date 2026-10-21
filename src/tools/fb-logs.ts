import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { id, limit, page } from './schemas.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

/**
 * fb-logs: read-only account feed/status logs and comment threads.
 */

export const fbLogSpec: ResourceSpec = {
  name: 'manage_fb_log',
  title: 'Read Facebook logs',
  description: 'kkAuto API v2 read-only logs: feed comments, account status logs, comment threads and one thread.',
  actions: {
    list: {
      title: 'List feed comment logs',
      description: 'Paginated feed-comment log rows, optionally filtered by account and approval.',
      method: 'GET',
      path: '/api/v2/fb-logs',
      query: ['page', 'limit', 'u_id', 'approve'],
      input: {
        page: page(),
        limit: limit(),
        u_id: id('Account uid filter.').optional(),
        approve: z.enum(['approved', 'pending', 'denied', 'unchecked']).optional().describe('Comment approval filter.'),
      },
    },
    'feed-comments': {
      title: 'Feed comment logs',
      description: 'Paginated feed-comment log rows, optionally filtered by account and approval.',
      method: 'GET',
      path: '/api/v2/fb-logs/feed-comments',
      query: ['page', 'limit', 'u_id', 'approve'],
      input: {
        page: page(),
        limit: limit(),
        u_id: id('Account uid filter.').optional(),
        approve: z.enum(['approved', 'pending', 'denied', 'unchecked']).optional().describe('Comment approval filter.'),
      },
    },
    'status-logs': {
      title: 'Account status logs',
      description: 'Paginated account status log rows.',
      method: 'GET',
      path: '/api/v2/fb-logs/status-logs',
      query: ['page', 'limit', 'u_id', 'status'],
      input: {
        page: page(),
        limit: limit(),
        u_id: id('Account uid filter.').optional(),
        status: z.string().optional().describe('Status filter.'),
      },
    },
    'comment-threads': {
      title: 'Comment threads',
      description: 'Paginated comment threads with their step counters.',
      method: 'GET',
      path: '/api/v2/fb-logs/comment-threads',
      query: ['page', 'limit', 'status', 'anchor_id'],
      input: {
        page: page(),
        limit: limit(),
        status: z.string().optional().describe('Thread status filter.'),
        anchor_id: id('Anchor post id filter.').optional(),
      },
    },
    'comment-thread': {
      title: 'Comment thread detail',
      description: 'One comment thread with its steps.',
      method: 'GET',
      path: '/api/v2/fb-logs/comment-threads/{threadId}',
      input: { threadId: id('Comment thread id.') },
    },
  },
};

export function registerFbLogTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, fbLogSpec);
}
