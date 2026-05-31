import assert from 'node:assert/strict';
import { test } from 'node:test';
import { open, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { ApiRequestOptions, KkAutoMcpConfig } from '../types.js';
import { registerFbPostTools } from './fb-posts.js';

type ToolHandler = (input: Record<string, unknown>) => Promise<unknown>;

class FakeServer {
  public readonly tools = new Map<string, ToolHandler>();

  registerTool(name: string, _definition: unknown, handler: ToolHandler): void {
    this.tools.set(name, handler);
  }
}

class FakeClient {
  public readonly calls: Array<{ method: string; path: string; options?: ApiRequestOptions }> = [];

  async get<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    this.calls.push({ method: 'GET', path, options });
    return { status: 'success', data: { id: 7, title: 'Existing title' } } as T;
  }

  async post<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    this.calls.push({ method: 'POST', path, options });
    return { status: 'success', data: { id: 7 } } as T;
  }

  async put<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    this.calls.push({ method: 'PUT', path, options });
    return { status: 'success', data: { id: 7 } } as T;
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

  registerFbPostTools(server as unknown as McpServer, client as unknown as KkAutoApiClient, testConfig);

  return { server, client };
}

test('registers exactly the supported FB post tools', () => {
  const { server } = registerTools();

  assert.deepEqual([...server.tools.keys()], [
    'list_fb_posts',
    'get_fb_post',
    'create_fb_post',
    'update_fb_post',
    'delete_fb_post',
  ]);
  assert.equal([...server.tools.keys()].some((name) => name.includes('random')), false);
});

test('delete is disabled by default before any API call', async () => {
  const { server, client } = registerTools();

  await assert.rejects(
    () => server.tools.get('delete_fb_post')!({ id: 7, confirm: true, reason: 'test' }),
    /disabled/,
  );
  assert.equal(client.calls.length, 0);
});

test('create applies defaults and normalizes natural hashtag strings', async () => {
  const { server, client } = registerTools();

  await server.tools.get('create_fb_post')!({
    title: 'Title',
    content: 'Content',
    post_type: 'product',
    media_type: 'image',
    post_to: 'fanpage',
    hashtags: '#sale, launch',
  });

  assert.equal(client.calls[0]?.method, 'POST');
  assert.deepEqual(client.calls[0]?.options?.body, {
    title: 'Title',
    content: 'Content',
    post_type: 'product',
    media_type: 'image',
    post_to: 'fanpage',
    hashtags: ['sale', 'launch'],
    assistant_id: 1,
    status: 0,
    file_download: 0,
    media: [],
  });
});

test('update omits absent fields and does not send media unless provided', async () => {
  const { server, client } = registerTools();

  await server.tools.get('update_fb_post')!({ id: 7, title: 'Changed title' });

  assert.equal(client.calls[0]?.method, 'PUT');
  assert.equal(client.calls[0]?.path, '/api/v2/fb-posts/7');
  assert.deepEqual(client.calls[0]?.options?.body, { title: 'Changed title' });
});

test('create can upload local image files through multipart form data', async () => {
  const { server, client } = registerTools();
  const imagePath = join(tmpdir(), `kkauto-mcp-upload-${Date.now()}.png`);
  await writeFile(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  try {
    await server.tools.get('create_fb_post')!({
      title: 'Title',
      content: 'Content',
      post_type: 'product',
      media_type: 'image',
      post_to: 'fanpage',
      media_files: [imagePath],
    });

    const call = client.calls[0];
    assert.equal(call?.method, 'POST');
    assert.equal(call?.path, '/api/v2/fb-posts');
    assert.ok(call?.options?.formData instanceof FormData);
    assert.equal(call.options.formData.has('data'), true);
    assert.equal(call.options.formData.has('media[]'), true);
    assert.equal(call.options.body, undefined);
    assert.deepEqual(JSON.parse(String(call.options.formData.get('data'))), {
      title: 'Title',
      content: 'Content',
      post_type: 'product',
      media_type: 'image',
      post_to: 'fanpage',
      assistant_id: 1,
      status: 0,
      file_download: 0,
      media: [],
    });
  } finally {
    await rm(imagePath, { force: true });
  }
});

test('update can replace media with local image files through multipart form data', async () => {
  const { server, client } = registerTools();
  const imagePath = join(tmpdir(), `kkauto-mcp-upload-${Date.now()}.jpg`);
  await writeFile(imagePath, Buffer.from([0xff, 0xd8, 0xff]));

  try {
    await server.tools.get('update_fb_post')!({ id: 7, media_files: [imagePath] });

    const call = client.calls[0];
    assert.equal(call?.method, 'POST');
    assert.equal(call?.path, '/api/v2/fb-posts/7');
    assert.ok(call?.options?.formData instanceof FormData);
    assert.equal(call.options.formData.has('media[]'), true);
    assert.equal(call.options.body, undefined);
  } finally {
    await rm(imagePath, { force: true });
  }
});

test('create rejects calls that mix media URLs and local upload files', async () => {
  const { server } = registerTools();
  const imagePath = join(tmpdir(), `kkauto-mcp-upload-${Date.now()}.gif`);
  await writeFile(imagePath, Buffer.from([0x47, 0x49, 0x46]));

  try {
    await assert.rejects(
      () => server.tools.get('create_fb_post')!({
        title: 'Title',
        content: 'Content',
        post_type: 'product',
        media_type: 'image',
        post_to: 'fanpage',
        media: ['https://example.com/image.png'],
        media_files: [imagePath],
      }),
      /either media URL array or media_files/,
    );
  } finally {
    await rm(imagePath, { force: true });
  }
});

test('update rejects calls that mix media URLs and local upload files', async () => {
  const { server } = registerTools();
  const imagePath = join(tmpdir(), `kkauto-mcp-upload-${Date.now()}.png`);
  await writeFile(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  try {
    await assert.rejects(
      () => server.tools.get('update_fb_post')!({
        id: 7,
        media: ['https://example.com/image.png'],
        media_files: [imagePath],
      }),
      /either media URL array or media_files/,
    );
  } finally {
    await rm(imagePath, { force: true });
  }
});

test('create rejects more than 15 local upload files', async () => {
  const { server } = registerTools();

  await assert.rejects(
    () => server.tools.get('create_fb_post')!({
      title: 'Title',
      content: 'Content',
      post_type: 'product',
      media_type: 'image',
      post_to: 'fanpage',
      media_files: Array.from({ length: 16 }, (_, index) => `/tmp/image-${index}.png`),
    }),
    /media_files accepts at most 15 files/,
  );
});

test('create rejects local upload files larger than 10 MB', async () => {
  const { server } = registerTools();
  const imagePath = join(tmpdir(), `kkauto-mcp-upload-${Date.now()}.png`);
  const handle = await open(imagePath, 'w');

  try {
    await handle.truncate(10 * 1024 * 1024 + 1);
    await handle.close();

    await assert.rejects(
      () => server.tools.get('create_fb_post')!({
        title: 'Title',
        content: 'Content',
        post_type: 'product',
        media_type: 'image',
        post_to: 'fanpage',
        media_files: [imagePath],
      }),
      /exceeds 10 MB/,
    );
  } finally {
    await handle.close().catch(() => undefined);
    await rm(imagePath, { force: true });
  }
});

test('create rejects unsupported local upload file types', async () => {
  const { server } = registerTools();
  const filePath = join(tmpdir(), `kkauto-mcp-upload-${Date.now()}.txt`);
  await writeFile(filePath, 'not an image');

  try {
    await assert.rejects(
      () => server.tools.get('create_fb_post')!({
        title: 'Title',
        content: 'Content',
        post_type: 'product',
        media_type: 'image',
        post_to: 'fanpage',
        media_files: [filePath],
      }),
      /only supports \.jpg, \.jpeg, \.png, or \.gif/,
    );
  } finally {
    await rm(filePath, { force: true });
  }
});
