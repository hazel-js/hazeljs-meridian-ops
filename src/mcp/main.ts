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
 */

import { buildGateFromModule } from '../skillgate/build-gate';
import { formatReport } from '../skillgate/wire-skills';

const gate = buildGateFromModule();
// eslint-disable-next-line no-console
console.error(formatReport(gate.report()));

const server = gate.toMcpServer({
  name: 'meridian-commerce-skills',
  version: '1.0.0',
  agentName: 'api-concierge',
});

server.listenStdio();
