import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { flag, id, limit, page, search, sortOrder } from './schemas.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

const barcode = z.string().min(1).describe('Product barcode; stored lowercase by the API.');
const positivePrice = z.number().positive().describe('Positive numeric value.');

const relationFields = {
  categories: z.array(id('Category id.')).optional().describe('Category ids; presence replaces the set.'),
  hashtags: z.union([z.string(), z.array(z.string().min(1))]).optional(),
  attributes: z.record(z.string(), z.unknown()).optional().describe('Attribute map; presence replaces the set.'),
  images: z.array(z.string().url()).max(15).optional().describe('Remote image URLs downloaded by the API; presence replaces the set.'),
};

const mutableFields = {
  name: z.string().min(1).optional(),
  list_price: positivePrice.optional(),
  price: positivePrice.optional(),
  description: z.string().optional(),
  allow_post: flag('0 or 1.').optional(),
  ...relationFields,
};

const mediaFiles = z.array(z.string().min(1)).min(1).max(15).describe('Local image file paths on the MCP client machine.');

export const productSpec: ResourceSpec = {
  name: 'manage_product',
  title: 'Manage products',
  description: 'kkAuto API v2 products: CRUD by id or barcode, images, categories, and post flags.',
  actions: {
    list: {
      title: 'List products',
      description: 'Paginated product list with search, category, and price filters.',
      method: 'GET',
      path: '/api/v2/products',
      query: ['page', 'limit', 'search', 'category', 'min_price', 'max_price', 'sort_by', 'sort_order'],
      input: {
        page: page(),
        limit: limit(),
        search: search('Matches product name, barcode, and description.'),
        category: z.string().optional().describe('Category-name filter.'),
        min_price: z.number().nonnegative().optional(),
        max_price: z.number().nonnegative().optional(),
        sort_by: z.string().optional().describe('Sort column. Defaults to created_at.'),
        sort_order: sortOrder(),
      },
    },
    get: {
      title: 'Get product',
      description: 'One product by id.',
      method: 'GET',
      path: '/api/v2/products/{id}',
      input: { id: id('Product id.') },
    },
    'get-by-barcode': {
      title: 'Get product by barcode',
      description: 'One product by barcode.',
      method: 'GET',
      path: '/api/v2/products/barcode/{barcode}',
      input: { barcode },
    },
    categories: {
      title: 'List product categories',
      description: 'Active product categories.',
      method: 'GET',
      path: '/api/v2/products/categories',
      input: {},
    },
    random: {
      title: 'Random product',
      description: 'Random products for post seeding.',
      method: 'GET',
      path: '/api/v2/products/random',
      query: ['limit'],
      input: { limit: limit() },
    },
    create: {
      title: 'Create product',
      description: 'Create one product; remote image URLs are downloaded and MIME-checked by the API.',
      method: 'POST',
      path: '/api/v2/products',
      input: {
        barcode,
        name: z.string().min(1),
        list_price: positivePrice,
        price: positivePrice,
        main_barcode: z.string().optional().describe('Defaults to barcode.'),
        description: z.string().optional(),
        allow_post: flag('0 or 1. Defaults to 0.').optional(),
        ...relationFields,
      },
    },
    update: {
      title: 'Update product',
      description: 'Partial update by id; relation fields replace their sets when present.',
      method: 'PUT',
      path: '/api/v2/products/{id}',
      input: { id: id('Product id.'), ...mutableFields },
    },
    'update-by-barcode': {
      title: 'Update product by barcode',
      description: 'Partial update by barcode; relation fields replace their sets when present.',
      method: 'PUT',
      path: '/api/v2/products/barcode/{barcode}',
      input: { barcode, ...mutableFields },
    },
    delete: {
      title: 'Delete product',
      description: 'Soft-delete one product by id. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/products/{id}',
      input: { id: id('Product id.') },
      guard: 'delete',
    },
    'toggle-active': {
      title: 'Toggle product active',
      description: 'Flip the active flag of one product.',
      method: 'POST',
      path: '/api/v2/products/{id}/toggle-active',
      input: { id: id('Product id.') },
    },
    'toggle-allow-post': {
      title: 'Toggle product allow-post',
      description: 'Flip the allow_post flag of one product.',
      method: 'POST',
      path: '/api/v2/products/{id}/toggle-allow-post',
      input: { id: id('Product id.') },
    },
    'main-image': {
      title: 'Set product main image',
      description: 'Mark one product image as the main image.',
      method: 'POST',
      path: '/api/v2/products/{id}/main-image',
      input: { id: id('Product id.'), image_id: id('Product image id.') },
    },
    'upload-images': {
      title: 'Upload product images',
      description: 'Upload local images to one product by id (multipart, images[] field).',
      method: 'POST',
      path: '/api/v2/products/{id}/images',
      body: 'form',
      filesField: 'images[]',
      input: { id: id('Product id.'), media_files: mediaFiles },
    },
    'upload-images-by-barcode': {
      title: 'Upload product images by barcode',
      description: 'Upload local images to one product by barcode (multipart, images[] field).',
      method: 'POST',
      path: '/api/v2/products/barcode/{barcode}/images',
      body: 'form',
      filesField: 'images[]',
      input: { barcode, media_files: mediaFiles },
    },
    'delete-images': {
      title: 'Delete product images',
      description: 'Delete all images of one product by id. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/products/{id}/images',
      input: { id: id('Product id.') },
      guard: 'delete',
    },
    'delete-images-by-barcode': {
      title: 'Delete product images by barcode',
      description: 'Delete all images of one product by barcode. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/products/barcode/{barcode}/images',
      input: { barcode },
      guard: 'delete',
    },
    'bulk-delete': {
      title: 'Bulk delete products',
      description: 'Delete up to 500 products in one call; unknown ids are skipped.',
      method: 'POST',
      path: '/api/v2/products/bulk/delete',
      input: {
        ids: z.array(id('Product id.')).min(1).max(500).describe('Products to delete (maximum 500).'),
      },
      guard: 'confirm',
    },
  },
};

export function registerProductTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, productSpec);
}
