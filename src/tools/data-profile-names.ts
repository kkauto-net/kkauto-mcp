import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { flag, id, limit, page, search } from './schemas.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

const gender = z.enum(['female', 'male']);

const writableFields = {
  firstname: z.string().min(2).max(50).describe('Required, 2..50 chars.'),
  lastname: z.string().min(2).max(50).describe('Required, 2..50 chars.'),
  sothich: z.string().max(1000).optional().describe('Personal interests.'),
  tieusu: z.string().max(2000).optional().describe('Biography.'),
  active: flag('Required, 0 or 1.'),
  gender: gender.optional(),
  info: z.union([z.string(), z.record(z.string(), z.unknown())]).optional().describe('Free-form profile info object or JSON string.'),
};

const imagePath = {
  id: id('Profile name id.'),
  image_id: id('Image id.'),
};

export const dataProfileNameSpec: ResourceSpec = {
  name: 'manage_data_profile_name',
  title: 'Manage data profile names',
  description: 'kkAuto API v2 data profile names with their images and the used counter.',
  actions: {
    list: {
      title: 'List data profile names',
      description: 'Paginated data profile name list with status, gender, and image filters.',
      method: 'GET',
      path: '/api/v2/data-profile-names',
      query: ['page', 'limit', 'search', 'status', 'active', 'has_images', 'gender', 'used_status'],
      input: {
        page: page(),
        limit: limit(),
        search: search(),
        status: z.string().optional().describe('Exact-match status filter.'),
        active: flag('Exact-match active filter: 0 or 1.').optional(),
        has_images: flag('Filter profiles with or without images: 1 or 0.').optional(),
        gender: gender.optional(),
        used_status: z.enum(['used', 'unused']).optional(),
      },
    },
    get: {
      title: 'Get data profile name',
      description: 'One data profile name by id, including its images.',
      method: 'GET',
      path: '/api/v2/data-profile-names/{id}',
      input: { id: id('Profile name id.') },
    },
    create: {
      title: 'Create data profile name',
      description: 'Create one data profile name; only the documented writable fields are accepted.',
      method: 'POST',
      path: '/api/v2/data-profile-names',
      input: writableFields,
    },
    update: {
      title: 'Update data profile name',
      description: 'Update one data profile name; the API re-applies the create rules, so firstname, lastname, and active are required.',
      method: 'PUT',
      path: '/api/v2/data-profile-names/{id}',
      input: { id: id('Profile name id.'), ...writableFields },
    },
    delete: {
      title: 'Delete data profile name',
      description: 'Delete one data profile name. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/data-profile-names/{id}',
      input: { id: id('Profile name id.') },
      guard: 'delete',
    },
    'increment-used': {
      title: 'Increment used counter',
      description: 'Increment the used counter of one data profile name.',
      method: 'POST',
      path: '/api/v2/data-profile-names/{id}/increment-used',
      input: { id: id('Profile name id.') },
    },
    'add-image': {
      title: 'Add profile name image',
      description: 'Upload local image files to one data profile name (multipart, images[] field).',
      method: 'POST',
      path: '/api/v2/data-profile-names/{id}/images',
      body: 'form',
      filesField: 'images[]',
      input: {
        id: id('Profile name id.'),
        media_files: z.array(z.string().min(1)).min(1).max(15).describe('Local image file paths on the MCP client machine.'),
      },
    },
    'delete-image': {
      title: 'Delete profile name image',
      description: 'Delete one image of a data profile name. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/data-profile-names/{id}/images/{image_id}',
      input: imagePath,
      guard: 'delete',
    },
    'set-primary': {
      title: 'Set primary profile name image',
      description: 'Set one image as the primary image of a data profile name.',
      method: 'PATCH',
      path: '/api/v2/data-profile-names/{id}/images/{image_id}/primary',
      input: imagePath,
    },
  },
};

export function registerDataProfileNameTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, dataProfileNameSpec);
}
