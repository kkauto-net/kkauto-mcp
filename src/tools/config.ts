import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { flag, id } from './schemas.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

/**
 * config: the API v2 config gateway (settings groups) plus storefront settings.
 *
 * The gateway takes a partial map of the group's writable keys, so `update`
 * declares those keys flat; `list-groups` returns the authoritative key list.
 */

const groupKey = z
  .enum([
    'fb.general',
    'system.language',
    'fb.system-instructions',
    'fb.notifications',
    'fb.levels',
    'fb.group-review',
    'fb.group-join',
    'source.collection-rules',
    'ig.settings',
    'storefront.settings',
  ])
  .describe('Config group key, see action list-groups.');

const storefrontShape = {
  shop_name: z.string().max(255).optional().describe('Shop name.'),
  shop_tagline: z.string().max(255).optional().describe('Shop tagline.'),
  shop_phone: z.string().max(50).optional().describe('Contact phone.'),
  shop_address: z.string().max(255).optional().describe('Street address.'),
  shop_hours: z.string().max(255).optional().describe('Opening hours text.'),
  shipping_note: z.string().max(500).optional().describe('Shipping note shown at checkout.'),
  payment_bank_code: z.string().max(32).optional().describe('Bank code for VietQR.'),
  payment_account_no: z.string().max(64).optional().describe('Receiving account number.'),
  payment_account_name: z.string().max(255).optional().describe('Receiving account holder.'),
  payment_webhook_secret: z.string().optional().describe('Payment webhook secret; empty keeps the stored value.'),
  theme: z.string().max(64).optional().describe('Active storefront theme slug.'),
};

/**
 * One level row: every `fb_settings.payload` key written by the wtadmin level form
 * plus the two Instagram toggles. `.strict()` so an unknown level key is named instead
 * of silently stripped.
 */
const levelEntry = z
  .object({
    level: z.number().int().min(0).max(4).describe('Level number 0..4.'),
    active: flag('Active level, 0 or 1.').optional().describe('fb.levels / ig.settings: active flag.'),

    // fb.levels
    scan_info: flag('Save scanned profile info.').optional(),
    friend_add_count: z.number().int().min(1).optional().describe('Friend requests per run.'),
    friend_add_per_session: z.number().int().min(1).optional().describe('Friend requests per session.'),
    friend_add_delay: z.number().int().min(1).optional().describe('Delay between friend requests, seconds.'),
    post_like: flag('Like posts.').optional(),
    group_post_check_delay: z.number().int().min(1).optional().describe('Group post check delay, seconds.'),
    group_post_check_count: z.number().int().min(1).optional().describe('Group posts checked per run.'),
    group_comment_check_enabled: flag('Comment approval gate enabled.').optional(),
    group_comment_check_delay: z.number().int().min(1).optional().describe('Comment gate delay, seconds.'),
    group_comment_check_count: z.number().int().min(1).optional().describe('Comments checked per run.'),
    group_post_block_count: z.number().int().min(1).optional().describe('Group posts blocked per run.'),
    group_max: z.number().int().min(1).optional().describe('Groups joined/used per level.'),
    group_join_per_session: z.number().int().min(0).optional().describe('Group joins per session.'),
    group_check_delay_minutes: z.number().int().min(1).optional().describe('Group check delay, minutes.'),
    group_check_count: z.number().int().min(1).optional().describe('Groups checked per run.'),
    group_join_per_day: z.number().int().min(0).optional().describe('Group joins per day; empty means unset.'),
    feed_feed_scan_friend: flag('Scan friend feeds.').optional(),
    feed_feed_scan_group: flag('Scan group feeds.').optional(),
    group_feed_scan: flag('Scan group feeds for posts.').optional(),
    group_scan_count: z.number().int().min(1).optional().describe('Group scans per run.'),
    group_scan_delay: z.number().int().min(1).optional().describe('Delay between group scans, seconds.'),
    group_scan_per_session: z.number().int().min(1).optional().describe('Group scans per session.'),
    group_scan_limit: z.number().int().min(1).optional().describe('Posts kept per group scan.'),
    group_scan_info: flag('Save scanned group info.').optional(),
    group_scan_info_count: z.number().int().min(0).optional().describe('Group info records per run.'),
    group_member_limit: z.number().int().min(0).optional().describe('Member scan cap.'),
    group_scan_min_train_count: z.number().int().min(0).optional().describe('Minimum scans before training.'),
    feed_reel_sound: flag('Use reel sound.').optional(),
    notification_read_enable: flag('Read notifications.').optional(),
    notification_read_delay: z.number().int().min(1).optional().describe('Notification read delay, seconds.'),
    message_read_enable: flag('Read messages.').optional(),
    message_pin_code: z.number().int().min(0).max(1).optional().describe('Message PIN enabled, 0 or 1.'),
    pin_type: z.enum(['random', 'custom']).optional().describe('PIN mode.'),
    custom_pin: z.union([z.string(), z.number()]).optional().describe('Custom PIN, 6+ digits.'),
    auto_engagement_comment_enabled: flag('Auto engagement comments enabled.').optional(),
    auto_engagement_max_per_day: z.number().int().min(0).optional().describe('Auto comments per day.'),
    auto_engagement_max_per_session: z.number().int().min(0).optional().describe('Auto comments per session.'),
    auto_engagement_cooldown_seconds: z.number().int().min(0).optional().describe('Auto comment cooldown, seconds.'),
    auto_engagement_allowed_surfaces: z
      .array(z.enum(['feed', 'reel', 'video', 'group', 'fanpage', 'public']))
      .optional()
      .describe('Surfaces auto comments may target.'),
    hashtag_min_confidence: z.number().min(0.05).max(1).optional().describe('Hashtag confidence floor.'),
    auto_engagement_require_hashtag_overlap: flag('Require hashtag overlap.').optional(),
    friend_add_enabled: flag('Friend-add master enable.').optional(),
    group_join_enabled: flag('Group-join master enable.').optional(),
    group_scan_enabled: flag('Group-scan master enable.').optional(),
    max_comments_per_post: z.number().int().min(1).optional().describe('Auto comments per post.'),
    min_gap_minutes: z.number().int().min(0).optional().describe('Minimum minutes between auto comments.'),

    // ig.settings
    read_notifications: z.boolean().optional().describe('ig.settings only: read notifications.'),
    read_messages: z.boolean().optional().describe('ig.settings only: read messages.'),
  })
  .strict()
  .describe(
    'One level. fb.levels keys: every key except read_notifications/read_messages. ig.settings keys: read_notifications, read_messages, active, level.',
  );

const writableShape = {
  // fb.general
  auto_run: flag('Automatic task running, 0 or 1.').optional(),
  account_blocked: z.enum(['manual', 'auto']).optional().describe('Blocked-account handling mode.'),
  auto_unlock_minutes: z.number().int().min(0).optional().describe('Minutes before an automatic unlock.'),
  auto_login_delay_minutes: z.number().int().min(0).max(1440).optional().describe('Minutes before the first automatic login; 0 disables.'),
  max_friend_requests: z.number().int().min(1).max(99).optional().describe('Friend requests per account.'),
  random_delay_percentage: z.number().int().min(1).max(99).optional().describe('Random delay spread, percent.'),
  seeding_fallback_type: z.enum(['none', 'new', 'sales', 'all']).optional().describe('Seeding fallback pool.'),

  // system.language
  language: z.enum(['vi', 'en']).optional().describe('UI language.'),
  sync_default_instructions: z.boolean().optional().describe('Also sync default system instructions.'),

  // fb.system-instructions
  content: z.string().optional().describe('Base business instructions.'),
  features: z.record(z.string(), z.string()).optional().describe('Feature slug to instruction content.'),
  guardrails: z
    .array(z.object({ content: z.string().min(1) }))
    .optional()
    .describe('Guardrail rules; replaces the stored list.'),
  profile_name_layers: z
    .object({
      guardrails: flag('Merge the guardrails layer.').optional(),
      business: flag('Merge the business layer.').optional(),
    })
    .strict()
    .optional()
    .describe('Profile-name prompt layers.'),

  // fb.notifications
  telegram: z
    .object({
      bot_token: z.string().optional().describe('Bot token; empty keeps the stored value.'),
      chat_id: z.string().optional().describe('Target chat id.'),
      topics: z.record(z.string(), z.string()).optional().describe('Topic name to thread id.'),
    })
    .optional()
    .describe('Telegram channel.'),
  discord: z
    .object({
      webhooks: z.record(z.string(), z.string()).optional().describe('Group to webhook URL; empty string removes it.'),
      enabled: flag('Discord channel enabled.').optional(),
    })
    .optional()
    .describe('Discord channel.'),
  routing: z
    .object({ primary_provider: z.enum(['telegram', 'discord']) })
    .optional()
    .describe('Primary notification provider.'),

  // fb.group-review
  hashtag_mode: z.enum(['auto', 'selected', 'none']).optional().describe('Hashtag selection mode.'),
  approve_threshold: z.number().min(0.01).max(1).optional().describe('Approve threshold.'),
  consider_threshold: z.number().min(0.01).max(1).optional().describe('Consider threshold; must be <= approve_threshold.'),
  attach_system_instruction: flag('Attach the system instruction.').optional(),
  hashtag_ids: z.array(id('Hashtag id.')).optional().describe('Selected hashtag ids.'),
  group_review_rules: z.string().max(5000).optional().describe('Group review rules; empty keeps the current text.'),

  // fb.group-join
  group_join_instruction: z.string().max(5000).optional().describe('Group join instruction; empty keeps the current text.'),
  reset_instruction: flag('Reset the group join instruction to the default.').optional(),

  // source.collection-rules
  rules: z.record(z.string(), z.record(z.string(), z.unknown())).optional().describe('Rules keyed by platform.'),

  // fb.levels + ig.settings
  active_level: z.number().int().min(0).max(4).optional().describe('Active Instagram level.'),
  levels: z.array(levelEntry).optional().describe('Per-level settings; fb.levels uses the Facebook keys, ig.settings the read toggles.'),

  // storefront.settings
  ...storefrontShape,
};

export const configSpec: ResourceSpec = {
  name: 'manage_config',
  title: 'Manage configuration',
  description:
    'kkAuto API v2 configuration gateway: list group keys, read one masked group, write a partial group, and read/write storefront settings.',
  actions: {
    'list-groups': {
      title: 'List config groups',
      description: 'All config group keys with their writable fields and secret flags.',
      method: 'GET',
      path: '/api/v2/config',
    },
    get: {
      title: 'Get config group',
      description: 'Current values of one group with secrets masked.',
      method: 'GET',
      path: '/api/v2/config/{group}',
      input: { group: groupKey },
    },
    update: {
      title: 'Update config group',
      description: 'Partial update of one group; only its writable keys are accepted.',
      method: 'PUT',
      path: '/api/v2/config/{group}',
      input: { group: groupKey, ...writableShape },
    },
    'storefront-settings': {
      title: 'Get storefront settings',
      description: 'Shop and payment settings with the webhook secret masked.',
      method: 'GET',
      path: '/api/v2/storefront/settings',
    },
    'update-storefront-settings': {
      title: 'Update storefront settings',
      description: 'Partial update of the storefront shop and payment settings.',
      method: 'PUT',
      path: '/api/v2/storefront/settings',
      input: storefrontShape,
    },
  },
};

export function registerConfigTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, configSpec);
}
