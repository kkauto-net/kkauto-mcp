import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { flag } from './schemas.js';
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

const writableShape = {
  // fb.general
  auto_run: flag('Automatic task running, 0 or 1.').optional(),
  account_blocked: z.enum(['manual', 'auto']).optional().describe('Blocked-account handling mode.'),
  auto_unlock_minutes: z.number().int().min(0).optional().describe('Minutes before an automatic unlock.'),
  auto_relogin: z.enum(['on', 'off']).optional().describe('Automatic re-login.'),
  auto_login: z.enum(['on', 'off']).optional().describe('Automatic login.'),
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
    .object({ webhooks: z.record(z.string(), z.string()).optional().describe('Group to webhook URL; empty string removes it.') })
    .optional()
    .describe('Discord channel.'),
  routing: z
    .object({ primary_provider: z.enum(['telegram', 'discord']) })
    .optional()
    .describe('Primary notification provider.'),

  // source.collection-rules
  rules: z.record(z.string(), z.record(z.string(), z.unknown())).optional().describe('Rules keyed by platform.'),

  // ig.settings
  active_level: z.number().int().min(0).max(4).optional().describe('Active Instagram level.'),
  levels: z
    .array(
      z.object({
        level: z.number().int().min(0).max(4),
        read_notifications: z.boolean().optional(),
        read_messages: z.boolean().optional(),
      }),
    )
    .optional()
    .describe('Per-level read toggles.'),

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
