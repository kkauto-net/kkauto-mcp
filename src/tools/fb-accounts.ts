import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { flag, id, limit, page, search } from './schemas.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

const fbLevel = z.number().int().min(0).max(4);
const nestedSections = {
  security: z.record(z.string(), z.unknown()).optional().describe('Nested fb_account_security fields.'),
  social: z.record(z.string(), z.unknown()).optional().describe('Nested fb_account_social fields.'),
  activity: z.record(z.string(), z.unknown()).optional().describe('Nested fb_account_activity fields.'),
};

export const fbAccountSpec: ResourceSpec = {
  name: 'manage_fb_account',
  title: 'Manage FB accounts',
  description: 'kkAuto API v2 Facebook accounts: CRUD, status transitions, statistics, and tag/category lookups.',
  actions: {
    list: {
      title: 'List FB accounts',
      description: 'Paginated FB account list with status, level, category, and search filters.',
      method: 'GET',
      path: '/api/v2/fb-accounts',
      query: ['page', 'limit', 'u_active', 'u_status', 'fb_level', 'fb_type', 'cat_id', 'u_live', 'f_block', 'search', 'search_field'],
      input: {
        page: page(),
        limit: limit(),
        u_active: flag('Active flag.').optional(),
        u_status: z.string().optional(),
        fb_level: fbLevel.optional(),
        fb_type: z.string().optional(),
        cat_id: id('Category id.').optional(),
        u_live: flag('Live flag.').optional(),
        f_block: flag('Blocked flag.').optional(),
        search: search(),
        search_field: z.enum(['all', 'u_name', 'u_mail', 'u_uid', 'tag']).optional().describe('Default is all.'),
      },
    },
    get: {
      title: 'Get FB account',
      description: 'One FB account by id; credential fields are omitted.',
      method: 'GET',
      path: '/api/v2/fb-accounts/{id}',
      input: { id: id('FB account id.') },
    },
    search: {
      title: 'Search FB account',
      description: 'Single-record lookup by type u_id, u_uid, or u_mail.',
      method: 'GET',
      path: '/api/v2/fb-accounts/search',
      query: ['type', 'value'],
      input: {
        type: z.enum(['u_id', 'u_uid', 'u_mail']),
        value: z.string().min(1),
      },
    },
    'search-by-tag': {
      title: 'Search FB accounts by tag',
      description: 'List FB accounts carrying one tag name.',
      method: 'GET',
      path: '/api/v2/fb-accounts/search-by-tag',
      query: ['tag', 'page', 'limit'],
      input: {
        tag: z.string().min(1).describe('Tag name filter.'),
        page: page(),
        limit: limit(),
      },
    },
    'search-by-category': {
      title: 'Search FB accounts by category',
      description: 'List FB accounts belonging to one category id.',
      method: 'GET',
      path: '/api/v2/fb-accounts/search-by-category',
      query: ['category_id', 'page', 'limit'],
      input: {
        category_id: id('Category id.'),
        page: page(),
        limit: limit(),
      },
    },
    stats: {
      title: 'Get FB account stats',
      description: 'Aggregate FB account statistics for the current tenant.',
      method: 'GET',
      path: '/api/v2/fb-accounts/stats',
      input: {},
    },
    create: {
      title: 'Create FB account',
      description: 'Create one FB account; the API enforces license limits and duplicate checks.',
      method: 'POST',
      path: '/api/v2/fb-accounts',
      input: {
        u_mail: z.string().min(1).describe('Account email.'),
        u_pass: z.string().min(1).describe('Account password; never returned by the API.'),
        u_name: z.string().optional(),
        u_uid: z.string().optional().describe('Facebook UID.'),
        u_active: flag('Defaults to 1.').optional(),
        u_status: z.string().optional().describe('Defaults to new.'),
        fb_level: fbLevel.optional().describe('Defaults to 0.'),
        fb_type: z.string().optional().describe('Defaults to add.'),
        cat_id: id('Category id.').optional(),
        u_language: z.string().optional().describe('Defaults to EN.'),
        ...nestedSections,
      },
    },
    update: {
      title: 'Update FB account',
      description: 'Partial update of one FB account; nested security/social/activity sections replace their blocks.',
      method: 'PUT',
      path: '/api/v2/fb-accounts/{id}',
      input: {
        id: id('FB account id.'),
        u_name: z.string().optional(),
        u_uid: z.string().optional(),
        u_mail: z.string().optional(),
        cat_id: id('Category id.').optional(),
        u_pass: z.string().optional(),
        u_proxy: z.string().optional(),
        u_type: z.string().optional(),
        u_active: flag('Active flag.').optional(),
        u_fullname: z.string().optional(),
        u_status: z.string().optional(),
        u_live: flag('Live flag.').optional(),
        u_note: z.string().optional(),
        u_language: z.string().optional(),
        f_block: flag('Blocked flag.').optional(),
        f_login: flag('Login flag.').optional(),
        fb_level: fbLevel.optional(),
        fb_type: z.string().optional(),
        ...nestedSections,
      },
    },
    status: {
      title: 'Update FB account status',
      description: 'Set the status of one FB account through the status service; the transition is logged.',
      method: 'PATCH',
      path: '/api/v2/fb-accounts/{id}/status',
      input: {
        id: id('FB account id.'),
        u_status: z.string().min(1).describe('New account status value.'),
      },
    },
    delete: {
      title: 'Delete FB account',
      description: 'Delete one FB account. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/fb-accounts/{id}',
      input: { id: id('FB account id.') },
      guard: 'delete',
    },
  },
};

export function registerFbAccountTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, fbAccountSpec);
}
