import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { ApiEnvelope, KkAutoMcpConfig } from '../types.js';
import { buildPostFormData } from './media-form-data.js';

const positiveInt = z.number().int().positive();
const binaryFlag = z.union([z.literal(0), z.literal(1)]);
const postType = z.enum(['product', 'interaction']);
const mediaType = z.enum(['video', 'image']);
const postTo = z.enum(['group', 'fanpage', 'profile', 'all']);
const scopeType = z.enum(['account', 'fanpage']);
const scheduleEntry = z.object({
  comment: z.string().min(1),
  delay: z.number().min(0),
});
const schedulePayload = z.union([z.array(scheduleEntry), z.record(z.string(), scheduleEntry)]);

const listSchema = {
  page: positiveInt.optional().describe('Page number, starting at 1.'),
  limit: positiveInt.optional().describe('Items per page. Capped by KK_MCP_MAX_LIST_LIMIT.'),
  status: binaryFlag.optional().describe('Filter by post status: 0 draft, 1 active/posted.'),
  post_type: postType.optional(),
  hashtags: z.string().optional().describe('Hashtag filter passed through to the kkAuto API.'),
};

const createSchema = {
  title: z.string().min(1),
  content: z.string().min(1),
  post_type: postType,
  media_type: mediaType,
  post_to: postTo,
  assistant_id: positiveInt.optional().describe('Defaults to 1.'),
  status: binaryFlag.optional().describe('Defaults to KK_MCP_DEFAULT_STATUS.'),
  file_download: binaryFlag.optional().describe('Defaults to 0. Leave 0 to keep media URLs as URLs.'),
  media: z.array(z.string().url()).max(15).optional().describe('Remote media URLs. Use media_files for direct local image uploads.'),
  media_files: z.array(z.string().min(1)).optional().describe('Local image file paths on the MCP client machine for direct multipart upload.'),
  hashtags: z.union([z.string(), z.array(z.string().min(1))]).optional(),
  comments: schedulePayload.optional(),
  seeding: schedulePayload.optional(),
  scope_type: scopeType.optional(),
  scope_id: positiveInt.optional(),
};

const updateSchema = {
  id: positiveInt,
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  post_type: postType.optional(),
  media_type: mediaType.optional(),
  post_to: postTo.optional(),
  assistant_id: positiveInt.optional(),
  status: binaryFlag.optional(),
  file_download: binaryFlag.optional(),
  media: z.array(z.string().url()).max(15).optional().describe('Remote media URLs. Only send this when media should be replaced.'),
  media_files: z.array(z.string().min(1)).optional().describe('Local image file paths on the MCP client machine for direct replacement upload.'),
  hashtags: z.union([z.string(), z.array(z.string().min(1))]).optional(),
  comments: schedulePayload.optional(),
  seeding: schedulePayload.optional(),
  scope_type: scopeType.optional(),
  scope_id: positiveInt.optional(),
};

const getSchema = {
  id: positiveInt,
};

const deleteSchema = {
  id: positiveInt,
  confirm: z.boolean().describe('Must be true for deletion.'),
  reason: z.string().min(1).describe('Human-readable reason for audit context.'),
  expected_title: z.string().min(1).optional().describe('Optional title guard checked before delete.'),
};

type ListInput = z.infer<z.ZodObject<typeof listSchema>>;
type CreateInput = z.infer<z.ZodObject<typeof createSchema>>;
type UpdateInput = z.infer<z.ZodObject<typeof updateSchema>>;
type GetInput = z.infer<z.ZodObject<typeof getSchema>>;
type DeleteInput = z.infer<z.ZodObject<typeof deleteSchema>>;

export function registerFbPostTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  server.registerTool(
    'list_fb_posts',
    {
      title: 'List FB posts',
      description: 'List kkAuto API v2 FB posts. Does not expose the random endpoint.',
      inputSchema: listSchema,
    },
    async (input: ListInput) => {
      const limit = input.limit ? Math.min(input.limit, config.maxListLimit) : config.maxListLimit;
      const response = await client.get<ApiEnvelope>('/api/v2/fb-posts', {
        query: { ...input, limit },
      });

      return jsonResult(response ?? { status: 'success', data: [], pagination: null });
    },
  );

  server.registerTool(
    'get_fb_post',
    {
      title: 'Get FB post',
      description: 'Get one kkAuto API v2 FB post by id.',
      inputSchema: getSchema,
    },
    async (input: GetInput) => {
      const response = await client.get<ApiEnvelope>(`/api/v2/fb-posts/${input.id}`);

      return jsonResult(response);
    },
  );

  server.registerTool(
    'create_fb_post',
    {
      title: 'Create FB post',
      description: 'Create an FB post through kkAuto API v2 using JSON fields, remote media URLs, or local media_files uploads.',
      inputSchema: createSchema,
    },
    async (input: CreateInput) => {
      const { media_files: mediaFiles, ...fields } = input;
      const payload = pruneUndefined({
        ...fields,
        assistant_id: input.assistant_id ?? 1,
        status: input.status ?? config.defaultStatus,
        file_download: input.file_download ?? 0,
        media: input.media ?? [],
        hashtags: normalizeHashtags(input.hashtags),
      });
      const response = mediaFiles?.length
        ? await client.post<ApiEnvelope>('/api/v2/fb-posts', { formData: await buildPostFormData(payload, mediaFiles) })
        : await client.post<ApiEnvelope>('/api/v2/fb-posts', { body: payload });

      return jsonResult(response);
    },
  );

  server.registerTool(
    'update_fb_post',
    {
      title: 'Update FB post',
      description: 'Update an FB post through kkAuto API v2. Fields not supplied are omitted from the MCP payload.',
      inputSchema: updateSchema,
    },
    async (input: UpdateInput) => {
      const { id, media_files: mediaFiles, ...fields } = input;
      const payload = pruneUndefined({
        ...fields,
        hashtags: normalizeHashtags(fields.hashtags),
      });

      if (Object.keys(payload).length === 0 && !mediaFiles?.length) {
        throw new Error('At least one field is required for update_fb_post');
      }

      const response = mediaFiles?.length
        ? await client.post<ApiEnvelope>(`/api/v2/fb-posts/${id}`, { formData: await buildPostFormData(payload, mediaFiles) })
        : await client.put<ApiEnvelope>(`/api/v2/fb-posts/${id}`, { body: payload });

      return jsonResult(response);
    },
  );

  server.registerTool(
    'delete_fb_post',
    {
      title: 'Delete FB post',
      description: 'Delete an FB post through kkAuto API v2. Disabled unless KK_MCP_ENABLE_DELETE=true.',
      inputSchema: deleteSchema,
    },
    async (input: DeleteInput) => {
      if (!config.enableDelete) {
        throw new Error('delete_fb_post is disabled. Set KK_MCP_ENABLE_DELETE=true to enable it.');
      }

      if (!input.confirm) {
        throw new Error('delete_fb_post requires confirm=true');
      }

      const preflight = await client.get<ApiEnvelope<Record<string, unknown>>>(`/api/v2/fb-posts/${input.id}`);
      const title = extractPostTitle(preflight);

      if (input.expected_title !== undefined && input.expected_title !== title) {
        throw new Error('expected_title did not match the current post title; delete aborted');
      }

      const response = await client.delete<ApiEnvelope>(`/api/v2/fb-posts/${input.id}`);

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

  try {
    const decoded = JSON.parse(trimmed) as unknown;
    if (Array.isArray(decoded)) {
      return decoded.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '');
    }
  } catch {
    // Fall through to natural-language splitting below.
  }

  return trimmed
    .split(/[\s,]+/)
    .map((entry) => entry.trim().replace(/^#+/, ''))
    .filter((entry) => entry !== '');
}

function extractPostTitle(response: ApiEnvelope<Record<string, unknown>> | null): string | undefined {
  const data = response?.data;

  return data && typeof data.title === 'string' ? data.title : undefined;
}
