import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { flag, id, limit, page, search, sortBy, sortOrder } from './schemas.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

/**
 * fb-taxonomy: category and tag dictionaries used to classify fanpages,
 * accounts, groups and posts.
 */

const direction = z.enum(['inc', 'dec']).describe('Move up (inc) or down (dec) one position.');

const categoryFields = {
  c_name: z.string().min(1).max(255).describe('Category name.'),
  sort: z.number().int().min(0).describe('Sort position.'),
  c_note: z.string().optional().describe('Note.'),
};

export const fbCategorySpec: ResourceSpec = {
  name: 'manage_fb_category',
  title: 'Manage categories',
  description: 'kkAuto API v2 category dictionary: list, read, create, update, delete, move one position and renumber.',
  actions: {
    list: {
      title: 'List categories',
      description: 'Paginated categories with name search and sort.',
      method: 'GET',
      path: '/api/v2/fb-categories',
      query: ['page', 'limit', 'search', 'sort_by', 'sort_order'],
      input: {
        page: page(),
        limit: limit(),
        search: search('Partial match on name or note.'),
        sort_by: sortBy(['cat_id', 'c_name', 'sort']),
        sort_order: sortOrder(),
      },
    },
    get: {
      title: 'Get category',
      description: 'One category by id.',
      method: 'GET',
      path: '/api/v2/fb-categories/{id}',
      input: { id: id('Category id.') },
    },
    create: {
      title: 'Create category',
      description: 'Create a category.',
      method: 'POST',
      path: '/api/v2/fb-categories',
      input: categoryFields,
    },
    update: {
      title: 'Update category',
      description: 'Update category name, sort position or note.',
      method: 'PUT',
      path: '/api/v2/fb-categories/{id}',
      input: {
        id: id('Category id.'),
        c_name: categoryFields.c_name.optional(),
        sort: categoryFields.sort.optional(),
        c_note: categoryFields.c_note,
      },
    },
    position: {
      title: 'Move category',
      description: 'Swap the category with its previous or next neighbour.',
      method: 'POST',
      path: '/api/v2/fb-categories/{id}/position',
      input: { id: id('Category id.'), direction },
    },
    reorder: {
      title: 'Reorder categories',
      description: 'Renumber every category in its current order.',
      method: 'POST',
      path: '/api/v2/fb-categories/reorder',
    },
    delete: {
      title: 'Delete category',
      description: 'Delete one category. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/fb-categories/{id}',
      input: { id: id('Category id.') },
      guard: 'delete',
    },
  },
};

const tagFields = {
  tag_name: z.string().min(1).max(255).describe('Tag name.'),
  tag_color: z.string().min(1).max(32).describe('Colour hex or token.'),
  tag_note: z.string().optional().describe('Note.'),
  sort: z.number().int().min(0).describe('Sort position.'),
  tag_active: flag('Active flag.').optional(),
};

export const fbTagSpec: ResourceSpec = {
  name: 'manage_fb_tag',
  title: 'Manage tags',
  description: 'kkAuto API v2 tag dictionary: list, read, create, update, delete, move one position and renumber.',
  actions: {
    list: {
      title: 'List tags',
      description: 'Paginated tags with name search and active filter.',
      method: 'GET',
      path: '/api/v2/fb-tags',
      query: ['page', 'limit', 'search', 'sort_by', 'sort_order', 'tag_active'],
      input: {
        page: page(),
        limit: limit(),
        search: search('Partial match on name or note.'),
        sort_by: sortBy(['tag_id', 'tag_name', 'sort', 'tag_active', 'date']),
        sort_order: sortOrder(),
        tag_active: flag('Active flag filter.').optional(),
      },
    },
    get: {
      title: 'Get tag',
      description: 'One tag by id.',
      method: 'GET',
      path: '/api/v2/fb-tags/{id}',
      input: { id: id('Tag id.') },
    },
    create: {
      title: 'Create tag',
      description: 'Create a tag.',
      method: 'POST',
      path: '/api/v2/fb-tags',
      input: tagFields,
    },
    update: {
      title: 'Update tag',
      description: 'Update tag name, colour, sort position, note or active flag.',
      method: 'PUT',
      path: '/api/v2/fb-tags/{id}',
      input: {
        id: id('Tag id.'),
        tag_name: tagFields.tag_name.optional(),
        tag_color: tagFields.tag_color.optional(),
        tag_note: tagFields.tag_note,
        sort: tagFields.sort.optional(),
        tag_active: tagFields.tag_active,
      },
    },
    position: {
      title: 'Move tag',
      description: 'Swap the tag with its previous or next neighbour.',
      method: 'POST',
      path: '/api/v2/fb-tags/{id}/position',
      input: { id: id('Tag id.'), direction },
    },
    reorder: {
      title: 'Reorder tags',
      description: 'Renumber every tag in its current order.',
      method: 'POST',
      path: '/api/v2/fb-tags/reorder',
    },
    delete: {
      title: 'Delete tag',
      description: 'Delete one tag. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/fb-tags/{id}',
      input: { id: id('Tag id.') },
      guard: 'delete',
    },
  },
};

export function registerFbTaxonomyTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, fbCategorySpec);
  registerResourceTools(server, client, config, fbTagSpec);
}
