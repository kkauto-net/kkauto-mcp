import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import { formatApiErrorMessage } from '../errors.js';
import type { ApiRequestOptions, KkAutoMcpConfig } from '../types.js';
import { registerAllTools } from './index.js';
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

test('requires the path token declared by the action', async () => {
  const { tool } = register();

  await assert.rejects(tool.handler(tool.schema.parse({ action: 'get' }) as Record<string, unknown>), /id/);
  assert.deepEqual(tool.schema.parse({ action: 'get', id: 4 }), { action: 'get', id: 4 });
});

test('publishes one object schema listing every action and field', () => {
  const { server } = register();
  const tool = server.tools.get('manage_thing') as unknown as { schema: z.ZodObject<any> };
  const json = z.toJSONSchema(tool.schema, { io: 'input' }) as {
    type?: string;
    properties?: Record<string, { enum?: string[] }>;
  };

  assert.equal(json.type, 'object');
  assert.deepEqual(json.properties?.action?.enum?.sort(), ['create', 'delete', 'get', 'list', 'run-now']);
  // name/id/confirm/reason come from different actions and are merged into one object.
  for (const field of ['id', 'name', 'search', 'confirm', 'reason', 'expected_name']) {
    assert.ok(json.properties?.[field] !== undefined, `merged schema must expose ${field}`);
  }
});

test('rejects a field the selected action does not declare', async () => {
  const { tool } = register();

  // The merged schema passes unknown keys through; the per-action schema still refuses them.
  const parsed = tool.schema.parse({ action: 'get', id: 4, unknown_foo: 123 }) as Record<string, unknown>;
  await assert.rejects(tool.handler(parsed), /unknown_foo/);
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

test('confirm-guarded action requires confirm and a reason at the action level', async () => {
  const { tool } = register();

  await assert.rejects(tool.handler(tool.schema.parse({ action: 'run-now', id: 5 }) as Record<string, unknown>), /confirm/);
  await assert.rejects(
    tool.handler(tool.schema.parse({ action: 'run-now', id: 5, confirm: true }) as Record<string, unknown>),
    /reason/,
  );
  await assert.doesNotReject(
    tool.handler(
      tool.schema.parse({ action: 'run-now', id: 5, confirm: true, reason: 'manual run' }) as Record<string, unknown>,
    ),
  );
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

test('tools/list publishes an object schema with the action enum for every manage_* tool', async () => {
  const server = new McpServer({ name: 'kkauto-test', version: '0.0.0' });
  registerAllTools(server, new FakeClient() as unknown as KkAutoApiClient, config);

  const client = new Client({ name: 'kkauto-test-client', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const { tools } = await client.listTools();
    const managed = tools.filter((tool) => tool.name.startsWith('manage_'));
    assert.ok(managed.length > 40, 'every manage_* family must be listed');

    for (const tool of managed) {
      const schema = tool.inputSchema as { type?: string; properties?: Record<string, { enum?: string[] }> };
      const properties = schema.properties ?? {};

      assert.equal(schema.type, 'object', `${tool.name} must publish an object inputSchema`);
      assert.ok(Object.keys(properties).length > 1, `${tool.name} must publish its action fields`);
      assert.ok(Array.isArray(properties.action?.enum), `${tool.name} must publish the action enum, got ${JSON.stringify(schema)}`);
      assert.ok((properties.action?.enum ?? []).length > 0, `${tool.name} action enum must not be empty`);
    }
  } finally {
    await client.close();
    await server.close();
  }
});

test('keeps every field error and the request id from a 422 body', () => {
  const message = formatApiErrorMessage(422, {
    status: 'error',
    code: 'VALIDATION_ERROR',
    message: 'Validation failed',
    errors: { title: 'Title is required', pipeline_config: ['must be an object'] },
    request_id: 'req-1',
  });

  assert.match(message, /^kkAuto API request failed with HTTP 422: Validation failed/);
  assert.match(message, /title: Title is required/);
  assert.match(message, /pipeline_config\.0: must be an object/);
  assert.match(message, /\[code=VALIDATION_ERROR request_id=req-1\]/);
});

test('keeps the 409 IN_USE payload in the message', () => {
  const message = formatApiErrorMessage(409, {
    status: 'error',
    code: 'IN_USE',
    message: 'Hashtag is still in use',
    data: { profile_name: [8] },
    request_id: 'req-2',
    error: { code: 'IN_USE', message: 'Hashtag is still in use', fields: { name: ['used by profile 8'] } },
  });

  assert.match(message, /^kkAuto API request failed with HTTP 409: Hashtag is still in use/);
  assert.match(message, /name\.0: used by profile 8/);
  assert.match(message, /details: \{"profile_name":\[8\]\}/);
  assert.match(message, /request_id=req-2/);
});
