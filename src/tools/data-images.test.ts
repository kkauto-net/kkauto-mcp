import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { ApiRequestOptions, KkAutoMcpConfig } from '../types.js';
import { registerDataImageTools } from './data-images.js';

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
    return { status: 'success', data: { id: 7, original_name: 'hero.jpg' } } as T;
  }

  async post<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    this.calls.push({ method: 'POST', path, options });
    return { status: 'success', data: { uploaded: [{ id: 7 }], errors: [] } } as T;
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

  registerDataImageTools(server as unknown as McpServer, client as unknown as KkAutoApiClient, testConfig);

  return { server, client };
}

test('registers exactly the supported data image tools', () => {
  const { server } = registerTools();

  assert.deepEqual([...server.tools.keys()], [
    'list_data_images',
    'get_data_image',
    'search_data_images',
    'create_data_image',
    'update_data_image',
    'delete_data_image',
  ]);
  assert.equal([...server.tools.keys()].some((name) => name.includes('random')), false);
});

test('list caps limit through KK_MCP_MAX_LIST_LIMIT and passes filters', async () => {
  const { server, client } = registerTools();

  await server.tools.get('list_data_images')!({ limit: 500, category_id: 3, approve: 1, search: 'hero' });

  assert.equal(client.calls[0]?.method, 'GET');
  assert.equal(client.calls[0]?.path, '/api/v2/data-images');
  assert.equal(client.calls[0]?.options?.query?.limit, 50);
  assert.equal(client.calls[0]?.options?.query?.category_id, 3);
  assert.equal(client.calls[0]?.options?.query?.approve, 1);
  assert.equal(client.calls[0]?.options?.query?.search, 'hero');
});

test('get and search use the expected data image routes', async () => {
  const { server, client } = registerTools();

  await server.tools.get('get_data_image')!({ id: 7 });
  await server.tools.get('search_data_images')!({ search: 'hero', category_id: 2, limit: 500 });

  assert.deepEqual(
    client.calls.map((call) => [call.method, call.path]),
    [
      ['GET', '/api/v2/data-images/7'],
      ['GET', '/api/v2/data-images/search'],
    ],
  );
  assert.equal(client.calls[1]?.options?.query?.limit, 50);
});

test('schema rejects invalid data image inputs before API calls', async () => {
  const { server, client } = registerTools();

  await assert.rejects(() => server.tools.get('search_data_images')!({}), /at least one of name or search/);
  await assert.rejects(() => server.tools.get('search_data_images')!({ name: 'a', search: 'b' }), /not both/);
  await assert.rejects(() => server.tools.get('get_data_image')!({ id: 0 }), /Too small/);

  assert.equal(client.calls.length, 0);
});

test('create sends JSON URL mode and multipart file mode to the expected route', async () => {
  const { server, client } = registerTools();

  await server.tools.get('create_data_image')!({ images: ['https://example.com/a.jpg'], category_id: 2, alt: 'alt text' });

  assert.equal(client.calls[0]?.method, 'POST');
  assert.equal(client.calls[0]?.path, '/api/v2/data-images');
  assert.deepEqual(client.calls[0]?.options?.body, {
    images: ['https://example.com/a.jpg'],
    category_id: 2,
    alt: 'alt text',
  });

  await assert.rejects(
    () => server.tools.get('create_data_image')!({ images: ['https://example.com/a.jpg'], media_files: ['/tmp/a.jpg'] }),
    /not both/,
  );
  assert.equal(client.calls.length, 1);

  const imagePath = join(tmpdir(), `kkauto-mcp-data-image-${Date.now()}.png`);
  await writeFile(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  try {
    await server.tools.get('create_data_image')!({ media_files: [imagePath], category_id: 2 });

    assert.equal(client.calls[1]?.method, 'POST');
    assert.equal(client.calls[1]?.path, '/api/v2/data-images');
    assert.equal(client.calls[1]?.options?.formData instanceof FormData, true);
  } finally {
    await rm(imagePath, { force: true });
  }
});

test('update sends only supplied fields over PUT', async () => {
  const { server, client } = registerTools();

  await server.tools.get('update_data_image')!({ id: 7, approve: 1, alt: 'new' });

  assert.equal(client.calls[0]?.method, 'PUT');
  assert.equal(client.calls[0]?.path, '/api/v2/data-images/7');
  assert.deepEqual(client.calls[0]?.options?.body, { approve: 1, alt: 'new' });
});

test('delete is disabled by default before preflight', async () => {
  const { server, client } = registerTools();

  await assert.rejects(
    () => server.tools.get('delete_data_image')!({ id: 7, confirm: true, reason: 'cleanup' }),
    /disabled/,
  );
  assert.equal(client.calls.length, 0);
});

test('delete preflights and checks expected name when enabled', async () => {
  const { server, client } = registerTools({ ...config, enableDelete: true });

  await server.tools.get('delete_data_image')!({
    id: 7,
    confirm: true,
    reason: 'cleanup',
    expected_name: 'hero.jpg',
  });

  assert.deepEqual(
    client.calls.map((call) => [call.method, call.path]),
    [
      ['GET', '/api/v2/data-images/7'],
      ['DELETE', '/api/v2/data-images/7'],
    ],
  );
});

test('delete aborts when expected name does not match preflight', async () => {
  const { server, client } = registerTools({ ...config, enableDelete: true });

  await assert.rejects(
    () => server.tools.get('delete_data_image')!({ id: 7, confirm: true, reason: 'cleanup', expected_name: 'other.jpg' }),
    /expected_name did not match/,
  );
  assert.deepEqual(client.calls.map((call) => call.method), ['GET']);
});