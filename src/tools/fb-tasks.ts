import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { id, limit, page, search } from './schemas.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

const taskType = z.enum(['post']).describe('Current API runtime only accepts post.');
const scheduleType = z.enum(['now', 'later']).optional().describe('Defaults to now; later requires scheduled_at.');
const postTarget = z.enum(['profile_post', 'group_post', 'fanpage_post']);
const filterQuery = ['page', 'limit', 'search', 'status', 'task_type', 'user_id', 'date_range', 'start_date', 'end_date'];

const taskPayload = {
  user_ids: z.array(id('FB account id.')).min(1).max(100).describe('Accounts that will execute the task (max 100 per call).'),
  task_type: taskType,
  schedule_type: scheduleType,
  scheduled_at: z.string().min(1).optional().describe('Required when schedule_type is later, e.g. 2026-05-12 10:30:00.'),
  task_count: z.number().int().min(1).max(10).optional().describe('Tasks to create, 1..10. Defaults to 1.'),
  priority_level: z.number().int().min(0).optional().describe('Defaults to 0.'),
  payload: z.record(z.string(), z.unknown()).optional().describe('Task payload object normalized by the API.'),
  type: postTarget.optional().describe('Post target hint merged into payload normalization.'),
  post_type: z.string().optional().describe('Content-type hint merged into payload normalization.'),
  content_type: z.string().optional().describe('Alias merged into payload normalization.'),
  su_type: z.enum(['profile', 'fanpage', 'subprofile']).optional(),
  su_uid: z.string().min(1).optional().describe('Target identity; required as fanpage UID for fanpage_post.'),
};

const taskFilters = {
  page: page(),
  limit: limit(),
  search: search(),
  status: z.string().optional().describe('Task status filter, e.g. pending, processing, failed, canceled.'),
  task_type: z.string().optional(),
  user_id: id('Executing FB account id.').optional(),
  date_range: z.enum(['today', 'yesterday', 'week', 'month', 'custom']).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
};

const taskIds = {
  task_ids: z.array(id('FB task id.')).min(1).max(500).describe('Tasks to act on in one call (maximum 500).'),
};

export const fbTaskSpec: ResourceSpec = {
  name: 'manage_fb_task',
  title: 'Manage FB tasks',
  description: 'kkAuto API v2 Facebook automation tasks: enqueue, list, cancel, retry, and lock maintenance.',
  actions: {
    create: {
      title: 'Create FB task',
      description: 'Enqueue automation tasks through the task router; user_ids max 100 and task_count max 10.',
      method: 'POST',
      path: '/api/v2/fb-tasks',
      input: taskPayload,
      guard: 'confirm',
    },
    'create-posts': {
      title: 'Create FB post tasks',
      description: 'Enqueue post tasks through the /posts alias.',
      method: 'POST',
      path: '/api/v2/fb-tasks/posts',
      input: taskPayload,
      guard: 'confirm',
    },
    'create-interactions': {
      title: 'Create FB interaction tasks',
      description: 'Enqueue interaction tasks through the /interactions alias.',
      method: 'POST',
      path: '/api/v2/fb-tasks/interactions',
      input: taskPayload,
      guard: 'confirm',
    },
    'create-comments': {
      title: 'Create FB comment tasks',
      description: 'Enqueue comment tasks through the /comments alias.',
      method: 'POST',
      path: '/api/v2/fb-tasks/comments',
      input: taskPayload,
      guard: 'confirm',
    },
    list: {
      title: 'List FB tasks',
      description: 'Paginated task list with status, type, account, and date filters.',
      method: 'GET',
      path: '/api/v2/fb-tasks',
      query: filterQuery,
      input: taskFilters,
    },
    stats: {
      title: 'Get FB task stats',
      description: 'Task counters for the same filters as the list.',
      method: 'GET',
      path: '/api/v2/fb-tasks/stats',
      query: filterQuery,
      input: taskFilters,
    },
    history: {
      title: 'Get FB task history',
      description: 'Task history entries, optionally for one task or account.',
      method: 'GET',
      path: '/api/v2/fb-tasks/history',
      query: [...filterQuery, 'task_id'],
      input: { ...taskFilters, task_id: id('FB task id.').optional() },
    },
    activity: {
      title: 'Get FB task activity',
      description: 'Activity log of one task.',
      method: 'GET',
      path: '/api/v2/fb-tasks/{id}/activity',
      input: { id: id('FB task id.') },
    },
    cancel: {
      title: 'Cancel FB task',
      description: 'Cancel one pending or processing task.',
      method: 'POST',
      path: '/api/v2/fb-tasks/{id}/cancel',
      input: { id: id('FB task id.') },
      guard: 'confirm',
    },
    'cancel-all': {
      title: 'Cancel all FB tasks',
      description: 'Cancel every pending and processing task in the tenant (bulk cap 500).',
      method: 'POST',
      path: '/api/v2/fb-tasks/cancel-all',
      input: {},
      guard: 'confirm',
    },
    'cancel-all-user': {
      title: 'Cancel all tasks of one account',
      description: 'Cancel every pending and processing task of one account (bulk cap 500).',
      method: 'POST',
      path: '/api/v2/fb-tasks/cancel-all-user',
      input: { user_id: id('Executing FB account id.') },
      guard: 'confirm',
    },
    'cancel-multiple': {
      title: 'Cancel multiple FB tasks',
      description: 'Cancel up to 500 pending or processing tasks.',
      method: 'POST',
      path: '/api/v2/fb-tasks/cancel-multiple',
      input: taskIds,
      guard: 'confirm',
    },
    reopen: {
      title: 'Reopen FB task',
      description: 'Reopen a failed or canceled task so it can run again.',
      method: 'POST',
      path: '/api/v2/fb-tasks/{id}/reopen',
      input: { id: id('FB task id.') },
      guard: 'confirm',
    },
    'run-now': {
      title: 'Run FB task now',
      description: 'Move a pending or processing task to the front so it runs immediately.',
      method: 'POST',
      path: '/api/v2/fb-tasks/{id}/run-now',
      input: { id: id('FB task id.') },
      guard: 'confirm',
    },
    'retry-all-failed': {
      title: 'Retry all failed FB tasks',
      description: 'Requeue failed tasks matching the filters.',
      method: 'POST',
      path: '/api/v2/fb-tasks/retry-all-failed',
      input: {
        task_type: z.string().optional(),
        user_id: id('Executing FB account id.').optional(),
        date_range: z.enum(['today', 'yesterday', 'week', 'month', 'custom']).optional(),
        start_date: z.string().optional(),
        end_date: z.string().optional(),
      },
      guard: 'confirm',
    },
    'delete-multiple': {
      title: 'Delete multiple FB tasks',
      description: 'Delete up to 500 tasks whose status allows deletion.',
      method: 'POST',
      path: '/api/v2/fb-tasks/delete-multiple',
      input: taskIds,
      guard: 'delete',
    },
    'clear-locks': {
      title: 'Clear account locks',
      description: 'Truncate account locks and reset browser-error accounts in the tenant.',
      method: 'POST',
      path: '/api/v2/fb-tasks/clear-locks',
      input: {},
      guard: 'confirm',
    },
  },
};

export function registerFbTaskTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, fbTaskSpec);
}
