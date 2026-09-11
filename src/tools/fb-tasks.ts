import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { ApiEnvelope, KkAutoMcpConfig } from '../types.js';
import { jsonResult, pruneUndefined } from './shared.js';

const positiveInt = z.number().int().positive();
const userIds = z
  .array(positiveInt)
  .min(1)
  .max(100)
  .describe('Account ids that will execute the task. MCP caps this at 100 per call.');
const taskType = z.enum(['post']).describe('Current API runtime only accepts post.');
const scheduleType = z.enum(['now', 'later']).optional().describe('Defaults to now; later requires scheduled_at.');
const taskCount = z
  .number()
  .int()
  .min(1)
  .max(10)
  .optional()
  .describe('Number of tasks to create, 1..10. Defaults to 1. The API clamps to the same range.');
const postTarget = z.enum(['profile_post', 'group_post', 'fanpage_post']);
const suType = z.enum(['profile', 'fanpage', 'subprofile']).optional();
const suUid = z.string().min(1).optional().describe('Opaque target identity; required as fanpage UID for fanpage_post.');

const taskPayloadSchema = {
  user_ids: userIds,
  task_type: taskType,
  schedule_type: scheduleType,
  scheduled_at: z.string().min(1).optional().describe('Required when schedule_type is later, for example 2026-05-12 10:30:00.'),
  task_count: taskCount,
  priority_level: z.number().int().min(0).optional().describe('Defaults to 0.'),
  payload: z.record(z.string(), z.unknown()).optional().describe('Task payload object normalized by the API.'),
  type: postTarget.optional().describe('Post target hint merged into payload normalization.'),
  post_type: z.string().optional().describe('Content-type hint merged into payload normalization.'),
  content_type: z.string().optional().describe('Backward-compatible alias merged into payload normalization.'),
  su_type: suType,
  su_uid: suUid,
  confirm: z.boolean().describe('Must be true to create tasks; aborts otherwise.'),
};

type TaskPayloadInput = z.infer<z.ZodObject<typeof taskPayloadSchema>>;

function normalizeTaskPayload(input: TaskPayloadInput): Record<string, unknown> {
  if (!input.confirm) {
    throw new Error('FB task creation requires confirm=true');
  }

  if (input.schedule_type === 'later' && input.scheduled_at === undefined) {
    throw new Error('scheduled_at is required when schedule_type is later');
  }

  if (input.type === 'fanpage_post') {
    if (input.su_type !== 'fanpage' || input.su_uid === undefined) {
      throw new Error('fanpage_post tasks require su_type=fanpage and a non-empty su_uid fanpage UID');
    }
  }

  const { confirm: _confirm, ...fields } = input;

  return pruneUndefined(fields);
}

export function registerFbTaskTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  void config;

  const register = (
    name: string,
    path: string,
    title: string,
    description: string,
  ): void => {
    server.registerTool(
      name,
      {
        title,
        description,
        inputSchema: taskPayloadSchema,
      },
      async (input: TaskPayloadInput) => {
        const response = await client.post<ApiEnvelope>(path, { body: normalizeTaskPayload(input) });

        return jsonResult(response);
      },
    );
  };

  register(
    'create_fb_task',
    '/api/v2/fb-tasks',
    'Create FB task',
    'Create automation tasks through the kkAuto API v2 FB task router. WARNING: this enqueues real account automation. Requires confirm=true; user_ids capped at 100 and task_count at 10.',
  );

  register(
    'create_fb_post_tasks',
    '/api/v2/fb-tasks/posts',
    'Create FB post tasks',
    'Create post tasks through the kkAuto API v2 alias POST /api/v2/fb-tasks/posts. WARNING: this enqueues real account automation. Requires confirm=true; user_ids capped at 100 and task_count at 10.',
  );

  register(
    'create_fb_interaction_tasks',
    '/api/v2/fb-tasks/interactions',
    'Create FB interaction tasks',
    'Create interaction tasks through the kkAuto API v2 alias POST /api/v2/fb-tasks/interactions. WARNING: this enqueues real account automation. Requires confirm=true; user_ids capped at 100 and task_count at 10.',
  );

  register(
    'create_fb_comment_tasks',
    '/api/v2/fb-tasks/comments',
    'Create FB comment tasks',
    'Create comment tasks through the kkAuto API v2 alias POST /api/v2/fb-tasks/comments. WARNING: this enqueues real account automation. Requires confirm=true; user_ids capped at 100 and task_count at 10.',
  );
}