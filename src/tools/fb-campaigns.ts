import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { flag, id, limit, page, sortBy, sortOrder } from './schemas.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

/**
 * fb-campaigns: automation campaigns that fan one target out over many accounts.
 */

const campaignFields = {
  kind: z.enum(['page_like', 'group_join', 'post_interact']).describe('Campaign kind.'),
  entity_type: z.enum(['fanpage', 'group']).optional().describe('Target entity type.'),
  entity_id: id('Target fanpage or group id.').optional(),
  hashtag_ids_json: z.array(z.number().int().positive()).optional().describe('Hashtag ids used by post_interact.'),
  max_accounts: z.number().int().min(1).optional().describe('Accounts used per run.'),
  min_likes: z.number().int().min(0).optional().describe('Minimum likes a candidate post needs.'),
  min_comments: z.number().int().min(0).optional().describe('Minimum comments a candidate post needs.'),
  like_quota_per_session: z.number().int().min(0).optional().describe('Likes per account session.'),
  comment_quota_per_session: z.number().int().min(0).optional().describe('Comments per account session.'),
  post_mode: z.enum(['all', 'fb_posts']).optional().describe('Post source.'),
  schedule_timer_enabled: flag('Enable the interval schedule.').optional(),
  schedule_timer_minutes: z.number().int().min(1).optional().describe('Interval minutes.'),
  schedule_on_post_enabled: flag('Enable the post-delay schedule.').optional(),
  schedule_on_post_delay_minutes: z.number().int().min(1).optional().describe('Delay after a new post, minutes.'),
  is_active: flag('Active flag.').optional(),
};

export const fbCampaignSpec: ResourceSpec = {
  name: 'manage_fb_campaign',
  title: 'Manage Facebook campaigns',
  description: 'kkAuto API v2 campaigns: list, read, create, update, delete, run now and list runs.',
  actions: {
    list: {
      title: 'List campaigns',
      description: 'Paginated campaigns with kind, entity and active filters.',
      method: 'GET',
      path: '/api/v2/fb-campaigns',
      query: ['page', 'limit', 'sort_by', 'sort_order', 'kind', 'entity_type', 'entity_id', 'is_active'],
      input: {
        page: page(),
        limit: limit(),
        sort_by: sortBy(['id', 'kind', 'entity_id', 'max_accounts', 'is_active', 'last_run_at', 'created_at']),
        sort_order: sortOrder(),
        kind: z.enum(['page_like', 'group_join', 'post_interact']).optional().describe('Campaign kind filter.'),
        entity_type: z.enum(['fanpage', 'group']).optional().describe('Entity type filter.'),
        entity_id: id('Entity id filter.').optional(),
        is_active: flag('Active flag filter.').optional(),
      },
    },
    get: {
      title: 'Get campaign',
      description: 'One campaign by id.',
      method: 'GET',
      path: '/api/v2/fb-campaigns/{id}',
      input: { id: id('Campaign id.') },
    },
    create: {
      title: 'Create campaign',
      description: 'Create a campaign with its target, quotas and schedule.',
      method: 'POST',
      path: '/api/v2/fb-campaigns',
      input: campaignFields,
    },
    update: {
      title: 'Update campaign',
      description: 'Update a campaign target, quotas or schedule.',
      method: 'PUT',
      path: '/api/v2/fb-campaigns/{id}',
      input: { id: id('Campaign id.'), ...campaignFields, kind: campaignFields.kind.optional() },
    },
    'run-now': {
      title: 'Run campaign now',
      description: 'Queue a manual campaign run.',
      method: 'POST',
      path: '/api/v2/fb-campaigns/{id}/run-now',
      input: { id: id('Campaign id.') },
      guard: 'confirm',
    },
    runs: {
      title: 'List runs',
      description: 'Run history of one campaign.',
      method: 'GET',
      path: '/api/v2/fb-campaigns/{id}/runs',
      input: { id: id('Campaign id.') },
    },
    delete: {
      title: 'Delete campaign',
      description: 'Delete one campaign. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/fb-campaigns/{id}',
      input: { id: id('Campaign id.') },
      guard: 'delete',
    },
  },
};

export function registerFbCampaignTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, fbCampaignSpec);
}
