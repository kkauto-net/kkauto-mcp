import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { flag, id, limit, page, search } from './schemas.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

/**
 * media: data images (upload/CRUD) and data video (presigned upload/CRUD).
 */

export const dataImageSpec: ResourceSpec = {
  name: 'manage_data_image',
  title: 'Manage data images',
  description: 'kkAuto API v2 image library: list, read, upload (URLs or local files), update, delete, random pick.',
  actions: {
    list: {
      title: 'List images',
      description: 'Paginated image list with category/approval filters.',
      method: 'GET',
      path: '/api/v2/data-images',
      query: ['page', 'limit', 'search', 'category_id', 'approve'],
      input: {
        page: page(),
        limit: limit(),
        search: search('Partial match on the original file name.'),
        category_id: id('Category id.').optional(),
        approve: flag('Approval filter.').optional(),
      },
    },
    get: {
      title: 'Get image',
      description: 'One image row by id with its public URL.',
      method: 'GET',
      path: '/api/v2/data-images/{id}',
      input: { id: id('Image id.') },
    },
    search: {
      title: 'Search images',
      description: 'Exact name or partial search; exactly one of name/search.',
      method: 'GET',
      path: '/api/v2/data-images/search',
      query: ['page', 'limit', 'name', 'search', 'category_id'],
      input: {
        page: page(),
        limit: limit(),
        name: z.string().optional().describe('Exact original file name.'),
        search: search('Partial match on the original file name.'),
        category_id: id('Category id.').optional(),
      },
    },
    random: {
      title: 'Random image',
      description: 'Least-used random image, optionally filtered.',
      method: 'GET',
      path: '/api/v2/data-images/random',
      query: ['category_id', 'approve'],
      input: { category_id: id('Category id.').optional(), approve: flag('Approval filter.').optional() },
    },
    create: {
      title: 'Upload images',
      description: 'Upload remote image URLs (JSON) or local files (multipart via media_files).',
      method: 'POST',
      path: '/api/v2/data-images',
      input: {
        media_files: z.array(z.string().min(1)).max(15).optional().describe('Local image file paths on the MCP client machine.'),
        images: z.array(z.string().url()).max(15).optional().describe('Remote image URLs to download. Do not mix with media_files.'),
        category_id: id('Category id. Defaults to 1.').optional(),
        alt: z.string().max(255).optional().describe('Alt text applied to every uploaded image.'),
      },
    },
    update: {
      title: 'Update image',
      description: 'Update category, approval, name or alt text.',
      method: 'PUT',
      path: '/api/v2/data-images/{id}',
      input: {
        id: id('Image id.'),
        category_id: id('Category id.').optional(),
        approve: flag('Approval flag.').optional(),
        original_name: z.string().max(255).optional().describe('Original file name.'),
        alt: z.string().max(255).optional().describe('Alt text.'),
      },
    },
    delete: {
      title: 'Delete image',
      description: 'Delete one image (blob + row). Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/data-images/{id}',
      input: { id: id('Image id.') },
      guard: 'delete',
    },
  },
};

export function registerDataImageTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, dataImageSpec);
}
