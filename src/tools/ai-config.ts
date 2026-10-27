import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { flag, id, limit, page, search, sortBy, sortOrder } from './schemas.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

/**
 * ai config: providers (text/image/discriminative pools), post assistants and
 * the Facebook AI manager configs.
 */

const kind = z.enum(['text', 'image', 'discriminative']).describe('Provider pool.');
const providerType = z.enum(['openai', 'gemini', 'claude', 'deepseek', 'minimax', 'custom']).describe('Provider API family.');

const providerBody = {
  provider_type: providerType,
  name: z.string().min(2).max(150).describe('Display name.'),
  api_key: z.string().optional().describe('API key; encrypted on write.'),
  organization: z.string().optional().describe('Organization id, when the provider needs one.'),
  api_url: z.string().url().optional().describe('Base API URL for custom providers.'),
  extra_config: z.record(z.string(), z.unknown()).optional().describe('Provider-specific extras.'),
  is_active: flag('Active flag.').optional(),
  is_default: flag('Default-provider flag.').optional(),
  sort_order: z.number().int().optional().describe('Ordering.'),
};

export const aiProviderSpec: ResourceSpec = {
  name: 'manage_ai_provider',
  title: 'Manage AI providers',
  description: 'kkAuto API v2 AI providers across the text, image and discriminative pools: CRUD, default, test, image preview and secret reveal.',
  actions: {
    list: {
      title: 'List AI providers',
      description: 'Providers of one pool with search/type/active filters.',
      method: 'GET',
      path: '/api/v2/ai-providers',
      query: ['kind', 'page', 'limit', 'search', 'provider_type', 'is_active'],
      input: {
        kind,
        page: page(),
        limit: limit(),
        search: search('Partial match on the provider name.'),
        provider_type: providerType.optional(),
        is_active: flag('Active filter.').optional(),
      },
    },
    get: {
      title: 'Get AI provider',
      description: 'One provider of the selected pool.',
      method: 'GET',
      path: '/api/v2/ai-providers/{id}',
      query: ['kind'],
      input: { id: id('Provider id.'), kind },
    },
    create: {
      title: 'Create AI provider',
      description: 'Create a provider in the selected pool.',
      method: 'POST',
      path: '/api/v2/ai-providers',
      input: { kind, ...providerBody },
    },
    update: {
      title: 'Update AI provider',
      description: 'Update provider fields; an empty api_key keeps the stored key.',
      method: 'PUT',
      path: '/api/v2/ai-providers/{id}',
      input: {
        id: id('Provider id.'),
        kind,
        provider_type: providerType.optional(),
        name: z.string().min(2).max(150).optional().describe('Display name.'),
        api_key: z.string().optional().describe('API key; encrypted on write.'),
        organization: z.string().optional().describe('Organization id.'),
        api_url: z.string().url().optional().describe('Base API URL.'),
        extra_config: z.record(z.string(), z.unknown()).optional().describe('Provider-specific extras.'),
        is_active: flag('Active flag.').optional(),
        is_default: flag('Default-provider flag.').optional(),
        sort_order: z.number().int().optional().describe('Ordering.'),
      },
    },
    delete: {
      title: 'Delete AI provider',
      description: 'Delete one provider of the selected pool. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/ai-providers/{id}',
      input: { id: id('Provider id.'), kind },
      guard: 'delete',
    },
    'set-default': {
      title: 'Set default provider',
      description: 'Make this provider the pool default.',
      method: 'POST',
      path: '/api/v2/ai-providers/{id}/set-default',
      input: { id: id('Provider id.'), kind },
    },
    test: {
      title: 'Test provider',
      description: 'Run a live connectivity test and record the result.',
      method: 'POST',
      path: '/api/v2/ai-providers/{id}/test',
      input: { id: id('Provider id.'), kind },
    },
    preview: {
      title: 'Preview image provider',
      description: 'Generate a preview image (kind=image only); mode=edit sends one local image.',
      method: 'POST',
      path: '/api/v2/ai-providers/{id}/preview',
      body: 'form',
      filesField: 'image',
      input: {
        id: id('Provider id.'),
        kind,
        mode: z.enum(['generate', 'edit']).optional().describe('Text-to-image or image-to-image.'),
        prompt: z.string().describe('Image prompt.'),
        model: z.string().optional().describe('Model override.'),
        quality: z.string().optional().describe('Quality preset.'),
        size: z.string().optional().describe('Image size.'),
        aspect_ratio: z.string().optional().describe('Aspect ratio.'),
        media_files: z.array(z.string().min(1)).optional().describe('Local image files for mode=edit.'),
      },
    },
    'reveal-secret': {
      title: 'Reveal API key',
      description: 'Return the plaintext api_key; requires apiv2.admin and is audited.',
      method: 'GET',
      path: '/api/v2/ai-providers/{id}/reveal-secret',
      query: ['kind', 'field'],
      input: {
        id: id('Provider id.'),
        kind,
        field: z.literal('api_key').describe('Secret field to reveal.'),
      },
    },
  },
};

const assistantBody = {
  title: z.string().min(3).max(255).describe('Assistant title.'),
  model_type: z.string().optional().describe('Model id.'),
  provider_id: id('AI provider id.').optional(),
  use_default: flag('Use the default provider.').optional(),
  model_assistant: z.string().optional().describe('Assistant name/key at the provider.'),
  assistant_key: z.string().optional().describe('Assistant key.'),
  api_url: z.string().url().optional().describe('Assistant API URL.'),
  system_instructions: z.string().optional().describe('System instructions.'),
  comment_script: z.record(z.string(), z.unknown()).optional().describe('Comment script map.'),
  number_of_posts: z.number().int().positive().optional().describe('Posts per run.'),
  is_active: flag('Active flag.').optional(),
  post_approve: flag('Auto-approve flag.').optional(),
  post_type: z.enum(['product', 'video']).optional().describe('Generated post type.'),
  post_auto: flag('Auto-post flag.').optional(),
  post_target: z.string().optional().describe('Post target.'),
  hashtags: z.array(z.union([z.number().int().positive(), z.string()])).optional().describe('Hashtag ids or names.'),
  image_category_id: id('Image category id.').optional(),
  image_text_config: z.record(z.string(), z.unknown()).optional().describe('Image text overlay config.'),
};

export const fbPostAssistantSpec: ResourceSpec = {
  name: 'manage_fb_post_assistant',
  title: 'Manage FB post assistants',
  description: 'kkAuto API v2 Facebook post assistants: CRUD, toggle, reactivate, reset errors, AI test/instruction generation and post creation.',
  actions: {
    list: {
      title: 'List assistants',
      description: 'Paginated assistant list with active/post_type filters.',
      method: 'GET',
      path: '/api/v2/fb-post-assistants',
      query: ['page', 'limit', 'search', 'is_active', 'post_type', 'sort_by', 'sort_order'],
      input: {
        page: page(),
        limit: limit(),
        search: search('Partial match on the title.'),
        is_active: flag('Active filter.').optional(),
        post_type: z.enum(['product', 'video']).optional().describe('Post type filter.'),
        sort_by: sortBy(['id', 'title', 'is_active', 'post_type', 'created_at', 'updated_at']),
        sort_order: sortOrder(),
      },
    },
    get: {
      title: 'Get assistant',
      description: 'One assistant config.',
      method: 'GET',
      path: '/api/v2/fb-post-assistants/{id}',
      input: { id: id('Assistant id.') },
    },
    create: {
      title: 'Create assistant',
      description: 'Create a post assistant.',
      method: 'POST',
      path: '/api/v2/fb-post-assistants',
      input: assistantBody,
    },
    update: {
      title: 'Update assistant',
      description: 'Update assistant fields; omitted keys are kept.',
      method: 'PUT',
      path: '/api/v2/fb-post-assistants/{id}',
      input: {
        id: id('Assistant id.'),
        title: z.string().min(3).max(255).optional().describe('Assistant title.'),
        model_type: z.string().optional().describe('Model id.'),
        provider_id: id('AI provider id.').optional(),
        use_default: flag('Use the default provider.').optional(),
        model_assistant: z.string().optional().describe('Assistant name/key at the provider.'),
        assistant_key: z.string().optional().describe('Assistant key.'),
        api_url: z.string().url().optional().describe('Assistant API URL.'),
        system_instructions: z.string().optional().describe('System instructions.'),
        comment_script: z.record(z.string(), z.unknown()).optional().describe('Comment script map.'),
        number_of_posts: z.number().int().positive().optional().describe('Posts per run.'),
        is_active: flag('Active flag.').optional(),
        post_approve: flag('Auto-approve flag.').optional(),
        post_type: z.enum(['product', 'video']).optional().describe('Generated post type.'),
        post_auto: flag('Auto-post flag.').optional(),
        post_target: z.string().optional().describe('Post target.'),
        hashtags: z.array(z.union([z.number().int().positive(), z.string()])).optional().describe('Hashtag ids or names.'),
        image_category_id: id('Image category id.').optional(),
        image_text_config: z.record(z.string(), z.unknown()).optional().describe('Image text overlay config.'),
      },
    },
    delete: {
      title: 'Delete assistant',
      description: 'Delete one assistant. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/fb-post-assistants/{id}',
      input: { id: id('Assistant id.') },
      guard: 'delete',
    },
    toggle: {
      title: 'Toggle assistant',
      description: 'Flip is_active.',
      method: 'POST',
      path: '/api/v2/fb-post-assistants/{id}/toggle',
      input: { id: id('Assistant id.') },
    },
    reactivate: {
      title: 'Reactivate assistant',
      description: 'Clear the auto-disable state and activate the assistant again.',
      method: 'POST',
      path: '/api/v2/fb-post-assistants/{id}/reactivate',
      input: { id: id('Assistant id.') },
    },
    'reset-errors': {
      title: 'Reset error counter',
      description: 'Reset error_count and last_error fields.',
      method: 'POST',
      path: '/api/v2/fb-post-assistants/{id}/reset-errors',
      input: { id: id('Assistant id.') },
    },
    'ai-test': {
      title: 'AI test assistant',
      description: 'Generate one post with this assistant without saving it.',
      method: 'POST',
      path: '/api/v2/fb-post-assistants/{id}/ai-test',
      input: {
        id: id('Assistant id.'),
        system_instructions: z.string().optional().describe('Instruction override for the test.'),
        model_type: z.string().optional().describe('Model override.'),
        provider_id: id('Provider override.').optional(),
        use_default: flag('Use the default provider.').optional(),
        comment_script: z.record(z.string(), z.unknown()).optional().describe('Comment script override.'),
        hashtags: z.array(z.union([z.number().int().positive(), z.string()])).optional().describe('Hashtag override.'),
        image_category_id: id('Image category override.').optional(),
        image_text_config: z.record(z.string(), z.unknown()).optional().describe('Image text config override.'),
      },
    },
    'ai-generate-instructions': {
      title: 'Generate instructions',
      description: 'Ask the AI provider to draft system instructions for this assistant.',
      method: 'POST',
      path: '/api/v2/fb-post-assistants/{id}/ai-generate-instructions',
      input: { id: id('Assistant id.') },
    },
    'create-post': {
      title: 'Create post with assistant',
      description: 'Generate and queue one real post through this assistant.',
      method: 'POST',
      path: '/api/v2/fb-post-assistants/{id}/create-post',
      input: { id: id('Assistant id.') },
      guard: 'confirm',
    },
  },
};

const jsonObjectOrString = (what: string) =>
  z.union([z.record(z.string(), z.unknown()), z.string()]).optional().describe(`${what}: JSON object or JSON string.`);
const commentSurfaces = z
  .union([z.array(z.string()), z.record(z.string(), z.unknown()), z.string()])
  .optional()
  .describe('Allowed comment surfaces: string list, map or JSON string.');
const modelAssistant = z.union([z.string(), z.number()]).optional().describe('Assistant name/key at the provider.');
const customApiUrl = z.union([z.string().url(), z.literal('')]).optional().describe('Custom API URL; empty clears it.');
const managerHashtags = z.array(z.number().int().positive()).optional().describe('Hashtag ids used as the topic filter.');
const engagementRules = z
  .array(z.record(z.string(), z.unknown()))
  .optional()
  .describe(
    'Engagement rules: surface, match_mode, min_views, min_likes, min_comments, priority, first_comment_instruction, cooldown_minutes, max_per_post, is_active. Presence replaces the rule set.',
  );

const aiManagerBody = {
  ai_type: z.string().describe('AI type, e.g. comment.'),
  title: z.string().min(1).max(255).describe('Config title.'),
  comment_surfaces: commentSurfaces,
  product_mode: z.string().optional().describe('Product mode.'),
  seed_context: z.string().optional().describe('Seed context text.'),
  system_instructions: z.string().optional().describe('System instructions.'),
  model_type: z.string().optional().describe('Model id.'),
  provider_id: id('AI provider id.').optional(),
  model_assistant: modelAssistant,
  assistant_key: z.string().optional().describe('Assistant key.'),
  use_default: flag('Use the default provider.').optional(),
  api_url: customApiUrl,
  is_active: flag('Active flag.').optional(),
  is_default: flag('Default-config flag.').optional(),
  image_category_id: id('Image category id.').optional(),
  image_text_config: jsonObjectOrString('Image text overlay config'),
  extra_config: jsonObjectOrString('Extra config'),
  pipeline_enabled: flag('Pipeline enabled flag.').optional(),
  pipeline_config: jsonObjectOrString('Pipeline config'),
  hashtags: managerHashtags,
  engagement_rules: engagementRules,
};

/** Shared by test-result / test-run / test-group-review. */
const commentTestBody = {
  postContent: z.string().min(1).optional().describe('Sample post text; providing it runs a live test.'),
  post_content: z.string().min(1).optional().describe('Alias of postContent.'),
  content: z.string().min(1).optional().describe('Alias of postContent.'),
  post_text: z.string().min(1).optional().describe('Alias of postContent.'),
  text: z.string().min(1).optional().describe('Alias of postContent.'),
  postAuthor: z.string().optional().describe('Sample author name.'),
  groupName: z.string().optional().describe('Sample group name.'),
  postLikeCount: z.number().int().min(0).optional().describe('Sample like count.'),
  postCommentCount: z.number().int().min(0).optional().describe('Sample comment count.'),
  postShareCount: z.number().int().min(0).optional().describe('Sample share count.'),
  postComments: z.array(z.record(z.string(), z.unknown())).optional().describe('Existing comments on the sample post.'),
  account_id: id('Account id used for the test run.').optional(),
  first_comment_in_group: flag('Treat the sample as the first comment in the group.').optional(),
  test_mode: z.enum(['config', 'general']).optional().describe('Pipeline to run; default config.'),
  dry_run: flag('Dry run: return the verdict without persisting last_test_*.').optional(),
  success: flag('Record a manual test result (0|1) instead of running a live test.').optional(),
  message: z.string().optional().describe('Message stored with a manual test result.'),
  config_hash: z.string().optional().describe('Config hash stored with a manual test result.'),
  context: z.record(z.string(), z.unknown()).optional().describe('Free-form test context.'),
};

export const fbAiManagerSpec: ResourceSpec = {
  name: 'manage_fb_ai_manager',
  title: 'Manage FB AI manager configs',
  description: 'kkAuto API v2 Facebook AI manager configs: CRUD, toggle, title/pipeline suggestions, test runs and the sample profile.',
  actions: {
    list: {
      title: 'List AI manager configs',
      description: 'Paginated config list with type/active/default filters.',
      method: 'GET',
      path: '/api/v2/fb-ai-manager',
      query: ['page', 'limit', 'search', 'ai_type', 'is_active', 'is_default', 'sort_by', 'sort_order'],
      input: {
        page: page(),
        limit: limit(),
        search: search('Partial match on the title.'),
        ai_type: z.string().optional().describe('AI type filter.'),
        is_active: flag('Active filter.').optional(),
        is_default: flag('Default filter.').optional(),
        sort_by: sortBy(['id', 'title', 'ai_type', 'is_active', 'is_default', 'created_at', 'updated_at']),
        sort_order: sortOrder(),
      },
    },
    get: {
      title: 'Get AI manager config',
      description: 'One config by id.',
      method: 'GET',
      path: '/api/v2/fb-ai-manager/{id}',
      input: { id: id('Config id.') },
    },
    create: {
      title: 'Create AI manager config',
      description: 'Create a config for one AI type.',
      method: 'POST',
      path: '/api/v2/fb-ai-manager',
      input: aiManagerBody,
    },
    update: {
      title: 'Update AI manager config',
      description: 'Update config fields; omitted keys are kept. hashtags/engagement_rules replace their sets when sent.',
      method: 'PUT',
      path: '/api/v2/fb-ai-manager/{id}',
      input: {
        ...aiManagerBody,
        id: id('Config id.'),
        ai_type: z.string().optional().describe('AI type.'),
        title: z.string().min(1).max(255).optional().describe('Config title.'),
      },
    },
    delete: {
      title: 'Delete AI manager config',
      description: 'Delete one config. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/fb-ai-manager/{id}',
      input: { id: id('Config id.') },
      guard: 'delete',
    },
    toggle: {
      title: 'Toggle AI manager config',
      description: 'Flip is_active.',
      method: 'POST',
      path: '/api/v2/fb-ai-manager/{id}/toggle',
      input: { id: id('Config id.') },
    },
    'suggest-title': {
      title: 'Suggest title',
      description: 'Ask the AI provider for a config title from free-form context.',
      method: 'POST',
      path: '/api/v2/fb-ai-manager/suggest-title',
      input: { context: z.string().describe('Context describing the config.') },
    },
    'suggest-pipeline': {
      title: 'Suggest pipeline',
      description: 'Ask the AI provider for a pipeline config of one comment config.',
      method: 'POST',
      path: '/api/v2/fb-ai-manager/{id}/suggest-pipeline',
      input: {
        id: id('Config id.'),
        title: z.string().optional().describe('Title override.'),
        use_default: flag('Use the default provider.').optional(),
        provider_id: id('Provider override.').optional(),
        model_type: z.string().optional().describe('Model override.'),
        messages: z.array(z.record(z.string(), z.unknown())).optional().describe('Conversation so far.'),
        current_pipeline: z.record(z.string(), z.unknown()).optional().describe('Current pipeline config.'),
        user_action: z.string().optional().describe('User action that triggered the suggestion.'),
      },
    },
    'test-result': {
      title: 'Test result generation',
      description:
        'Run a live test with a sample post (postContent) or record a manual result (success 0|1) and return the verdict.',
      method: 'POST',
      path: '/api/v2/fb-ai-manager/{id}/test-result',
      input: { id: id('Config id.'), ...commentTestBody },
    },
    'test-run': {
      title: 'Run comment test',
      description: 'Alias of test-result: run the comment pipeline on a sample post and return the verdict.',
      method: 'POST',
      path: '/api/v2/fb-ai-manager/{id}/test-run',
      input: { id: id('Config id.'), ...commentTestBody },
    },
    versions: {
      title: 'List config versions',
      description: 'Version history of one config, newest first.',
      method: 'GET',
      path: '/api/v2/fb-ai-manager/{id}/versions',
      query: ['include_snapshot'],
      input: { id: id('Config id.'), include_snapshot: flag('Include the full snapshot of each version.').optional() },
    },
    revert: {
      title: 'Revert config version',
      description: 'Restore the config from one version; the history is kept and a new revert version is appended.',
      method: 'POST',
      path: '/api/v2/fb-ai-manager/{id}/revert',
      input: { id: id('Config id.'), version: z.number().int().positive().describe('Version to restore.') },
    },
    'test-group-review': {
      title: 'Test group review',
      description: 'Kept alias: runs the group AI review on a sample post (POST /api/v2/fb-groups/{id}/test-ai); id is the group id.',
      method: 'POST',
      path: '/api/v2/fb-groups/{id}/test-ai',
      input: { id: id('Group id.'), ...commentTestBody },
    },
    'sample-profile': {
      title: 'Sample profile',
      description: 'Sample Facebook profile data used by the AI manager preview.',
      method: 'GET',
      path: '/api/v2/fb-ai-manager/sample-profile',
    },
  },
};

export function registerAiProviderTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, aiProviderSpec);
}

export function registerFbPostAssistantTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, fbPostAssistantSpec);
}

export function registerFbAiManagerTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, fbAiManagerSpec);
}
