import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { flag, id, limit, page, search, sortBy, sortOrder } from './schemas.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

/**
 * goods: product categories and product attributes (taxonomy of the product catalog).
 */

export const productCategorySpec: ResourceSpec = {
  name: 'manage_product_category',
  title: 'Manage product categories',
  description: 'kkAuto API v2 product categories: CRUD and active toggle.',
  actions: {
    list: {
      title: 'List product categories',
      description: 'Paginated category list with parent/active filters.',
      method: 'GET',
      path: '/api/v2/product-categories',
      query: ['page', 'limit', 'search', 'is_active', 'parent_id', 'sort_by', 'sort_order'],
      input: {
        page: page(),
        limit: limit(),
        search: search('Partial match on the category name.'),
        is_active: flag('Active filter.').optional(),
        parent_id: id('Parent category id filter.').optional(),
        sort_by: sortBy(['id', 'name', 'parent_id', 'sort_order', 'is_active', 'created_at']),
        sort_order: sortOrder(),
      },
    },
    get: {
      title: 'Get product category',
      description: 'One product category by id.',
      method: 'GET',
      path: '/api/v2/product-categories/{id}',
      input: { id: id('Category id.') },
    },
    create: {
      title: 'Create product category',
      description: 'Create a product category.',
      method: 'POST',
      path: '/api/v2/product-categories',
      input: {
        name: z.string().min(1).max(255).describe('Category name.'),
        parent_id: id('Parent category id.').optional(),
        sort_order: z.number().int().optional().describe('Ordering.'),
        is_active: flag('Active flag.').optional(),
      },
    },
    update: {
      title: 'Update product category',
      description: 'Update category fields; omitted keys are kept.',
      method: 'PUT',
      path: '/api/v2/product-categories/{id}',
      input: {
        id: id('Category id.'),
        name: z.string().min(1).max(255).optional().describe('Category name.'),
        parent_id: id('Parent category id.').optional(),
        sort_order: z.number().int().optional().describe('Ordering.'),
        is_active: flag('Active flag.').optional(),
      },
    },
    delete: {
      title: 'Delete product category',
      description: 'Delete one product category. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/product-categories/{id}',
      input: { id: id('Category id.') },
      guard: 'delete',
    },
    toggle: {
      title: 'Toggle product category',
      description: 'Flip is_active.',
      method: 'POST',
      path: '/api/v2/product-categories/{id}/toggle',
      input: { id: id('Category id.') },
    },
  },
};

export const productAttributeSpec: ResourceSpec = {
  name: 'manage_product_attribute',
  title: 'Manage product attributes',
  description: 'kkAuto API v2 product attributes: CRUD and active toggle.',
  actions: {
    list: {
      title: 'List product attributes',
      description: 'Paginated attribute list with type/active/list filters.',
      method: 'GET',
      path: '/api/v2/product-attributes',
      query: ['page', 'limit', 'search', 'type', 'is_active', 'show_in_list', 'sort_by', 'sort_order'],
      input: {
        page: page(),
        limit: limit(),
        search: search('Partial match on the attribute name or code.'),
        type: z.string().optional().describe('Attribute type filter.'),
        is_active: flag('Active filter.').optional(),
        show_in_list: flag('Show-in-list filter.').optional(),
        sort_by: sortBy(['id', 'name', 'code', 'type', 'sort_order', 'is_active', 'created_at']),
        sort_order: sortOrder(),
      },
    },
    get: {
      title: 'Get product attribute',
      description: 'One product attribute by id.',
      method: 'GET',
      path: '/api/v2/product-attributes/{id}',
      input: { id: id('Attribute id.') },
    },
    create: {
      title: 'Create product attribute',
      description: 'Create a product attribute with its option list.',
      method: 'POST',
      path: '/api/v2/product-attributes',
      input: {
        name: z.string().min(1).max(255).describe('Attribute name.'),
        code: z.string().min(1).max(100).describe('Unique attribute code.'),
        type: z.string().describe('Attribute type.'),
        show_in_list: flag('Show in the product list.').optional(),
        sort_order: z.number().int().optional().describe('Ordering.'),
        options: z.array(z.string()).optional().describe('Selectable options.'),
        is_active: flag('Active flag.').optional(),
      },
    },
    update: {
      title: 'Update product attribute',
      description: 'Update attribute fields; omitted keys are kept.',
      method: 'PUT',
      path: '/api/v2/product-attributes/{id}',
      input: {
        id: id('Attribute id.'),
        name: z.string().min(1).max(255).optional().describe('Attribute name.'),
        code: z.string().min(1).max(100).optional().describe('Unique attribute code.'),
        type: z.string().optional().describe('Attribute type.'),
        show_in_list: flag('Show in the product list.').optional(),
        sort_order: z.number().int().optional().describe('Ordering.'),
        options: z.array(z.string()).optional().describe('Selectable options.'),
        is_active: flag('Active flag.').optional(),
      },
    },
    delete: {
      title: 'Delete product attribute',
      description: 'Delete one product attribute. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/product-attributes/{id}',
      input: { id: id('Attribute id.') },
      guard: 'delete',
    },
    toggle: {
      title: 'Toggle product attribute',
      description: 'Flip is_active.',
      method: 'POST',
      path: '/api/v2/product-attributes/{id}/toggle',
      input: { id: id('Attribute id.') },
    },
  },
};

export function registerProductCategoryTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, productCategorySpec);
}

export function registerProductAttributeTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, productAttributeSpec);
}
