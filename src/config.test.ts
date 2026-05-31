import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig } from './config.js';
import { ConfigError } from './errors.js';

const baseEnv = {
  KK_API_BASE_URL: 'https://tenant.example.com/',
  KK_API_TOKEN: 'token-placeholder',
};

test('loadConfig rejects partial integer env values', () => {
  assert.throws(
    () => loadConfig({ ...baseEnv, KK_MCP_MAX_LIST_LIMIT: '50abc' }),
    ConfigError,
  );
  assert.throws(
    () => loadConfig({ ...baseEnv, KK_MCP_DEFAULT_STATUS: '1.9' }),
    ConfigError,
  );
});

test('loadConfig normalizes defaults', () => {
  assert.deepEqual(loadConfig(baseEnv), {
    apiBaseUrl: 'https://tenant.example.com',
    apiToken: 'token-placeholder',
    enableDelete: false,
    defaultStatus: 0,
    maxListLimit: 50,
  });
});
