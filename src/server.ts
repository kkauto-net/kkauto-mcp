#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { ConfigError, formatUnknownError } from './errors.js';
import { KkAutoApiClient } from './kkauto-api-client.js';
import { registerAllTools } from './tools/index.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new KkAutoApiClient(config);
  const server = new McpServer({
    name: 'kkauto-mcp',
    version: '0.6.0',
  });

  registerAllTools(server, client, config);

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
