import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { ApiRequestOptions, KkAutoMcpConfig } from '../types.js';
import { registerSourceCrawlerTools } from './source-crawlers.js';

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
    return { status: 'success', data: { crawler: { id: 7, source_name: 'Crawler source' } } } as T;
  }

  async post<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    this.calls.push({ method: 'POST', path, options });
    return { status: 'success' } as T;
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

  registerSourceCrawlerTools(server as unknown as McpServer, client as unknown as KkAutoApiClient, testConfig);

  return { server, client };
}

test('registers exactly the supported source crawler tools', () => {
  const { server } = registerTools();

  assert.deepEqual([...server.tools.keys()], [
    'list_source_crawlers',
    'get_source_crawler',
    'list_source_crawler_posts',
    'search_source_crawler_hashtags',
    'search_source_crawler_accounts',
    'create_source_crawler',
    'update_source_crawler',
    'pause_source_crawler',
    'resume_source_crawler',
    'list_source_crawler_hashtags',
    'add_source_crawler_hashtag',
    'update_source_crawler_hashtag_priority',
    'remove_source_crawler_hashtag',
    'list_source_crawler_accounts',
    'add_source_crawler_account',
    'add_source_crawler_accounts_bulk',
    'remove_source_crawler_account',
    'delete_source_crawler',
  ]);
});

test('list caps limit and uses source crawler route', async () => {
  const { server, client } = registerTools();

  await server.tools.get('list_source_crawlers')!({ limit: 500, status: 'active' });

  assert.equal(client.calls[0]?.method, 'GET');
  assert.equal(client.calls[0]?.path, '/api/v2/source-crawlers');
  assert.equal(client.calls[0]?.options?.query?.limit, 50);
});

test('read and search tools use expected source crawler routes', async () => {
  const { server, client } = registerTools();

  await server.tools.get('get_source_crawler')!({ id: 7 });
  await server.tools.get('list_source_crawler_posts')!({ id: 7, page: 2, limit: 500 });
  await server.tools.get('search_source_crawler_hashtags')!({ q: 'sale' });
  await server.tools.get('search_source_crawler_accounts')!({ q: 'page' });
  await server.tools.get('list_source_crawler_hashtags')!({ id: 7 });
  await server.tools.get('list_source_crawler_accounts')!({ id: 7 });

  assert.deepEqual(
    client.calls.map((call) => [call.method, call.path]),
    [
      ['GET', '/api/v2/source-crawlers/7'],
      ['GET', '/api/v2/source-crawlers/7/posts'],
      ['GET', '/api/v2/source-crawlers/search/hashtags'],
      ['GET', '/api/v2/source-crawlers/search/accounts'],
      ['GET', '/api/v2/source-crawlers/7/hashtags'],
      ['GET', '/api/v2/source-crawlers/7/accounts'],
    ],
  );
  assert.equal(client.calls[1]?.options?.query?.limit, 50);
  assert.equal(client.calls[1]?.options?.query?.page, 2);
});

test('relation add tools use expected source crawler routes', async () => {
  const { server, client } = registerTools();

  await server.tools.get('add_source_crawler_hashtag')!({ id: 7, hashtag_id: 8, priority: 2, status: 'active' });
  await server.tools.get('add_source_crawler_account')!({ id: 7, account_id: 9, permission: 'admin', status: 'active' });

  assert.deepEqual(
    client.calls.map((call) => [call.method, call.path]),
    [
      ['POST', '/api/v2/source-crawlers/7/hashtags'],
      ['POST', '/api/v2/source-crawlers/7/accounts'],
    ],
  );
  assert.deepEqual(client.calls[0]?.options?.body, { hashtag_id: 8, priority: 2, status: 'active' });
  assert.deepEqual(client.calls[1]?.options?.body, { account_id: 9, permission: 'admin', status: 'active' });
});

test('schema rejects invalid source crawler inputs before API calls', async () => {
  const { server, client } = registerTools();

  await assert.rejects(() => server.tools.get('get_source_crawler')!({ id: 0 }), /Too small/);
  await assert.rejects(() => server.tools.get('add_source_crawler_account')!({ id: 7, account_id: 9, permission: 'owner' }), /Invalid option/);
  await assert.rejects(
    () => server.tools.get('add_source_crawler_accounts_bulk')!({ id: 7, account_ids: Array.from({ length: 101 }, (_, index) => index + 1), confirm: true }),
    /Too big/,
  );

  assert.equal(client.calls.length, 0);
});

test('create applies paused once defaults', async () => {
  const { server, client } = registerTools();

  await server.tools.get('create_source_crawler')!({
    platform_type: 'facebook',
    source_type: 'page',
    crawl_interval: 0,
    source_url: 'https://example.com/page',
  });

  assert.equal(client.calls[0]?.method, 'POST');
  assert.deepEqual(client.calls[0]?.options?.body, {
    platform_type: 'facebook',
    source_type: 'page',
    crawl_interval: 0,
    source_url: 'https://example.com/page',
    status: 'paused',
    fetch_mode: 'once',
  });
});

test('update omits absent fields and rejects empty updates', async () => {
  const { server, client } = registerTools();

  await assert.rejects(() => server.tools.get('update_source_crawler')!({ id: 7 }), /At least one field/);
  await server.tools.get('update_source_crawler')!({ id: 7, fetch_mode: 'recurring', crawl_interval: 15 });

  assert.equal(client.calls[0]?.method, 'PUT');
  assert.equal(client.calls[0]?.path, '/api/v2/source-crawlers/7');
  assert.deepEqual(client.calls[0]?.options?.body, { fetch_mode: 'recurring', crawl_interval: 15 });
});

test('pause and resume use PATCH lifecycle routes', async () => {
  const { server, client } = registerTools();

  await server.tools.get('pause_source_crawler')!({ id: 7 });
  await server.tools.get('resume_source_crawler')!({ id: 7 });

  assert.deepEqual(
    client.calls.map((call) => [call.method, call.path]),
    [
      ['PATCH', '/api/v2/source-crawlers/7/pause'],
      ['PATCH', '/api/v2/source-crawlers/7/resume'],
    ],
  );
});

test('hashtag priority update uses PATCH relation route', async () => {
  const { server, client } = registerTools();

  await server.tools.get('update_source_crawler_hashtag_priority')!({ id: 7, hashtag_id: 8, priority: 4 });

  assert.equal(client.calls[0]?.method, 'PATCH');
  assert.equal(client.calls[0]?.path, '/api/v2/source-crawlers/7/hashtags/8/priority');
  assert.deepEqual(client.calls[0]?.options?.body, { priority: 4 });
});

test('bulk account add requires confirm and caps ids through schema', async () => {
  const { server, client } = registerTools();

  await assert.rejects(
    () => server.tools.get('add_source_crawler_accounts_bulk')!({ id: 7, account_ids: [1, 2], confirm: false }),
    /requires confirm=true/,
  );
  await server.tools.get('add_source_crawler_accounts_bulk')!({ id: 7, account_ids: [1, 2], confirm: true });

  assert.equal(client.calls[0]?.method, 'POST');
  assert.equal(client.calls[0]?.path, '/api/v2/source-crawlers/7/accounts/bulk');
  assert.deepEqual(client.calls[0]?.options?.body, { account_ids: [1, 2] });
});

test('relation deletes are disabled by default before any API call', async () => {
  const { server, client } = registerTools();

  await assert.rejects(
    () => server.tools.get('remove_source_crawler_account')!({ id: 7, account_id: 8, confirm: true, reason: 'cleanup' }),
    /disabled/,
  );
  assert.equal(client.calls.length, 0);
});

test('relation deletes preflight crawler before delete when enabled', async () => {
  const { server, client } = registerTools({ ...config, enableDelete: true });

  await server.tools.get('remove_source_crawler_hashtag')!({ id: 7, hashtag_id: 8, confirm: true, reason: 'cleanup' });
  await server.tools.get('remove_source_crawler_account')!({ id: 7, account_id: 9, confirm: true, reason: 'cleanup' });

  assert.deepEqual(
    client.calls.map((call) => [call.method, call.path]),
    [
      ['GET', '/api/v2/source-crawlers/7'],
      ['DELETE', '/api/v2/source-crawlers/7/hashtags/8'],
      ['GET', '/api/v2/source-crawlers/7'],
      ['DELETE', '/api/v2/source-crawlers/7/accounts/9'],
    ],
  );
});

test('delete preflights and checks expected name when enabled', async () => {
  const { server, client } = registerTools({ ...config, enableDelete: true });

  await server.tools.get('delete_source_crawler')!({ id: 7, confirm: true, reason: 'cleanup', expected_name: 'Crawler source' });

  assert.deepEqual(
    client.calls.map((call) => [call.method, call.path]),
    [
      ['GET', '/api/v2/source-crawlers/7'],
      ['DELETE', '/api/v2/source-crawlers/7'],
    ],
  );
});
