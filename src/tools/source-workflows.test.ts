import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { ApiRequestOptions, KkAutoMcpConfig } from '../types.js';
import { registerSourceWorkflowTools } from './source-workflows.js';

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

    return { success: true, data: { workflow: { id: 7, consumer_mode: 'ai_agent' }, writes: { fb_posts: 0 } } } as T;
  }

  async post<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    this.calls.push({ method: 'POST', path, options });

    return { success: true, data: { claim: { status: 'ok' } } } as T;
  }
}

const config: KkAutoMcpConfig = {
  apiBaseUrl: 'https://tenant.example.com',
  apiToken: 'token-placeholder',
  enableDelete: false,
  defaultStatus: 0,
  maxListLimit: 50,
};

function registerTools(): { server: FakeServer; client: FakeClient } {
  const server = new FakeServer();
  const client = new FakeClient();

  registerSourceWorkflowTools(server as unknown as McpServer, client as unknown as KkAutoApiClient, config);

  return { server, client };
}

test('registers source workflow agent context tool', () => {
  const { server } = registerTools();

  assert.deepEqual([...server.tools.keys()], [
    'list_source_workflows_by_hashtag',
    'get_source_workflow_agent_context',
    'claim_source_workflow_posts',
    'create_fb_post_from_source_workflow_claim',
    'release_source_workflow_claim',
    'fail_source_workflow_claim',
  ]);
});

test('workflow discovery tool uses encoded hashtag route and query filters', async () => {
  const { server, client } = registerTools();

  await server.tools.get('list_source_workflows_by_hashtag')!({
    hashtag: '#foo bar',
    status: 'paused',
    consumer_mode: 'command',
    limit: 5,
    offset: 10,
  });

  assert.deepEqual(client.calls[0], {
    method: 'GET',
    path: '/api/v2/source-workflows/by-hashtag/%23foo%20bar',
    options: {
      query: {
        status: 'paused',
        consumer_mode: 'command',
        limit: 5,
        offset: 10,
      },
    },
  });
});

test('workflow discovery schema rejects tenant id and empty hashtag before API calls', async () => {
  const { server, client } = registerTools();

  await assert.rejects(
    () => server.tools.get('list_source_workflows_by_hashtag')!({ hashtag: 'growth', tenant_id: 123 }),
    /never|expected/i,
  );
  await assert.rejects(
    () => server.tools.get('list_source_workflows_by_hashtag')!({ hashtag: ' ' }),
    /Too small/,
  );

  assert.equal(client.calls.length, 0);
});

test('agent context tool uses expected API route', async () => {
  const { server, client } = registerTools();

  await server.tools.get('get_source_workflow_agent_context')!({ id: 7 });

  assert.deepEqual(client.calls.map((call) => [call.method, call.path]), [
    ['GET', '/api/v2/source-workflows/7/agent-context'],
  ]);
});

test('agent context schema rejects invalid workflow id before API calls', async () => {
  const { server, client } = registerTools();

  await assert.rejects(() => server.tools.get('get_source_workflow_agent_context')!({ id: 0 }), /Too small/);

  assert.equal(client.calls.length, 0);
});

test('claim tool posts supported claim options only', async () => {
  const { server, client } = registerTools();

  await server.tools.get('claim_source_workflow_posts')!({
    id: 7,
    source_post_ids: [11, 12],
    limit: 2,
    ttl_seconds: 600,
    include_content: true,
  });

  assert.deepEqual(client.calls[0], {
    method: 'POST',
    path: '/api/v2/source-workflows/7/source-post-claims',
    options: {
      body: {
        source_post_ids: [11, 12],
        limit: 2,
        ttl_seconds: 600,
        include_content: true,
      },
    },
  });
});

test('create from claim posts generated content to the guarded write route', async () => {
  const { server, client } = registerTools();

  await server.tools.get('create_fb_post_from_source_workflow_claim')!({
    id: 7,
    source_post_id: 11,
    claim_token: 'claim-token',
    content: 'Agent FB post body',
    title: 'Optional title',
    target_key: 'shared',
    conversion_mode: 'rewrite',
  });

  assert.deepEqual(client.calls[0], {
    method: 'POST',
    path: '/api/v2/source-workflows/7/source-post-claims/11/fb-post',
    options: {
      body: {
        claim_token: 'claim-token',
        content: 'Agent FB post body',
        title: 'Optional title',
        target_key: 'shared',
        conversion_mode: 'rewrite',
      },
    },
  });
});

test('create from claim sends remote media URLs in JSON body', async () => {
  const { server, client } = registerTools();

  await server.tools.get('create_fb_post_from_source_workflow_claim')!({
    id: 7,
    source_post_id: 11,
    claim_token: 'claim-token',
    content: 'Agent FB post body',
    media: ['https://agent.example/remade.jpg'],
  });

  assert.deepEqual(client.calls[0], {
    method: 'POST',
    path: '/api/v2/source-workflows/7/source-post-claims/11/fb-post',
    options: {
      body: {
        claim_token: 'claim-token',
        content: 'Agent FB post body',
        media: ['https://agent.example/remade.jpg'],
      },
    },
  });
});

test('create from claim sends media_files as multipart form data', async () => {
  const { server, client } = registerTools();
  const tmpDir = join(process.cwd(), '.tmp-source-workflow-test');
  const imagePath = join(tmpDir, 'remade.jpg');

  await mkdir(tmpDir, { recursive: true });
  try {
    await writeFile(imagePath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

    await server.tools.get('create_fb_post_from_source_workflow_claim')!({
      id: 7,
      source_post_id: 11,
      claim_token: 'claim-token',
      content: 'Agent FB post body',
      media_files: [imagePath],
    });
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }

  const call = client.calls[0];
  assert.equal(call.method, 'POST');
  assert.equal(call.path, '/api/v2/source-workflows/7/source-post-claims/11/fb-post');
  assert.ok(call.options?.formData instanceof FormData);
  assert.equal(call.options.body, undefined);
  assert.deepEqual(JSON.parse(String(call.options.formData.get('data'))), {
    claim_token: 'claim-token',
    content: 'Agent FB post body',
    media: [],
  });
  assert.equal(call.options.formData.getAll('media[]').length, 1);
});

test('create from claim rejects mixed media URLs and media_files before API call', async () => {
  const { server, client } = registerTools();
  const tmpDir = join(process.cwd(), '.tmp-source-workflow-test');
  const imagePath = join(tmpDir, 'remade.jpg');

  await mkdir(tmpDir, { recursive: true });
  try {
    await writeFile(imagePath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

    await assert.rejects(
      () => server.tools.get('create_fb_post_from_source_workflow_claim')!({
        id: 7,
        source_post_id: 11,
        claim_token: 'claim-token',
        content: 'Agent FB post body',
        media: ['https://agent.example/remade.jpg'],
        media_files: [imagePath],
      }),
      /Use either media URL array or media_files/,
    );
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }

  assert.equal(client.calls.length, 0);
});

test('release and fail tools post claim tokens without tenant input', async () => {
  const { server, client } = registerTools();

  await server.tools.get('release_source_workflow_claim')!({ id: 7, source_post_id: 11, claim_token: 'claim-token' });
  await server.tools.get('fail_source_workflow_claim')!({ id: 7, source_post_id: 11, claim_token: 'claim-token', reason: 'No usable content' });

  assert.deepEqual(client.calls.map((call) => [call.method, call.path, call.options?.body]), [
    ['POST', '/api/v2/source-workflows/7/source-post-claims/11/release', { claim_token: 'claim-token' }],
    ['POST', '/api/v2/source-workflows/7/source-post-claims/11/fail', { claim_token: 'claim-token', reason: 'No usable content' }],
  ]);
});

test('claim schema rejects tenant id and invalid source ids before API calls', async () => {
  const { server, client } = registerTools();

  await assert.rejects(
    () => server.tools.get('claim_source_workflow_posts')!({ id: 7, tenant_id: 123 }),
    /never|expected/i,
  );
  await assert.rejects(
    () => server.tools.get('claim_source_workflow_posts')!({ id: 7, source_post_ids: [0] }),
    /Too small/,
  );

  assert.equal(client.calls.length, 0);
});
