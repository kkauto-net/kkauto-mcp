import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { ApiEnvelope, KkAutoMcpConfig } from '../types.js';

const positiveInt = z.number().int().positive();
const nonEmptyString = z.string().min(1);
const platformType = z.enum(['facebook', 'tiktok', 'youtube', 'pinterest', 'x', 'instagram', 'douyin', 'other']);
const sourceType = z.enum(['group', 'page', 'user', 'post', 'hashtag', 'trending', 'other']);
const crawlerStatus = z.enum(['active', 'inactive', 'paused', 'crawled', 'crawling']);
const fetchMode = z.enum(['once', 'recurring']);
const orderDirection = z.enum(['ASC', 'DESC']);
const crawlerOrderBy = z.enum([
  'id',
  'source_name',
  'source_url',
  'author_name',
  'author_url',
  'platform_type',
  'source_type',
  'crawl_interval',
  'status',
  'fetch_mode',
  'last_crawled_at',
  'next_crawled_at',
  'total_crawled',
  'created_at',
  'updated_at',
]);
const relationStatus = z.enum(['active', 'inactive']);
const accountPermission = z.enum(['viewer', 'editor', 'admin']);
const jsonRecord = z.record(z.string(), z.unknown());

const listSchema = {
  page: positiveInt.optional().describe('Page number, starting at 1.'),
  limit: positiveInt.optional().describe('Items per page. Capped by KK_MCP_MAX_LIST_LIMIT.'),
  platform_type: platformType.optional(),
  status: crawlerStatus.optional(),
  source_type: sourceType.optional(),
  fetch_mode: fetchMode.optional(),
  search: nonEmptyString.optional(),
  order_by: crawlerOrderBy.optional(),
  order_direction: orderDirection.optional(),
};

const getSchema = {
  id: positiveInt,
};

const postsSchema = {
  id: positiveInt,
  page: positiveInt.optional(),
  limit: positiveInt.optional().describe('Items per page. Capped by KK_MCP_MAX_LIST_LIMIT.'),
};

const searchSchema = {
  q: z.string().optional(),
};

const createSchema = {
  platform_type: platformType,
  source_type: sourceType,
  crawl_interval: z.number().int().min(0),
  source_name: z.string().min(3).max(255).optional(),
  source_url: z.string().url().max(1000).optional(),
  author_name: z.string().max(255).optional(),
  author_url: z.string().url().max(1000).optional(),
  status: crawlerStatus.optional(),
  fetch_mode: fetchMode.optional(),
  source_description: z.string().optional(),
  source_settings: jsonRecord.optional(),
  crawl_filters: z.union([jsonRecord, z.string()]).optional(),
  crawl_keywords: z.union([z.array(z.string().min(1)), z.string()]).optional(),
};

const updateSchema = {
  id: positiveInt,
  source_name: z.string().min(3).max(255).optional(),
  source_url: z.string().url().max(1000).optional(),
  author_name: z.string().max(255).optional(),
  author_url: z.string().url().max(1000).optional(),
  platform_type: platformType.optional(),
  source_type: sourceType.optional(),
  crawl_interval: z.number().int().min(0).optional(),
  status: crawlerStatus.optional(),
  fetch_mode: fetchMode.optional(),
  source_description: z.string().optional(),
  source_settings: jsonRecord.optional(),
  crawl_filters: z.union([jsonRecord, z.string()]).optional(),
  crawl_keywords: z.union([z.array(z.string().min(1)), z.string()]).optional(),
};

const hashtagSchema = {
  id: positiveInt,
  hashtag_id: positiveInt,
  priority: z.number().int().min(1).max(10).optional(),
  status: relationStatus.optional(),
};

const hashtagPrioritySchema = {
  id: positiveInt,
  hashtag_id: positiveInt,
  priority: z.number().int().min(1).max(10),
};

const accountSchema = {
  id: positiveInt,
  account_id: positiveInt,
  permission: accountPermission.optional(),
  status: relationStatus.optional(),
};

const bulkAccountSchema = {
  id: positiveInt,
  account_ids: z.array(positiveInt).min(1).max(100),
  permission: accountPermission.optional(),
  status: relationStatus.optional(),
  confirm: z.boolean().describe('Must be true because this can link many accounts.'),
};

const removeHashtagSchema = {
  id: positiveInt,
  hashtag_id: positiveInt,
  confirm: z.boolean().describe('Must be true to remove a crawler hashtag relation.'),
  reason: nonEmptyString,
};

const removeAccountSchema = {
  id: positiveInt,
  account_id: positiveInt,
  confirm: z.boolean().describe('Must be true to remove a crawler account relation.'),
  reason: nonEmptyString,
};

const deleteSchema = {
  id: positiveInt,
  confirm: z.boolean().describe('Must be true for deletion.'),
  reason: nonEmptyString.describe('Human-readable reason for audit context.'),
  expected_name: nonEmptyString.optional().describe('Optional source_name guard checked before delete.'),
};

type ListInput = z.infer<z.ZodObject<typeof listSchema>>;
type GetInput = z.infer<z.ZodObject<typeof getSchema>>;
type PostsInput = z.infer<z.ZodObject<typeof postsSchema>>;
type SearchInput = z.infer<z.ZodObject<typeof searchSchema>>;
type CreateInput = z.infer<z.ZodObject<typeof createSchema>>;
type UpdateInput = z.infer<z.ZodObject<typeof updateSchema>>;
type HashtagInput = z.infer<z.ZodObject<typeof hashtagSchema>>;
type HashtagPriorityInput = z.infer<z.ZodObject<typeof hashtagPrioritySchema>>;
type AccountInput = z.infer<z.ZodObject<typeof accountSchema>>;
type BulkAccountInput = z.infer<z.ZodObject<typeof bulkAccountSchema>>;
type RemoveHashtagInput = z.infer<z.ZodObject<typeof removeHashtagSchema>>;
type RemoveAccountInput = z.infer<z.ZodObject<typeof removeAccountSchema>>;
type DeleteInput = z.infer<z.ZodObject<typeof deleteSchema>>;

export function registerSourceCrawlerTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  server.registerTool(
    'list_source_crawlers',
    {
      title: 'List source crawlers',
      description: 'List kkAuto API v2 source crawlers with filters and page pagination.',
      inputSchema: listSchema,
    },
    async (input: ListInput) => {
      const response = await client.get<ApiEnvelope>('/api/v2/source-crawlers', {
        query: { ...input, limit: limitOrDefault(input.limit, config) },
      });

      return jsonResult(response ?? { status: 'success', data: [], pagination: null });
    },
  );

  server.registerTool(
    'get_source_crawler',
    {
      title: 'Get source crawler',
      description: 'Get one source crawler by id, including info, hashtag, and account relations.',
      inputSchema: getSchema,
    },
    async (input: GetInput) => jsonResult(await client.get<ApiEnvelope>(`/api/v2/source-crawlers/${input.id}`)),
  );

  server.registerTool(
    'list_source_crawler_posts',
    {
      title: 'List source crawler posts',
      description: 'List source posts attached to one source crawler through kkAuto API v2.',
      inputSchema: postsSchema,
    },
    async (input: PostsInput) => {
      const response = await client.get<ApiEnvelope>(`/api/v2/source-crawlers/${input.id}/posts`, {
        query: { page: input.page, limit: limitOrDefault(input.limit, config) },
      });

      return jsonResult(response);
    },
  );

  server.registerTool(
    'search_source_crawler_hashtags',
    {
      title: 'Search source crawler hashtags',
      description: 'Search hashtag options for source crawler relations.',
      inputSchema: searchSchema,
    },
    async (input: SearchInput) => jsonResult(await client.get<ApiEnvelope>('/api/v2/source-crawlers/search/hashtags', { query: input })),
  );

  server.registerTool(
    'search_source_crawler_accounts',
    {
      title: 'Search source crawler accounts',
      description: 'Search active FB account options for source crawler relations.',
      inputSchema: searchSchema,
    },
    async (input: SearchInput) => jsonResult(await client.get<ApiEnvelope>('/api/v2/source-crawlers/search/accounts', { query: input })),
  );

  server.registerTool(
    'create_source_crawler',
    {
      title: 'Create source crawler',
      description: 'Create a source crawler through kkAuto API v2.',
      inputSchema: createSchema,
    },
    async (input: CreateInput) => {
      const response = await client.post<ApiEnvelope>('/api/v2/source-crawlers', {
        body: pruneUndefined({ ...input, status: input.status ?? 'paused', fetch_mode: input.fetch_mode ?? 'once' }),
      });

      return jsonResult(response);
    },
  );

  server.registerTool(
    'update_source_crawler',
    {
      title: 'Update source crawler',
      description: 'Update one source crawler through kkAuto API v2. Fields not supplied are omitted.',
      inputSchema: updateSchema,
    },
    async (input: UpdateInput) => {
      const { id, ...fields } = input;
      const payload = pruneUndefined(fields);
      if (Object.keys(payload).length === 0) {
        throw new Error('At least one field is required for update_source_crawler');
      }

      return jsonResult(await client.put<ApiEnvelope>(`/api/v2/source-crawlers/${id}`, { body: payload }));
    },
  );

  server.registerTool(
    'pause_source_crawler',
    {
      title: 'Pause source crawler',
      description: 'Pause one source crawler through kkAuto API v2.',
      inputSchema: getSchema,
    },
    async (input: GetInput) => jsonResult(await client.patch<ApiEnvelope>(`/api/v2/source-crawlers/${input.id}/pause`)),
  );

  server.registerTool(
    'resume_source_crawler',
    {
      title: 'Resume source crawler',
      description: 'Resume one source crawler through kkAuto API v2. Backend requires linked accounts.',
      inputSchema: getSchema,
    },
    async (input: GetInput) => jsonResult(await client.patch<ApiEnvelope>(`/api/v2/source-crawlers/${input.id}/resume`)),
  );

  server.registerTool(
    'list_source_crawler_hashtags',
    {
      title: 'List source crawler hashtags',
      description: 'List hashtag relations for one source crawler.',
      inputSchema: getSchema,
    },
    async (input: GetInput) => jsonResult(await client.get<ApiEnvelope>(`/api/v2/source-crawlers/${input.id}/hashtags`)),
  );

  server.registerTool(
    'add_source_crawler_hashtag',
    {
      title: 'Add source crawler hashtag',
      description: 'Add a hashtag relation to one source crawler.',
      inputSchema: hashtagSchema,
    },
    async (input: HashtagInput) => {
      const { id, ...body } = input;

      return jsonResult(await client.post<ApiEnvelope>(`/api/v2/source-crawlers/${id}/hashtags`, { body: pruneUndefined(body) }));
    },
  );

  server.registerTool(
    'update_source_crawler_hashtag_priority',
    {
      title: 'Update source crawler hashtag priority',
      description: 'Update a source crawler hashtag relation priority, from 1 to 10.',
      inputSchema: hashtagPrioritySchema,
    },
    async (input: HashtagPriorityInput) => {
      const response = await client.patch<ApiEnvelope>(`/api/v2/source-crawlers/${input.id}/hashtags/${input.hashtag_id}/priority`, {
        body: { priority: input.priority },
      });

      return jsonResult(response);
    },
  );

  server.registerTool(
    'remove_source_crawler_hashtag',
    {
      title: 'Remove source crawler hashtag',
      description: 'Remove a hashtag relation from one source crawler. Disabled unless KK_MCP_ENABLE_DELETE=true.',
      inputSchema: removeHashtagSchema,
    },
    async (input: RemoveHashtagInput) => {
      requireDeleteEnabled(config, 'remove_source_crawler_hashtag');
      requireConfirm(input.confirm, 'remove_source_crawler_hashtag');
      const preflight = await client.get<ApiEnvelope<{ crawler?: Record<string, unknown> }>>(`/api/v2/source-crawlers/${input.id}`);
      const response = await client.delete<ApiEnvelope>(`/api/v2/source-crawlers/${input.id}/hashtags/${input.hashtag_id}`);

      return jsonResult({
        status: 'success',
        source_crawler_id: input.id,
        source_name: extractSourceName(preflight),
        hashtag_id: input.hashtag_id,
        reason: input.reason,
        api_response: response,
      });
    },
  );

  server.registerTool(
    'list_source_crawler_accounts',
    {
      title: 'List source crawler accounts',
      description: 'List account relations for one source crawler.',
      inputSchema: getSchema,
    },
    async (input: GetInput) => jsonResult(await client.get<ApiEnvelope>(`/api/v2/source-crawlers/${input.id}/accounts`)),
  );

  server.registerTool(
    'add_source_crawler_account',
    {
      title: 'Add source crawler account',
      description: 'Add one account relation to a source crawler.',
      inputSchema: accountSchema,
    },
    async (input: AccountInput) => {
      const { id, ...body } = input;

      return jsonResult(await client.post<ApiEnvelope>(`/api/v2/source-crawlers/${id}/accounts`, { body: pruneUndefined(body) }));
    },
  );

  server.registerTool(
    'add_source_crawler_accounts_bulk',
    {
      title: 'Add source crawler accounts bulk',
      description: 'Add up to 100 account relations to one source crawler. Requires confirm=true.',
      inputSchema: bulkAccountSchema,
    },
    async (input: BulkAccountInput) => {
      if (!input.confirm) {
        throw new Error('add_source_crawler_accounts_bulk requires confirm=true');
      }

      const { id, confirm: _confirm, ...body } = input;

      return jsonResult(await client.post<ApiEnvelope>(`/api/v2/source-crawlers/${id}/accounts/bulk`, { body: pruneUndefined(body) }));
    },
  );

  server.registerTool(
    'remove_source_crawler_account',
    {
      title: 'Remove source crawler account',
      description: 'Remove an account relation from one source crawler. Disabled unless KK_MCP_ENABLE_DELETE=true.',
      inputSchema: removeAccountSchema,
    },
    async (input: RemoveAccountInput) => {
      requireDeleteEnabled(config, 'remove_source_crawler_account');
      requireConfirm(input.confirm, 'remove_source_crawler_account');
      const preflight = await client.get<ApiEnvelope<{ crawler?: Record<string, unknown> }>>(`/api/v2/source-crawlers/${input.id}`);
      const response = await client.delete<ApiEnvelope>(`/api/v2/source-crawlers/${input.id}/accounts/${input.account_id}`);

      return jsonResult({
        status: 'success',
        source_crawler_id: input.id,
        source_name: extractSourceName(preflight),
        account_id: input.account_id,
        reason: input.reason,
        api_response: response,
      });
    },
  );

  server.registerTool(
    'delete_source_crawler',
    {
      title: 'Delete source crawler',
      description: 'Delete a source crawler and its relations through kkAuto API v2. Disabled unless KK_MCP_ENABLE_DELETE=true.',
      inputSchema: deleteSchema,
    },
    async (input: DeleteInput) => {
      requireDeleteEnabled(config, 'delete_source_crawler');
      requireConfirm(input.confirm, 'delete_source_crawler');
      const preflight = await client.get<ApiEnvelope<{ crawler?: Record<string, unknown> }>>(`/api/v2/source-crawlers/${input.id}`);
      const sourceName = extractSourceName(preflight);
      if (input.expected_name !== undefined && input.expected_name !== sourceName) {
        throw new Error('expected_name did not match the current source crawler name; delete aborted');
      }

      const response = await client.delete<ApiEnvelope>(`/api/v2/source-crawlers/${input.id}`);

      return jsonResult({
        status: 'success',
        deleted_id: input.id,
        deleted_name: sourceName,
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

function requireDeleteEnabled(config: KkAutoMcpConfig, toolName: string): void {
  if (!config.enableDelete) {
    throw new Error(`${toolName} is disabled. Set KK_MCP_ENABLE_DELETE=true to enable it.`);
  }
}

function requireConfirm(confirmed: boolean, toolName: string): void {
  if (!confirmed) {
    throw new Error(`${toolName} requires confirm=true`);
  }
}

function extractSourceName(response: ApiEnvelope<{ crawler?: Record<string, unknown> }> | null): string | undefined {
  const crawler = response?.data?.crawler;

  return crawler && typeof crawler.source_name === 'string' ? crawler.source_name : undefined;
}
