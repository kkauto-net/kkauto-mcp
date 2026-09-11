import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { ApiRequestOptions, KkAutoMcpConfig } from '../types.js';
import { registerFbTaskTools } from './fb-tasks.js';

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
    return { success: true } as T;
  }

  async post<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    this.calls.push({ method: 'POST', path, options });
    return { success: true, data: { created_count: 1 } } as T;
  }

  async put<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    this.calls.push({ method: 'PUT', path, options });
    return { success: true } as T;
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

  registerFbTaskTools(server as unknown as McpServer, client as unknown as KkAutoApiClient, testConfig);

  return { server, client };
}

test('registers exactly the supported FB task tools', () => {
  const { server } = registerTools();

  assert.deepEqual([...server.tools.keys()], [
    'create_fb_task',
    'create_fb_post_tasks',
    'create_fb_interaction_tasks',
    'create_fb_comment_tasks',
  ]);
});

test('task tools map to the router and alias routes', async () => {
  const { server, client } = registerTools();

  await server.tools.get('create_fb_task')!({ user_ids: [1], task_type: 'post', confirm: true });
  await server.tools.get('create_fb_post_tasks')!({ user_ids: [1], task_type: 'post', confirm: true });
  await server.tools.get('create_fb_interaction_tasks')!({ user_ids: [1], task_type: 'post', confirm: true });
  await server.tools.get('create_fb_comment_tasks')!({ user_ids: [1], task_type: 'post', confirm: true });

  assert.deepEqual(
    client.calls.map((call) => [call.method, call.path]),
    [
      ['POST', '/api/v2/fb-tasks'],
      ['POST', '/api/v2/fb-tasks/posts'],
      ['POST', '/api/v2/fb-tasks/interactions'],
      ['POST', '/api/v2/fb-tasks/comments'],
    ],
  );
});

test('task creation requires confirm=true and never sends it to the API', async () => {
  const { server, client } = registerTools();

  await assert.rejects(
    () => server.tools.get('create_fb_task')!({ user_ids: [1], task_type: 'post', confirm: false }),
    /requires confirm=true/,
  );
  assert.equal(client.calls.length, 0);

  await server.tools.get('create_fb_task')!({ user_ids: [1, 2], task_type: 'post', confirm: true, task_count: 3 });

  assert.deepEqual(client.calls[0]?.options?.body, { user_ids: [1, 2], task_type: 'post', task_count: 3 });
  assert.equal('confirm' in (client.calls[0]?.options?.body ?? {}), false);
});

test('schema caps user_ids and task_count before API calls', async () => {
  const { server, client } = registerTools();

  await assert.rejects(
    () => server.tools.get('create_fb_task')!({ user_ids: [], task_type: 'post', confirm: true }),
    /at least 1|Too small/,
  );
  await assert.rejects(
    () =>
      server.tools.get('create_fb_task')!({
        user_ids: Array.from({ length: 101 }, (_, index) => index + 1),
        task_type: 'post',
        confirm: true,
      }),
    /at most 100|Too big/,
  );
  await assert.rejects(
    () => server.tools.get('create_fb_task')!({ user_ids: [1], task_type: 'post', confirm: true, task_count: 11 }),
    /Too big/,
  );
  await assert.rejects(
    () => server.tools.get('create_fb_task')!({ user_ids: [1], task_type: 'comment', confirm: true }),
    /expected "post"|Invalid input/,
  );

  assert.equal(client.calls.length, 0);
});

test('later schedules require scheduled_at and fanpage posts require identity', async () => {
  const { server, client } = registerTools();

  await assert.rejects(
    () => server.tools.get('create_fb_task')!({ user_ids: [1], task_type: 'post', confirm: true, schedule_type: 'later' }),
    /scheduled_at is required/,
  );
  await assert.rejects(
    () => server.tools.get('create_fb_task')!({ user_ids: [1], task_type: 'post', confirm: true, type: 'fanpage_post' }),
    /fanpage_post tasks require/,
  );
  await assert.rejects(
    () =>
      server.tools.get('create_fb_task')!({
        user_ids: [1],
        task_type: 'post',
        confirm: true,
        type: 'fanpage_post',
        su_type: 'fanpage',
        su_uid: '',
      }),
    /su_uid|at least 1|Too small/,
  );

  assert.equal(client.calls.length, 0);
});

test('valid fanpage post tasks pass identity fields through', async () => {
  const { server, client } = registerTools();

  await server.tools.get('create_fb_task')!({
    user_ids: [1],
    task_type: 'post',
    confirm: true,
    type: 'fanpage_post',
    post_type: 'interaction',
    su_type: 'fanpage',
    su_uid: '1122334455667788',
    schedule_type: 'later',
    scheduled_at: '2026-05-12 10:30:00',
    payload: { caption: 'content' },
  });

  assert.deepEqual(client.calls[0]?.options?.body, {
    user_ids: [1],
    task_type: 'post',
    type: 'fanpage_post',
    post_type: 'interaction',
    su_type: 'fanpage',
    su_uid: '1122334455667788',
    schedule_type: 'later',
    scheduled_at: '2026-05-12 10:30:00',
    payload: { caption: 'content' },
  });
});