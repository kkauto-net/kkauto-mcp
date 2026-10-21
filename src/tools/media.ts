import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { id, limit, page, search, sortBy, sortOrder } from './schemas.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

/**
 * media: data video (presigned or direct upload, metadata, categories) and the
 * data image category taxonomy.
 */

export const dataVideoSpec: ResourceSpec = {
  name: 'manage_data_video',
  title: 'Manage data videos',
  description: 'kkAuto API v2 video library: list, read, presigned/direct upload, confirm, metadata, delete, categories and hashtag helpers.',
  actions: {
    list: {
      title: 'List videos',
      description: 'Paginated video list with status/category/hashtag filters.',
      method: 'GET',
      path: '/api/v2/data-video',
      query: ['page', 'limit', 'status', 'category_id', 'hashtag'],
      input: {
        page: page(),
        limit: limit(),
        status: z.string().optional().describe('Upload status filter.'),
        category_id: id('Video category id.').optional(),
        hashtag: z.string().optional().describe('Hashtag name filter.'),
      },
    },
    get: {
      title: 'Get video',
      description: 'One video row with category and hashtags.',
      method: 'GET',
      path: '/api/v2/data-video/{id}',
      input: { id: id('Video id.') },
    },
    presign: {
      title: 'Presign upload',
      description: 'Create a pending video row plus a presigned upload target for large files.',
      method: 'POST',
      path: '/api/v2/data-video/presign',
      input: {
        filename: z.string().max(255).describe('Original file name.'),
        content_type: z
          .enum(['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'])
          .describe('Video MIME type.'),
        file_size: z.number().int().positive().max(104857600).describe('File size in bytes (max 100 MB).'),
        category_id: id('Video category id.').optional(),
        hashtags: z.array(z.string()).optional().describe('Hashtag names to attach.'),
      },
    },
    upload: {
      title: 'Upload video directly',
      description: 'Multipart upload of one local video file (max 10 MB through MCP; use presign above that).',
      method: 'POST',
      path: '/api/v2/data-video/upload',
      body: 'form',
      filesField: 'video',
      input: {
        media_files: z.array(z.string().min(1)).max(1).describe('Local video file path on the MCP client machine.'),
        video_id: id('Existing pending video id to upload into.').optional(),
        category_id: id('Video category id.').optional(),
        hashtags: z.string().optional().describe('Comma-separated hashtag names.'),
      },
    },
    confirm: {
      title: 'Confirm upload',
      description: 'Confirm a pending video so processing starts.',
      method: 'POST',
      path: '/api/v2/data-video/{id}/confirm',
      input: { id: id('Video id.') },
    },
    metadata: {
      title: 'Update video metadata',
      description: 'Replace category and hashtag links of one video.',
      method: 'PUT',
      path: '/api/v2/data-video/{id}/metadata',
      input: {
        id: id('Video id.'),
        category_id: id('Video category id.').optional(),
        hashtags: z.array(z.string()).optional().describe('Hashtag names to attach.'),
      },
    },
    delete: {
      title: 'Delete video',
      description: 'Delete one video row and its blob. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/data-video/{id}',
      input: { id: id('Video id.') },
      guard: 'delete',
    },
    categories: {
      title: 'List video categories',
      description: 'Video categories, optionally with usage counts.',
      method: 'GET',
      path: '/api/v2/data-video/categories',
      query: ['with_stats'],
      input: { with_stats: z.enum(['true', 'false']).optional().describe('Include per-category counts.') },
    },
    'create-category': {
      title: 'Create video category',
      description: 'Create a video category.',
      method: 'POST',
      path: '/api/v2/data-video/categories',
      input: {
        name: z.string().min(2).max(255).describe('Category name.'),
        description: z.string().max(500).optional().describe('Description.'),
      },
    },
    'update-category': {
      title: 'Update video category',
      description: 'Update a video category name/description.',
      method: 'PUT',
      path: '/api/v2/data-video/categories/{categoryId}',
      input: {
        categoryId: id('Category id.'),
        name: z.string().min(2).max(255).describe('Category name.'),
        description: z.string().max(500).optional().describe('Description.'),
      },
    },
    'delete-category': {
      title: 'Delete video category',
      description: 'Delete one video category. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/data-video/categories/{categoryId}',
      input: { categoryId: id('Category id.') },
      guard: 'delete',
    },
    'hashtag-suggestions': {
      title: 'Hashtag suggestions',
      description: 'Popular hashtags suggested for video metadata.',
      method: 'GET',
      path: '/api/v2/data-video/hashtag-suggestions',
      query: ['limit'],
      input: { limit: limit() },
    },
    'search-hashtags': {
      title: 'Search hashtags',
      description: 'Hashtag search for the video metadata editor.',
      method: 'GET',
      path: '/api/v2/data-video/search-hashtags',
      query: ['q', 'limit'],
      input: { q: z.string().describe('Partial hashtag name.'), limit: limit() },
    },
  },
};

export const dataImageCategorySpec: ResourceSpec = {
  name: 'manage_data_image_category',
  title: 'Manage image categories',
  description: 'kkAuto API v2 image categories used by the image library.',
  actions: {
    list: {
      title: 'List image categories',
      description: 'Paginated image category list.',
      method: 'GET',
      path: '/api/v2/data-image-categories',
      query: ['page', 'limit', 'search', 'sort_by', 'sort_order'],
      input: {
        page: page(),
        limit: limit(),
        search: search('Partial match on the category name.'),
        sort_by: sortBy(['id', 'name', 'created_at']),
        sort_order: sortOrder(),
      },
    },
    get: {
      title: 'Get image category',
      description: 'One image category by id.',
      method: 'GET',
      path: '/api/v2/data-image-categories/{id}',
      input: { id: id('Category id.') },
    },
    create: {
      title: 'Create image category',
      description: 'Create an image category.',
      method: 'POST',
      path: '/api/v2/data-image-categories',
      input: {
        name: z.string().min(3).max(255).describe('Category name.'),
        description: z.string().optional().describe('Description.'),
      },
    },
    update: {
      title: 'Update image category',
      description: 'Update an image category name/description.',
      method: 'PUT',
      path: '/api/v2/data-image-categories/{id}',
      input: {
        id: id('Category id.'),
        name: z.string().min(3).max(255).optional().describe('Category name.'),
        description: z.string().optional().describe('Description.'),
      },
    },
    delete: {
      title: 'Delete image category',
      description: 'Delete one image category. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/data-image-categories/{id}',
      input: { id: id('Category id.') },
      guard: 'delete',
    },
  },
};

export function registerDataVideoTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, dataVideoSpec);
}

export function registerDataImageCategoryTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, dataImageCategorySpec);
}
