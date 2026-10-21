import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { flag, id, limit, page, search, sortBy, sortOrder } from './schemas.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

/**
 * system: admin users, API tokens, notification centre, storage backends.
 */

const listQuery = (filters: string[]) => ['page', 'limit', 'search', 'sort_by', 'sort_order', ...filters];

export const adminUserSpec: ResourceSpec = {
  name: 'manage_admin_user',
  title: 'Manage admin users',
  description: 'kkAuto API v2 admin accounts: list, read, create, update, delete, permissions and two-factor activation.',
  actions: {
    list: {
      title: 'List admin users',
      description: 'Paginated admin users with status and super-admin filters.',
      method: 'GET',
      path: '/api/v2/system/users',
      query: listQuery(['status', 'is_super_admin']),
      input: {
        page: page(),
        limit: limit(),
        search: search('Partial match on username, email or full name.'),
        sort_by: sortBy(['id', 'username', 'email', 'status', 'is_super_admin', 'last_login', 'created_at']),
        sort_order: sortOrder(),
        status: z.enum(['active', 'inactive']).optional().describe('Account status filter.'),
        is_super_admin: flag('Super-admin filter.').optional(),
      },
    },
    get: {
      title: 'Get admin user',
      description: 'One admin user by id, without password or 2FA secrets.',
      method: 'GET',
      path: '/api/v2/system/users/{id}',
      input: { id: id('Admin user id.') },
    },
    create: {
      title: 'Create admin user',
      description: 'Create an admin account with optional permission keys.',
      method: 'POST',
      path: '/api/v2/system/users',
      input: {
        username: z.string().min(3).max(100).describe('Login name.'),
        email: z.string().email().optional().describe('Email address.'),
        password: z.string().min(8).describe('Plain password.'),
        full_name: z.string().max(255).optional().describe('Display name.'),
        status: z.enum(['active', 'inactive']).optional().describe('Account status, default inactive.'),
        is_super_admin: flag('Super-admin flag.').optional(),
        permission_keys: z.array(z.string()).optional().describe('Permission keys to grant.'),
      },
      admin: true,
    },
    update: {
      title: 'Update admin user',
      description: 'Update identity, status, super-admin flag or permission keys; a blank password keeps the hash.',
      method: 'PUT',
      path: '/api/v2/system/users/{id}',
      input: {
        id: id('Admin user id.'),
        username: z.string().min(3).max(100).optional().describe('Login name.'),
        email: z.string().email().optional().describe('Email address.'),
        password: z.string().min(8).optional().describe('New plain password.'),
        full_name: z.string().max(255).optional().describe('Display name.'),
        status: z.enum(['active', 'inactive']).optional().describe('Account status.'),
        is_super_admin: flag('Super-admin flag.').optional(),
        permission_keys: z.array(z.string()).optional().describe('Full replacement of the granted permission keys.'),
      },
      admin: true,
    },
    delete: {
      title: 'Delete admin user',
      description: 'Delete an admin user; the last super admin is refused. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/system/users/{id}',
      input: { id: id('Admin user id.') },
      guard: 'delete',
      admin: true,
    },
    permissions: {
      title: 'Get user permissions',
      description: 'Granted permission keys plus the assignable set.',
      method: 'GET',
      path: '/api/v2/system/users/{id}/permissions',
      input: { id: id('Admin user id.') },
      admin: true,
    },
    'update-permissions': {
      title: 'Replace user permissions',
      description: 'Replace the permission keys granted to one admin user.',
      method: 'PUT',
      path: '/api/v2/system/users/{id}/permissions',
      input: {
        id: id('Admin user id.'),
        permission_keys: z.array(z.string()).describe('Full permission key set; empty revokes everything.'),
      },
      admin: true,
    },
    'activate-2fa': {
      title: 'Activate 2FA',
      description: 'Without secret returns a new secret and otpauth URL; with secret + code enables 2FA and returns recovery codes.',
      method: 'POST',
      path: '/api/v2/system/users/{id}/2fa/activate',
      input: {
        id: id('Admin user id.'),
        secret: z.string().optional().describe('Secret being confirmed; omit to generate one.'),
        code: z.string().optional().describe('TOTP code confirming the secret.'),
      },
      admin: true,
    },
    'disable-2fa': {
      title: 'Disable 2FA',
      description: 'Disable two-factor authentication for one admin user.',
      method: 'POST',
      path: '/api/v2/system/users/{id}/2fa/disable',
      input: { id: id('Admin user id.') },
      admin: true,
    },
    'recovery-codes': {
      title: 'Get 2FA recovery codes',
      description: 'Remaining two-factor recovery codes for one admin user.',
      method: 'GET',
      path: '/api/v2/system/users/{id}/2fa/recovery-codes',
      input: { id: id('Admin user id.') },
      admin: true,
    },
  },
};

export const apiTokenSpec: ResourceSpec = {
  name: 'manage_api_token',
  title: 'Manage API tokens',
  description: 'kkAuto API v2 admin tokens: list, read, create (plaintext returned once), update, toggle and delete.',
  actions: {
    list: {
      title: 'List tokens',
      description: 'Paginated token records with status, type and owner filters.',
      method: 'GET',
      path: '/api/v2/system/tokens',
      query: listQuery(['status', 'type', 'is_permanent', 'created_by']),
      input: {
        page: page(),
        limit: limit(),
        search: search('Partial match on name, device name or token prefix.'),
        sort_by: sortBy(['id', 'name', 'status', 'type', 'last_used_at', 'expires_at', 'created_at']),
        sort_order: sortOrder(),
        status: z.enum(['active', 'inactive']).optional().describe('Status filter.'),
        type: z.enum(['api', 'client', 'gpm', 'gpmglobal']).optional().describe('Token type filter.'),
        is_permanent: flag('Permanent-token filter.').optional(),
        created_by: id('Creator user id.').optional(),
      },
      admin: true,
    },
    get: {
      title: 'Get token',
      description: 'One token record by id, without the token value.',
      method: 'GET',
      path: '/api/v2/system/tokens/{id}',
      input: { id: id('Token id.') },
      admin: true,
    },
    create: {
      title: 'Create token',
      description: 'Issue a token; the plaintext value is returned in this response only.',
      method: 'POST',
      path: '/api/v2/system/tokens',
      input: {
        name: z.string().min(3).max(100).describe('Token name, at least 3 characters.'),
        type: z.enum(['api', 'client', 'gpm', 'gpmglobal']).optional().describe('Token type, default api.'),
        is_permanent: flag('1 = never expires.').optional(),
        expires_at: z.string().optional().describe('Expiry date, required unless is_permanent=1.'),
        scopes: z.array(z.string()).optional().describe('Scope subset; omitted keeps legacy full access.'),
      },
      admin: true,
    },
    update: {
      title: 'Update token',
      description: 'Rename a token or change its status.',
      method: 'PUT',
      path: '/api/v2/system/tokens/{id}',
      input: {
        id: id('Token id.'),
        name: z.string().min(3).max(100).optional().describe('Token name.'),
        status: z.enum(['active', 'inactive']).optional().describe('Status.'),
      },
      admin: true,
    },
    toggle: {
      title: 'Toggle token status',
      description: 'Flip a token between active and inactive.',
      method: 'POST',
      path: '/api/v2/system/tokens/{id}/toggle',
      input: { id: id('Token id.') },
      admin: true,
    },
    delete: {
      title: 'Delete token',
      description: 'Delete one token record. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/system/tokens/{id}',
      input: { id: id('Token id.') },
      guard: 'delete',
      admin: true,
    },
  },
};

const notificationFilters = {
  group_key: z.string().optional().describe('Notification group key.'),
  classification: z.string().optional().describe('Classification key.'),
  read_state: z.enum(['read', 'unread']).optional().describe('Read state filter.'),
  summary_date: z.string().optional().describe('Summary date, YYYY-MM-DD.'),
};

export const notificationSpec: ResourceSpec = {
  name: 'manage_notification',
  title: 'Manage notifications',
  description: 'kkAuto API v2 notification centre: list summaries, unread count, latest unread and mark-as-read.',
  actions: {
    list: {
      title: 'List notifications',
      description: 'Paginated notification summaries with group, classification and read-state filters.',
      method: 'GET',
      path: '/api/v2/system/notifications',
      query: ['page', 'limit', 'group_key', 'classification', 'read_state', 'summary_date'],
      input: {
        page: page(),
        limit: limit(),
        ...notificationFilters,
      },
    },
    count: {
      title: 'Unread count',
      description: 'Number of unread notification summaries.',
      method: 'GET',
      path: '/api/v2/system/notifications/count',
    },
    latest: {
      title: 'Latest unread',
      description: 'Most recent unread summaries plus the unread count.',
      method: 'GET',
      path: '/api/v2/system/notifications/latest',
      query: ['limit'],
      input: { limit: limit() },
    },
    'mark-read': {
      title: 'Mark one read',
      description: 'Mark one notification summary as read.',
      method: 'POST',
      path: '/api/v2/system/notifications/{id}/mark-read',
      input: { id: id('Notification summary id.') },
    },
    'mark-all-read': {
      title: 'Mark all read',
      description: 'Mark every summary read, or only those matching the given filters.',
      method: 'POST',
      path: '/api/v2/system/notifications/mark-all-read',
      input: {
        scope: z.enum(['all', 'filtered']).describe('all = every summary, filtered = only the given filters.'),
        ...notificationFilters,
      },
    },
  },
};

export const storageBackendSpec: ResourceSpec = {
  name: 'manage_storage_backend',
  title: 'Manage storage backends',
  description: 'kkAuto API v2 storage backends: CRUD, activation, health test, feature bindings and secret reveal.',
  actions: {
    list: {
      title: 'List backends',
      description: 'Paginated storage backends with driver and health filters.',
      method: 'GET',
      path: '/api/v2/system/storage-backends',
      query: listQuery(['driver', 'is_active', 'last_health_status']),
      input: {
        page: page(),
        limit: limit(),
        search: search('Partial match on name or driver.'),
        sort_by: sortBy(['id', 'name', 'driver', 'is_active', 'last_health_checked_at', 'created_at']),
        sort_order: sortOrder(),
        driver: z.string().optional().describe('Driver filter.'),
        is_active: flag('Active flag filter.').optional(),
        last_health_status: z.string().optional().describe('Last health status filter.'),
      },
      admin: true,
    },
    get: {
      title: 'Get backend',
      description: 'One storage backend with its configuration secrets masked.',
      method: 'GET',
      path: '/api/v2/system/storage-backends/{id}',
      input: { id: id('Storage backend id.') },
      admin: true,
    },
    create: {
      title: 'Create backend',
      description: 'Register a storage backend; credentials inside config are encrypted on write.',
      method: 'POST',
      path: '/api/v2/system/storage-backends',
      input: {
        name: z.string().min(1).max(100).describe('Backend name.'),
        driver: z.string().min(1).describe('Storage driver key.'),
        config: z.record(z.string(), z.unknown()).optional().describe('Driver configuration map.'),
        is_active: flag('Active flag.').optional(),
      },
      admin: true,
    },
    update: {
      title: 'Update backend',
      description: 'Update name, driver, configuration or active flag; blank secrets keep the stored values.',
      method: 'PUT',
      path: '/api/v2/system/storage-backends/{id}',
      input: {
        id: id('Storage backend id.'),
        name: z.string().min(1).max(100).optional().describe('Backend name.'),
        driver: z.string().optional().describe('Storage driver key.'),
        config: z.record(z.string(), z.unknown()).optional().describe('Driver configuration map.'),
        is_active: flag('Active flag.').optional(),
      },
      admin: true,
    },
    toggle: {
      title: 'Toggle backend',
      description: 'Flip a storage backend between active and inactive.',
      method: 'POST',
      path: '/api/v2/system/storage-backends/{id}/toggle',
      input: { id: id('Storage backend id.') },
      admin: true,
    },
    test: {
      title: 'Test backend',
      description: 'Run the driver health check and record the result on the backend row.',
      method: 'POST',
      path: '/api/v2/system/storage-backends/{id}/test',
      input: { id: id('Storage backend id.') },
      admin: true,
    },
    bindings: {
      title: 'Get bindings',
      description: 'Feature to backend bindings grouped by feature key.',
      method: 'GET',
      path: '/api/v2/system/storage-backends/bindings',
      admin: true,
    },
    'update-bindings': {
      title: 'Replace bindings',
      description: 'Replace the feature bindings; rows absent from a feature are removed.',
      method: 'PUT',
      path: '/api/v2/system/storage-backends/bindings',
      input: {
        bindings: z
          .record(
            z.string(),
            z.record(
              z.string(),
              z.object({
                priority: z.number().int().min(0).optional(),
                weight: z.number().int().min(1).optional(),
                is_active: flag('Active flag.').optional(),
              }),
            ),
          )
          .describe('feature_key => backend_id => binding.'),
      },
      admin: true,
    },
    'reveal-secret': {
      title: 'Reveal secret',
      description: 'Reveal one plaintext credential field; the call is audited.',
      method: 'GET',
      path: '/api/v2/system/storage-backends/{id}/reveal-secret',
      query: ['field'],
      input: {
        id: id('Storage backend id.'),
        field: z.string().min(1).describe('Secret config field to reveal.'),
      },
      admin: true,
    },
    delete: {
      title: 'Delete backend',
      description: 'Delete one storage backend. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/system/storage-backends/{id}',
      input: { id: id('Storage backend id.') },
      guard: 'delete',
      admin: true,
    },
  },
};

export function registerSystemTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, adminUserSpec);
  registerResourceTools(server, client, config, apiTokenSpec);
  registerResourceTools(server, client, config, notificationSpec);
  registerResourceTools(server, client, config, storageBackendSpec);
}
