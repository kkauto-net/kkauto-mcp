import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { RESOURCE_SPECS, registerAllTools } from './index.js';

class FakeServer {
  public readonly names: string[] = [];

  registerTool(name: string): void {
    this.names.push(name);
  }
}

const config: KkAutoMcpConfig = {
  apiBaseUrl: 'https://tenant.example.com',
  apiToken: 'token-placeholder',
  enableDelete: false,
  defaultStatus: 0,
  maxListLimit: 50,
};

function register() {
  const server = new FakeServer();
  registerAllTools(server as unknown as McpServer, {} as unknown as KkAutoApiClient, config);

  return server.names;
}

test('registers every grouped tool exactly once', () => {
  const names = register();

  // 45 grouped specs + the get_api_capabilities discovery tool.
  assert.equal(names.length, RESOURCE_SPECS.length + 1);
  assert.equal(new Set(names).size, names.length, 'tool names must be unique');
  assert.ok(names.includes('manage_config'));
  assert.ok(names.includes('manage_fb_post'));
  assert.ok(names.includes('manage_social_account'));
});

test('every tool name follows manage_<resource> or is an explicit discovery tool', () => {
  for (const spec of RESOURCE_SPECS) {
    assert.match(spec.name, /^manage_[a-z0-9_]+$/, `${spec.name} must follow manage_<resource>`);
    assert.ok(spec.title.length > 0, `${spec.name} needs a title`);
    assert.ok(spec.description.length > 0, `${spec.name} needs a description`);
  }
});

test('every action targets the api v2 surface with a unique method+path', () => {
  for (const spec of RESOURCE_SPECS) {
    const seen = new Set<string>();

    for (const [name, action] of Object.entries(spec.actions)) {
      assert.ok(action.path.startsWith('/api/v2/'), `${spec.name}.${name} must target /api/v2/`);
      assert.match(action.method, /^(GET|POST|PUT|PATCH|DELETE)$/, `${spec.name}.${name} has an invalid method`);

      const key = `${action.method} ${action.path}`;
      assert.ok(!seen.has(key), `${spec.name} reuses ${key}`);
      seen.add(key);

      for (const token of action.path.matchAll(/\{([a-zA-Z0-9_]+)\}/g)) {
        assert.ok(action.input?.[token[1]] !== undefined, `${spec.name}.${name} path token {${token[1]}} has no schema field`);
      }

      if (action.guard !== undefined) {
        assert.ok(['delete', 'confirm'].includes(action.guard), `${spec.name}.${name} has an unknown guard`);
      }

      if (action.method === 'GET' && action.body !== undefined) {
        assert.fail(`${spec.name}.${name} sets a body on a GET action`);
      }
    }
  }
});

test('guards match the action semantics', () => {
  const guardByAction = new Map<string, string>();

  for (const spec of RESOURCE_SPECS) {
    for (const [name, action] of Object.entries(spec.actions)) {
      guardByAction.set(`${spec.name}.${name}`, action.guard ?? 'none');

      if (action.guard === 'delete') {
        assert.match(name, /(delete|remove|detach|revoke|clear|unbind|close|reset)/, `${spec.name}.${name} guards a non-destructive action as delete`);
      }

      if (action.guard === 'confirm') {
        assert.notEqual(action.method, 'GET', `${spec.name}.${name} cannot guard a GET with confirm`);
      }
    }
  }

  // Spot checks across the families with the heaviest side effects.
  assert.equal(guardByAction.get('manage_fb_task.cancel-all'), 'confirm');
  assert.equal(guardByAction.get('manage_hashtag.bulk-delete'), 'confirm');
  assert.equal(guardByAction.get('manage_source_crawler_task.retry-all-failed'), 'confirm');
  assert.equal(guardByAction.get('manage_fb_post.delete'), 'delete');
  assert.equal(guardByAction.get('manage_storefront.confirm-payment'), 'confirm');
});

test('list actions expose pagination and let the client cap the page size', () => {
  for (const spec of RESOURCE_SPECS) {
    const list = spec.actions.list ?? spec.actions['list-orders'] ?? spec.actions['list-customers'];
    if (list === undefined) {
      continue;
    }

    assert.ok(list.method === 'GET', `${spec.name} list action must be a GET`);
    assert.ok(list.query?.includes('limit'), `${spec.name} list action must forward limit`);
    assert.ok(list.input?.limit !== undefined, `${spec.name} list action must declare limit`);
  }
});
