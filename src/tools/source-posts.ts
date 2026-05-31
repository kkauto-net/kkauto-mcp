import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { ApiEnvelope, KkAutoMcpConfig } from '../types.js';

const positiveInt = z.number().int().positive();
const nonEmptyString = z.string().min(1);
const sourcePlatform = z.enum([
  'facebook',
  'instagram',
  'twitter',
  'youtube',
  'tiktok',
  'reddit',
  'pinterest',
  'website',
  'linkedin',
  'telegram',
  'discord',
  'other',
]);
const workflowStatus = z.enum(['pending', 'approved', 'rejected', 'waiting_confirmation']);
const sourceFormat = z.enum(['feed_post', 'reel', 'story', 'short', 'live', 'carousel', 'article', 'unknown', 'other']);
const topicType = z.enum(['normal', 'tutorial', 'share', 'review', 'comparison', 'introduction', 'promotion', 'news', 'event']);
const lengthType = z.enum(['short', 'medium', 'long']);
const contentShape = z.enum(['text_only', 'image_only', 'video_only', 'text_image', 'text_video', 'image_video', 'text_image_video']);
const orderDirection = z.enum(['ASC', 'DESC']);
const orderBy = z.enum(['published_at', 'id', 'created_at', 'updated_at', 'quality_score', 'popularity_score']);
const mediaPayload = z.object({
  media_type: z.enum(['image', 'video']).default('image'),
  media_url: z.string().url(),
});

const listSchema = {
  source_platform: sourcePlatform.optional(),
  workflow_status: workflowStatus.optional().describe('Canonical lifecycle status. Use status only for API compatibility checks.'),
  status: workflowStatus.optional().describe('Deprecated API alias for workflow_status.'),
  source_format: sourceFormat.optional(),
  topic_type: topicType.optional(),
  content_shape: contentShape.optional(),
  length_type: lengthType.optional(),
  post_type: lengthType.optional().describe('Deprecated API alias for length_type.'),
  hashtag: nonEmptyString.optional(),
  date_from: nonEmptyString.optional(),
  date_to: nonEmptyString.optional(),
  search: nonEmptyString.optional(),
  order_by: orderBy.optional(),
  order_direction: orderDirection.optional(),
  limit: positiveInt.optional().describe('Result limit. Capped by KK_MCP_MAX_LIST_LIMIT.'),
  offset: z.number().int().min(0).optional(),
};

const getSchema = {
  id: positiveInt,
};

const createSchema = {
  title: z.string().min(3).max(500),
  content: nonEmptyString,
  source_platform: sourcePlatform,
  source_channel: z.string().min(1).max(255),
  source_author: z.string().min(1).max(255),
  source_url: z.string().url().max(1000),
  source_post_id: z.string().min(1).max(255),
  published_at: nonEmptyString.describe('Publish timestamp accepted by kkAuto API valid_date, e.g. 2026-05-26 10:30:00.'),
  source_format: sourceFormat.optional(),
  workflow_status: workflowStatus.optional(),
  status: workflowStatus.optional().describe('Deprecated API alias for workflow_status.'),
  topic_type: topicType.optional(),
  length_type: lengthType.optional(),
  post_type: lengthType.optional().describe('Deprecated API alias for length_type.'),
  source_crawler_id: positiveInt.optional(),
  media: z.array(mediaPayload).max(50).optional(),
  hashtags: z.union([z.string(), z.array(z.string().min(1))]).optional(),
  comments: z.array(z.record(z.string(), z.unknown())).max(200).optional(),
  analytics: z.record(z.string(), z.unknown()).optional(),
};

const updateSchema = {
  id: positiveInt,
  title: z.string().min(3).max(500).optional(),
  content: nonEmptyString.optional(),
  source_platform: sourcePlatform.optional(),
  source_channel: z.string().min(1).max(255).optional(),
  source_author: z.string().min(1).max(255).optional(),
  source_url: z.string().url().max(1000).optional(),
  source_format: sourceFormat.optional(),
  workflow_status: workflowStatus.optional(),
  status: workflowStatus.optional().describe('Deprecated API alias for workflow_status.'),
  topic_type: topicType.optional(),
  length_type: lengthType.optional(),
  post_type: lengthType.optional().describe('Deprecated API alias for length_type.'),
  media: z.array(mediaPayload).max(50).optional().describe('Only send when replacing media rows.'),
};

const searchSchema = {
  q: nonEmptyString,
  workflow_status: workflowStatus.optional(),
  status: workflowStatus.optional().describe('Deprecated API alias for workflow_status.'),
  limit: positiveInt.optional().describe('Result limit. Capped by KK_MCP_MAX_LIST_LIMIT.'),
  offset: z.number().int().min(0).optional(),
};

const byPlatformSchema = {
  platform: sourcePlatform,
  workflow_status: workflowStatus.optional(),
  status: workflowStatus.optional().describe('Deprecated API alias for workflow_status.'),
  limit: positiveInt.optional().describe('Result limit. Capped by KK_MCP_MAX_LIST_LIMIT.'),
  offset: z.number().int().min(0).optional(),
};

const byHashtagSchema = {
  hashtag: nonEmptyString,
  workflow_status: workflowStatus.optional(),
  status: workflowStatus.optional().describe('Deprecated API alias for workflow_status.'),
  limit: positiveInt.optional().describe('Result limit. Capped by KK_MCP_MAX_LIST_LIMIT.'),
  offset: z.number().int().min(0).optional(),
};

const statusSchema = {
  id: positiveInt,
  workflow_status: workflowStatus.optional(),
  status: workflowStatus.optional().describe('Deprecated API alias for workflow_status.'),
  notes: z.string().optional(),
};

const deleteSchema = {
  id: positiveInt,
  confirm: z.boolean().describe('Must be true for deletion.'),
  reason: nonEmptyString.describe('Human-readable reason for audit context.'),
  expected_title: nonEmptyString.optional().describe('Optional title guard checked before delete.'),
};

type ListInput = z.infer<z.ZodObject<typeof listSchema>>;
type GetInput = z.infer<z.ZodObject<typeof getSchema>>;
type CreateInput = z.infer<z.ZodObject<typeof createSchema>>;
type UpdateInput = z.infer<z.ZodObject<typeof updateSchema>>;
type SearchInput = z.infer<z.ZodObject<typeof searchSchema>>;
type ByPlatformInput = z.infer<z.ZodObject<typeof byPlatformSchema>>;
type ByHashtagInput = z.infer<z.ZodObject<typeof byHashtagSchema>>;
type StatusInput = z.infer<z.ZodObject<typeof statusSchema>>;
type DeleteInput = z.infer<z.ZodObject<typeof deleteSchema>>;

export function registerSourcePostTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  server.registerTool(
    'list_source_posts',
    {
      title: 'List source posts',
      description: 'List kkAuto API v2 source posts with filters and offset pagination.',
      inputSchema: listSchema,
    },
    async (input: ListInput) => {
      const response = await client.get<ApiEnvelope>('/api/v2/source-posts', {
        query: { ...input, limit: limitOrDefault(input.limit, config) },
      });

      return jsonResult(response ?? { success: true, data: [], total: 0, filters: {} });
    },
  );

  server.registerTool(
    'get_source_post',
    {
      title: 'Get source post',
      description: 'Get one kkAuto API v2 source post by id, including API-provided details.',
      inputSchema: getSchema,
    },
    async (input: GetInput) => jsonResult(await client.get<ApiEnvelope>(`/api/v2/source-posts/${input.id}`)),
  );

  server.registerTool(
    'search_source_posts',
    {
      title: 'Search source posts',
      description: 'Search source posts by keyword through kkAuto API v2.',
      inputSchema: searchSchema,
    },
    async (input: SearchInput) => {
      const response = await client.get<ApiEnvelope>('/api/v2/source-posts/search', {
        query: { ...input, limit: limitOrDefault(input.limit, config) },
      });

      return jsonResult(response);
    },
  );

  server.registerTool(
    'list_source_posts_by_platform',
    {
      title: 'List source posts by platform',
      description: 'List source posts for one platform through kkAuto API v2.',
      inputSchema: byPlatformSchema,
    },
    async (input: ByPlatformInput) => {
      const { platform, ...query } = input;
      const response = await client.get<ApiEnvelope>(`/api/v2/source-posts/by-platform/${platform}`, {
        query: { ...query, limit: limitOrDefault(input.limit, config) },
      });

      return jsonResult(response);
    },
  );

  server.registerTool(
    'list_source_posts_by_hashtag',
    {
      title: 'List source posts by hashtag',
      description: 'List source posts for one hashtag through kkAuto API v2.',
      inputSchema: byHashtagSchema,
    },
    async (input: ByHashtagInput) => {
      const { hashtag, ...query } = input;
      const response = await client.get<ApiEnvelope>(`/api/v2/source-posts/by-hashtag/${encodeURIComponent(hashtag)}`, {
        query: { ...query, limit: limitOrDefault(input.limit, config) },
      });

      return jsonResult(response);
    },
  );

  server.registerTool(
    'get_source_post_statistics',
    {
      title: 'Get source post statistics',
      description: 'Get kkAuto API v2 aggregate statistics for source posts.',
      inputSchema: {},
    },
    async () => jsonResult(await client.get<ApiEnvelope>('/api/v2/source-posts/statistics')),
  );

  server.registerTool(
    'create_source_post',
    {
      title: 'Create source post',
      description: 'Create a source post through kkAuto API v2. Uses remote media URLs only.',
      inputSchema: createSchema,
    },
    async (input: CreateInput) => {
      const payload = pruneUndefined({
        ...input,
        source_format: input.source_format ?? 'unknown',
        workflow_status: input.workflow_status ?? input.status ?? 'pending',
        topic_type: input.topic_type ?? 'normal',
        length_type: input.length_type ?? input.post_type ?? 'short',
        hashtags: normalizeHashtags(input.hashtags),
      });
      const response = await client.post<ApiEnvelope>('/api/v2/source-posts', { body: payload });

      return jsonResult(response);
    },
  );

  server.registerTool(
    'update_source_post',
    {
      title: 'Update source post',
      description: 'Update one source post through kkAuto API v2. Fields not supplied are omitted.',
      inputSchema: updateSchema,
    },
    async (input: UpdateInput) => {
      const { id, ...fields } = input;
      const payload = pruneUndefined({
        ...fields,
        workflow_status: fields.workflow_status ?? fields.status,
        length_type: fields.length_type ?? fields.post_type,
      });

      if (Object.keys(payload).length === 0) {
        throw new Error('At least one field is required for update_source_post');
      }

      const response = await client.put<ApiEnvelope>(`/api/v2/source-posts/${id}`, { body: payload });

      return jsonResult(response);
    },
  );

  server.registerTool(
    'update_source_post_status',
    {
      title: 'Update source post status',
      description: 'Update one source post workflow status through kkAuto API v2.',
      inputSchema: statusSchema,
    },
    async (input: StatusInput) => {
      const status = input.workflow_status ?? input.status;
      if (status === undefined) {
        throw new Error('update_source_post_status requires workflow_status or status');
      }

      const response = await client.patch<ApiEnvelope>(`/api/v2/source-posts/${input.id}/status`, {
        body: pruneUndefined({ workflow_status: status, notes: input.notes }),
      });

      return jsonResult(response);
    },
  );

  server.registerTool(
    'delete_source_post',
    {
      title: 'Delete source post',
      description: 'Delete a source post through kkAuto API v2. Disabled unless KK_MCP_ENABLE_DELETE=true.',
      inputSchema: deleteSchema,
    },
    async (input: DeleteInput) => {
      if (!config.enableDelete) {
        throw new Error('delete_source_post is disabled. Set KK_MCP_ENABLE_DELETE=true to enable it.');
      }
      if (!input.confirm) {
        throw new Error('delete_source_post requires confirm=true');
      }

      const preflight = await client.get<ApiEnvelope<Record<string, unknown>>>(`/api/v2/source-posts/${input.id}`);
      const title = extractTitle(preflight);
      if (input.expected_title !== undefined && input.expected_title !== title) {
        throw new Error('expected_title did not match the current source post title; delete aborted');
      }

      const response = await client.delete<ApiEnvelope>(`/api/v2/source-posts/${input.id}`);

      return jsonResult({
        status: 'success',
        deleted_id: input.id,
        deleted_title: title,
        reason: input.reason,
        api_response: response,
      });
    },
  );
}

function jsonResult(value: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function pruneUndefined<T extends Record<string, unknown>>(value: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function limitOrDefault(value: number | undefined, config: KkAutoMcpConfig): number {
  return value ? Math.min(value, config.maxListLimit) : config.maxListLimit;
}

function normalizeHashtags(value: string | string[] | undefined): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value;
  }

  const trimmed = value.trim();
  if (trimmed === '') {
    return [];
  }

  return trimmed
    .split(/[\s,]+/)
    .map((entry) => entry.trim().replace(/^#+/, ''))
    .filter((entry) => entry !== '');
}

function extractTitle(response: ApiEnvelope<Record<string, unknown>> | null): string | undefined {
  const data = response?.data;

  return data && typeof data.title === 'string' ? data.title : undefined;
}
