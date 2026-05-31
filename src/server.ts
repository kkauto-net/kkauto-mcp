#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { ConfigError, formatUnknownError } from './errors.js';
import { KkAutoApiClient } from './kkauto-api-client.js';
import { registerFbPostTools } from './tools/fb-posts.js';
import { registerSourceCrawlerTools } from './tools/source-crawlers.js';
import { registerSourcePostTools } from './tools/source-posts.js';
import { registerSourceWorkflowTools } from './tools/source-workflows.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new KkAutoApiClient(config);
  const server = new McpServer({
    name: 'kkauto-mcp',
    version: '0.3.6',
  });

  registerFbPostTools(server, client, config);
  registerSourcePostTools(server, client, config);
  registerSourceCrawlerTools(server, client, config);
  registerSourceWorkflowTools(server, client, config);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  if (error instanceof ConfigError) {
    console.error(`Configuration error: ${error.message}`);
  } else {
    console.error(`kkAuto MCP server failed: ${formatUnknownError(error)}`);
  }

  process.exit(1);
});
