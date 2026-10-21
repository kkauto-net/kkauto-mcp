import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { flag, id, limit, page, search, sortBy, sortOrder } from './schemas.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

/**
 * fb-groups: owned Facebook groups, their settings, moderators, posters,
 * AI manager config, review gate and task creation.
 */

const accountIds = z
  .union([z.number().int().positive(), z.array(z.number().int().positive()).max(500)])
  .describe('One account id or a list of ids.');

const groupFields = {
  gr_name: z.string().min(1).max(255).describe('Group name.'),
  gr_uid: z.string().max(64).optional().describe('Facebook group id.'),
  gr_url: z.string().max(255).optional().describe('Group URL.'),
  gr_type: z.string().max(32).optional().describe('Group type.'),
  gr_note: z.string().optional().describe('Internal note.'),
  info_members: z.number().int().min(0).optional().describe('Member count.'),
  gr_active: flag('Active flag.').optional(),
  approval_mode: z.string().max(16).optional().describe('Post approval mode.'),
};

const hashtagIds = z.array(z.number().int().positive()).optional().describe('Full hashtag id set for the group.');

export const fbGroupSpec: ResourceSpec = {
  name: 'manage_fb_group',
  title: 'Manage Facebook groups',
  description:
    'kkAuto API v2 owned Facebook groups: CRUD, post settings, moderators, posters, AI manager, review gate and task creation.',
  actions: {
    list: {
      title: 'List groups',
      description: 'Paginated group list with activity, type and approval filters.',
      method: 'GET',
      path: '/api/v2/fb-groups',
      query: ['page', 'limit', 'search', 'sort_by', 'sort_order', 'gr_active', 'gr_type', 'gr_check', 'gr_scan', 'gr_post', 'approval_mode'],
      input: {
        page: page(),
        limit: limit(),
        search: search('Partial match on name, uid, URL or note.'),
        sort_by: sortBy(['gr_id', 'gr_name', 'gr_check', 'gr_active', 'info_members', 'date_add', 'date_update']),
        sort_order: sortOrder(),
        gr_active: flag('Active flag filter.').optional(),
        gr_type: z.string().optional().describe('Group type filter.'),
        gr_check: flag('Check flag filter.').optional(),
        gr_scan: flag('Scan flag filter.').optional(),
        gr_post: flag('Auto-post flag filter.').optional(),
        approval_mode: z.string().optional().describe('Approval mode filter.'),
      },
    },
    get: {
      title: 'Get group',
      description: 'One group by id.',
      method: 'GET',
      path: '/api/v2/fb-groups/{id}',
      input: { id: id('Group id.') },
    },
    create: {
      title: 'Create group',
      description: 'Register an owned group.',
      method: 'POST',
      path: '/api/v2/fb-groups',
      input: groupFields,
    },
    update: {
      title: 'Update group',
      description: 'Update group identity and activity flags.',
      method: 'PUT',
      path: '/api/v2/fb-groups/{id}',
      input: {
        id: id('Group id.'),
        ...groupFields,
        gr_name: z.string().min(1).max(255).optional().describe('Group name.'),
      },
    },
    settings: {
      title: 'Update post settings',
      description: 'Update approval, post/comment/image/scan flags, join target, assistants and hashtags.',
      method: 'PUT',
      path: '/api/v2/fb-groups/{id}/settings',
      input: {
        id: id('Group id.'),
        approval_mode: z.string().max(16).optional().describe('Post approval mode.'),
        gr_post: flag('Auto-post flag.').optional(),
        gr_config_comment: flag('Comment permission.').optional(),
        gr_config_image: flag('Image posting permission.').optional(),
        gr_config_scanuid: flag('Scan-uid permission.').optional(),
        gr_config_scanuid_all: flag('Scan-uid for all members.').optional(),
        gr_check: flag('Group check flag.').optional(),
        join_target: z.number().int().min(1).optional().describe('Target member join count.'),
        assistants_ids: z.array(z.number().int().positive()).optional().describe('Post assistant ids; empty clears.'),
        hashtag_ids: hashtagIds,
      },
    },
    moderators: {
      title: 'List moderators',
      description: 'Accounts that moderate this group.',
      method: 'GET',
      path: '/api/v2/fb-groups/{id}/moderators',
      input: { id: id('Group id.') },
    },
    'add-moderator': {
      title: 'Add moderators',
      description: 'Grant moderator rights to one or more accounts.',
      method: 'POST',
      path: '/api/v2/fb-groups/{id}/moderators',
      input: { id: id('Group id.'), account_ids: accountIds },
    },
    'delete-moderator': {
      title: 'Remove moderator',
      description: 'Revoke moderator rights from one account. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/fb-groups/{id}/moderators/{moderatorId}',
      input: { id: id('Group id.'), moderatorId: id('Account id to revoke.') },
      guard: 'delete',
    },
    posters: {
      title: 'List posters',
      description: 'Accounts allowed to post in this group.',
      method: 'GET',
      path: '/api/v2/fb-groups/{id}/posters',
      query: ['can_post'],
      input: { id: id('Group id.'), can_post: flag('Only accounts that can post now.').optional() },
    },
    'add-poster': {
      title: 'Add posters',
      description: 'Allow one or more accounts to post in this group.',
      method: 'POST',
      path: '/api/v2/fb-groups/{id}/posters',
      input: { id: id('Group id.'), account_ids: accountIds },
    },
    'delete-poster': {
      title: 'Remove poster',
      description: 'Revoke posting rights from one account. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/fb-groups/{id}/posters/{posterId}',
      input: { id: id('Group id.'), posterId: id('Account id to revoke.') },
      guard: 'delete',
    },
    manager: {
      title: 'Get AI manager',
      description: 'AI manager configuration, allowed hashtags and banned keywords.',
      method: 'GET',
      path: '/api/v2/fb-groups/{id}/manager',
      input: { id: id('Group id.') },
    },
    'update-manager': {
      title: 'Update AI manager',
      description: 'Save AI manager settings; omitted fields fall back to the defaults.',
      method: 'PUT',
      path: '/api/v2/fb-groups/{id}/manager',
      input: {
        id: id('Group id.'),
        auto_approve_posts: flag('Auto-approve posts.').optional(),
        approval_time_minutes: z.number().int().min(0).optional().describe('Approval window, minutes.'),
        max_posts_per_day: z.number().int().min(0).optional().describe('Daily post cap.'),
        auto_invite_members: flag('Auto-invite members.').optional(),
        ai_type: z.enum(['system', 'custom']).optional().describe('Provider source.'),
        provider_id: id('AI provider id.').optional(),
        ai_model: z.string().optional().describe('Model id.'),
        ai_guidance: z.string().optional().describe('Manager guidance prompt.'),
        ai_api_url: z.string().optional().describe('Custom API URL.'),
        banned_keywords: z.union([z.string(), z.array(z.string())]).optional().describe('Banned keywords string or list.'),
        hashtag_ids: hashtagIds,
      },
    },
    'activate-manager': {
      title: 'Activate manager',
      description: 'Turn the group AI manager on.',
      method: 'POST',
      path: '/api/v2/fb-groups/{id}/manager/activate',
      input: { id: id('Group id.') },
    },
    'deactivate-manager': {
      title: 'Deactivate manager',
      description: 'Turn the group AI manager off.',
      method: 'POST',
      path: '/api/v2/fb-groups/{id}/manager/deactivate',
      input: { id: id('Group id.') },
    },
    'manager-guidance': {
      title: 'Get manager guidance',
      description: 'AI-generated guidance proposal for the group manager.',
      method: 'GET',
      path: '/api/v2/fb-groups/{id}/ai/manager-guidance',
      input: { id: id('Group id.') },
    },
    'review-queue': {
      title: 'Review queue',
      description: 'Groups waiting in the review gate with their round and status.',
      method: 'GET',
      path: '/api/v2/fb-groups/{id}/review/queue',
      input: { id: id('Group id, kept for routing; the queue is workspace-wide.') },
    },
    review: {
      title: 'Get review item',
      description: 'One review-gate entry with AI recommendations.',
      method: 'GET',
      path: '/api/v2/fb-groups/{id}/review',
      input: { id: id('Group id.') },
    },
    'review-action': {
      title: 'Review action',
      description: 'Approve, drop, hold, rerun or manually pass a review-gate entry.',
      method: 'POST',
      path: '/api/v2/fb-groups/{id}/review/action',
      input: {
        id: id('Group id.'),
        action: z.enum(['approve', 'drop', 'hold', 'rerun', 'manual']).describe('Review decision.'),
        round: z.union([z.literal(1), z.literal(2)]).optional().describe('Gate round; inferred when omitted.'),
        hashtags: z.array(z.number().int().positive()).optional().describe('Hashtag ids for a manual pass.'),
        rank: z.number().int().optional().describe('Group rank for a manual pass.'),
        flags: z.array(z.string()).optional().describe('Flags recorded with a manual pass.'),
        note: z.string().optional().describe('Review note.'),
      },
    },
    'hashtag-search': {
      title: 'Search hashtags',
      description: 'Active hashtags matching a keyword, for review assignment.',
      method: 'GET',
      path: '/api/v2/fb-groups/review/hashtag-search',
      query: ['q'],
      input: { q: z.string().optional().describe('Keyword to match.') },
    },
    delete: {
      title: 'Delete group',
      description: 'Delete one owned group. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/fb-groups/{id}',
      input: { id: id('Group id.') },
      guard: 'delete',
    },
    'create-tasks': {
      title: 'Create group tasks',
      description: 'Queue post tasks for this group and optional extra groups.',
      method: 'POST',
      path: '/api/v2/fb-groups/{id}/tasks',
      input: {
        id: id('Group id.'),
        group_ids: z.array(z.number().int().positive()).max(500).optional().describe('Extra group ids; defaults to this group.'),
        type: z.string().optional().describe('Task type, default group_post.'),
        post_type: z.string().optional().describe('Post type.'),
        content_type: z.enum(['interaction', 'product', 'video']).optional().describe('Content type.'),
        category: z.string().optional().describe('Content category.'),
        fb_post_id: z.number().int().positive().optional().describe('Bound post id.'),
        schedule_type: z.enum(['now', 'later']).optional().describe('Schedule mode.'),
        scheduled_at: z.string().optional().describe('Run time, required when schedule_type=later.'),
        task_count: z.number().int().min(1).max(10).optional().describe('Tasks per group, default 1.'),
        join_mode: z.string().optional().describe('Join mode for accounts that are not members yet.'),
        join_account: z.union([z.number().int().positive(), z.array(z.number().int().positive())]).optional().describe('Account id(s) used to join.'),
      },
    },
  },
};

export function registerFbGroupTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, fbGroupSpec);
}
