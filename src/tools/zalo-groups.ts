import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { flag, id, limit, page, search, sortBy, sortOrder } from './schemas.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

/**
 * platforms: Zalo groups with their manager guidance and hashtag links.
 */

export const zaloGroupSpec: ResourceSpec = {
  name: 'manage_zalo_group',
  title: 'Manage Zalo groups',
  description: 'kkAuto API v2 Zalo groups: CRUD, bulk delete and per-account membership writes.',
  actions: {
    list: {
      title: 'List Zalo groups',
      description: 'Paginated Zalo group list with active/hashtag filters.',
      method: 'GET',
      path: '/api/v2/zalo-groups',
      query: ['page', 'limit', 'search', 'active', 'hashtag_id', 'sort_by', 'sort_order'],
      input: {
        page: page(),
        limit: limit(),
        search: search('Partial match on the group name or url.'),
        active: z.string().optional().describe('Active filter (1|0).'),
        hashtag_id: id('Hashtag id filter.').optional(),
        sort_by: sortBy(['id', 'gr_name', 'gr_active', 'created_at', 'updated_at']),
        sort_order: sortOrder(),
      },
    },
    get: {
      title: 'Get Zalo group',
      description: 'One Zalo group by id.',
      method: 'GET',
      path: '/api/v2/zalo-groups/{id}',
      input: { id: id('Group id.') },
    },
    create: {
      title: 'Create Zalo group',
      description: 'Create a Zalo group with optional manager guidance and hashtags.',
      method: 'POST',
      path: '/api/v2/zalo-groups',
      input: {
        gr_uid: z.string().describe('Zalo group uid.'),
        gr_name: z.string().optional().describe('Group name.'),
        gr_url: z.string().optional().describe('Group URL.'),
        gr_active: flag('Active flag.').optional(),
        gr_note: z.string().optional().describe('Note.'),
        ai_guidance: z.string().optional().describe('AI manager guidance.'),
        hashtags: z.array(z.number().int().positive()).optional().describe('Hashtag ids to link.'),
      },
    },
    update: {
      title: 'Update Zalo group',
      description: 'Update group fields, manager guidance and hashtag links; omitted keys are kept.',
      method: 'PUT',
      path: '/api/v2/zalo-groups/{id}',
      input: {
        id: id('Group id.'),
        gr_uid: z.string().optional().describe('Zalo group uid.'),
        gr_name: z.string().optional().describe('Group name.'),
        gr_url: z.string().optional().describe('Group URL.'),
        gr_active: flag('Active flag.').optional(),
        gr_note: z.string().optional().describe('Note.'),
        ai_guidance: z.string().optional().describe('AI manager guidance.'),
        hashtags: z.array(z.number().int().positive()).optional().describe('Hashtag ids to link.'),
      },
    },
    delete: {
      title: 'Delete Zalo group',
      description: 'Delete one Zalo group. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/zalo-groups/{id}',
      input: { id: id('Group id.') },
      guard: 'delete',
    },
    'bulk-delete': {
      title: 'Bulk delete Zalo groups',
      description: 'Delete up to 500 groups at once.',
      method: 'POST',
      path: '/api/v2/zalo-groups/bulk/delete',
      input: { ids: z.array(z.number().int().positive()).min(1).max(500).describe('Group ids.') },
      guard: 'confirm',
    },
    membership: {
      title: 'Write membership',
      description: 'Set the join state of one account in this group.',
      method: 'POST',
      path: '/api/v2/zalo-groups/{id}/membership',
      input: {
        id: id('Group id.'),
        u_id: id('Zalo account id.'),
        joined: z.union([z.literal(-1), z.literal(0), z.literal(1)]).describe('Join state: -1 failed, 0 not joined, 1 joined.'),
        reason: z.string().optional().describe('Reason; required by the API for joined=-1.'),
      },
    },
  },
};

export function registerZaloGroupTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, zaloGroupSpec);
}
