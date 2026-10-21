import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { flag, id, limit, page, search, sortOrder } from './schemas.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

/**
 * infrastructure: proxy pool (groups, proxies, account assignments) and the
 * mobile farm (device families, farm groups, dashboard).
 */

export const proxySpec: ResourceSpec = {
  name: 'manage_proxy',
  title: 'Manage proxies',
  description: 'kkAuto API v2 proxy pool: groups, proxy rows, connection tests and per-account assignments.',
  actions: {
    'list-groups': {
      title: 'List proxy groups',
      description: 'Paginated proxy groups.',
      method: 'GET',
      path: '/api/v2/proxy-groups',
      query: ['page', 'limit', 'search', 'sort_by', 'sort_order'],
      input: {
        page: page(),
        limit: limit(),
        search: search('Partial match on the group name or description.'),
        sort_by: z.enum(['id', 'name', 'created_at']).optional().describe('Sort column.'),
        sort_order: sortOrder(),
      },
    },
    'get-group': {
      title: 'Get proxy group',
      description: 'One proxy group by id.',
      method: 'GET',
      path: '/api/v2/proxy-groups/{id}',
      input: { id: id('Proxy group id.') },
    },
    'group-stats': {
      title: 'Proxy group stats',
      description: 'Live/dead counts for one proxy group.',
      method: 'GET',
      path: '/api/v2/proxy-groups/{id}/stats',
      input: { id: id('Proxy group id.') },
    },
    'create-group': {
      title: 'Create proxy group',
      description: 'Create a proxy group.',
      method: 'POST',
      path: '/api/v2/proxy-groups',
      input: {
        name: z.string().min(1).max(255).describe('Group name.'),
        description: z.string().max(1000).optional().describe('Group description.'),
        reset_ip: flag('Reset IP per session.').optional(),
        max_browsers: z.number().int().positive().optional().describe('Max concurrent browsers.'),
        static_proxy: flag('Static proxy group.').optional(),
      },
    },
    'update-group': {
      title: 'Update proxy group',
      description: 'Partial group update.',
      method: 'PUT',
      path: '/api/v2/proxy-groups/{id}',
      input: {
        id: id('Proxy group id.'),
        name: z.string().min(1).max(255).optional(),
        description: z.string().max(1000).optional(),
        reset_ip: flag('Reset IP per session.').optional(),
        max_browsers: z.number().int().positive().optional(),
        static_proxy: flag('Static proxy group.').optional(),
      },
    },
    'delete-group': {
      title: 'Delete proxy group',
      description: 'Delete a group; proxies still attached block it with IN_USE.',
      method: 'DELETE',
      path: '/api/v2/proxy-groups/{id}',
      input: { id: id('Proxy group id.') },
      guard: 'delete',
    },
    list: {
      title: 'List proxies',
      description: 'Paginated proxy rows; passwords are masked.',
      method: 'GET',
      path: '/api/v2/proxies',
      query: ['page', 'limit', 'search', 'sort_by', 'sort_order', 'group_id', 'status'],
      input: {
        page: page(),
        limit: limit(),
        search: search('Partial match on host/username.'),
        sort_by: z.enum(['id', 'host', 'port', 'status', 'last_checked_at']).optional().describe('Sort column.'),
        sort_order: sortOrder(),
        group_id: id('Group filter.').optional(),
        status: z.string().optional().describe('Proxy status filter.'),
      },
    },
    get: {
      title: 'Get proxy',
      description: 'One proxy row with masked password.',
      method: 'GET',
      path: '/api/v2/proxies/{id}',
      input: { id: id('Proxy id.') },
    },
    create: {
      title: 'Create proxy',
      description: 'Create a proxy row (or pass proxy_info as one host:port:user:pass string).',
      method: 'POST',
      path: '/api/v2/proxies',
      input: {
        group_id: id('Group id.').optional(),
        proxy_info: z.string().optional().describe('host:port:user:pass single-line form.'),
        host: z.string().optional().describe('Proxy host.'),
        port: z.number().int().positive().optional().describe('Proxy port.'),
        username: z.string().optional().describe('Proxy username.'),
        password: z.string().optional().describe('Proxy password.'),
        type: z.string().optional().describe('Proxy type, e.g. http or socks5.'),
      },
    },
    update: {
      title: 'Update proxy',
      description: 'Partial proxy update.',
      method: 'PUT',
      path: '/api/v2/proxies/{id}',
      input: {
        id: id('Proxy id.'),
        group_id: id('Group id.').optional(),
        host: z.string().optional(),
        port: z.number().int().positive().optional(),
        username: z.string().optional(),
        password: z.string().optional(),
        type: z.string().optional(),
        status: z.string().optional(),
      },
    },
    delete: {
      title: 'Delete proxy',
      description: 'Delete one proxy row.',
      method: 'DELETE',
      path: '/api/v2/proxies/{id}',
      input: { id: id('Proxy id.') },
      guard: 'delete',
    },
    import: {
      title: 'Import proxies',
      description: 'Import newline-separated proxy lines (capped at 500).',
      method: 'POST',
      path: '/api/v2/proxies/import',
      input: {
        group_id: id('Target group id.').optional(),
        lines: z.string().describe('Newline-separated host:port:user:pass entries.'),
        type: z.string().optional().describe('Proxy type applied to every imported row.'),
      },
      guard: 'confirm',
    },
    test: {
      title: 'Test proxy',
      description: 'Probe one proxy and persist its status.',
      method: 'POST',
      path: '/api/v2/proxies/{id}/test',
      input: { id: id('Proxy id.') },
      guard: 'confirm',
    },
    random: {
      title: 'Random proxy',
      description: 'Pick a live proxy (usage counters are incremented).',
      method: 'GET',
      path: '/api/v2/proxies/random',
      query: ['group_id'],
      input: { group_id: id('Group filter.').optional() },
    },
    'by-group': {
      title: 'Proxies by group',
      description: 'Active proxies of one group.',
      method: 'GET',
      path: '/api/v2/proxies/by-group/{id}',
      input: { id: id('Group id.') },
    },
    assignments: {
      title: 'List proxy assignments',
      description: 'Paginated account to proxy assignments.',
      method: 'GET',
      path: '/api/v2/proxy-assignments',
      query: ['page', 'limit', 'search', 'group_id'],
      input: {
        page: page(),
        limit: limit(),
        search: search('Partial match on account name.'),
        group_id: id('Group filter.').optional(),
      },
    },
    'assignment-stats': {
      title: 'Assignment stats',
      description: 'Coverage counters for proxy assignments.',
      method: 'GET',
      path: '/api/v2/proxy-assignments/stats',
    },
    assign: {
      title: 'Assign proxy',
      description: 'Assign a specific or random proxy to an account.',
      method: 'POST',
      path: '/api/v2/proxy-assignments/assign',
      input: {
        account_id: id('Account id.'),
        proxy_id: id('Proxy id; omit to pick a random proxy.').optional(),
        group_id: id('Group filter for the random pick.').optional(),
      },
      guard: 'confirm',
    },
    unassign: {
      title: 'Unassign proxy',
      description: 'Remove the proxy binding of an account.',
      method: 'POST',
      path: '/api/v2/proxy-assignments/unassign',
      input: { account_id: id('Account id.') },
      guard: 'confirm',
    },
    'bulk-assign': {
      title: 'Bulk assign proxies',
      description: 'Assign proxies to up to 500 accounts (random or round_robin).',
      method: 'POST',
      path: '/api/v2/proxy-assignments/bulk-assign',
      input: {
        account_ids: z.array(z.number().int().positive()).min(1).max(500).describe('Account ids.'),
        group_id: id('Group filter.').optional(),
        strategy: z.enum(['random', 'round_robin']).optional().describe('Assignment strategy.'),
      },
      guard: 'confirm',
    },
    'bulk-unassign': {
      title: 'Bulk unassign proxies',
      description: 'Remove proxy bindings for up to 500 accounts.',
      method: 'POST',
      path: '/api/v2/proxy-assignments/bulk-unassign',
      input: { account_ids: z.array(z.number().int().positive()).min(1).max(500).describe('Account ids.') },
      guard: 'confirm',
    },
  },
};

export const mobileFarmSpec: ResourceSpec = {
  name: 'manage_mobile_farm',
  title: 'Manage mobile farm',
  description: 'kkAuto API v2 mobile farm: device families, farm groups and the phone runtime dashboard.',
  actions: {
    'list-families': {
      title: 'List device families',
      description: 'Paginated device families.',
      method: 'GET',
      path: '/api/v2/device-families',
      query: ['page', 'limit', 'search', 'sort_by', 'sort_order'],
      input: {
        page: page(),
        limit: limit(),
        search: search('Partial match on the family name.'),
        sort_by: z.enum(['id', 'name', 'created_at']).optional().describe('Sort column.'),
        sort_order: sortOrder(),
      },
    },
    'get-family': {
      title: 'Get device family',
      description: 'One device family with bound phones and accounts.',
      method: 'GET',
      path: '/api/v2/device-families/{id}',
      input: { id: id('Device family id.') },
    },
    'create-family': {
      title: 'Create device family',
      description: 'Create a custom device family.',
      method: 'POST',
      path: '/api/v2/device-families',
      input: {
        name: z.string().min(1).max(255).describe('Family name.'),
        brand: z.string().optional().describe('Brand.'),
        model: z.string().optional().describe('Model.'),
        os_version: z.string().optional().describe('OS version.'),
        screen: z.string().optional().describe('Screen resolution.'),
        user_agent: z.string().optional().describe('User agent.'),
      },
    },
    'update-family': {
      title: 'Update device family',
      description: 'Partial family update.',
      method: 'PUT',
      path: '/api/v2/device-families/{id}',
      input: {
        id: id('Device family id.'),
        name: z.string().min(1).max(255).optional(),
        brand: z.string().optional(),
        model: z.string().optional(),
        os_version: z.string().optional(),
        screen: z.string().optional(),
        user_agent: z.string().optional(),
      },
    },
    'delete-family': {
      title: 'Delete device family',
      description: 'Delete a custom family; bound phones block it.',
      method: 'DELETE',
      path: '/api/v2/device-families/{id}',
      input: { id: id('Device family id.') },
      guard: 'delete',
    },
    'restore-defaults': {
      title: 'Restore system families',
      description: 'Recreate the shipped device families and prune unbound custom ones.',
      method: 'POST',
      path: '/api/v2/device-families/restore-defaults',
      guard: 'confirm',
    },
    'register-phone': {
      title: 'Register phone',
      description: 'Register a phone against a device family.',
      method: 'POST',
      path: '/api/v2/device-families/register-phone',
      input: {
        phone_id: z.string().min(1).describe('Phone identifier.'),
        family_id: id('Device family id.').optional(),
      },
      guard: 'confirm',
    },
    'list-groups': {
      title: 'List farm groups',
      description: 'Paginated mobile farm groups.',
      method: 'GET',
      path: '/api/v2/mobile-farm/groups',
      query: ['page', 'limit', 'search', 'sort_by', 'sort_order'],
      input: {
        page: page(),
        limit: limit(),
        search: search('Partial match on the group id or description.'),
        sort_by: z.enum(['id', 'created_at', 'updated_at']).optional().describe('Sort column.'),
        sort_order: sortOrder(),
      },
    },
    'get-group': {
      title: 'Get farm group',
      description: 'One farm group with its phones and runtime.',
      method: 'GET',
      path: '/api/v2/mobile-farm/groups/{id}',
      input: { id: id('Group id.') },
    },
    'create-group': {
      title: 'Create farm group',
      description: 'Create a farm group.',
      method: 'POST',
      path: '/api/v2/mobile-farm/groups',
      input: {
        id: z.string().min(2).max(64).describe('Group id (lowercase letters, digits, - and _).'),
        description: z.string().max(500).optional().describe('Group description.'),
      },
    },
    'update-group': {
      title: 'Update farm group',
      description: 'Partial group update.',
      method: 'PUT',
      path: '/api/v2/mobile-farm/groups/{id}',
      input: { id: id('Group id.'), description: z.string().max(500).optional().describe('Group description.') },
    },
    'delete-group': {
      title: 'Delete farm group',
      description: 'Delete a group; phones still referenced block it with IN_USE.',
      method: 'DELETE',
      path: '/api/v2/mobile-farm/groups/{id}',
      input: { id: id('Group id.') },
      guard: 'delete',
    },
    'assign-phone': {
      title: 'Assign phone to group',
      description: 'Attach one phone to a farm group.',
      method: 'POST',
      path: '/api/v2/mobile-farm/groups/{id}/assign-phone',
      input: { id: id('Group id.'), phone_id: z.string().min(1).describe('Phone identifier.') },
      guard: 'confirm',
    },
    dashboard: {
      title: 'Farm dashboard',
      description: 'Phone fleet counters, runtime rows and family filter options.',
      method: 'GET',
      path: '/api/v2/mobile-farm/dashboard',
      query: ['device_status', 'family'],
      input: {
        device_status: z.enum(['active', 'inactive']).optional().describe('Device status filter.'),
        family: z.string().optional().describe('Device family filter.'),
      },
    },
  },
};

export function registerProxyTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, proxySpec);
}

export function registerMobileFarmTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, mobileFarmSpec);
}
