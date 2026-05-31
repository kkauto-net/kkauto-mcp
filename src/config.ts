import { ConfigError } from './errors.js';
import type { KkAutoMcpConfig } from './types.js';

export function loadConfig(env: NodeJS.ProcessEnv = process.env): KkAutoMcpConfig {
  const apiBaseUrl = normalizeBaseUrl(requireEnv(env, 'KK_API_BASE_URL'));
  const apiToken = requireEnv(env, 'KK_API_TOKEN');

  return {
    apiBaseUrl,
    apiToken,
    enableDelete: parseBoolean(env.KK_MCP_ENABLE_DELETE, false),
    defaultStatus: parseStatus(env.KK_MCP_DEFAULT_STATUS),
    maxListLimit: parsePositiveInteger(env.KK_MCP_MAX_LIST_LIMIT, 50, 'KK_MCP_MAX_LIST_LIMIT'),
  };
}

function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();

  if (!value) {
    throw new ConfigError(`${key} is required`);
  }

  return value;
}

function normalizeBaseUrl(value: string): string {
  try {
    const url = new URL(value);

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new ConfigError('KK_API_BASE_URL must use http or https');
    }

    return url.toString().replace(/\/+$/, '');
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }

    throw new ConfigError('KK_API_BASE_URL must be a valid URL');
  }
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === '') {
    return defaultValue;
  }

  return value.trim().toLowerCase() === 'true';
}

function parseStatus(value: string | undefined): 0 | 1 {
  const parsed = parsePositiveInteger(value, 0, 'KK_MCP_DEFAULT_STATUS', true);

  if (parsed !== 0 && parsed !== 1) {
    throw new ConfigError('KK_MCP_DEFAULT_STATUS must be 0 or 1');
  }

  return parsed;
}

function parsePositiveInteger(value: string | undefined, defaultValue: number, key: string, allowZero = false): number {
  if (value === undefined || value.trim() === '') {
    return defaultValue;
  }

  const trimmed = value.trim();

  if (!/^(0|[1-9]\d*)$/.test(trimmed)) {
    throw new ConfigError(`${key} must be ${allowZero ? 'a non-negative' : 'a positive'} integer`);
  }

  const parsed = Number.parseInt(trimmed, 10);
  const valid = Number.isInteger(parsed) && (allowZero ? parsed >= 0 : parsed > 0);

  if (!valid) {
    throw new ConfigError(`${key} must be ${allowZero ? 'a non-negative' : 'a positive'} integer`);
  }

  return parsed;
}
