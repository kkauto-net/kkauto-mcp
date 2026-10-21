import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { flag, id, limit, page, search } from './schemas.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

/**
 * ai config: captcha service settings (no create/delete — the rows are seeded).
 */

export const captchaServiceSpec: ResourceSpec = {
  name: 'manage_captcha_service',
  title: 'Manage captcha services',
  description: 'kkAuto API v2 captcha services: list, read, update, default, toggle and secret reveal.',
  actions: {
    list: {
      title: 'List captcha services',
      description: 'Captcha service settings with a name search.',
      method: 'GET',
      path: '/api/v2/captcha-services',
      query: ['page', 'limit', 'search'],
      input: {
        page: page(),
        limit: limit(),
        search: search('Partial match on the service name or provider.'),
      },
    },
    get: {
      title: 'Get captcha service',
      description: 'One captcha service by id.',
      method: 'GET',
      path: '/api/v2/captcha-services/{id}',
      input: { id: id('Captcha service id.') },
    },
    update: {
      title: 'Update captcha service',
      description: 'Update provider/name/api_key/flags; an empty api_key keeps the stored key.',
      method: 'PUT',
      path: '/api/v2/captcha-services/{id}',
      input: {
        id: id('Captcha service id.'),
        provider: z.string().optional().describe('Provider key.'),
        name: z.string().optional().describe('Display name.'),
        api_key: z.string().optional().describe('API key; encrypted on write.'),
        is_active: flag('Active flag.').optional(),
        is_default: flag('Default-service flag.').optional(),
      },
    },
    'set-default': {
      title: 'Set default captcha service',
      description: 'Make this service the default solver.',
      method: 'POST',
      path: '/api/v2/captcha-services/{id}/set-default',
      input: { id: id('Captcha service id.') },
    },
    toggle: {
      title: 'Toggle captcha service',
      description: 'Flip is_active.',
      method: 'POST',
      path: '/api/v2/captcha-services/{id}/toggle',
      input: { id: id('Captcha service id.') },
    },
    'reveal-secret': {
      title: 'Reveal captcha API key',
      description: 'Return the plaintext api_key; requires apiv2.admin and is audited.',
      method: 'GET',
      path: '/api/v2/captcha-services/{id}/reveal-secret',
      query: ['field'],
      input: { id: id('Captcha service id.'), field: z.literal('api_key').describe('Secret field to reveal.') },
    },
  },
};

export function registerCaptchaServiceTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, captchaServiceSpec);
}
