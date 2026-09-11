import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { ApiRequestOptions, KkAutoMcpConfig } from '../types.js';
import { registerProductTools } from './products.js';

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
  public nullOnGet = false;

  async get<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    this.calls.push({ method: 'GET', path, options });
    if (this.nullOnGet) {
      return null as T;
    }
    return { status: 'success', data: { id: 7, name: 'Product A', barcode: 'sp-001' } } as T;
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

  registerProductTools(server as unknown as McpServer, client as unknown as KkAutoApiClient, testConfig);

  return { server, client };
}

test('registers exactly the supported product tools', () => {
  const { server } = registerTools();

  assert.deepEqual([...server.tools.keys()], [
    'list_products',
    'get_product',
    'get_product_by_barcode',
    'list_product_categories',
    'create_product',
    'update_product',
    'update_product_by_barcode',
    'delete_product',
    'upload_product_images',
    'upload_product_images_by_barcode',
    'delete_product_images',
    'delete_product_images_by_barcode',
  ]);
  assert.equal([...server.tools.keys()].some((name) => name.includes('random')), false);
});

test('list caps limit and normalizes 204 responses to an empty envelope', async () => {
  const { server, client } = registerTools();

  await server.tools.get('list_products')!({ limit: 500, search: 'ao', sort_order: 'ASC' });

  assert.equal(client.calls[0]?.method, 'GET');
  assert.equal(client.calls[0]?.path, '/api/v2/products');
  assert.equal(client.calls[0]?.options?.query?.limit, 50);
  assert.equal(client.calls[0]?.options?.query?.sort_order, 'ASC');

  client.nullOnGet = true;
  const result = (await server.tools.get('list_products')!({})) as { content: Array<{ text: string }> };
  assert.deepEqual(JSON.parse(result.content[0]!.text), { status: 'success', data: [], pagination: null });
});

test('read tools use the expected product routes and encode barcodes', async () => {
  const { server, client } = registerTools();

  await server.tools.get('get_product')!({ id: 7 });
  await server.tools.get('get_product_by_barcode')!({ barcode: 'SP 001/x' });
  await server.tools.get('list_product_categories')!({});

  assert.deepEqual(
    client.calls.map((call) => [call.method, call.path]),
    [
      ['GET', '/api/v2/products/7'],
      ['GET', '/api/v2/products/barcode/SP%20001%2Fx'],
      ['GET', '/api/v2/products/categories'],
    ],
  );
});

test('schema rejects invalid product inputs before API calls', async () => {
  const { server, client } = registerTools();

  await assert.rejects(() => server.tools.get('create_product')!({ barcode: 'sp-1', name: 'A' }), /list_price/);
  await assert.rejects(
    () => server.tools.get('create_product')!({ barcode: 'sp-1', name: 'A', list_price: 0, price: 1 }),
    /Too small/,
  );
  await assert.rejects(() => server.tools.get('update_product')!({ id: 7, allow_post: 5 }), /Invalid input/);

  assert.equal(client.calls.length, 0);
});

test('create, update, and update by barcode send expected bodies', async () => {
  const { server, client } = registerTools();

  await server.tools.get('create_product')!({
    barcode: 'SP-001',
    name: 'Product A',
    list_price: 100000,
    price: 90000,
    categories: [1, 2],
    attributes: { color: 'red' },
    hashtags: ['sale'],
    images: ['https://example.com/a.jpg'],
  });
  await server.tools.get('update_product')!({ id: 7, name: 'Product B', allow_post: 1 });
  await server.tools.get('update_product_by_barcode')!({ barcode: 'sp 001', description: 'desc' });

  assert.equal(client.calls[0]?.path, '/api/v2/products');
  assert.deepEqual(client.calls[0]?.options?.body, {
    barcode: 'SP-001',
    name: 'Product A',
    list_price: 100000,
    price: 90000,
    categories: [1, 2],
    attributes: { color: 'red' },
    hashtags: ['sale'],
    images: ['https://example.com/a.jpg'],
  });
  assert.equal(client.calls[1]?.path, '/api/v2/products/7');
  assert.deepEqual(client.calls[1]?.options?.body, { name: 'Product B', allow_post: 1 });
  assert.equal(client.calls[2]?.path, '/api/v2/products/barcode/sp%20001');
  assert.deepEqual(client.calls[2]?.options?.body, { description: 'desc' });
});

test('update rejects empty payloads before API calls', async () => {
  const { server, client } = registerTools();

  await assert.rejects(() => server.tools.get('update_product')!({ id: 7 }), /At least one field/);
  await assert.rejects(() => server.tools.get('update_product_by_barcode')!({ barcode: 'sp-1' }), /At least one field/);

  assert.equal(client.calls.length, 0);
});

test('image upload tools require media files and send multipart form data', async () => {
  const { server, client } = registerTools();

  const imagePath = join(tmpdir(), `kkauto-mcp-product-${Date.now()}.jpg`);
  await writeFile(imagePath, Buffer.from([0xff, 0xd8, 0xff]));

  try {
    await server.tools.get('upload_product_images')!({ id: 7, media_files: [imagePath] });
    await server.tools.get('upload_product_images_by_barcode')!({ barcode: 'sp 001', media_files: [imagePath] });

    assert.deepEqual(
      client.calls.map((call) => [call.method, call.path]),
      [
        ['POST', '/api/v2/products/7/images'],
        ['POST', '/api/v2/products/barcode/sp%20001/images'],
      ],
    );
    assert.equal(client.calls[0]?.options?.formData instanceof FormData, true);
  } finally {
    await rm(imagePath, { force: true });
  }
});

test('delete tools are disabled by default before preflight', async () => {
  const { server, client } = registerTools();

  await assert.rejects(
    () => server.tools.get('delete_product')!({ id: 7, confirm: true, reason: 'cleanup' }),
    /disabled/,
  );
  await assert.rejects(
    () => server.tools.get('delete_product_images')!({ id: 7, confirm: true, reason: 'cleanup' }),
    /disabled/,
  );
  assert.equal(client.calls.length, 0);
});

test('delete preflights and checks expected name when enabled', async () => {
  const { server, client } = registerTools({ ...config, enableDelete: true });

  await server.tools.get('delete_product')!({ id: 7, confirm: true, reason: 'cleanup', expected_name: 'Product A' });

  assert.deepEqual(
    client.calls.map((call) => [call.method, call.path]),
    [
      ['GET', '/api/v2/products/7'],
      ['DELETE', '/api/v2/products/7'],
    ],
  );
});

test('image delete by barcode preflights product lookup then deletes images', async () => {
  const { server, client } = registerTools({ ...config, enableDelete: true });

  await server.tools.get('delete_product_images_by_barcode')!({ barcode: 'sp 001', confirm: true, reason: 'cleanup' });

  assert.deepEqual(
    client.calls.map((call) => [call.method, call.path]),
    [
      ['GET', '/api/v2/products/barcode/sp%20001'],
      ['DELETE', '/api/v2/products/barcode/sp%20001/images'],
    ],
  );
});