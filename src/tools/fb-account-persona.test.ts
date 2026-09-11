import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { ApiRequestOptions, KkAutoMcpConfig } from '../types.js';
import { registerFbAccountPersonaTools } from './fb-account-persona.js';

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
    return { status: 'success', data: { account_id: 7, persona: {} } } as T;
  }

  async post<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    this.calls.push({ method: 'POST', path, options });
    return { status: 'success', data: { persisted: true } } as T;
  }

  async put<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    this.calls.push({ method: 'PUT', path, options });
    return { status: 'success', data: { account_id: 7 } } as T;
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

  registerFbAccountPersonaTools(server as unknown as McpServer, client as unknown as KkAutoApiClient, testConfig);

  return { server, client };
}

test('registers exactly the supported FB account persona tools', () => {
  const { server } = registerTools();

  assert.deepEqual([...server.tools.keys()], [
    'get_fb_account_persona',
    'update_fb_account_persona',
    'generate_fb_account_persona',
  ]);
});

test('get and update use the expected persona routes with supplied fields', async () => {
  const { server, client } = registerTools();

  await server.tools.get('get_fb_account_persona')!({ id: 7 });
  await server.tools.get('update_fb_account_persona')!({
    id: 7,
    display_name: 'Lan',
    interests: ['coffee'],
    education: [{ school: 'DUT' }],
    avatar_url: '',
  });

  assert.deepEqual(
    client.calls.map((call) => [call.method, call.path]),
    [
      ['GET', '/api/v2/fb-accounts/7/persona'],
      ['PUT', '/api/v2/fb-accounts/7/persona'],
    ],
  );
  assert.deepEqual(client.calls[1]?.options?.body, {
    display_name: 'Lan',
    interests: ['coffee'],
    education: [{ school: 'DUT' }],
    avatar_url: '',
  });
});

test('update rejects empty payloads and invalid media URL schemes', async () => {
  const { server, client } = registerTools();

  await assert.rejects(() => server.tools.get('update_fb_account_persona')!({ id: 7 }), /At least one persona field/);
  await assert.rejects(
    () => server.tools.get('update_fb_account_persona')!({ id: 7, avatar_url: 'ftp://example.com/a.jpg' }),
    /http:\/\/ or https:\/\//,
  );
  await assert.rejects(
    () => server.tools.get('update_fb_account_persona')!({ id: 7, display_name: 'x'.repeat(191) }),
    /Too big/,
  );

  assert.equal(client.calls.length, 0);
});

test('generate normalizes boolish flags and maps provider options', async () => {
  const { server, client } = registerTools();

  await server.tools.get('generate_fb_account_persona')!({
    id: 7,
    provider_id: 3,
    reference_text: 'Keep it short',
    generate_fullname: 'false',
    merge_data_profile_name: 1,
    save_data_profile_gender: true,
    data_profile_gender: 'female',
    persona_overrides: { occupation: 'Teacher' },
  });

  assert.equal(client.calls[0]?.method, 'POST');
  assert.equal(client.calls[0]?.path, '/api/v2/fb-accounts/7/persona/generate');
  assert.deepEqual(client.calls[0]?.options?.body, {
    provider_id: 3,
    reference_text: 'Keep it short',
    generate_fullname: false,
    merge_data_profile_name: true,
    save_data_profile_gender: true,
    data_profile_gender: 'female',
    persona_overrides: { occupation: 'Teacher' },
  });
});

test('generate allows an empty option body', async () => {
  const { server, client } = registerTools();

  await server.tools.get('generate_fb_account_persona')!({ id: 7 });

  assert.equal(client.calls[0]?.path, '/api/v2/fb-accounts/7/persona/generate');
  assert.deepEqual(client.calls[0]?.options?.body, {});
});