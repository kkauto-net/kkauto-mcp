import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { ApiEnvelope, KkAutoMcpConfig } from '../types.js';
import { buildImageFilesFormData } from './media-form-data.js';
import { appliedLimit, guardedDelete, jsonResult, pruneUndefined } from './shared.js';

const positiveInt = z.number().int().positive();
const binaryFlag = z.union([z.literal(0), z.literal(1)]);

const listSchema = {
  page: positiveInt.optional().describe('Page number, starting at 1.'),
  limit: positiveInt.optional().describe('Items per page. Capped by KK_MCP_MAX_LIST_LIMIT.'),
  category_id: positiveInt.optional().describe('Exact-match category filter.'),
  approve: binaryFlag.optional().describe('Exact-match approval filter: 0 or 1.'),
  search: z.string().optional().describe('Partial match on the image original name.'),
};

const createSchema = {
  images: z
    .array(z.string().url())
    .max(15)
    .optional()
    .describe('Remote image URLs to download. Use media_files for local uploads instead; do not mix.'),
  media_files: z.array(z.string().min(1)).optional().describe('Local image file paths on the MCP client machine for direct multipart upload.'),
  category_id: positiveInt.optional().describe('Category id. Defaults to 1 when omitted.'),
  alt: z.string().optional().describe('Shared alt text applied to the uploaded or downloaded images.'),
};

const updateSchema = {
  id: positiveInt,
  category_id: positiveInt.optional(),
  approve: binaryFlag.optional(),
  original_name: z.string().max(255).optional(),
  alt: z.string().max(255).optional(),
};

const getSchema = {
  id: positiveInt,
};

const searchSchema = {
  name: z.string().optional().describe('Exact lookup on original_name. Mutually exclusive with search.'),
  search: z.string().optional().describe('Partial match on original_name. Mutually exclusive with name.'),
  category_id: positiveInt.optional(),
  page: positiveInt.optional(),
  limit: positiveInt.optional().describe('Items per page. Capped by KK_MCP_MAX_LIST_LIMIT.'),
};

const deleteSchema = {
  id: positiveInt,
  confirm: z.boolean().describe('Must be true for deletion.'),
  reason: z.string().min(1).describe('Human-readable reason for audit context.'),
  expected_name: z.string().min(1).optional().describe('Optional original_name guard checked before delete.'),
};

type ListInput = z.infer<z.ZodObject<typeof listSchema>>;
type CreateInput = z.infer<z.ZodObject<typeof createSchema>>;
type UpdateInput = z.infer<z.ZodObject<typeof updateSchema>>;
type GetInput = z.infer<z.ZodObject<typeof getSchema>>;
type SearchInput = z.infer<z.ZodObject<typeof searchSchema>>;
type DeleteInput = z.infer<z.ZodObject<typeof deleteSchema>>;

export function registerDataImageTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  server.registerTool(
    'list_data_images',
    {
      title: 'List data images',
      description: 'List kkAuto API v2 data images with optional filters. Does not expose the random endpoint.',
      inputSchema: listSchema,
    },
    async (input: ListInput) => {
      const response = await client.get<ApiEnvelope>('/api/v2/data-images', {
        query: { ...input, limit: appliedLimit(input.limit, config) },
      });

      return jsonResult(response ?? { status: 'success', data: [], pagination: null });
    },
  );

  server.registerTool(
    'get_data_image',
    {
      title: 'Get data image',
      description: 'Get one kkAuto API v2 data image row by id.',
      inputSchema: getSchema,
    },
    async (input: GetInput) => {
      const response = await client.get<ApiEnvelope>(`/api/v2/data-images/${input.id}`);

      return jsonResult(response);
    },
  );

  server.registerTool(
    'search_data_images',
    {
      title: 'Search data images',
      description: 'Search kkAuto API v2 data images by exact name or partial match on the image original name.',
      inputSchema: searchSchema,
    },
    async (input: SearchInput) => {
      if (input.name === undefined && input.search === undefined) {
        throw new Error('search_data_images requires at least one of name or search');
      }

      if (input.name !== undefined && input.search !== undefined) {
        throw new Error('search_data_images accepts either name or search, not both');
      }

      const response = await client.get<ApiEnvelope>('/api/v2/data-images/search', {
        query: { ...input, limit: appliedLimit(input.limit, config) },
      });

      return jsonResult(response);
    },
  );

  server.registerTool(
    'create_data_image',
    {
      title: 'Create data image',
      description:
        'Upload one or more images to kkAuto API v2 data-images. Use images for remote URLs or media_files for local image paths; do not mix.',
      inputSchema: createSchema,
    },
    async (input: CreateInput) => {
      const { images, media_files: mediaFiles, ...fields } = input;
      const payload = pruneUndefined({ ...fields });

      if (images?.length && mediaFiles?.length) {
        throw new Error('create_data_image accepts either images URLs or media_files, not both');
      }

      const response = mediaFiles?.length
        ? await client.post<ApiEnvelope>('/api/v2/data-images', {
            formData: await buildImageFilesFormData(mediaFiles, payload),
          })
        : await client.post<ApiEnvelope>('/api/v2/data-images', { body: { images: images ?? [], ...payload } });

      return jsonResult(response);
    },
  );

  server.registerTool(
    'update_data_image',
    {
      title: 'Update data image',
      description: 'Update metadata of one kkAuto API v2 data image row. Fields not supplied are omitted from the MCP payload.',
      inputSchema: updateSchema,
    },
    async (input: UpdateInput) => {
      const { id, ...fields } = input;
      const payload = pruneUndefined(fields);

      if (Object.keys(payload).length === 0) {
        throw new Error('At least one field is required for update_data_image');
      }

      const response = await client.put<ApiEnvelope>(`/api/v2/data-images/${id}`, { body: payload });

      return jsonResult(response);
    },
  );

  server.registerTool(
    'delete_data_image',
    {
      title: 'Delete data image',
      description: 'Delete one kkAuto API v2 data image row. Disabled unless KK_MCP_ENABLE_DELETE=true.',
      inputSchema: deleteSchema,
    },
    async (input: DeleteInput) =>
      guardedDelete({
        client,
        config,
        toolName: 'delete_data_image',
        id: input.id,
        getPath: `/api/v2/data-images/${input.id}`,
        deletePath: `/api/v2/data-images/${input.id}`,
        input,
        extractName: (data) => (typeof data.original_name === 'string' ? data.original_name : undefined),
      }),
  );
}