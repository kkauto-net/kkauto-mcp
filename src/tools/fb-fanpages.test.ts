import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { ApiRequestOptions, KkAutoMcpConfig } from '../types.js';
import { registerFbFanpageTools } from './fb-fanpages.js';

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
    return { status: 'success', data: { id: 7, fanpage_name: 'Page 7' } } as T;
  }

  async post<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    this.calls.push({ method: 'POST', path, options });
    return { status: 'success', data: { id: 7 } } as T;
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

  registerFbFanpageTools(server as unknown as McpServer, client as unknown as KkAutoApiClient, testConfig);

  return { server, client };
}

test('registers exactly the supported FB fanpage tools', () => {
  const { server } = registerTools();

  assert.deepEqual([...server.tools.keys()], [
    'list_fb_fanpages',
    'search_fb_fanpages',
    'list_fb_fanpages_missing_uid',
    'get_fb_fanpage',
    'create_fb_fanpage',
    'update_fb_fanpage',
    'delete_fb_fanpage',
  ]);
});

test('list caps limit and passes fanpage filters', async () => {
  const { server, client } = registerTools();

  await server.tools.get('list_fb_fanpages')!({
    limit: 500,
    status: 'active',
    search: 'page',
    search_field: 'fanpage_name',
    missing_uid: 1,
    account_id: 3,
  });

  assert.equal(client.calls[0]?.method, 'GET');
  assert.equal(client.calls[0]?.path, '/api/v2/fb-fanpages');
  assert.equal(client.calls[0]?.options?.query?.limit, 50);
  assert.equal(client.calls[0]?.options?.query?.missing_uid, 1);
  assert.equal(client.calls[0]?.options?.query?.search_field, 'fanpage_name');
});

test('search supports text mode and exact lookup mode only separately', async () => {
  const { server, client } = registerTools();

  await server.tools.get('search_fb_fanpages')!({ q: 'page', limit: 500 });
  await server.tools.get('search_fb_fanpages')!({ type: 'fanpage_uid', value: '112233' });

  assert.deepEqual(
    client.calls.map((call) => call.path),
    ['/api/v2/fb-fanpages/search', '/api/v2/fb-fanpages/search'],
  );
  assert.equal(client.calls[0]?.options?.query?.limit, 50);

  await assert.rejects(() => server.tools.get('search_fb_fanpages')!({}), /requires either q or both type and value/);
  await assert.rejects(
    () => server.tools.get('search_fb_fanpages')!({ q: 'page', type: 'id', value: '7' }),
    /not both/,
  );
  assert.equal(client.calls.length, 2);
});

test('missing-uid, get, create, and update routes are mapped', async () => {
  const { server, client } = registerTools();

  await server.tools.get('list_fb_fanpages_missing_uid')!({ limit: 500, status: 'active' });
  await server.tools.get('get_fb_fanpage')!({ id: 7 });
  await server.tools.get('create_fb_fanpage')!({
    fanpage_name: 'Page A',
    fanpage_link: 'https://facebook.com/page-a',
    status: 'active',
    account_ids: [1, 2],
  });
  await server.tools.get('update_fb_fanpage')!({ id: 7, fanpage_uid: '1122334455667788', account_ids: [1] });

  assert.deepEqual(
    client.calls.map((call) => [call.method, call.path]),
    [
      ['GET', '/api/v2/fb-fanpages/missing-uid'],
      ['GET', '/api/v2/fb-fanpages/7'],
      ['POST', '/api/v2/fb-fanpages'],
      ['PUT', '/api/v2/fb-fanpages/7'],
    ],
  );
  assert.equal(client.calls[0]?.options?.query?.limit, 50);
});

test('schema rejects invalid fanpage inputs before API calls', async () => {
  const { server, client } = registerTools();

  await assert.rejects(() => server.tools.get('create_fb_fanpage')!({ fanpage_name: 'ab', fanpage_link: 'x' }), /Too small/);
  await assert.rejects(() => server.tools.get('create_fb_fanpage')!({ fanpage_name: 'Page A' }), /fanpage_link/);
  await assert.rejects(() => server.tools.get('update_fb_fanpage')!({ id: 7 }), /At least one field/);

  assert.equal(client.calls.length, 0);
});

test('delete is disabled by default and preflights expected name when enabled', async () => {
  const { server, client } = registerTools();

  await assert.rejects(
    () => server.tools.get('delete_fb_fanpage')!({ id: 7, confirm: true, reason: 'cleanup' }),
    /disabled/,
  );
  assert.equal(client.calls.length, 0);

  const enabled = registerTools({ ...config, enableDelete: true });

  await enabled.server.tools.get('delete_fb_fanpage')!({
    id: 7,
    confirm: true,
    reason: 'cleanup',
    expected_name: 'Page 7',
  });

  assert.deepEqual(
    enabled.client.calls.map((call) => [call.method, call.path]),
    [
      ['GET', '/api/v2/fb-fanpages/7'],
      ['DELETE', '/api/v2/fb-fanpages/7'],
    ],
  );
});