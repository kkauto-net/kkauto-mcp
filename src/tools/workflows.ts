import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { flag, id, limit, page, search, sortBy, sortOrder } from './schemas.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

/**
 * automation: the three workflow families (account, fanpage, group). They share
 * the `fb_workflow` table but keep separate controllers, targets and activities.
 */

const activities = z
  .record(z.string(), z.unknown())
  .describe('Activity map keyed by activity type, e.g. {"post_profile":{"enabled":1,"schedules":[...]}}.');

const workflowBody = {
  name: z.string().min(1).max(255).describe('Workflow name.'),
  content_type: z.enum(['post', 'video']).optional().describe('Content type, default post.'),
  destination_type: z.enum(['profile', 'group', 'fanpage']).optional().describe('Destination type.'),
  is_active: flag('Active flag.').optional(),
};

const listShape = {
  page: page(),
  limit: limit(),
  search: search('Partial match on the workflow name.'),
  is_active: flag('Active filter.').optional(),
  target_mode: z.string().optional().describe('Target mode filter.'),
  content_type: z.enum(['post', 'video']).optional().describe('Content type filter.'),
  destination_type: z.enum(['profile', 'group', 'fanpage']).optional().describe('Destination filter.'),
  sort_by: sortBy(['id', 'name', 'is_active', 'created_at', 'updated_at']),
  sort_order: sortOrder(),
};

export const accountWorkflowSpec: ResourceSpec = {
  name: 'manage_account_workflow',
  title: 'Manage account workflows',
  description: 'kkAuto API v2 account workflows: CRUD, duplicate, toggle, run now, logs and tag targets.',
  actions: {
    list: {
      title: 'List account workflows',
      description: 'Paginated account workflow list with filters.',
      method: 'GET',
      path: '/api/v2/account-workflows',
      query: ['page', 'limit', 'search', 'is_active', 'target_mode', 'content_type', 'destination_type', 'sort_by', 'sort_order'],
      input: listShape,
    },
    get: {
      title: 'Get account workflow',
      description: 'One account workflow with activities and targets.',
      method: 'GET',
      path: '/api/v2/account-workflows/{id}',
      input: { id: id('Workflow id.') },
    },
    create: {
      title: 'Create account workflow',
      description: 'Create a workflow with activities and its target selection.',
      method: 'POST',
      path: '/api/v2/account-workflows',
      input: {
        ...workflowBody,
        target_mode: z.enum(['level', 'hashtags', 'tags', 'accounts']).describe('How accounts are selected.'),
        activities,
        account_ids: z.array(z.number().int().positive()).optional().describe('Accounts for target_mode=accounts.'),
        tag_ids: z.array(z.number().int().positive()).optional().describe('Tags for target_mode=tags.'),
        levels: z.array(z.number().int()).optional().describe('Account levels for target_mode=level.'),
        hashtag_ids: z.array(z.number().int().positive()).optional().describe('Hashtags for target_mode=hashtags.'),
      },
    },
    update: {
      title: 'Update account workflow',
      description: 'Update workflow fields, activities and targets; omitted keys are kept.',
      method: 'PUT',
      path: '/api/v2/account-workflows/{id}',
      input: {
        id: id('Workflow id.'),
        name: z.string().min(1).max(255).optional().describe('Workflow name.'),
        content_type: z.enum(['post', 'video']).optional().describe('Content type.'),
        destination_type: z.enum(['profile', 'group']).optional().describe('Destination type.'),
        is_active: flag('Active flag.').optional(),
        target_mode: z.enum(['level', 'hashtags', 'tags', 'accounts']).optional().describe('How accounts are selected.'),
        activities: activities.optional(),
        account_ids: z.array(z.number().int().positive()).optional().describe('Accounts for target_mode=accounts.'),
        tag_ids: z.array(z.number().int().positive()).optional().describe('Tags for target_mode=tags.'),
        levels: z.array(z.number().int()).optional().describe('Account levels for target_mode=level.'),
        hashtag_ids: z.array(z.number().int().positive()).optional().describe('Hashtags for target_mode=hashtags.'),
      },
    },
    delete: {
      title: 'Delete account workflow',
      description: 'Delete one account workflow. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/account-workflows/{id}',
      input: { id: id('Workflow id.') },
      guard: 'delete',
    },
    duplicate: {
      title: 'Duplicate account workflow',
      description: 'Copy the workflow including activities and targets.',
      method: 'POST',
      path: '/api/v2/account-workflows/{id}/duplicate',
      input: { id: id('Workflow id.'), name: z.string().min(1).max(255).optional().describe('Name for the copy.') },
    },
    toggle: {
      title: 'Toggle account workflow',
      description: 'Flip is_active; the API needs confirm=true when disabling cancels pending tasks.',
      method: 'POST',
      path: '/api/v2/account-workflows/{id}/toggle',
      input: { id: id('Workflow id.') },
      guard: 'confirm',
    },
    'run-now': {
      title: 'Run account workflow now',
      description: 'Queue an immediate run of the workflow.',
      method: 'POST',
      path: '/api/v2/account-workflows/{id}/run-now',
      input: { id: id('Workflow id.') },
      guard: 'confirm',
    },
    logs: {
      title: 'Account workflow logs',
      description: 'Run logs of one workflow.',
      method: 'GET',
      path: '/api/v2/account-workflows/{id}/logs',
      query: ['workflow_id', 'limit'],
      input: { id: id('Workflow id.'), workflow_id: id('Workflow id filter.').optional(), limit: limit() },
    },
    'tag-targets': {
      title: 'List tag targets',
      description: 'Accounts linked through workflow tags.',
      method: 'GET',
      path: '/api/v2/account-workflows/{id}/tag-targets',
      query: ['tag_id'],
      input: { id: id('Workflow id.'), tag_id: id('Restrict to one tag.').optional() },
    },
    'add-tag-target': {
      title: 'Add tag target',
      description: 'Link one account tag to the workflow.',
      method: 'POST',
      path: '/api/v2/account-workflows/{id}/tag-targets',
      input: { id: id('Workflow id.'), tag_id: id('Tag id to link.') },
    },
    'remove-tag-target': {
      title: 'Remove tag target',
      description: 'Unlink one account tag from the workflow. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/account-workflows/{id}/tag-targets/{targetId}',
      input: { id: id('Workflow id.'), targetId: id('Tag id to unlink.') },
      guard: 'delete',
    },
  },
};

export const fanpageWorkflowSpec: ResourceSpec = {
  name: 'manage_fanpage_workflow',
  title: 'Manage fanpage workflows',
  description: 'kkAuto API v2 fanpage workflows: CRUD, duplicate, toggle, tag targets and fanpage/group search.',
  actions: {
    list: {
      title: 'List fanpage workflows',
      description: 'Paginated fanpage workflow list with filters.',
      method: 'GET',
      path: '/api/v2/fanpage-workflows',
      query: ['page', 'limit', 'search', 'is_active', 'target_mode', 'content_type', 'destination_type', 'sort_by', 'sort_order'],
      input: listShape,
    },
    get: {
      title: 'Get fanpage workflow',
      description: 'One fanpage workflow with activities and targets.',
      method: 'GET',
      path: '/api/v2/fanpage-workflows/{id}',
      input: { id: id('Workflow id.') },
    },
    create: {
      title: 'Create fanpage workflow',
      description: 'Create a workflow with activities and its fanpage/tag/hashtag targets.',
      method: 'POST',
      path: '/api/v2/fanpage-workflows',
      input: {
        ...workflowBody,
        target_mode: z.enum(['fanpages', 'tags', 'hashtags']).describe('How fanpages are selected.'),
        activities,
        fanpage_ids: z.array(z.number().int().positive()).optional().describe('Fanpages for target_mode=fanpages.'),
        tag_ids: z.array(z.number().int().positive()).optional().describe('Tags for target_mode=tags.'),
        hashtag_ids: z.array(z.number().int().positive()).optional().describe('Hashtags for target_mode=hashtags.'),
      },
    },
    update: {
      title: 'Update fanpage workflow',
      description: 'Update workflow fields, activities and targets; omitted keys are kept.',
      method: 'PUT',
      path: '/api/v2/fanpage-workflows/{id}',
      input: {
        id: id('Workflow id.'),
        name: z.string().min(1).max(255).optional().describe('Workflow name.'),
        content_type: z.enum(['post', 'video']).optional().describe('Content type.'),
        destination_type: z.enum(['fanpage', 'group']).optional().describe('Destination type.'),
        is_active: flag('Active flag.').optional(),
        target_mode: z.enum(['fanpages', 'tags', 'hashtags']).optional().describe('How fanpages are selected.'),
        activities: activities.optional(),
        fanpage_ids: z.array(z.number().int().positive()).optional().describe('Fanpages for target_mode=fanpages.'),
        tag_ids: z.array(z.number().int().positive()).optional().describe('Tags for target_mode=tags.'),
        hashtag_ids: z.array(z.number().int().positive()).optional().describe('Hashtags for target_mode=hashtags.'),
      },
    },
    delete: {
      title: 'Delete fanpage workflow',
      description: 'Delete one fanpage workflow. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/fanpage-workflows/{id}',
      input: { id: id('Workflow id.') },
      guard: 'delete',
    },
    duplicate: {
      title: 'Duplicate fanpage workflow',
      description: 'Copy the workflow including activities and targets.',
      method: 'POST',
      path: '/api/v2/fanpage-workflows/{id}/duplicate',
      input: { id: id('Workflow id.'), name: z.string().min(1).max(255).optional().describe('Name for the copy.') },
    },
    toggle: {
      title: 'Toggle fanpage workflow',
      description: 'Flip is_active; the API needs confirm=true when disabling cancels pending tasks.',
      method: 'POST',
      path: '/api/v2/fanpage-workflows/{id}/toggle',
      input: { id: id('Workflow id.') },
      guard: 'confirm',
    },
    'tag-targets': {
      title: 'List tag targets',
      description: 'Fanpages linked through workflow tags.',
      method: 'GET',
      path: '/api/v2/fanpage-workflows/{id}/tag-targets',
      query: ['tag_id'],
      input: { id: id('Workflow id.'), tag_id: id('Restrict to one tag.').optional() },
    },
    'search-fanpages': {
      title: 'Search fanpages',
      description: 'Fanpage picker search for workflow targets.',
      method: 'GET',
      path: '/api/v2/fanpage-workflows/search-fanpages',
      query: ['q', 'search', 'ids', 'page', 'limit'],
      input: {
        q: z.string().optional().describe('Partial match on name, link or uid.'),
        search: z.string().optional().describe('Alias of q.'),
        ids: z.string().optional().describe('Comma-separated fanpage ids to resolve.'),
        page: page(),
        limit: limit(),
      },
    },
    'search-groups': {
      title: 'Search groups',
      description: 'Group picker search for workflow targets.',
      method: 'GET',
      path: '/api/v2/fanpage-workflows/search-groups',
      query: ['q', 'search', 'ids', 'page', 'limit'],
      input: {
        q: z.string().optional().describe('Partial match on group name, link or uid.'),
        search: z.string().optional().describe('Alias of q.'),
        ids: z.string().optional().describe('Comma-separated group ids to resolve.'),
        page: page(),
        limit: limit(),
      },
    },
  },
};

export const groupWorkflowSpec: ResourceSpec = {
  name: 'manage_group_workflow',
  title: 'Manage group workflows',
  description: 'kkAuto API v2 group workflows: CRUD, duplicate, toggle, group/fanpage search and hashtag targets.',
  actions: {
    list: {
      title: 'List group workflows',
      description: 'Paginated group workflow list with filters.',
      method: 'GET',
      path: '/api/v2/group-workflows',
      query: ['page', 'limit', 'search', 'is_active', 'target_mode', 'content_type', 'destination_type', 'sort_by', 'sort_order'],
      input: listShape,
    },
    get: {
      title: 'Get group workflow',
      description: 'One group workflow with schedules and targets.',
      method: 'GET',
      path: '/api/v2/group-workflows/{id}',
      input: { id: id('Workflow id.') },
    },
    create: {
      title: 'Create group workflow',
      description: 'Create a workflow with schedule slots and group/account/fanpage targets.',
      method: 'POST',
      path: '/api/v2/group-workflows',
      input: {
        ...workflowBody,
        schedules: z
          .array(z.record(z.string(), z.unknown()))
          .describe('Schedule slots, e.g. [{"schedule_type":"daily","time":"08:30"}].'),
        group_ids: z.array(z.number().int().positive()).optional().describe('Target groups.'),
        account_ids: z.array(z.number().int().positive()).optional().describe('Posting accounts.'),
        fanpage_ids: z.array(z.number().int().positive()).optional().describe('Posting fanpages.'),
        group_hashtag_ids: z.array(z.number().int().positive()).optional().describe('Group hashtags.'),
        account_hashtag_ids: z.array(z.number().int().positive()).optional().describe('Account hashtags.'),
        fanpage_hashtag_ids: z.array(z.number().int().positive()).optional().describe('Fanpage hashtags.'),
        content_hashtag_ids: z.array(z.number().int().positive()).optional().describe('Content hashtags.'),
      },
    },
    update: {
      title: 'Update group workflow',
      description: 'Update workflow fields, schedules and targets; omitted keys are kept.',
      method: 'PUT',
      path: '/api/v2/group-workflows/{id}',
      input: {
        id: id('Workflow id.'),
        name: z.string().min(1).max(255).optional().describe('Workflow name.'),
        content_type: z.enum(['post', 'video']).optional().describe('Content type.'),
        is_active: flag('Active flag.').optional(),
        schedules: z.array(z.record(z.string(), z.unknown())).optional().describe('Schedule slots.'),
        group_ids: z.array(z.number().int().positive()).optional().describe('Target groups.'),
        account_ids: z.array(z.number().int().positive()).optional().describe('Posting accounts.'),
        fanpage_ids: z.array(z.number().int().positive()).optional().describe('Posting fanpages.'),
        group_hashtag_ids: z.array(z.number().int().positive()).optional().describe('Group hashtags.'),
        account_hashtag_ids: z.array(z.number().int().positive()).optional().describe('Account hashtags.'),
        fanpage_hashtag_ids: z.array(z.number().int().positive()).optional().describe('Fanpage hashtags.'),
        content_hashtag_ids: z.array(z.number().int().positive()).optional().describe('Content hashtags.'),
      },
    },
    delete: {
      title: 'Delete group workflow',
      description: 'Delete one group workflow. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/group-workflows/{id}',
      input: { id: id('Workflow id.') },
      guard: 'delete',
    },
    duplicate: {
      title: 'Duplicate group workflow',
      description: 'Copy the workflow including schedules and targets.',
      method: 'POST',
      path: '/api/v2/group-workflows/{id}/duplicate',
      input: { id: id('Workflow id.'), name: z.string().min(1).max(255).optional().describe('Name for the copy.') },
    },
    toggle: {
      title: 'Toggle group workflow',
      description: 'Flip is_active.',
      method: 'POST',
      path: '/api/v2/group-workflows/{id}/toggle',
      input: { id: id('Workflow id.') },
    },
    'search-groups': {
      title: 'Search groups',
      description: 'Group picker search for workflow targets.',
      method: 'GET',
      path: '/api/v2/group-workflows/search-groups',
      query: ['q', 'search', 'ids', 'page', 'limit'],
      input: {
        q: z.string().optional().describe('Partial match on group name, link or uid.'),
        search: z.string().optional().describe('Alias of q.'),
        ids: z.string().optional().describe('Comma-separated group ids to resolve.'),
        page: page(),
        limit: limit(),
      },
    },
    'search-fanpages': {
      title: 'Search fanpages',
      description: 'Fanpage picker search for workflow targets.',
      method: 'GET',
      path: '/api/v2/group-workflows/search-fanpages',
      query: ['q', 'search', 'ids', 'page', 'limit'],
      input: {
        q: z.string().optional().describe('Partial match on name, link or uid.'),
        search: z.string().optional().describe('Alias of q.'),
        ids: z.string().optional().describe('Comma-separated fanpage ids to resolve.'),
        page: page(),
        limit: limit(),
      },
    },
    'hashtag-targets': {
      title: 'List hashtag targets',
      description: 'Hashtags linked to this workflow.',
      method: 'GET',
      path: '/api/v2/group-workflows/{id}/hashtag-targets',
      query: ['hashtag_id'],
      input: { id: id('Workflow id.'), hashtag_id: id('Restrict to one hashtag.').optional() },
    },
    'add-hashtag-target': {
      title: 'Add hashtag target',
      description: 'Link one hashtag to the workflow.',
      method: 'POST',
      path: '/api/v2/group-workflows/{id}/hashtag-targets',
      input: { id: id('Workflow id.'), hashtag_id: id('Hashtag id to link.') },
    },
    'remove-hashtag-target': {
      title: 'Remove hashtag target',
      description: 'Unlink one hashtag from the workflow. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/group-workflows/{id}/hashtag-targets/{targetId}',
      input: { id: id('Workflow id.'), targetId: id('Hashtag id to unlink.') },
      guard: 'delete',
    },
  },
};

export function registerAccountWorkflowTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, accountWorkflowSpec);
}

export function registerFanpageWorkflowTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, fanpageWorkflowSpec);
}

export function registerGroupWorkflowTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, groupWorkflowSpec);
}
