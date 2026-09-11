import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { ApiEnvelope, KkAutoMcpConfig } from '../types.js';
import { appliedLimit, guardedDelete, jsonResult, pruneUndefined } from './shared.js';

const positiveInt = z.number().int().positive();
const fanpageStatus = z.enum(['active', 'inactive']);

const writableFields = {
  fanpage_name: z.string().min(3).describe('Fanpage name, min length 3.'),
  fanpage_link: z.string().min(1).describe('Slug or Facebook URL; normalized to a slug by the API.'),
  fanpage_uid: z.string().optional().describe('Facebook Page ID. Nullable.'),
  status: fanpageStatus.optional().describe('Defaults to active.'),
  fb_role: z.string().optional(),
  total_likes: z.number().int().min(0).optional().describe('Defaults to 0.'),
  assistant_ids: z.array(positiveInt).optional(),
  fanpage_introduction: z.string().optional(),
  fanpage_category: z.string().optional(),
  fanpage_location: z.string().optional(),
  fanpage_website: z.string().optional(),
  fanpage_email: z.string().optional(),
  fanpage_phone: z.string().optional(),
  ai_instruction: z.string().optional(),
  fanpage_cover_prompt: z.string().optional(),
  fanpage_avatar_prompt: z.string().optional(),
  account_ids: z.array(positiveInt).optional().describe('Linked FB account ids; presence replaces the relation set.'),
  hashtags: z.array(positiveInt).optional().describe('Hashtag ids; presence replaces the relation set.'),
  tag_ids: z.array(positiveInt).optional().describe('Tag ids; presence replaces the relation set.'),
};

const listSchema = {
  page: positiveInt.optional(),
  limit: positiveInt.optional().describe('Items per page. Capped by KK_MCP_MAX_LIST_LIMIT and the API limit of 1000.'),
  status: fanpageStatus.optional(),
  search: z.string().optional(),
  search_field: z.enum(['all', 'fanpage_name', 'fanpage_link', 'fanpage_uid']).optional().describe('Default is all.'),
  missing_uid: z.union([z.literal(0), z.literal(1)]).optional().describe('1 returns only fanpages with an empty UID.'),
  account_id: positiveInt.optional().describe('Filter by linked FB account id.'),
};

const searchSchema = {
  q: z.string().min(1).optional().describe('Text search over fanpage name, link, and UID. Use either q or type+value.'),
  type: z.enum(['id', 'fanpage_uid', 'fanpage_link']).optional().describe('Exact lookup type. Required with value when q is omitted.'),
  value: z.string().min(1).optional().describe('Exact lookup value. Required with type when q is omitted.'),
  page: positiveInt.optional(),
  limit: positiveInt.optional().describe('Items per page. Capped by KK_MCP_MAX_LIST_LIMIT and the API limit of 1000.'),
};

const missingUidSchema = {
  page: positiveInt.optional(),
  limit: positiveInt.optional().describe('Items per page. Capped by KK_MCP_MAX_LIST_LIMIT and the API limit of 1000.'),
  status: fanpageStatus.optional(),
  search: z.string().optional(),
};

const getSchema = {
  id: positiveInt,
};

const createSchema = {
  ...writableFields,
  fanpage_name: writableFields.fanpage_name,
  fanpage_link: writableFields.fanpage_link,
};

const updateSchema = {
  id: positiveInt,
  fanpage_name: writableFields.fanpage_name.optional(),
  fanpage_link: writableFields.fanpage_link.optional(),
  fanpage_uid: writableFields.fanpage_uid,
  status: writableFields.status,
  fb_role: writableFields.fb_role,
  total_likes: writableFields.total_likes,
  assistant_ids: writableFields.assistant_ids,
  fanpage_introduction: writableFields.fanpage_introduction,
  fanpage_category: writableFields.fanpage_category,
  fanpage_location: writableFields.fanpage_location,
  fanpage_website: writableFields.fanpage_website,
  fanpage_email: writableFields.fanpage_email,
  fanpage_phone: writableFields.fanpage_phone,
  ai_instruction: writableFields.ai_instruction,
  fanpage_cover_prompt: writableFields.fanpage_cover_prompt,
  fanpage_avatar_prompt: writableFields.fanpage_avatar_prompt,
  account_ids: writableFields.account_ids,
  hashtags: writableFields.hashtags,
  tag_ids: writableFields.tag_ids,
};

const deleteSchema = {
  id: positiveInt,
  confirm: z.boolean().describe('Must be true for deletion.'),
  reason: z.string().min(1).describe('Human-readable reason for audit context.'),
  expected_name: z.string().min(1).optional().describe('Optional fanpage_name guard checked before delete.'),
};

type ListInput = z.infer<z.ZodObject<typeof listSchema>>;
type SearchInput = z.infer<z.ZodObject<typeof searchSchema>>;
type MissingUidInput = z.infer<z.ZodObject<typeof missingUidSchema>>;
type GetInput = z.infer<z.ZodObject<typeof getSchema>>;
type CreateInput = z.infer<z.ZodObject<typeof createSchema>>;
type UpdateInput = z.infer<z.ZodObject<typeof updateSchema>>;
type DeleteInput = z.infer<z.ZodObject<typeof deleteSchema>>;

export function registerFbFanpageTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  server.registerTool(
    'list_fb_fanpages',
    {
      title: 'List FB fanpages',
      description: 'List kkAuto API v2 FB fanpages with optional filters.',
      inputSchema: listSchema,
    },
    async (input: ListInput) => {
      const response = await client.get<ApiEnvelope>('/api/v2/fb-fanpages', {
        query: { ...input, limit: appliedLimit(input.limit, config) },
      });

      return jsonResult(response ?? { status: 'success', data: [], pagination: null });
    },
  );

  server.registerTool(
    'search_fb_fanpages',
    {
      title: 'Search FB fanpages',
      description: 'Search kkAuto API v2 FB fanpages by text, or fetch one fanpage by exact lookup type and value.',
      inputSchema: searchSchema,
    },
    async (input: SearchInput) => {
      const hasQuery = input.q !== undefined;
      const hasLookup = input.type !== undefined && input.value !== undefined;

      if (!hasQuery && !hasLookup) {
        throw new Error('search_fb_fanpages requires either q or both type and value');
      }

      if (hasQuery && (input.type !== undefined || input.value !== undefined)) {
        throw new Error('search_fb_fanpages accepts either q or type+value, not both');
      }

      const response = await client.get<ApiEnvelope>('/api/v2/fb-fanpages/search', {
        query: { ...input, limit: appliedLimit(input.limit, config) },
      });

      return jsonResult(response);
    },
  );

  server.registerTool(
    'list_fb_fanpages_missing_uid',
    {
      title: 'List FB fanpages missing UID',
      description: 'List kkAuto API v2 FB fanpages that do not have a Facebook Page UID yet.',
      inputSchema: missingUidSchema,
    },
    async (input: MissingUidInput) => {
      const response = await client.get<ApiEnvelope>('/api/v2/fb-fanpages/missing-uid', {
        query: { ...input, limit: appliedLimit(input.limit, config) },
      });

      return jsonResult(response ?? { status: 'success', data: [], pagination: null });
    },
  );

  server.registerTool(
    'get_fb_fanpage',
    {
      title: 'Get FB fanpage',
      description: 'Get one kkAuto API v2 FB fanpage by id.',
      inputSchema: getSchema,
    },
    async (input: GetInput) => {
      const response = await client.get<ApiEnvelope>(`/api/v2/fb-fanpages/${input.id}`);

      return jsonResult(response);
    },
  );

  server.registerTool(
    'create_fb_fanpage',
    {
      title: 'Create FB fanpage',
      description: 'Create one kkAuto API v2 FB fanpage with optional info fields and account/hashtag/tag relations.',
      inputSchema: createSchema,
    },
    async (input: CreateInput) => {
      const response = await client.post<ApiEnvelope>('/api/v2/fb-fanpages', { body: pruneUndefined(input) });

      return jsonResult(response);
    },
  );

  server.registerTool(
    'update_fb_fanpage',
    {
      title: 'Update FB fanpage',
      description:
        'Partial update of one kkAuto API v2 FB fanpage. Only supplied fields change; relation fields replace their sets when present.',
      inputSchema: updateSchema,
    },
    async (input: UpdateInput) => {
      const { id, ...fields } = input;
      const payload = pruneUndefined(fields);

      if (Object.keys(payload).length === 0) {
        throw new Error('At least one field is required for update_fb_fanpage');
      }

      const response = await client.put<ApiEnvelope>(`/api/v2/fb-fanpages/${id}`, { body: payload });

      return jsonResult(response);
    },
  );

  server.registerTool(
    'delete_fb_fanpage',
    {
      title: 'Delete FB fanpage',
      description: 'Delete one kkAuto API v2 FB fanpage. Disabled unless KK_MCP_ENABLE_DELETE=true.',
      inputSchema: deleteSchema,
    },
    async (input: DeleteInput) =>
      guardedDelete({
        client,
        config,
        toolName: 'delete_fb_fanpage',
        id: input.id,
        getPath: `/api/v2/fb-fanpages/${input.id}`,
        deletePath: `/api/v2/fb-fanpages/${input.id}`,
        input,
        extractName: (data) => (typeof data.fanpage_name === 'string' ? data.fanpage_name : undefined),
      }),
  );
}