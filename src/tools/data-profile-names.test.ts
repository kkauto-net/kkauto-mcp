import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { ApiRequestOptions, KkAutoMcpConfig } from '../types.js';
import { registerDataProfileNameTools } from './data-profile-names.js';

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
    return { status: 'success', data: { id: 7, firstname: 'Lan', lastname: 'Nguyen', fullname: 'Nguyen Lan' } } as T;
  }

  async post<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    this.calls.push({ method: 'POST', path, options });
    return { status: 'success', data: { id: 7, used: 3 } } as T;
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

  registerDataProfileNameTools(server as unknown as McpServer, client as unknown as KkAutoApiClient, testConfig);

  return { server, client };
}

test('registers exactly the supported data profile name tools', () => {
  const { server } = registerTools();

  assert.deepEqual([...server.tools.keys()], [
    'list_data_profile_names',
    'get_data_profile_name',
    'create_data_profile_name',
    'update_data_profile_name',
    'delete_data_profile_name',
    'increment_data_profile_name_used',
    'add_data_profile_name_image',
    'delete_data_profile_name_image',
    'set_primary_data_profile_name_image',
  ]);
});

test('list caps limit and converts has_images flag', async () => {
  const { server, client } = registerTools();

  await server.tools.get('list_data_profile_names')!({
    limit: 500,
    has_images: 1,
    gender: 'female',
    used_status: 'unused',
    active: 0,
  });

  assert.equal(client.calls[0]?.method, 'GET');
  assert.equal(client.calls[0]?.path, '/api/v2/data-profile-names');
  assert.equal(client.calls[0]?.options?.query?.limit, 50);
  assert.equal(client.calls[0]?.options?.query?.has_images, 1);
  assert.equal(client.calls[0]?.options?.query?.gender, 'female');
  assert.equal(client.calls[0]?.options?.query?.used_status, 'unused');
});

test('get, create, update, increment, and primary routes are mapped', async () => {
  const { server, client } = registerTools();

  await server.tools.get('get_data_profile_name')!({ id: 7 });
  await server.tools.get('create_data_profile_name')!({ firstname: 'Lan', lastname: 'Nguyen', active: 1 });
  await server.tools.get('update_data_profile_name')!({ id: 7, firstname: 'Lan', lastname: 'Nguyen', active: 1, sothich: 'coffee' });
  await server.tools.get('increment_data_profile_name_used')!({ id: 7 });
  await server.tools.get('set_primary_data_profile_name_image')!({ id: 7, image_id: 9 });

  assert.deepEqual(
    client.calls.map((call) => [call.method, call.path]),
    [
      ['GET', '/api/v2/data-profile-names/7'],
      ['POST', '/api/v2/data-profile-names'],
      ['PUT', '/api/v2/data-profile-names/7'],
      ['POST', '/api/v2/data-profile-names/7/increment-used'],
      ['PATCH', '/api/v2/data-profile-names/7/images/9/primary'],
    ],
  );
});

test('schema rejects invalid data profile name inputs before API calls', async () => {
  const { server, client } = registerTools();

  await assert.rejects(() => server.tools.get('create_data_profile_name')!({ firstname: 'L', lastname: 'Nguyen', active: 1 }), /Too small/);
  await assert.rejects(() => server.tools.get('create_data_profile_name')!({ firstname: 'Lan', lastname: 'Nguyen' }), /active/);
  await assert.rejects(
    () => server.tools.get('update_data_profile_name')!({ id: 7, sothich: 'coffee' }),
    /firstname/,
  );

  assert.equal(client.calls.length, 0);
});

test('add image requires local media files and posts multipart form data', async () => {
  const { server, client } = registerTools();

  await assert.rejects(() => server.tools.get('add_data_profile_name_image')!({ id: 7 }), /media_files/);

  const imagePath = join(tmpdir(), `kkauto-mcp-profile-${Date.now()}.png`);
  await writeFile(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  try {
    await server.tools.get('add_data_profile_name_image')!({ id: 7, media_files: [imagePath] });

    assert.equal(client.calls[0]?.method, 'POST');
    assert.equal(client.calls[0]?.path, '/api/v2/data-profile-names/7/images');
    assert.equal(client.calls[0]?.options?.formData instanceof FormData, true);
  } finally {
    await rm(imagePath, { force: true });
  }
});

test('profile delete is disabled by default and preflights when enabled', async () => {
  const { server, client } = registerTools();

  await assert.rejects(
    () => server.tools.get('delete_data_profile_name')!({ id: 7, confirm: true, reason: 'cleanup' }),
    /disabled/,
  );
  assert.equal(client.calls.length, 0);

  const enabled = registerTools({ ...config, enableDelete: true });

  await enabled.server.tools.get('delete_data_profile_name')!({
    id: 7,
    confirm: true,
    reason: 'cleanup',
    expected_name: 'Nguyen Lan',
  });

  assert.deepEqual(
    enabled.client.calls.map((call) => [call.method, call.path]),
    [
      ['GET', '/api/v2/data-profile-names/7'],
      ['DELETE', '/api/v2/data-profile-names/7'],
    ],
  );
});

test('image delete preflights the profile and deletes the image', async () => {
  const { server, client } = registerTools({ ...config, enableDelete: true });

  await server.tools.get('delete_data_profile_name_image')!({ id: 7, image_id: 9, confirm: true, reason: 'cleanup' });

  assert.deepEqual(
    client.calls.map((call) => [call.method, call.path]),
    [
      ['GET', '/api/v2/data-profile-names/7'],
      ['DELETE', '/api/v2/data-profile-names/7/images/9'],
    ],
  );
});