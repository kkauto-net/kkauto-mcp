import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { id, limit, page, search, sortBy, sortOrder } from './schemas.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

/**
 * fb-uids: the Facebook uid directory (clone/source profiles and their stats).
 */

const uidFields = {
  fb_uid: z.string().min(1).max(64).optional().describe('Facebook uid.'),
  fb_user: z.string().max(255).optional().describe('Facebook username.'),
  fb_fullname: z.string().max(255).optional().describe('Display name.'),
  fb_info: z.string().optional().describe('Raw profile info.'),
  fb_friends: z.number().int().min(0).optional().describe('Friend count.'),
  fb_birthday: z.string().max(32).optional().describe('Birthday.'),
  fb_clone: z.string().max(64).optional().describe('Clone flag.'),
  fb_check: z.string().max(64).optional().describe('Check flag.'),
  type: z.number().int().optional().describe('Directory type.'),
  target_id: id('Target id.').optional(),
  total_like: z.number().int().min(0).optional().describe('Likes performed.'),
  total_comment: z.number().int().min(0).optional().describe('Comments performed.'),
  total_author: z.number().int().min(0).optional().describe('Authored posts.'),
  total_add: z.number().int().min(0).optional().describe('Friend requests sent.'),
};

export const fbUidSpec: ResourceSpec = {
  name: 'manage_fb_uid',
  title: 'Manage Facebook uids',
  description: 'kkAuto API v2 uid directory: list, read, create, update, delete, friends, type, note and info writes.',
  actions: {
    list: {
      title: 'List uids',
      description: 'Paginated uid directory with clone, type and target filters.',
      method: 'GET',
      path: '/api/v2/fb-uids',
      query: ['page', 'limit', 'search', 'sort_by', 'sort_order', 'fb_clone', 'type', 'target_id'],
      input: {
        page: page(),
        limit: limit(),
        search: search('Partial match on uid, username, full name or info.'),
        sort_by: sortBy(['fb_id', 'fb_uid', 'fb_user', 'fb_fullname', 'fb_clone', 'fb_friends', 'total_like', 'total_comment', 'total_author', 'total_add']),
        sort_order: sortOrder(),
        fb_clone: z.string().optional().describe('Clone flag filter.'),
        type: z.number().int().optional().describe('Type filter.'),
        target_id: id('Target id filter.').optional(),
      },
    },
    get: {
      title: 'Get uid',
      description: 'One uid row by id.',
      method: 'GET',
      path: '/api/v2/fb-uids/{id}',
      input: { id: id('Uid row id.') },
    },
    create: {
      title: 'Create uid',
      description: 'Add a uid row.',
      method: 'POST',
      path: '/api/v2/fb-uids',
      input: uidFields,
    },
    update: {
      title: 'Update uid',
      description: 'Update uid identity, flags or counters.',
      method: 'PUT',
      path: '/api/v2/fb-uids/{id}',
      input: { id: id('Uid row id.'), ...uidFields },
    },
    friends: {
      title: 'List friends',
      description: 'Paginated friend list stored for one uid.',
      method: 'GET',
      path: '/api/v2/fb-uids/{id}/friends',
      query: ['page', 'limit', 'search'],
      input: {
        id: id('Uid row id.'),
        page: page(),
        limit: limit(),
        search: search('Partial match on the friend name.'),
      },
    },
    type: {
      title: 'Set uid type',
      description: 'Change the directory type of one uid.',
      method: 'PATCH',
      path: '/api/v2/fb-uids/{id}/type',
      input: { id: id('Uid row id.'), type: z.number().int().describe('Directory type.') },
    },
    note: {
      title: 'Set uid note',
      description: 'Replace the note stored on one uid.',
      method: 'PATCH',
      path: '/api/v2/fb-uids/{id}/note',
      input: { id: id('Uid row id.'), note: z.string().describe('Note text; empty clears it.') },
    },
    info: {
      title: 'Update uid info',
      description: 'Update the profile fields of one uid (the endpoint writes on GET).',
      method: 'GET',
      path: '/api/v2/fb-uids/{id}/info',
      query: ['fb_uid', 'fb_user', 'fb_fullname', 'fb_info', 'fb_friends', 'fb_clone', 'fb_check', 'type', 'target_id'],
      input: { id: id('Uid row id.'), ...uidFields },
    },
    delete: {
      title: 'Delete uid',
      description: 'Delete one uid row. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/fb-uids/{id}',
      input: { id: id('Uid row id.') },
      guard: 'delete',
    },
  },
};

export function registerFbUidTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, fbUidSpec);
}
