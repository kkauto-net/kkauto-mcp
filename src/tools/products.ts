import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { ApiEnvelope, KkAutoMcpConfig } from '../types.js';
import { buildImageFilesFormData } from './media-form-data.js';
import { appliedLimit, guardedDelete, jsonResult, pruneUndefined } from './shared.js';

const positiveInt = z.number().int().positive();
const binaryFlag = z.union([z.literal(0), z.literal(1)]);
const barcode = z.string().min(1).describe('Product barcode. Stored lowercase by the API.');
const positivePrice = z.number().positive().describe('Positive numeric value.');
const hashtags = z.union([z.string(), z.array(z.string().min(1))]).optional();

const listSchema = {
  page: positiveInt.optional(),
  limit: positiveInt.optional().describe('Items per page. Capped by KK_MCP_MAX_LIST_LIMIT and the API limit of 1500.'),
  search: z.string().optional().describe('Searches product name, barcode, and description.'),
  category: z.string().optional().describe('Category-name filter.'),
  min_price: z.number().nonnegative().optional(),
  max_price: z.number().nonnegative().optional(),
  sort_by: z.string().optional().describe('Sort column. Defaults to created_at.'),
  sort_order: z.enum(['ASC', 'DESC']).optional().describe('Sort direction. Defaults to DESC.'),
};

const relationFields = {
  categories: z.array(positiveInt).optional().describe('Category ids synced as product relations; presence replaces the set.'),
  hashtags,
  attributes: z.record(z.string(), z.unknown()).optional().describe('Product attributes object; presence replaces the set.'),
  images: z.array(z.string().url()).max(15).optional().describe('Remote image URLs downloaded by the API; presence replaces the set.'),
};

const createSchema = {
  barcode,
  name: z.string().min(1),
  list_price: positivePrice,
  price: positivePrice,
  main_barcode: z.string().optional().describe('Defaults to barcode when omitted.'),
  description: z.string().optional(),
  allow_post: binaryFlag.optional().describe('0 or 1. Defaults to 0.'),
  ...relationFields,
};

const updateSchema = {
  id: positiveInt,
  name: z.string().min(1).optional(),
  list_price: positivePrice.optional(),
  price: positivePrice.optional(),
  description: z.string().optional(),
  allow_post: binaryFlag.optional(),
  ...relationFields,
};

const updateByBarcodeSchema = {
  barcode,
  name: z.string().min(1).optional(),
  list_price: positivePrice.optional(),
  price: positivePrice.optional(),
  description: z.string().optional(),
  allow_post: binaryFlag.optional(),
  ...relationFields,
};

const getSchema = {
  id: positiveInt,
};

const getByBarcodeSchema = {
  barcode,
};

const deleteSchema = {
  id: positiveInt,
  confirm: z.boolean().describe('Must be true for deletion.'),
  reason: z.string().min(1).describe('Human-readable reason for audit context.'),
  expected_name: z.string().min(1).optional().describe('Optional product name guard checked before delete.'),
};

const uploadImagesSchema = {
  id: positiveInt,
  media_files: z.array(z.string().min(1)).describe('Local image file paths on the MCP client machine for direct multipart upload.'),
};

const uploadImagesByBarcodeSchema = {
  barcode,
  media_files: z.array(z.string().min(1)).describe('Local image file paths on the MCP client machine for direct multipart upload.'),
};

const deleteImagesSchema = {
  id: positiveInt,
  confirm: z.boolean().describe('Must be true for deletion.'),
  reason: z.string().min(1).describe('Human-readable reason for audit context.'),
};

const deleteImagesByBarcodeSchema = {
  barcode,
  confirm: z.boolean().describe('Must be true for deletion.'),
  reason: z.string().min(1).describe('Human-readable reason for audit context.'),
};

type ListInput = z.infer<z.ZodObject<typeof listSchema>>;
type CreateInput = z.infer<z.ZodObject<typeof createSchema>>;
type UpdateInput = z.infer<z.ZodObject<typeof updateSchema>>;
type UpdateByBarcodeInput = z.infer<z.ZodObject<typeof updateByBarcodeSchema>>;
type GetInput = z.infer<z.ZodObject<typeof getSchema>>;
type GetByBarcodeInput = z.infer<z.ZodObject<typeof getByBarcodeSchema>>;
type DeleteInput = z.infer<z.ZodObject<typeof deleteSchema>>;
type UploadImagesInput = z.infer<z.ZodObject<typeof uploadImagesSchema>>;
type UploadImagesByBarcodeInput = z.infer<z.ZodObject<typeof uploadImagesByBarcodeSchema>>;
type DeleteImagesInput = z.infer<z.ZodObject<typeof deleteImagesSchema>>;
type DeleteImagesByBarcodeInput = z.infer<z.ZodObject<typeof deleteImagesByBarcodeSchema>>;

export function registerProductTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  server.registerTool(
    'list_products',
    {
      title: 'List products',
      description: 'List kkAuto API v2 products with optional filters. Does not expose the random endpoint.',
      inputSchema: listSchema,
    },
    async (input: ListInput) => {
      const response = await client.get<ApiEnvelope>('/api/v2/products', {
        query: { ...input, limit: appliedLimit(input.limit, config) },
      });

      return jsonResult(response ?? { status: 'success', data: [], pagination: null });
    },
  );

  server.registerTool(
    'get_product',
    {
      title: 'Get product',
      description: 'Get one kkAuto API v2 product by id.',
      inputSchema: getSchema,
    },
    async (input: GetInput) => {
      const response = await client.get<ApiEnvelope>(`/api/v2/products/${input.id}`);

      return jsonResult(response);
    },
  );

  server.registerTool(
    'get_product_by_barcode',
    {
      title: 'Get product by barcode',
      description: 'Get one kkAuto API v2 product by barcode.',
      inputSchema: getByBarcodeSchema,
    },
    async (input: GetByBarcodeInput) => {
      const response = await client.get<ApiEnvelope>(`/api/v2/products/barcode/${encodeURIComponent(input.barcode)}`);

      return jsonResult(response);
    },
  );

  server.registerTool(
    'list_product_categories',
    {
      title: 'List product categories',
      description: 'List active kkAuto API v2 product categories.',
      inputSchema: {},
    },
    async () => {
      const response = await client.get<ApiEnvelope>('/api/v2/products/categories');

      return jsonResult(response);
    },
  );

  server.registerTool(
    'create_product',
    {
      title: 'Create product',
      description:
        'Create one kkAuto API v2 product. Remote image URLs supplied in images are downloaded and MIME-checked by the API.',
      inputSchema: createSchema,
    },
    async (input: CreateInput) => {
      const response = await client.post<ApiEnvelope>('/api/v2/products', { body: pruneUndefined(input) });

      return jsonResult(response);
    },
  );

  server.registerTool(
    'update_product',
    {
      title: 'Update product',
      description:
        'Update one kkAuto API v2 product by id. Fields not supplied are omitted; categories, attributes, images, and hashtags replace their relation sets when present.',
      inputSchema: updateSchema,
    },
    async (input: UpdateInput) => {
      const { id, ...fields } = input;
      const payload = pruneUndefined(fields);

      if (Object.keys(payload).length === 0) {
        throw new Error('At least one field is required for update_product');
      }

      const response = await client.put<ApiEnvelope>(`/api/v2/products/${id}`, { body: payload });

      return jsonResult(response);
    },
  );

  server.registerTool(
    'update_product_by_barcode',
    {
      title: 'Update product by barcode',
      description:
        'Update one kkAuto API v2 product by barcode. Fields not supplied are omitted; relation fields replace their sets when present.',
      inputSchema: updateByBarcodeSchema,
    },
    async (input: UpdateByBarcodeInput) => {
      const { barcode: productBarcode, ...fields } = input;
      const payload = pruneUndefined(fields);

      if (Object.keys(payload).length === 0) {
        throw new Error('At least one field is required for update_product_by_barcode');
      }

      const response = await client.put<ApiEnvelope>(
        `/api/v2/products/barcode/${encodeURIComponent(productBarcode)}`,
        { body: payload },
      );

      return jsonResult(response);
    },
  );

  server.registerTool(
    'delete_product',
    {
      title: 'Delete product',
      description: 'Soft-delete one kkAuto API v2 product by id. Disabled unless KK_MCP_ENABLE_DELETE=true.',
      inputSchema: deleteSchema,
    },
    async (input: DeleteInput) =>
      guardedDelete({
        client,
        config,
        toolName: 'delete_product',
        id: input.id,
        getPath: `/api/v2/products/${input.id}`,
        deletePath: `/api/v2/products/${input.id}`,
        input,
        extractName: (data) => (typeof data.name === 'string' ? data.name : undefined),
      }),
  );

  server.registerTool(
    'upload_product_images',
    {
      title: 'Upload product images',
      description: 'Upload local images to a kkAuto API v2 product by id. Multipart with an images[] file field.',
      inputSchema: uploadImagesSchema,
    },
    async (input: UploadImagesInput) => {
      const response = await client.post<ApiEnvelope>(`/api/v2/products/${input.id}/images`, {
        formData: await buildImageFilesFormData(input.media_files),
      });

      return jsonResult(response);
    },
  );

  server.registerTool(
    'upload_product_images_by_barcode',
    {
      title: 'Upload product images by barcode',
      description: 'Upload local images to a kkAuto API v2 product by barcode. Multipart with an images[] file field.',
      inputSchema: uploadImagesByBarcodeSchema,
    },
    async (input: UploadImagesByBarcodeInput) => {
      const response = await client.post<ApiEnvelope>(`/api/v2/products/barcode/${encodeURIComponent(input.barcode)}/images`, {
        formData: await buildImageFilesFormData(input.media_files),
      });

      return jsonResult(response);
    },
  );

  server.registerTool(
    'delete_product_images',
    {
      title: 'Delete product images',
      description: 'Delete all images of a kkAuto API v2 product by id. Disabled unless KK_MCP_ENABLE_DELETE=true.',
      inputSchema: deleteImagesSchema,
    },
    async (input: DeleteImagesInput) =>
      guardedDelete({
        client,
        config,
        toolName: 'delete_product_images',
        id: input.id,
        getPath: `/api/v2/products/${input.id}`,
        deletePath: `/api/v2/products/${input.id}/images`,
        input,
        extractName: (data) => (typeof data.name === 'string' ? data.name : undefined),
      }),
  );

  server.registerTool(
    'delete_product_images_by_barcode',
    {
      title: 'Delete product images by barcode',
      description: 'Delete all images of a kkAuto API v2 product by barcode. Disabled unless KK_MCP_ENABLE_DELETE=true.',
      inputSchema: deleteImagesByBarcodeSchema,
    },
    async (input: DeleteImagesByBarcodeInput) =>
      guardedDelete({
        client,
        config,
        toolName: 'delete_product_images_by_barcode',
        id: input.barcode,
        getPath: `/api/v2/products/barcode/${encodeURIComponent(input.barcode)}`,
        deletePath: `/api/v2/products/barcode/${encodeURIComponent(input.barcode)}/images`,
        input,
        extractName: (data) => (typeof data.name === 'string' ? data.name : undefined),
      }),
  );
}