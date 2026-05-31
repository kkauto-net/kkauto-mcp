import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { ApiRequestOptions, KkAutoMcpConfig } from '../types.js';
import { registerSourcePostTools } from './source-posts.js';

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
    return { success: true, data: { id: 7, title: 'Existing source post' } } as T;
  }

  async post<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    this.calls.push({ method: 'POST', path, options });
    return { success: true, data: { id: 7 } } as T;
  }

  async put<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    this.calls.push({ method: 'PUT', path, options });
    return { success: true, data: { id: 7 } } as T;
  }

  async patch<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    this.calls.push({ method: 'PATCH', path, options });
    return { success: true } as T;
  }

  async delete<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    this.calls.push({ method: 'DELETE', path, options });
    return { success: true } as T;
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

  registerSourcePostTools(server as unknown as McpServer, client as unknown as KkAutoApiClient, testConfig);

  return { server, client };
}

test('registers exactly the supported source post tools', () => {
  const { server } = registerTools();

  assert.deepEqual([...server.tools.keys()], [
    'list_source_posts',
    'get_source_post',
    'search_source_posts',
    'list_source_posts_by_platform',
    'list_source_posts_by_hashtag',
    'get_source_post_statistics',
    'create_source_post',
    'update_source_post',
    'update_source_post_status',
    'delete_source_post',
  ]);
  assert.equal([...server.tools.keys()].some((name) => name.includes('random')), false);
});

test('list caps limit through KK_MCP_MAX_LIST_LIMIT', async () => {
  const { server, client } = registerTools();

  await server.tools.get('list_source_posts')!({ limit: 500, workflow_status: 'approved' });

  assert.equal(client.calls[0]?.method, 'GET');
  assert.equal(client.calls[0]?.path, '/api/v2/source-posts');
  assert.equal(client.calls[0]?.options?.query?.limit, 50);
});

test('read and search tools use expected source post routes', async () => {
  const { server, client } = registerTools();

  await server.tools.get('get_source_post')!({ id: 7 });
  await server.tools.get('search_source_posts')!({ q: 'launch', limit: 500, status: 'approved' });
  await server.tools.get('list_source_posts_by_platform')!({ platform: 'facebook', limit: 2 });
  await server.tools.get('list_source_posts_by_hashtag')!({ hashtag: 'sale tag', offset: 3 });
  await server.tools.get('get_source_post_statistics')!({});

  assert.deepEqual(
    client.calls.map((call) => [call.method, call.path]),
    [
      ['GET', '/api/v2/source-posts/7'],
      ['GET', '/api/v2/source-posts/search'],
      ['GET', '/api/v2/source-posts/by-platform/facebook'],
      ['GET', '/api/v2/source-posts/by-hashtag/sale%20tag'],
      ['GET', '/api/v2/source-posts/statistics'],
    ],
  );
  assert.equal(client.calls[1]?.options?.query?.limit, 50);
  assert.equal(client.calls[3]?.options?.query?.offset, 3);
});

test('schema rejects invalid source post inputs before API calls', async () => {
  const { server, client } = registerTools();

  await assert.rejects(() => server.tools.get('get_source_post')!({ id: 0 }), /Too small/);
  await assert.rejects(() => server.tools.get('list_source_posts')!({ source_platform: 'myspace' }), /Invalid option/);

  assert.equal(client.calls.length, 0);
});

test('create applies API defaults and normalizes natural hashtag strings', async () => {
  const { server, client } = registerTools();

  await server.tools.get('create_source_post')!({
    title: 'Source title',
    content: 'Content',
    source_platform: 'facebook',
    source_channel: 'Channel',
    source_author: 'Author',
    source_url: 'https://example.com/post/1',
    source_post_id: 'post-1',
    published_at: '2026-05-26 10:30:00',
    hashtags: '#sale, launch',
  });

  assert.equal(client.calls[0]?.method, 'POST');
  assert.equal(client.calls[0]?.path, '/api/v2/source-posts');
  assert.deepEqual(client.calls[0]?.options?.body, {
    title: 'Source title',
    content: 'Content',
    source_platform: 'facebook',
    source_channel: 'Channel',
    source_author: 'Author',
    source_url: 'https://example.com/post/1',
    source_post_id: 'post-1',
    published_at: '2026-05-26 10:30:00',
    source_format: 'unknown',
    workflow_status: 'pending',
    topic_type: 'normal',
    length_type: 'short',
    hashtags: ['sale', 'launch'],
  });
});

test('update omits absent fields and maps deprecated aliases to canonical fields', async () => {
  const { server, client } = registerTools();

  await server.tools.get('update_source_post')!({ id: 7, status: 'approved', post_type: 'long' });

  assert.equal(client.calls[0]?.method, 'PUT');
  assert.equal(client.calls[0]?.path, '/api/v2/source-posts/7');
  assert.deepEqual(client.calls[0]?.options?.body, {
    status: 'approved',
    post_type: 'long',
    workflow_status: 'approved',
    length_type: 'long',
  });
});

test('status update uses PATCH and requires an explicit status', async () => {
  const { server, client } = registerTools();

  await assert.rejects(() => server.tools.get('update_source_post_status')!({ id: 7 }), /requires workflow_status or status/);
  await server.tools.get('update_source_post_status')!({ id: 7, workflow_status: 'rejected', notes: 'duplicate' });

  assert.equal(client.calls[0]?.method, 'PATCH');
  assert.equal(client.calls[0]?.path, '/api/v2/source-posts/7/status');
  assert.deepEqual(client.calls[0]?.options?.body, { workflow_status: 'rejected', notes: 'duplicate' });
});

test('delete is disabled by default before preflight', async () => {
  const { server, client } = registerTools();

  await assert.rejects(
    () => server.tools.get('delete_source_post')!({ id: 7, confirm: true, reason: 'cleanup' }),
    /disabled/,
  );
  assert.equal(client.calls.length, 0);
});

test('delete preflights and checks expected title when enabled', async () => {
  const { server, client } = registerTools({ ...config, enableDelete: true });

  await server.tools.get('delete_source_post')!({
    id: 7,
    confirm: true,
    reason: 'cleanup',
    expected_title: 'Existing source post',
  });

  assert.deepEqual(
    client.calls.map((call) => [call.method, call.path]),
    [
      ['GET', '/api/v2/source-posts/7'],
      ['DELETE', '/api/v2/source-posts/7'],
    ],
  );
});
