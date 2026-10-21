import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { ApiRequestOptions, KkAutoMcpConfig } from '../types.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

type ToolHandler = (input: Record<string, unknown>) => Promise<{ content: Array<{ text: string }> }>;

class FakeServer {
  public readonly tools = new Map<string, { schema: { parse: (input: unknown) => unknown }; handler: ToolHandler }>();

  registerTool(name: string, definition: { inputSchema?: unknown }, handler: ToolHandler): void {
    const schema = definition.inputSchema as { parse: (input: unknown) => unknown };
    this.tools.set(name, { schema, handler });
  }
}

class FakeClient {
  public readonly calls: Array<{ method: string; path: string; options?: ApiRequestOptions }> = [];

  async request<T>(method: string, path: string, options: ApiRequestOptions = {}): Promise<T> {
    this.calls.push({ method, path, options });

    return { status: 'success', data: { id: 9 } } as T;
  }
}

const config: KkAutoMcpConfig = {
  apiBaseUrl: 'https://tenant.example.com',
  apiToken: 'token-placeholder',
  enableDelete: false,
  defaultStatus: 0,
  maxListLimit: 50,
};

const spec: ResourceSpec = {
  name: 'manage_thing',
  title: 'Manage things',
  description: 'Test resource.',
  actions: {
    list: {
      title: 'List things',
      description: 'List.',
      method: 'GET',
      path: '/api/v2/things',
      query: ['page', 'limit', 'search'],
      input: {
        page: z.number().int().positive().optional(),
        limit: z.number().int().positive().optional(),
        search: z.string().optional(),
      },
    },
    get: {
      title: 'Get thing',
      description: 'Get.',
      method: 'GET',
      path: '/api/v2/things/{id}',
      input: { id: z.number().int().positive() },
    },
    create: {
      title: 'Create thing',
      description: 'Create.',
      method: 'POST',
      path: '/api/v2/things',
      input: { name: z.string(), id: z.number().int().positive().optional() },
    },
    'run-now': {
      title: 'Run thing',
      description: 'Run.',
      method: 'POST',
      path: '/api/v2/things/{id}/run-now',
      input: { id: z.number().int().positive() },
      guard: 'confirm',
    },
    delete: {
      title: 'Delete thing',
      description: 'Delete.',
      method: 'DELETE',
      path: '/api/v2/things/{id}',
      input: { id: z.number().int().positive() },
      guard: 'delete',
    },
  },
};

function register(testConfig: KkAutoMcpConfig = config) {
  const server = new FakeServer();
  const client = new FakeClient();
  registerResourceTools(server as unknown as McpServer, client as unknown as KkAutoApiClient, testConfig, spec);
  const tool = server.tools.get('manage_thing');
  if (tool === undefined) {
    throw new Error('manage_thing must be registered');
  }

  return { server, client, tool };
}

test('registers one grouped tool carrying every action', () => {
  const { server } = register();

  assert.deepEqual([...server.tools.keys()], ['manage_thing']);
});

test('rejects an unknown action', () => {
  const { tool } = register();

  assert.throws(() => tool.schema.parse({ action: 'explode' }), /action/i);
});

test('requires the path token declared by the action', () => {
  const { tool } = register();

  assert.throws(() => tool.schema.parse({ action: 'get' }));
  assert.deepEqual(tool.schema.parse({ action: 'get', id: 4 }), { action: 'get', id: 4 });
});

test('forwards declared query fields and caps limit', async () => {
  const { client, tool } = register();

  const parsed = tool.schema.parse({ action: 'list', limit: 999, search: 'abc', page: 2 }) as Record<string, unknown>;
  await tool.handler(parsed);

  assert.equal(client.calls[0].method, 'GET');
  assert.equal(client.calls[0].path, '/api/v2/things');
  assert.deepEqual(client.calls[0].options?.query, { limit: 50, search: 'abc', page: 2 });
  assert.equal(client.calls[0].options?.body, undefined);
});

test('substitutes path tokens and sends the remaining fields as the body', async () => {
  const { client, tool } = register();

  await tool.handler(tool.schema.parse({ action: 'create', name: 'hello' }) as Record<string, unknown>);

  assert.equal(client.calls[0].path, '/api/v2/things');
  assert.deepEqual(client.calls[0].options?.body, { name: 'hello' });
});

test('blocks a delete when deletes are disabled', async () => {
  const { tool } = register();

  await assert.rejects(
    tool.handler(tool.schema.parse({ action: 'delete', id: 3, confirm: true, reason: 'cleanup' }) as Record<string, unknown>),
    /KK_MCP_ENABLE_DELETE/,
  );
});

test('guarded delete sends the request when enabled and echoes the reason', async () => {
  const { client, tool } = register({ ...config, enableDelete: true });

  const result = await tool.handler(
    tool.schema.parse({ action: 'delete', id: 3, confirm: true, reason: 'cleanup' }) as Record<string, unknown>,
  );

  assert.equal(client.calls[0].method, 'DELETE');
  assert.equal(client.calls[0].path, '/api/v2/things/3');
  assert.equal(JSON.parse(result.content[0].text).reason, 'cleanup');
});

test('confirm-guarded action requires confirm and a reason at the schema level', () => {
  const { tool } = register();

  assert.throws(() => tool.schema.parse({ action: 'run-now', id: 5 }));
  assert.throws(() => tool.schema.parse({ action: 'run-now', id: 5, confirm: true }));
  assert.doesNotThrow(() => tool.schema.parse({ action: 'run-now', id: 5, confirm: true, reason: 'manual run' }));
});

test('confirm-guarded action posts confirm=true in the body', async () => {
  const { client, tool } = register();

  await tool.handler(tool.schema.parse({ action: 'run-now', id: 5, confirm: true, reason: 'manual' }) as Record<string, unknown>);

  assert.equal(client.calls[0].path, '/api/v2/things/5/run-now');
  assert.deepEqual(client.calls[0].options?.body, { confirm: true });
});

test('refuses to build a spec whose path token has no schema field', () => {
  const server = new FakeServer();
  const broken: ResourceSpec = {
    name: 'manage_broken',
    title: 'Broken',
    description: 'Broken spec.',
    actions: {
      first: { title: 'a', description: 'a', method: 'GET', path: '/api/v2/x/{missing}' },
      second: { title: 'b', description: 'b', method: 'GET', path: '/api/v2/x' },
    },
  };

  assert.throws(
    () => registerResourceTools(server as unknown as McpServer, new FakeClient() as unknown as KkAutoApiClient, config, broken),
    /missing/,
  );
});
