import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { ApiEnvelope, KkAutoMcpConfig } from '../types.js';
import { appliedLimit, guardedDelete, jsonResult, pruneUndefined } from './shared.js';

const positiveInt = z.number().int().positive();
const binaryFlag = z.union([z.literal(0), z.literal(1)]);

const listSchema = {
  page: positiveInt.optional(),
  limit: positiveInt.optional().describe('Items per page. Capped by KK_MCP_MAX_LIST_LIMIT and the API limit of 1000.'),
  u_active: binaryFlag.optional(),
  u_status: z.string().optional(),
  fb_level: z.number().int().min(0).max(4).optional(),
  fb_type: z.string().optional(),
  cat_id: positiveInt.optional(),
  u_live: binaryFlag.optional(),
  f_block: binaryFlag.optional(),
  search: z.string().optional(),
  search_field: z.enum(['all', 'u_name', 'u_mail', 'u_uid', 'tag']).optional().describe('Default is all.'),
};

const getSchema = {
  id: positiveInt,
};

const lookupSchema = {
  type: z.enum(['u_id', 'u_uid', 'u_mail']),
  value: z.string().min(1),
};

const byTagSchema = {
  tag: z.string().min(1).describe('Tag name filter.'),
  page: positiveInt.optional(),
  limit: positiveInt.optional().describe('Items per page. Capped by KK_MCP_MAX_LIST_LIMIT and the API limit of 1000.'),
};

const byCategorySchema = {
  category_id: positiveInt,
  page: positiveInt.optional(),
  limit: positiveInt.optional().describe('Items per page. Capped by KK_MCP_MAX_LIST_LIMIT and the API limit of 1000.'),
};

const createSchema = {
  u_mail: z.string().min(1).describe('Account email. Checked for duplicates by the API.'),
  u_pass: z.string().min(1).describe('Account password. Stored by the API; never returned by API responses.'),
  u_name: z.string().optional(),
  u_uid: z.string().optional().describe('Facebook UID. Checked for duplicates by the API.'),
  u_active: binaryFlag.optional().describe('Defaults to 1.'),
  u_status: z.string().optional().describe('Defaults to new.'),
  fb_level: z.number().int().min(0).max(4).optional().describe('Defaults to 0.'),
  fb_type: z.string().optional().describe('Defaults to add.'),
  cat_id: positiveInt.optional(),
  u_language: z.string().optional().describe('Defaults to EN.'),
  security: z.record(z.string(), z.unknown()).optional().describe('Nested fb_account_security fields.'),
  social: z.record(z.string(), z.unknown()).optional().describe('Nested fb_account_social fields.'),
  activity: z.record(z.string(), z.unknown()).optional().describe('Nested fb_account_activity fields.'),
};

const updateSchema = {
  id: positiveInt,
  u_name: z.string().optional(),
  u_uid: z.string().optional(),
  u_mail: z.string().optional(),
  cat_id: positiveInt.optional(),
  u_pass: z.string().optional(),
  u_proxy: z.string().optional(),
  u_type: z.string().optional(),
  u_active: binaryFlag.optional(),
  u_fullname: z.string().optional(),
  u_status: z.string().optional(),
  u_live: binaryFlag.optional(),
  u_note: z.string().optional(),
  u_language: z.string().optional(),
  f_block: binaryFlag.optional(),
  f_login: binaryFlag.optional(),
  fb_level: z.number().int().min(0).max(4).optional(),
  fb_type: z.string().optional(),
  security: z.record(z.string(), z.unknown()).optional().describe('Nested fb_account_security fields; replaces that section.'),
  social: z.record(z.string(), z.unknown()).optional().describe('Nested fb_account_social fields; replaces that section.'),
  activity: z.record(z.string(), z.unknown()).optional().describe('Nested fb_account_activity fields; replaces that section.'),
};

const statusSchema = {
  id: positiveInt,
  u_status: z.string().min(1).describe('New account status value.'),
};

const deleteSchema = {
  id: positiveInt,
  confirm: z.boolean().describe('Must be true for deletion.'),
  reason: z.string().min(1).describe('Human-readable reason for audit context.'),
  expected_name: z.string().min(1).optional().describe('Optional u_name guard checked before delete.'),
};

type ListInput = z.infer<z.ZodObject<typeof listSchema>>;
type GetInput = z.infer<z.ZodObject<typeof getSchema>>;
type LookupInput = z.infer<z.ZodObject<typeof lookupSchema>>;
type ByTagInput = z.infer<z.ZodObject<typeof byTagSchema>>;
type ByCategoryInput = z.infer<z.ZodObject<typeof byCategorySchema>>;
type CreateInput = z.infer<z.ZodObject<typeof createSchema>>;
type UpdateInput = z.infer<z.ZodObject<typeof updateSchema>>;
type StatusInput = z.infer<z.ZodObject<typeof statusSchema>>;
type DeleteInput = z.infer<z.ZodObject<typeof deleteSchema>>;

export function registerFbAccountTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  server.registerTool(
    'list_fb_accounts',
    {
      title: 'List FB accounts',
      description: 'List kkAuto API v2 FB accounts with optional filters.',
      inputSchema: listSchema,
    },
    async (input: ListInput) => {
      const response = await client.get<ApiEnvelope>('/api/v2/fb-accounts', {
        query: { ...input, limit: appliedLimit(input.limit, config) },
      });

      return jsonResult(response ?? { status: 'success', data: [], pagination: null });
    },
  );

  server.registerTool(
    'get_fb_account',
    {
      title: 'Get FB account',
      description: 'Get one kkAuto API v2 FB account by id. API responses omit credential-bearing fields.',
      inputSchema: getSchema,
    },
    async (input: GetInput) => {
      const response = await client.get<ApiEnvelope>(`/api/v2/fb-accounts/${input.id}`);

      return jsonResult(response);
    },
  );

  server.registerTool(
    'search_fb_accounts',
    {
      title: 'Search FB account',
      description: 'Single-record kkAuto API v2 FB account lookup by type u_id, u_uid, or u_mail.',
      inputSchema: lookupSchema,
    },
    async (input: LookupInput) => {
      const response = await client.get<ApiEnvelope>('/api/v2/fb-accounts/search', { query: input });

      return jsonResult(response);
    },
  );

  server.registerTool(
    'search_fb_accounts_by_tag',
    {
      title: 'Search FB accounts by tag',
      description: 'List kkAuto API v2 FB accounts that have a matching tag name.',
      inputSchema: byTagSchema,
    },
    async (input: ByTagInput) => {
      const response = await client.get<ApiEnvelope>('/api/v2/fb-accounts/search-by-tag', {
        query: { tag: input.tag, page: input.page, limit: appliedLimit(input.limit, config) },
      });

      return jsonResult(response);
    },
  );

  server.registerTool(
    'search_fb_accounts_by_category',
    {
      title: 'Search FB accounts by category',
      description: 'List kkAuto API v2 FB accounts that belong to one category id.',
      inputSchema: byCategorySchema,
    },
    async (input: ByCategoryInput) => {
      const response = await client.get<ApiEnvelope>('/api/v2/fb-accounts/search-by-category', {
        query: { category_id: input.category_id, page: input.page, limit: appliedLimit(input.limit, config) },
      });

      return jsonResult(response);
    },
  );

  server.registerTool(
    'get_fb_account_stats',
    {
      title: 'Get FB account stats',
      description: 'Fetch kkAuto API v2 FB account aggregate statistics for the current tenant.',
      inputSchema: {},
    },
    async () => {
      const response = await client.get<ApiEnvelope>('/api/v2/fb-accounts/stats');

      return jsonResult(response);
    },
  );

  server.registerTool(
    'create_fb_account',
    {
      title: 'Create FB account',
      description:
        'Create one kkAuto API v2 FB account. Accepts account credentials; the API enforces license limits and duplicate checks.',
      inputSchema: createSchema,
    },
    async (input: CreateInput) => {
      const response = await client.post<ApiEnvelope>('/api/v2/fb-accounts', { body: pruneUndefined(input) });

      return jsonResult(response);
    },
  );

  server.registerTool(
    'update_fb_account',
    {
      title: 'Update FB account',
      description:
        'Update one kkAuto API v2 FB account. Direct core fields and nested security/social/activity sections are accepted; fields not supplied are omitted.',
      inputSchema: updateSchema,
    },
    async (input: UpdateInput) => {
      const { id, ...fields } = input;
      const payload = pruneUndefined(fields);

      if (Object.keys(payload).length === 0) {
        throw new Error('At least one field is required for update_fb_account');
      }

      const response = await client.put<ApiEnvelope>(`/api/v2/fb-accounts/${id}`, { body: payload });

      return jsonResult(response);
    },
  );

  server.registerTool(
    'update_fb_account_status',
    {
      title: 'Update FB account status',
      description: 'Update the status of one kkAuto API v2 FB account through the status service. Transition is logged by the API.',
      inputSchema: statusSchema,
    },
    async (input: StatusInput) => {
      const response = await client.patch<ApiEnvelope>(`/api/v2/fb-accounts/${input.id}/status`, { body: { u_status: input.u_status } });

      return jsonResult(response);
    },
  );

  server.registerTool(
    'delete_fb_account',
    {
      title: 'Delete FB account',
      description: 'Delete one kkAuto API v2 FB account. Disabled unless KK_MCP_ENABLE_DELETE=true.',
      inputSchema: deleteSchema,
    },
    async (input: DeleteInput) =>
      guardedDelete({
        client,
        config,
        toolName: 'delete_fb_account',
        id: input.id,
        getPath: `/api/v2/fb-accounts/${input.id}`,
        deletePath: `/api/v2/fb-accounts/${input.id}`,
        input,
        extractName: (data) => (typeof data.u_name === 'string' ? data.u_name : undefined),
      }),
  );
}