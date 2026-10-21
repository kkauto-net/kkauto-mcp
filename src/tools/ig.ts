import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { flag, id, limit, page, search, sortBy, sortOrder } from './schemas.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

/**
 * platforms: Instagram posts and tasks.
 */

export const igPostSpec: ResourceSpec = {
  name: 'manage_ig_post',
  title: 'Manage Instagram posts',
  description: 'kkAuto API v2 Instagram posts: CRUD, status and bulk delete.',
  actions: {
    list: {
      title: 'List IG posts',
      description: 'Paginated IG post list with format/status/account/hashtag filters.',
      method: 'GET',
      path: '/api/v2/ig-posts',
      query: ['page', 'limit', 'search', 'format', 'status', 'u_id', 'hashtag_id', 'sort_by', 'sort_order'],
      input: {
        page: page(),
        limit: limit(),
        search: search('Partial match on the title.'),
        format: z.string().optional().describe('Post format filter.'),
        status: z.string().optional().describe('Status filter.'),
        u_id: id('IG account id filter.').optional(),
        hashtag_id: id('Hashtag id filter.').optional(),
        sort_by: sortBy(['id', 'title', 'format', 'status', 'u_id', 'created_at', 'updated_at']),
        sort_order: sortOrder(),
      },
    },
    get: {
      title: 'Get IG post',
      description: 'One IG post by id.',
      method: 'GET',
      path: '/api/v2/ig-posts/{id}',
      input: { id: id('Post id.') },
    },
    create: {
      title: 'Create IG post',
      description: 'Create an IG post row.',
      method: 'POST',
      path: '/api/v2/ig-posts',
      input: {
        title: z.string().optional().describe('Post title.'),
        caption: z.string().optional().describe('Caption.'),
        format: z.string().optional().describe('Post format.'),
        status: z.string().optional().describe('Status.'),
        u_id: id('IG account id.').optional(),
        permalink: z.string().url().optional().describe('Published permalink.'),
        ig_media_id: z.string().optional().describe('Instagram media id.'),
        expires_at: z.string().optional().describe('Expiry timestamp.'),
        hashtags: z.array(z.union([z.number().int().positive(), z.string()])).optional().describe('Hashtag ids or names.'),
      },
    },
    update: {
      title: 'Update IG post',
      description: 'Update IG post fields; omitted keys are kept.',
      method: 'PUT',
      path: '/api/v2/ig-posts/{id}',
      input: {
        id: id('Post id.'),
        title: z.string().optional().describe('Post title.'),
        caption: z.string().optional().describe('Caption.'),
        format: z.string().optional().describe('Post format.'),
        status: z.string().optional().describe('Status.'),
        u_id: id('IG account id.').optional(),
        permalink: z.string().url().optional().describe('Published permalink.'),
        ig_media_id: z.string().optional().describe('Instagram media id.'),
        expires_at: z.string().optional().describe('Expiry timestamp.'),
        hashtags: z.array(z.union([z.number().int().positive(), z.string()])).optional().describe('Hashtag ids or names.'),
      },
    },
    delete: {
      title: 'Delete IG post',
      description: 'Delete one IG post. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/ig-posts/{id}',
      input: { id: id('Post id.') },
      guard: 'delete',
    },
    status: {
      title: 'Set IG post status',
      description: 'Update only the post status.',
      method: 'PATCH',
      path: '/api/v2/ig-posts/{id}/status',
      input: { id: id('Post id.'), status: z.string().describe('New status.') },
    },
    'bulk-delete': {
      title: 'Bulk delete IG posts',
      description: 'Delete up to 500 posts at once.',
      method: 'POST',
      path: '/api/v2/ig-posts/bulk/delete',
      input: { ids: z.array(z.number().int().positive()).min(1).max(500).describe('Post ids.') },
      guard: 'confirm',
    },
  },
};

export const igTaskSpec: ResourceSpec = {
  name: 'manage_ig_task',
  title: 'Manage Instagram tasks',
  description: 'kkAuto API v2 Instagram tasks: list, stats, post-task creation, cancel, reopen and run now.',
  actions: {
    list: {
      title: 'List IG tasks',
      description: 'Paginated IG task list with status/type/account/date filters.',
      method: 'GET',
      path: '/api/v2/ig-tasks',
      query: ['page', 'limit', 'search', 'status', 'task_type', 'u_id', 'start_date', 'end_date', 'sort_by', 'sort_order'],
      input: {
        page: page(),
        limit: limit(),
        search: search('Partial match on task text.'),
        status: z.string().optional().describe('Status filter.'),
        task_type: z.string().optional().describe('Task type filter.'),
        u_id: id('IG account id filter.').optional(),
        start_date: z.string().optional().describe('Start date (Y-m-d).'),
        end_date: z.string().optional().describe('End date (Y-m-d).'),
        sort_by: sortBy(['id', 'u_id', 'task_type', 'status', 'priority_level', 'created_at', 'scheduled_at', 'completed_at']),
        sort_order: sortOrder(),
      },
    },
    get: {
      title: 'Get IG task',
      description: 'One IG task by id.',
      method: 'GET',
      path: '/api/v2/ig-tasks/{id}',
      input: { id: id('Task id.') },
    },
    stats: {
      title: 'IG task stats',
      description: 'Task counts by status/type for one account or all.',
      method: 'GET',
      path: '/api/v2/ig-tasks/stats',
      query: ['u_id', 'status', 'task_type', 'start_date', 'end_date'],
      input: {
        u_id: id('IG account id filter.').optional(),
        status: z.string().optional().describe('Status filter.'),
        task_type: z.string().optional().describe('Task type filter.'),
        start_date: z.string().optional().describe('Start date (Y-m-d).'),
        end_date: z.string().optional().describe('End date (Y-m-d).'),
      },
    },
    'create-post-tasks': {
      title: 'Create post tasks',
      description: 'Queue posting tasks for one or more IG accounts.',
      method: 'POST',
      path: '/api/v2/ig-tasks/create-post-tasks',
      input: {
        user_ids: z.array(z.number().int().positive()).min(1).describe('IG account ids.'),
        schedule_type: z.enum(['now', 'schedule']).optional().describe('Run now or at scheduled_at.'),
        scheduled_at: z.string().optional().describe('Schedule timestamp for schedule_type=schedule.'),
        task_count: z.number().int().min(1).max(10).optional().describe('Tasks per account.'),
      },
    },
    cancel: {
      title: 'Cancel IG task',
      description: 'Cancel one pending task.',
      method: 'POST',
      path: '/api/v2/ig-tasks/{id}/cancel',
      input: { id: id('Task id.') },
    },
    reopen: {
      title: 'Reopen IG task',
      description: 'Put one finished/canceled/failed task back to pending.',
      method: 'POST',
      path: '/api/v2/ig-tasks/{id}/reopen',
      input: { id: id('Task id.') },
    },
    'run-now': {
      title: 'Run IG task now',
      description: 'Queue an immediate run of one task.',
      method: 'POST',
      path: '/api/v2/ig-tasks/{id}/run-now',
      input: { id: id('Task id.') },
      guard: 'confirm',
    },
  },
};

export function registerIgPostTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, igPostSpec);
}

export function registerIgTaskTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, igTaskSpec);
}
