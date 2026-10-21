import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { id, limit, page, search } from './schemas.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

/**
 * platforms: browser profiles across the gpm, gpmglobal and kkbrowser backends,
 * including sharing, lifecycle actions and kkbrowser machine/artifact access.
 */

const kind = z.enum(['gpm', 'gpmglobal', 'kkbrowser']).describe('Profile backend.');

const profileFields = {
  name: z.string().optional().describe('Profile name.'),
  note: z.string().optional().describe('Free-form note.'),
  group_id: id('Profile group id.').optional(),
};

export const profileSpec: ResourceSpec = {
  name: 'manage_profile',
  title: 'Manage browser profiles',
  description: 'kkAuto API v2 browser profiles: list, read, update, stats, sharing, bulk share/group change and kkbrowser open/unlock/machine actions.',
  actions: {
    list: {
      title: 'List profiles',
      description: 'Paginated profile list for one backend.',
      method: 'GET',
      path: '/api/v2/profiles/{kind}',
      query: ['q', 'page', 'pageSize', 'limit', 'search', 'share_mode', 'group_id', 'group_name', 'status', 'lock_status', 'has_artifact'],
      input: {
        kind,
        q: z.string().optional().describe('Free-form search.'),
        page: page(),
        pageSize: z.number().int().positive().optional().describe('Page size (the backend default is 100).'),
        limit: limit(),
        search: search('Partial match on the profile name.'),
        share_mode: z.number().int().optional().describe('Share mode filter.'),
        group_id: z.union([z.number().int(), z.string()]).optional().describe('Group id or name filter.'),
        group_name: z.string().optional().describe('Group name filter.'),
        status: z.string().optional().describe('Status filter.'),
        lock_status: z.string().optional().describe('Lock status filter.'),
        has_artifact: z.string().optional().describe('Artifact presence filter.'),
      },
    },
    get: {
      title: 'Get profile',
      description: 'One profile by id.',
      method: 'GET',
      path: '/api/v2/profiles/{kind}/{id}',
      input: { kind, id: z.union([z.number().int().positive(), z.string().min(1)]).describe('Profile id (uuid for gpmglobal).') },
    },
    update: {
      title: 'Update profile',
      description: 'Update profile fields; omitted keys are kept.',
      method: 'PUT',
      path: '/api/v2/profiles/{kind}/{id}',
      input: { kind, id: z.union([z.number().int().positive(), z.string().min(1)]).describe('Profile id.'), ...profileFields },
    },
    stats: {
      title: 'Profile stats',
      description: 'Profile counts for one backend.',
      method: 'GET',
      path: '/api/v2/profiles/{kind}/stats',
      input: { kind },
    },
    share: {
      title: 'Share profile',
      description: 'Grant another admin access to this profile.',
      method: 'POST',
      path: '/api/v2/profiles/{kind}/{id}/share',
      input: {
        kind,
        id: z.union([z.number().int().positive(), z.string().min(1)]).describe('Profile id.'),
        admin_user_id: id('Admin user id to share with.'),
        role: z.number().int().optional().describe('Role id granted.'),
      },
    },
    'shared-users': {
      title: 'List shared users',
      description: 'Admins that can access this profile.',
      method: 'GET',
      path: '/api/v2/profiles/{kind}/{id}/shared-users',
      input: { kind, id: z.union([z.number().int().positive(), z.string().min(1)]).describe('Profile id.') },
    },
    revoke: {
      title: 'Revoke profile access',
      description: 'Remove one admin from this profile.',
      method: 'POST',
      path: '/api/v2/profiles/{kind}/{id}/revoke',
      input: {
        kind,
        id: z.union([z.number().int().positive(), z.string().min(1)]).describe('Profile id.'),
        admin_user_id: id('Admin user id to revoke.'),
      },
      guard: 'confirm',
    },
    'bulk-share': {
      title: 'Bulk share profiles',
      description: 'Share many profiles with one admin (max 500).',
      method: 'POST',
      path: '/api/v2/profiles/{kind}/bulk-share',
      input: {
        kind,
        profile_ids: z.array(z.union([z.number().int().positive(), z.string().min(1)])).min(1).max(500).describe('Profile ids.'),
        admin_user_id: id('Admin user id to share with.'),
        role: z.number().int().optional().describe('Role id granted.'),
      },
      guard: 'confirm',
    },
    'bulk-change-group': {
      title: 'Bulk change group',
      description: 'Move many profiles into one group (max 500).',
      method: 'POST',
      path: '/api/v2/profiles/{kind}/bulk-change-group',
      input: {
        kind,
        profile_ids: z.array(z.union([z.number().int().positive(), z.string().min(1)])).min(1).max(500).describe('Profile ids.'),
        group_id: id('Target group id.'),
      },
      guard: 'confirm',
    },
    open: {
      title: 'Open profile',
      description: 'Ask the backend to open the profile browser.',
      method: 'POST',
      path: '/api/v2/profiles/{kind}/{id}/open',
      input: { kind, id: z.union([z.number().int().positive(), z.string().min(1)]).describe('Profile id.') },
      guard: 'confirm',
    },
    machines: {
      title: 'List machines',
      description: 'kkbrowser machines that can hold this profile.',
      method: 'GET',
      path: '/api/v2/profiles/{kind}/{id}/machines',
      input: { kind, id: z.union([z.number().int().positive(), z.string().min(1)]).describe('Profile id.') },
    },
    'machine-token': {
      title: 'Issue machine token',
      description: 'Mint a machine access token for this kkbrowser profile.',
      method: 'POST',
      path: '/api/v2/profiles/{kind}/{id}/machine-token',
      input: {
        kind,
        id: z.union([z.number().int().positive(), z.string().min(1)]).describe('Profile id.'),
        admin_user_id: id('Admin user id the token belongs to.').optional(),
      },
      guard: 'confirm',
    },
    unlock: {
      title: 'Unlock profile',
      description: 'Clear the profile lock held by a crashed browser.',
      method: 'POST',
      path: '/api/v2/profiles/{kind}/{id}/unlock',
      input: { kind, id: z.union([z.number().int().positive(), z.string().min(1)]).describe('Profile id.') },
      guard: 'confirm',
    },
    artifacts: {
      title: 'List artifacts',
      description: 'kkbrowser artifacts stored for this profile.',
      method: 'GET',
      path: '/api/v2/profiles/{kind}/{id}/artifacts',
      input: { kind, id: z.union([z.number().int().positive(), z.string().min(1)]).describe('Profile id.') },
    },
  },
};

export function registerProfileTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, profileSpec);
}
