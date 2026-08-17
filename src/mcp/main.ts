/**
 * Export Skillgate skills as an MCP server (Cursor / Claude Desktop).
 *
 *   npm run mcp
 *
 * Cursor mcp.json example:
 * {
 *   "mcpServers": {
 *     "meridian-skills": {
 *       "command": "npx",
 *       "args": ["ts-node", "--transpile-only", "src/mcp/main.ts"],
 *       "cwd": "/path/to/hazeljs-meridian-ops",
 *       "env": { "API_BASE_URL": "http://127.0.0.1:3060", "API_TOKEN": "meridian-dev-token" }
 *     }
 *   }
 * }
 *
 * Note: start the HTTP API (`npm run dev`) so skill HTTP calls succeed.
 * tools/call is wrapped with Agent Gatekeeper (default MCP invoke bypasses ToolExecutor).
 */

import { ToolRegistry } from '@hazeljs/agent';
import { createMcpServer } from '@hazeljs/mcp';
import { buildGateFromModule } from '../skillgate/build-gate';
import { formatReport } from '../skillgate/wire-skills';
import { AGENT_NAME } from '../config';
import { createMeridianGatekeeper, formatGatekeeperBoot, protectMcpRegistry } from '../gatekeeper';

const gate = buildGateFromModule();
// eslint-disable-next-line no-console
console.error(formatReport(gate.report()));

const registry = new ToolRegistry();
gate.register(registry, AGENT_NAME);

const bundle = createMeridianGatekeeper({});
if (bundle.enabled) {
  protectMcpRegistry(registry, bundle.gatekeeper);
  // eslint-disable-next-line no-console
  console.error(formatGatekeeperBoot(bundle));
}

const server = createMcpServer({
  name: 'meridian-commerce-skills',
  version: '1.0.0',
  toolRegistry: registry,
});

server.listenStdio();
