import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { flag, id, limit, page, search, sortBy, sortOrder } from './schemas.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

/**
 * automation: hashtags — taxonomy CRUD, AI generation, train data, link
 * suggestions and the AI suggestion queue.
 */

const hashtagCategories = z
  .string()
  .describe('Hashtag category slug from the categories action.');

export const hashtagSpec: ResourceSpec = {
  name: 'manage_hashtag',
  title: 'Manage hashtags',
  description: 'kkAuto API v2 hashtags: CRUD, usage, merge, AI generation/approval, train data, account/fanpage links and the AI suggestion queue.',
  actions: {
    list: {
      title: 'List hashtags',
      description: 'Paginated hashtag list with category/active filters.',
      method: 'GET',
      path: '/api/v2/hashtags',
      query: ['page', 'limit', 'search', 'category', 'is_active', 'sort_by', 'sort_order'],
      input: {
        page: page(),
        limit: limit(),
        search: search('Partial match on name or description.'),
        category: hashtagCategories.optional(),
        is_active: flag('Active filter.').optional(),
        sort_by: sortBy(['id', 'name', 'is_active', 'usage_count', 'created_at']),
        sort_order: sortOrder(),
      },
    },
    get: {
      title: 'Get hashtag',
      description: 'One hashtag by id.',
      method: 'GET',
      path: '/api/v2/hashtags/{id}',
      input: { id: id('Hashtag id.') },
    },
    create: {
      title: 'Create hashtag',
      description: 'Create a hashtag row (name is normalized before insert).',
      method: 'POST',
      path: '/api/v2/hashtags',
      input: {
        name: z.string().min(2).max(100).describe('Hashtag name.'),
        description: z.string().optional().describe('Description.'),
        ai_instruction: z.string().optional().describe('AI instruction text.'),
        train_instruction: z.string().optional().describe('Train instruction text.'),
        search_keywords: z.string().optional().describe('Comma-separated search keywords.'),
        category: hashtagCategories.optional(),
        is_active: flag('Active flag.').optional(),
        auto_label: flag('Auto-label flag.').optional(),
      },
    },
    update: {
      title: 'Update hashtag',
      description: 'Update hashtag fields; only supplied keys change.',
      method: 'PUT',
      path: '/api/v2/hashtags/{id}',
      input: {
        id: id('Hashtag id.'),
        name: z.string().min(2).max(100).optional().describe('Hashtag name.'),
        description: z.string().optional().describe('Description.'),
        ai_instruction: z.string().optional().describe('AI instruction text.'),
        train_instruction: z.string().optional().describe('Train instruction text.'),
        search_keywords: z.string().optional().describe('Comma-separated search keywords.'),
        category: hashtagCategories.optional(),
        is_active: flag('Active flag.').optional(),
        auto_label: flag('Auto-label flag.').optional(),
      },
    },
    delete: {
      title: 'Delete hashtag',
      description: 'Delete one hashtag; returns 409 IN_USE unless force=true. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/hashtags/{id}',
      input: { id: id('Hashtag id.'), force: z.boolean().optional().describe('Delete even when relations exist.') },
      guard: 'delete',
    },
    status: {
      title: 'Toggle hashtag status',
      description: 'Flip is_active for one hashtag.',
      method: 'PATCH',
      path: '/api/v2/hashtags/{id}/status',
      input: { id: id('Hashtag id.') },
    },
    search: {
      title: 'Search hashtags',
      description: 'Picker search: by ids, or by keyword, top usage first.',
      method: 'GET',
      path: '/api/v2/hashtags/search',
      query: ['page', 'limit', 'ids', 'q'],
      input: {
        page: page(),
        limit: limit(),
        ids: z.string().optional().describe('Comma-separated hashtag ids to resolve.'),
        q: z.string().optional().describe('Keyword to match.'),
      },
    },
    popular: {
      title: 'Popular hashtags',
      description: 'Most used hashtags.',
      method: 'GET',
      path: '/api/v2/hashtags/popular',
      query: ['limit'],
      input: { limit: limit() },
    },
    'by-category': {
      title: 'Hashtags by category',
      description: 'Hashtags of one category, most used first.',
      method: 'GET',
      path: '/api/v2/hashtags/by-category/{categoryId}',
      query: ['category', 'limit'],
      input: {
        categoryId: id('Numeric category id used in the path.'),
        category: hashtagCategories,
        limit: limit(),
      },
    },
    categories: {
      title: 'Hashtag categories',
      description: 'Configured hashtag category slugs.',
      method: 'GET',
      path: '/api/v2/hashtags/categories',
    },
    'quick-create': {
      title: 'Quick create hashtag',
      description: 'Find-or-create one hashtag by name.',
      method: 'POST',
      path: '/api/v2/hashtags/quick-create',
      input: { name: z.string().min(2).max(100).describe('Hashtag name.') },
    },
    usage: {
      title: 'Hashtag usage',
      description: 'Which features still reference these hashtags (drives the delete IN_USE payload).',
      method: 'GET',
      path: '/api/v2/hashtags/{id}/usage',
      query: ['ids'],
      input: {
        id: id('Hashtag id used in the path.'),
        ids: z.string().optional().describe('Comma-separated hashtag ids to inspect; defaults to the path id.'),
      },
    },
    merge: {
      title: 'Merge hashtags',
      description: 'Move source hashtags into this one and delete the sources.',
      method: 'POST',
      path: '/api/v2/hashtags/{id}/merge',
      input: {
        id: id('Target hashtag id.'),
        source_ids: z.array(z.number().int().positive()).min(1).describe('Hashtag ids to merge into the target.'),
      },
      guard: 'confirm',
    },
    'ai-generate': {
      title: 'Generate hashtags with AI',
      description: 'Ask the default AI provider for new hashtag proposals.',
      method: 'POST',
      path: '/api/v2/hashtags/ai/generate',
      input: {
        count: z.number().int().min(1).max(20).describe('How many proposals to generate.'),
        user_prompt: z.string().max(500).optional().describe('Optional steer for the model.'),
      },
    },
    'ai-generate-instruction': {
      title: 'Generate hashtag instruction',
      description: 'Generate ai_instruction/train_instruction text for a hashtag name.',
      method: 'POST',
      path: '/api/v2/hashtags/ai/generate-instruction',
      input: {
        name: z.string().min(2).max(100).describe('Hashtag name.'),
        category: hashtagCategories,
        description: z.string().optional().describe('Description used as context.'),
        user_prompt: z.string().max(500).optional().describe('Optional steer for the model.'),
        mode: z.enum(['both', 'ai_instruction', 'train_instruction']).optional().describe('Which instruction to generate.'),
      },
    },
    'ai-approve': {
      title: 'Approve AI hashtag items',
      description: 'Persist approved AI hashtag proposals (max 20).',
      method: 'POST',
      path: '/api/v2/hashtags/{id}/ai/approve',
      input: {
        id: id('Parent hashtag id used in the path.'),
        items: z.array(z.record(z.string(), z.unknown())).min(1).max(20).describe('AI hashtag proposal rows.'),
      },
    },
    'train-keywords': {
      title: 'Train: suggest keywords',
      description: 'Dry-run keyword suggestions for the given hashtags.',
      method: 'POST',
      path: '/api/v2/hashtags/{id}/train/keywords',
      input: {
        id: id('Hashtag id used in the path.'),
        hashtag_ids: z.array(z.number().int().positive()).min(1).max(20).describe('Hashtags to train on.'),
      },
    },
    'train-decide': {
      title: 'Train: preview decision',
      description: 'Dry-run the AI decision for a sample post against these hashtags.',
      method: 'POST',
      path: '/api/v2/hashtags/{id}/train/decide',
      input: {
        id: id('Hashtag id used in the path.'),
        hashtag_ids: z.array(z.number().int().positive()).min(1).max(20).describe('Hashtags to decide with.'),
        post: z.record(z.string(), z.unknown()).optional().describe('Full sample post object.'),
        content: z.string().optional().describe('Sample post content when post is omitted.'),
        literal_hashtags: z.array(z.string()).optional().describe('Hashtags literally present in the content.'),
        author_name: z.string().optional().describe('Sample author name.'),
        author_id: z.string().optional().describe('Sample author id.'),
        author_url: z.string().optional().describe('Sample author URL.'),
      },
    },
    'train-targets': {
      title: 'Get train targets',
      description: 'Resolved train targets of one hashtag.',
      method: 'GET',
      path: '/api/v2/hashtags/{id}/train/targets',
      input: { id: id('Hashtag id.') },
    },
    'update-train-targets': {
      title: 'Replace train targets',
      description: 'Replace the whole train target list of one hashtag.',
      method: 'PUT',
      path: '/api/v2/hashtags/{id}/train/targets',
      input: {
        id: id('Hashtag id.'),
        targets: z.array(z.record(z.string(), z.unknown())).describe('Full target list.'),
      },
    },
    'links-suggest': {
      title: 'Suggest links',
      description: 'Accounts or fanpages not yet linked to this hashtag.',
      method: 'GET',
      path: '/api/v2/hashtags/links/suggest',
      query: ['hashtag_id', 'target', 'count', 'level'],
      input: {
        hashtag_id: id('Active hashtag id.'),
        target: z.enum(['account', 'fanpage']).describe('Which link type to suggest.'),
        count: z.number().int().min(1).max(200).describe('How many suggestions.'),
        level: z.number().int().min(0).max(4).optional().describe('Account level, required for target=account.'),
      },
    },
    'links-append': {
      title: 'Append links',
      description: 'Link selected accounts or fanpages to this hashtag.',
      method: 'POST',
      path: '/api/v2/hashtags/{id}/links/append',
      input: {
        id: id('Hashtag id used in the path.'),
        hashtag_id: id('Hashtag id read from the body; must match id.'),
        target: z.enum(['account', 'fanpage']).describe('Which link type to append.'),
        ids: z.array(z.number().int().positive()).min(1).max(200).describe('Account or fanpage ids.'),
      },
    },
    'ai-suggestions': {
      title: 'List AI suggestions',
      description: 'Pending hashtag AI suggestions.',
      method: 'GET',
      path: '/api/v2/hashtags/ai-suggestions',
      query: ['page', 'limit', 'type'],
      input: {
        page: page(),
        limit: limit(),
        type: z.enum(['fanpage', 'group']).optional().describe('Suggestion target type.'),
      },
    },
    'apply-ai-suggestion': {
      title: 'Apply AI suggestion',
      description: 'Apply one pending suggestion.',
      method: 'POST',
      path: '/api/v2/hashtags/ai-suggestions/{suggestionId}/apply',
      input: { suggestionId: id('Suggestion id.') },
    },
    'discard-ai-suggestion': {
      title: 'Discard AI suggestion',
      description: 'Mark one pending suggestion as discarded.',
      method: 'POST',
      path: '/api/v2/hashtags/ai-suggestions/{suggestionId}/discard',
      input: { suggestionId: id('Suggestion id.') },
    },
    'apply-all-ai-suggestions': {
      title: 'Apply all AI suggestions',
      description: 'Apply every pending suggestion of one type.',
      method: 'POST',
      path: '/api/v2/hashtags/ai-suggestions/apply-all',
      input: { type: z.enum(['fanpage', 'group']).optional().describe('Restrict to one suggestion type.') },
      guard: 'confirm',
    },
    'bulk-delete': {
      title: 'Bulk delete hashtags',
      description: 'Delete up to 500 hashtags at once.',
      method: 'POST',
      path: '/api/v2/hashtags/bulk/delete',
      input: {
        ids: z.array(z.number().int().positive()).min(1).max(500).describe('Hashtag ids.'),
        force: z.boolean().optional().describe('Delete even when relations exist.'),
      },
      guard: 'confirm',
    },
  },
};

export function registerHashtagTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, hashtagSpec);
}
