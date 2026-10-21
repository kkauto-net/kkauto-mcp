import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { flag, id, limit, page, search, sortBy, sortOrder } from './schemas.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

/**
 * platforms: non-Facebook social accounts (ig, google, pinterest, tiktok,
 * douyin, x, zalo) behind one `{platform}` path segment.
 */

const platform = z.enum(['ig', 'google', 'pinterest', 'tiktok', 'douyin', 'x', 'zalo']).describe('Account platform.');

const accountFields = {
  u_name: z.string().optional().describe('Display name.'),
  u_username: z.string().optional().describe('Login username.'),
  u_uid: z.string().optional().describe('Platform user id.'),
  u_pass: z.string().optional().describe('Password; encrypted on write.'),
  u_2fa: z.string().optional().describe('2FA secret; encrypted on write.'),
  u_recover_email: z.string().optional().describe('Recovery email.'),
  u_cookie: z.string().optional().describe('Raw cookie string.'),
  u_proxy: z.string().optional().describe('Proxy string (validated by the API).'),
  u_note: z.string().optional().describe('Free-form note.'),
  u_active: flag('Active flag.').optional(),
  u_status: z.enum(['new', 'live', 'login', 'die']).optional().describe('Account status.'),
  u_live: flag('Live flag.').optional(),
};

export const socialAccountSpec: ResourceSpec = {
  name: 'manage_social_account',
  title: 'Manage social accounts',
  description: 'kkAuto API v2 accounts for ig, google, pinterest, tiktok, douyin, x and zalo: CRUD, bulk delete, status, profiles, secret reveal and stats.',
  actions: {
    list: {
      title: 'List accounts',
      description: 'Paginated account list for one platform.',
      method: 'GET',
      path: '/api/v2/accounts/{platform}',
      query: ['page', 'limit', 'search', 'status', 'u_active', 'sort_by', 'sort_order'],
      input: {
        platform,
        page: page(),
        limit: limit(),
        search: search('Partial match on name/username/uid.'),
        status: z.string().optional().describe('Status filter.'),
        u_active: flag('Active filter.').optional(),
        sort_by: sortBy(['u_id', 'u_name', 'u_username', 'u_uid', 'u_status', 'u_active', 'created_at', 'updated_at']),
        sort_order: sortOrder(),
      },
    },
    get: {
      title: 'Get account',
      description: 'One account without credential material.',
      method: 'GET',
      path: '/api/v2/accounts/{platform}/{id}',
      input: { platform, id: id('Account id.') },
    },
    create: {
      title: 'Create account',
      description: 'Create an account; secrets are encrypted and never returned.',
      method: 'POST',
      path: '/api/v2/accounts/{platform}',
      input: { platform, ...accountFields },
    },
    update: {
      title: 'Update account',
      description: 'Update account fields; omitted keys are kept and empty secrets keep the stored value.',
      method: 'PUT',
      path: '/api/v2/accounts/{platform}/{id}',
      input: { platform, id: id('Account id.'), ...accountFields },
    },
    delete: {
      title: 'Delete account',
      description: 'Delete one account. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/accounts/{platform}/{id}',
      input: { platform, id: id('Account id.') },
      guard: 'delete',
    },
    'bulk-delete': {
      title: 'Bulk delete accounts',
      description: 'Delete up to 500 accounts of one platform.',
      method: 'POST',
      path: '/api/v2/accounts/{platform}/bulk-delete',
      input: {
        platform,
        ids: z.array(z.number().int().positive()).min(1).max(500).describe('Account ids.'),
      },
      guard: 'confirm',
    },
    status: {
      title: 'Set account status',
      description: 'Update only u_status (new|live|login|die).',
      method: 'PATCH',
      path: '/api/v2/accounts/{platform}/{id}/status',
      input: {
        platform,
        id: id('Account id.'),
        u_status: z.enum(['new', 'live', 'login', 'die']).describe('New status.'),
      },
    },
    profiles: {
      title: 'Account browser profiles',
      description: 'Browser profiles bound to this account.',
      method: 'GET',
      path: '/api/v2/accounts/{platform}/{id}/profiles',
      input: { platform, id: id('Account id.') },
    },
    'reveal-secret': {
      title: 'Reveal account secret',
      description: 'Return one plaintext secret field; requires apiv2.admin and is audited.',
      method: 'GET',
      path: '/api/v2/accounts/{platform}/{id}/reveal-secret',
      query: ['field'],
      input: {
        platform,
        id: id('Account id.'),
        field: z.enum(['pass', '2fa']).describe('Secret field to reveal.'),
      },
    },
    stats: {
      title: 'Platform account stats',
      description: 'Account counts by status for one platform.',
      method: 'GET',
      path: '/api/v2/accounts/{platform}/stats',
      input: { platform },
    },
  },
};

export function registerSocialAccountTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, socialAccountSpec);
}
