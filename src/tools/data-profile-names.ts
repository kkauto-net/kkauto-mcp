import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { ApiEnvelope, KkAutoMcpConfig } from '../types.js';
import { buildImageFilesFormData } from './media-form-data.js';
import { appliedLimit, guardedDelete, jsonResult, pruneUndefined } from './shared.js';

const positiveInt = z.number().int().positive();
const binaryFlag = z.union([z.literal(0), z.literal(1)]);
const firstName = z.string().min(2).max(50);
const lastName = z.string().min(2).max(50);

const listSchema = {
  page: positiveInt.optional(),
  limit: positiveInt.optional().describe('Items per page. Capped by KK_MCP_MAX_LIST_LIMIT and the API limit of 100.'),
  search: z.string().optional(),
  status: z.string().optional().describe('Exact-match status filter.'),
  active: binaryFlag.optional().describe('Exact-match active filter: 0 or 1.'),
  has_images: binaryFlag.optional().describe('Filter profiles with or without images: 1 or 0.'),
  gender: z.enum(['female', 'male']).optional(),
  used_status: z.enum(['used', 'unused']).optional(),
};

const writableFields = {
  firstname: firstName,
  lastname: lastName,
  sothich: z.string().max(1000).optional().describe('Personal interests.'),
  tieusu: z.string().max(2000).optional().describe('Biography.'),
  active: binaryFlag.describe('0 or 1.'),
  gender: z.enum(['female', 'male']).optional(),
  info: z.union([z.string(), z.record(z.string(), z.unknown())]).optional().describe('Free-form profile info object or JSON string.'),
};

const createSchema = {
  ...writableFields,
  // Keep required-field messages explicit for create.
  firstname: firstName.describe('Required, 2..50 chars.'),
  lastname: lastName.describe('Required, 2..50 chars.'),
  active: binaryFlag.describe('Required, 0 or 1.'),
};

const updateSchema = {
  id: positiveInt,
  ...createSchema,
};

const getSchema = {
  id: positiveInt,
};

const baseDeleteSchema = {
  confirm: z.boolean().describe('Must be true for deletion.'),
  reason: z.string().min(1).describe('Human-readable reason for audit context.'),
};

const deleteSchema = {
  id: positiveInt,
  ...baseDeleteSchema,
  expected_name: z.string().min(1).optional().describe('Optional profile fullname guard checked before delete.'),
};

const deleteImageSchema = {
  id: positiveInt,
  image_id: positiveInt,
  ...baseDeleteSchema,
};

const incrementUsedSchema = {
  id: positiveInt,
};

const addImageSchema = {
  id: positiveInt,
  media_files: z.array(z.string().min(1)).optional().describe('Local image file paths on the MCP client machine for direct multipart upload.'),
};

const setPrimaryImageSchema = {
  id: positiveInt,
  image_id: positiveInt,
};

type ListInput = z.infer<z.ZodObject<typeof listSchema>>;
type CreateInput = z.infer<z.ZodObject<typeof createSchema>>;
type UpdateInput = z.infer<z.ZodObject<typeof updateSchema>>;
type GetInput = z.infer<z.ZodObject<typeof getSchema>>;
type DeleteInput = z.infer<z.ZodObject<typeof deleteSchema>>;
type DeleteImageInput = z.infer<z.ZodObject<typeof deleteImageSchema>>;
type IncrementUsedInput = z.infer<z.ZodObject<typeof incrementUsedSchema>>;
type AddImageInput = z.infer<z.ZodObject<typeof addImageSchema>>;
type SetPrimaryImageInput = z.infer<z.ZodObject<typeof setPrimaryImageSchema>>;

export function registerDataProfileNameTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  server.registerTool(
    'list_data_profile_names',
    {
      title: 'List data profile names',
      description: 'List kkAuto API v2 data profile names with optional filters.',
      inputSchema: listSchema,
    },
    async (input: ListInput) => {
      const query = pruneUndefined({
        ...input,
        has_images: input.has_images !== undefined ? Number(input.has_images) : undefined,
      });
      const response = await client.get<ApiEnvelope>('/api/v2/data-profile-names', {
        query: { ...query, limit: appliedLimit(input.limit, config) },
      });

      return jsonResult(response ?? { status: 'success', data: [], pagination: null });
    },
  );

  server.registerTool(
    'get_data_profile_name',
    {
      title: 'Get data profile name',
      description: 'Get one kkAuto API v2 data profile name by id, including its images.',
      inputSchema: getSchema,
    },
    async (input: GetInput) => {
      const response = await client.get<ApiEnvelope>(`/api/v2/data-profile-names/${input.id}`);

      return jsonResult(response);
    },
  );

  server.registerTool(
    'create_data_profile_name',
    {
      title: 'Create data profile name',
      description:
        'Create one kkAuto API v2 data profile name. The API accepts only the documented writable fields; unexpected fields are rejected.',
      inputSchema: createSchema,
    },
    async (input: CreateInput) => {
      const response = await client.post<ApiEnvelope>('/api/v2/data-profile-names', { body: pruneUndefined(input) });

      return jsonResult(response);
    },
  );

  server.registerTool(
    'update_data_profile_name',
    {
      title: 'Update data profile name',
      description:
        'Update one kkAuto API v2 data profile name. The HTTP API re-validates the payload with the same create rules, so firstname, lastname, and active are required in the submitted payload.',
      inputSchema: updateSchema,
    },
    async (input: UpdateInput) => {
      const { id, ...fields } = input;
      const response = await client.put<ApiEnvelope>(`/api/v2/data-profile-names/${id}`, { body: pruneUndefined(fields) });

      return jsonResult(response);
    },
  );

  server.registerTool(
    'delete_data_profile_name',
    {
      title: 'Delete data profile name',
      description: 'Delete one kkAuto API v2 data profile name. Disabled unless KK_MCP_ENABLE_DELETE=true.',
      inputSchema: deleteSchema,
    },
    async (input: DeleteInput) =>
      guardedDelete({
        client,
        config,
        toolName: 'delete_data_profile_name',
        id: input.id,
        getPath: `/api/v2/data-profile-names/${input.id}`,
        deletePath: `/api/v2/data-profile-names/${input.id}`,
        input,
        extractName: (data) => {
          if (typeof data.fullname === 'string' && data.fullname.trim() !== '') {
            return data.fullname;
          }
          const first = typeof data.firstname === 'string' ? data.firstname : '';
          const last = typeof data.lastname === 'string' ? data.lastname : '';
          return `${first} ${last}`.trim() || undefined;
        },
      }),
  );

  server.registerTool(
    'increment_data_profile_name_used',
    {
      title: 'Increment data profile name used counter',
      description: 'Increment the used counter of one kkAuto API v2 data profile name. This mutates the used counter.',
      inputSchema: incrementUsedSchema,
    },
    async (input: IncrementUsedInput) => {
      const response = await client.post<ApiEnvelope>(`/api/v2/data-profile-names/${input.id}/increment-used`);

      return jsonResult(response);
    },
  );

  server.registerTool(
    'add_data_profile_name_image',
    {
      title: 'Add data profile name image',
      description:
        'Upload images to a kkAuto API v2 data profile name via local image paths. The endpoint only accepts multipart form data.',
      inputSchema: addImageSchema,
    },
    async (input: AddImageInput) => {
      if (!input.media_files?.length) {
        throw new Error('add_data_profile_name_image requires media_files with at least one local image path');
      }

      const response = await client.post<ApiEnvelope>(`/api/v2/data-profile-names/${input.id}/images`, {
        formData: await buildImageFilesFormData(input.media_files),
      });

      return jsonResult(response);
    },
  );

  server.registerTool(
    'delete_data_profile_name_image',
    {
      title: 'Delete data profile name image',
      description: 'Delete one image from a kkAuto API v2 data profile name. Disabled unless KK_MCP_ENABLE_DELETE=true.',
      inputSchema: deleteImageSchema,
    },
    async (input: DeleteImageInput) =>
      guardedDelete({
        client,
        config,
        toolName: 'delete_data_profile_name_image',
        id: { profile_id: input.id, image_id: input.image_id },
        getPath: `/api/v2/data-profile-names/${input.id}`,
        deletePath: `/api/v2/data-profile-names/${input.id}/images/${input.image_id}`,
        input,
        extractName: () => undefined,
      }),
  );

  server.registerTool(
    'set_primary_data_profile_name_image',
    {
      title: 'Set primary data profile name image',
      description: 'Set one image as the primary image of a kkAuto API v2 data profile name.',
      inputSchema: setPrimaryImageSchema,
    },
    async (input: SetPrimaryImageInput) => {
      const response = await client.patch<ApiEnvelope>(`/api/v2/data-profile-names/${input.id}/images/${input.image_id}/primary`);

      return jsonResult(response);
    },
  );
}