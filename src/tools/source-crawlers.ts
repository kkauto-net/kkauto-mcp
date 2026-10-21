import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { id, limit, page, search } from './schemas.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

const platformType = z.enum(['facebook', 'tiktok', 'youtube', 'pinterest', 'x', 'instagram', 'douyin', 'other']);
const sourceType = z.enum(['group', 'page', 'user', 'post', 'hashtag', 'trending', 'other']);
const crawlerStatus = z.enum(['active', 'inactive', 'paused', 'crawled', 'crawling']);
const fetchMode = z.enum(['once', 'recurring']);
const relationStatus = z.enum(['active', 'inactive']);
const accountPermission = z.enum(['viewer', 'editor', 'admin']);
const jsonRecord = z.record(z.string(), z.unknown());

const crawlerFields = {
  platform_type: platformType,
  source_type: sourceType,
  crawl_interval: z.number().int().min(0),
  source_name: z.string().min(3).max(255),
  source_url: z.string().url().max(1000),
  author_name: z.string().max(255),
  author_url: z.string().url().max(1000),
  status: crawlerStatus,
  fetch_mode: fetchMode,
  source_description: z.string(),
  source_settings: jsonRecord,
  crawl_filters: z.union([jsonRecord, z.string()]),
  crawl_keywords: z.union([z.array(z.string().min(1)), z.string()]),
};

const hashtagPath = { id: id('Source crawler id.'), hashtag_id: id('Hashtag id.') };
const accountPath = { id: id('Source crawler id.'), account_id: id('Account id.') };

export const sourceCrawlerSpec: ResourceSpec = {
  name: 'manage_source_crawler',
  title: 'Manage source crawlers',
  description: 'kkAuto API v2 source crawlers: CRUD, pause/resume, and hashtag/account relations.',
  actions: {
    list: {
      title: 'List source crawlers',
      description: 'Paginated crawler list with platform, status, and fetch-mode filters.',
      method: 'GET',
      path: '/api/v2/source-crawlers',
      query: [
        'page',
        'limit',
        'platform_type',
        'status',
        'source_type',
        'fetch_mode',
        'search',
        'order_by',
        'order_direction',
      ],
      input: {
        page: page(),
        limit: limit(),
        platform_type: platformType.optional(),
        status: crawlerStatus.optional(),
        source_type: sourceType.optional(),
        fetch_mode: fetchMode.optional(),
        search: search(),
        order_by: z
          .enum([
            'id',
            'source_name',
            'source_url',
            'author_name',
            'author_url',
            'platform_type',
            'source_type',
            'crawl_interval',
            'status',
            'fetch_mode',
            'last_crawled_at',
            'next_crawled_at',
            'total_crawled',
            'created_at',
            'updated_at',
          ])
          .optional(),
        order_direction: z.enum(['ASC', 'DESC']).optional(),
      },
    },
    get: {
      title: 'Get source crawler',
      description: 'One crawler by id with its hashtag and account relations.',
      method: 'GET',
      path: '/api/v2/source-crawlers/{id}',
      input: { id: id('Source crawler id.') },
    },
    create: {
      title: 'Create source crawler',
      description: 'Create a crawler; status defaults to paused and fetch_mode to once.',
      method: 'POST',
      path: '/api/v2/source-crawlers',
      input: crawlerFields,
    },
    update: {
      title: 'Update source crawler',
      description: 'Partial update of one crawler.',
      method: 'PUT',
      path: '/api/v2/source-crawlers/{id}',
      input: {
        id: id('Source crawler id.'),
        platform_type: platformType.optional(),
        source_type: sourceType.optional(),
        crawl_interval: z.number().int().min(0).optional(),
        source_name: z.string().min(3).max(255).optional(),
        source_url: z.string().url().max(1000).optional(),
        author_name: z.string().max(255).optional(),
        author_url: z.string().url().max(1000).optional(),
        status: crawlerStatus.optional(),
        fetch_mode: fetchMode.optional(),
        source_description: z.string().optional(),
        source_settings: jsonRecord.optional(),
        crawl_filters: z.union([jsonRecord, z.string()]).optional(),
        crawl_keywords: z.union([z.array(z.string().min(1)), z.string()]).optional(),
      },
    },
    delete: {
      title: 'Delete source crawler',
      description: 'Delete a crawler and its relations. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/source-crawlers/{id}',
      input: { id: id('Source crawler id.') },
      guard: 'delete',
    },
    pause: {
      title: 'Pause source crawler',
      description: 'Pause one crawler.',
      method: 'PATCH',
      path: '/api/v2/source-crawlers/{id}/pause',
      input: { id: id('Source crawler id.') },
    },
    resume: {
      title: 'Resume source crawler',
      description: 'Resume one crawler; the backend requires linked accounts.',
      method: 'PATCH',
      path: '/api/v2/source-crawlers/{id}/resume',
      input: { id: id('Source crawler id.') },
    },
    'search-hashtags': {
      title: 'Search hashtags to link',
      description: 'Hashtag options for crawler relations.',
      method: 'GET',
      path: '/api/v2/source-crawlers/search/hashtags',
      query: ['q'],
      input: { q: z.string().optional().describe('Free-text hashtag search.') },
    },
    'search-accounts': {
      title: 'Search accounts to link',
      description: 'Active account options for crawler relations.',
      method: 'GET',
      path: '/api/v2/source-crawlers/search/accounts',
      query: ['q', 'platform'],
      input: {
        q: z.string().optional().describe('Free-text account search.'),
        platform: platformType.optional().describe('Account platform (default server-side facebook).'),
      },
    },
    hashtags: {
      title: 'List crawler hashtags',
      description: 'Hashtag relations of one crawler.',
      method: 'GET',
      path: '/api/v2/source-crawlers/{id}/hashtags',
      input: { id: id('Source crawler id.') },
    },
    'add-hashtag': {
      title: 'Add crawler hashtag',
      description: 'Link one hashtag to a crawler.',
      method: 'POST',
      path: '/api/v2/source-crawlers/{id}/hashtags',
      input: {
        id: id('Source crawler id.'),
        hashtag_id: id('Hashtag id.'),
        priority: z.number().int().min(1).max(10).optional(),
        status: relationStatus.optional(),
      },
    },
    'remove-hashtag': {
      title: 'Remove crawler hashtag',
      description: 'Unlink one hashtag from a crawler. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/source-crawlers/{id}/hashtags/{hashtag_id}',
      input: hashtagPath,
      guard: 'delete',
    },
    'hashtag-priority': {
      title: 'Update crawler hashtag priority',
      description: 'Set one crawler hashtag priority, 1 to 10.',
      method: 'PATCH',
      path: '/api/v2/source-crawlers/{id}/hashtags/{hashtag_id}/priority',
      input: { ...hashtagPath, priority: z.number().int().min(1).max(10) },
    },
    accounts: {
      title: 'List crawler accounts',
      description: 'Account relations of one crawler.',
      method: 'GET',
      path: '/api/v2/source-crawlers/{id}/accounts',
      input: { id: id('Source crawler id.') },
    },
    'add-account': {
      title: 'Add crawler account',
      description: 'Link one account to a crawler.',
      method: 'POST',
      path: '/api/v2/source-crawlers/{id}/accounts',
      input: {
        id: id('Source crawler id.'),
        account_id: id('Account id.'),
        permission: accountPermission.optional(),
        status: relationStatus.optional(),
      },
    },
    'add-accounts': {
      title: 'Add crawler accounts in bulk',
      description: 'Link up to 100 accounts to one crawler.',
      method: 'POST',
      path: '/api/v2/source-crawlers/{id}/accounts/bulk',
      input: {
        id: id('Source crawler id.'),
        account_ids: z.array(id('Account id.')).min(1).max(100),
        permission: accountPermission.optional(),
        status: relationStatus.optional(),
      },
      guard: 'confirm',
    },
    'remove-account': {
      title: 'Remove crawler account',
      description: 'Unlink one account from a crawler. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/source-crawlers/{id}/accounts/{account_id}',
      input: accountPath,
      guard: 'delete',
    },
    posts: {
      title: 'List crawler posts',
      description: 'Source posts collected by one crawler.',
      method: 'GET',
      path: '/api/v2/source-crawlers/{id}/posts',
      query: ['page', 'limit'],
      input: { id: id('Source crawler id.'), page: page(), limit: limit() },
    },
  },
};

export function registerSourceCrawlerTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, sourceCrawlerSpec);
}
