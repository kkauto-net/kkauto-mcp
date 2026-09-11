import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { ApiRequestOptions, KkAutoMcpConfig } from '../types.js';
import { registerFbAccountTools } from './fb-accounts.js';

type ToolHandler = (input: Record<string, unknown>) => Promise<unknown>;

class FakeServer {
  public readonly tools = new Map<string, ToolHandler>();

  registerTool(name: string, definition: { inputSchema?: z.ZodRawShape }, handler: ToolHandler): void {
    const schema = z.object(definition.inputSchema ?? {});

    this.tools.set(name, async (input) => handler(schema.parse(input)));
  }
}

class FakeClient {
  public readonly calls: Array<{ method: string; path: string; options?: ApiRequestOptions }> = [];

  async get<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    this.calls.push({ method: 'GET', path, options });
    return { status: 'success', data: { u_id: 7, u_name: 'account-7' } } as T;
  }

  async post<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    this.calls.push({ method: 'POST', path, options });
    return { status: 'success', data: { u_id: 7 } } as T;
  }

  async put<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    this.calls.push({ method: 'PUT', path, options });
    return { status: 'success' } as T;
  }

  async patch<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    this.calls.push({ method: 'PATCH', path, options });
    return { status: 'success' } as T;
  }

  async delete<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    this.calls.push({ method: 'DELETE', path, options });
    return { status: 'success' } as T;
  }
}

const config: KkAutoMcpConfig = {
  apiBaseUrl: 'https://tenant.example.com',
  apiToken: 'token-placeholder',
  enableDelete: false,
  defaultStatus: 0,
  maxListLimit: 50,
};

function registerTools(testConfig: KkAutoMcpConfig = config): { server: FakeServer; client: FakeClient } {
  const server = new FakeServer();
  const client = new FakeClient();

  registerFbAccountTools(server as unknown as McpServer, client as unknown as KkAutoApiClient, testConfig);

  return { server, client };
}

test('registers exactly the supported FB account tools', () => {
  const { server } = registerTools();

  assert.deepEqual([...server.tools.keys()], [
    'list_fb_accounts',
    'get_fb_account',
    'search_fb_accounts',
    'search_fb_accounts_by_tag',
    'search_fb_accounts_by_category',
    'get_fb_account_stats',
    'create_fb_account',
    'update_fb_account',
    'update_fb_account_status',
    'delete_fb_account',
  ]);
});

test('list caps limit and passes account filters', async () => {
  const { server, client } = registerTools();

  await server.tools.get('list_fb_accounts')!({
    limit: 500,
    u_active: 1,
    u_status: 'live',
    fb_level: 2,
    cat_id: 3,
    search: 'acc',
    search_field: 'u_mail',
  });

  assert.equal(client.calls[0]?.method, 'GET');
  assert.equal(client.calls[0]?.path, '/api/v2/fb-accounts');
  assert.equal(client.calls[0]?.options?.query?.limit, 50);
  assert.equal(client.calls[0]?.options?.query?.u_active, 1);
  assert.equal(client.calls[0]?.options?.query?.fb_level, 2);
  assert.equal(client.calls[0]?.options?.query?.search_field, 'u_mail');
});

test('read and lookup tools use the expected account routes', async () => {
  const { server, client } = registerTools();

  await server.tools.get('get_fb_account')!({ id: 7 });
  await server.tools.get('search_fb_accounts')!({ type: 'u_mail', value: 'a@example.com' });
  await server.tools.get('search_fb_accounts_by_tag')!({ tag: 'vip', limit: 500 });
  await server.tools.get('search_fb_accounts_by_category')!({ category_id: 3, limit: 500 });
  await server.tools.get('get_fb_account_stats')!({});

  assert.deepEqual(
    client.calls.map((call) => [call.method, call.path]),
    [
      ['GET', '/api/v2/fb-accounts/7'],
      ['GET', '/api/v2/fb-accounts/search'],
      ['GET', '/api/v2/fb-accounts/search-by-tag'],
      ['GET', '/api/v2/fb-accounts/search-by-category'],
      ['GET', '/api/v2/fb-accounts/stats'],
    ],
  );
  assert.equal(client.calls[2]?.options?.query?.limit, 50);
  assert.equal(client.calls[3]?.options?.query?.limit, 50);
});

test('schema rejects invalid account inputs before API calls', async () => {
  const { server, client } = registerTools();

  await assert.rejects(() => server.tools.get('search_fb_accounts')!({ type: 'u_phone', value: 'x' }), /Invalid option/);
  await assert.rejects(() => server.tools.get('create_fb_account')!({ u_mail: 'a@example.com' }), /u_pass/);
  await assert.rejects(() => server.tools.get('list_fb_accounts')!({ search_field: 'u_phone' }), /Invalid option/);

  assert.equal(client.calls.length, 0);
});

test('create posts required credentials and optional sections', async () => {
  const { server, client } = registerTools();

  await server.tools.get('create_fb_account')!({
    u_mail: 'a@example.com',
    u_pass: 'secret',
    u_name: 'acc',
    security: { u_2fa: 'secret' },
  });

  assert.equal(client.calls[0]?.method, 'POST');
  assert.equal(client.calls[0]?.path, '/api/v2/fb-accounts');
  assert.deepEqual(client.calls[0]?.options?.body, {
    u_mail: 'a@example.com',
    u_pass: 'secret',
    u_name: 'acc',
    security: { u_2fa: 'secret' },
  });
});

test('update omits absent fields and rejects empty payloads', async () => {
  const { server, client } = registerTools();

  await assert.rejects(() => server.tools.get('update_fb_account')!({ id: 7 }), /At least one field/);

  await server.tools.get('update_fb_account')!({ id: 7, u_note: 'note', social: { u_gender: 'female' } });

  assert.equal(client.calls[0]?.method, 'PUT');
  assert.equal(client.calls[0]?.path, '/api/v2/fb-accounts/7');
  assert.deepEqual(client.calls[0]?.options?.body, { u_note: 'note', social: { u_gender: 'female' } });
});

test('status update uses PATCH with u_status body', async () => {
  const { server, client } = registerTools();

  await server.tools.get('update_fb_account_status')!({ id: 7, u_status: 'live' });

  assert.equal(client.calls[0]?.method, 'PATCH');
  assert.equal(client.calls[0]?.path, '/api/v2/fb-accounts/7/status');
  assert.deepEqual(client.calls[0]?.options?.body, { u_status: 'live' });
});

test('delete is disabled by default and preflights expected name when enabled', async () => {
  const { server, client } = registerTools();

  await assert.rejects(
    () => server.tools.get('delete_fb_account')!({ id: 7, confirm: true, reason: 'cleanup' }),
    /disabled/,
  );
  assert.equal(client.calls.length, 0);

  const enabled = registerTools({ ...config, enableDelete: true });

  await enabled.server.tools.get('delete_fb_account')!({
    id: 7,
    confirm: true,
    reason: 'cleanup',
    expected_name: 'account-7',
  });

  assert.deepEqual(
    enabled.client.calls.map((call) => [call.method, call.path]),
    [
      ['GET', '/api/v2/fb-accounts/7'],
      ['DELETE', '/api/v2/fb-accounts/7'],
    ],
  );
});