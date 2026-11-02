import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { ApiRequestOptions, KkAutoMcpConfig } from '../types.js';
import { registerConfigTools } from './config.js';

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

    return { status: 'success', data: {} } as T;
  }
}

const config: KkAutoMcpConfig = {
  apiBaseUrl: 'https://tenant.example.com',
  apiToken: 'token-placeholder',
  enableDelete: false,
  defaultStatus: 0,
  maxListLimit: 50,
};

function asRecord(value: unknown): Record<string, unknown> {
  assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value));

  return Object.fromEntries(Object.entries(value));
}

function register() {
  const server = new FakeServer();
  const client = new FakeClient();
  registerConfigTools(server as unknown as McpServer, client as unknown as KkAutoApiClient, config);
  const tool = server.tools.get('manage_config');
  if (tool === undefined) {
    throw new Error('manage_config must be registered');
  }

  return { client, tool };
}

test('accepts full level keys and forwards the level body', async () => {
  const { client, tool } = register();
  const parsed = tool.schema.parse({
    action: 'update',
    group: 'fb.levels',
    levels: [{ level: 1, group_max: 5, post_like: 1 }],
  });
  await tool.handler(asRecord(parsed));

  assert.equal(client.calls.length, 1);
  const [call] = client.calls;
  assert.ok(call !== undefined);
  assert.equal(call.method, 'PUT');
  assert.equal(call.path, '/api/v2/config/fb.levels');
  const options = call.options;
  assert.ok(options !== undefined);
  const body = options.body;
  assert.ok(body !== undefined);
  assert.ok(Array.isArray(body.levels));
  assert.deepEqual(body.levels[0], { level: 1, group_max: 5, post_like: 1 });
});

test('rejects an unknown level key by name', async () => {
  const { tool } = register();

  await assert.rejects(
    tool.handler({ action: 'update', group: 'fb.levels', levels: [{ level: 1, bogus: 1 }] }),
    /bogus/,
  );
});

test('forwards auto_login_delay_minutes for fb.general', async () => {
  const { client, tool } = register();
  const parsed = tool.schema.parse({ action: 'update', group: 'fb.general', auto_login_delay_minutes: 15 });
  await tool.handler(asRecord(parsed));

  const [call] = client.calls;
  assert.ok(call !== undefined);
  assert.equal(call.path, '/api/v2/config/fb.general');
  const options = call.options;
  assert.ok(options !== undefined);
  const body = options.body;
  assert.ok(body !== undefined);
  assert.equal(body.auto_login_delay_minutes, 15);
});

test('accepts fb.group-review as a get target', () => {
  const { tool } = register();

  assert.doesNotThrow(() => tool.schema.parse({ action: 'get', group: 'fb.group-review' }));
});
