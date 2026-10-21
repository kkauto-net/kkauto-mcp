import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { id, limit, page, search, sortBy, sortOrder } from './schemas.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

/**
 * fb-block-uids: blocked Facebook uids propagated to every hashtag an owner shares.
 */

export const fbBlockUidSpec: ResourceSpec = {
  name: 'manage_fb_block_uid',
  title: 'Manage blocked uids',
  description: 'kkAuto API v2 block-uid list: list, read, create, update the note, delete, bulk add from an owner and preview a hashtag.',
  actions: {
    list: {
      title: 'List blocked uids',
      description: 'Paginated blocked uids with hashtag and text filters.',
      method: 'GET',
      path: '/api/v2/fb-block-uids',
      query: ['page', 'limit', 'search', 'sort_by', 'sort_order', 'hashtag_id'],
      input: {
        page: page(),
        limit: limit(),
        search: search('Partial match on the blocked uid.'),
        sort_by: sortBy(['id', 'hashtag_id', 'block_uid', 'created_at', 'updated_at']),
        sort_order: sortOrder(),
        hashtag_id: id('Hashtag id filter.').optional(),
      },
    },
    get: {
      title: 'Get blocked uid',
      description: 'One block-uid row by id.',
      method: 'GET',
      path: '/api/v2/fb-block-uids/{id}',
      input: { id: id('Block-uid row id.') },
    },
    create: {
      title: 'Block a uid',
      description: 'Add one blocked uid; the block propagates to the owner hashtags.',
      method: 'POST',
      path: '/api/v2/fb-block-uids',
      input: {
        hashtag_id: id('Hashtag id.'),
        block_uid: z.string().min(1).max(255).describe('Uid, username or profile link to block.'),
        note: z.string().optional().describe('Reason note.'),
      },
    },
    update: {
      title: 'Update block note',
      description: 'Only the note is editable on a block-uid row.',
      method: 'PUT',
      path: '/api/v2/fb-block-uids/{id}',
      input: {
        id: id('Block-uid row id.'),
        note: z.string().optional().describe('Reason note; empty clears it.'),
      },
    },
    'from-owner': {
      title: 'Block from owner',
      description: 'Block one or more uids from an account or fanpage and propagate to its hashtags.',
      method: 'POST',
      path: '/api/v2/fb-block-uids/from-owner',
      input: {
        owner_type: z.enum(['account', 'fanpage']).describe('Owner kind.'),
        owner_id: id('Owner account or fanpage id.'),
        uids: z.union([z.string().min(1), z.array(z.string().min(1)).max(500)]).describe('Uids, usernames or links to block.'),
        note: z.string().optional().describe('Reason note.'),
      },
    },
    'preview-hashtag': {
      title: 'Preview hashtag members',
      description: 'Member count of one hashtag before blocking.',
      method: 'GET',
      path: '/api/v2/fb-block-uids/preview-hashtag',
      query: ['hashtag_id'],
      input: { hashtag_id: id('Hashtag id.') },
    },
    delete: {
      title: 'Unblock a uid',
      description: 'Delete one block-uid row. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/fb-block-uids/{id}',
      input: { id: id('Block-uid row id.') },
      guard: 'delete',
    },
  },
};

export function registerFbBlockUidTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, fbBlockUidSpec);
}
