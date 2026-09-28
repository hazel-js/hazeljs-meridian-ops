/**
 * Print F1–F22 checklist + sample curls for Meridian.
 */

const PORT = process.env.PORT ?? '3060';
const base = `http://localhost:${PORT}`;

const FEATURES: Array<{ id: string; name: string; try: string }> = [
  { id: 'F1', name: 'AgentRuntime execute', try: `POST ${base}/api/chat` },
  { id: 'F2', name: 'Real @Tool handlers', try: `POST ${base}/api/support/chat — ORD-1001` },
  { id: 'F3', name: 'DNA as contract', try: 'dna/*.marketplace.json' },
  { id: 'F4', name: 'Local registry + Store', try: 'npm run store:sync' },
  { id: 'F5', name: 'Project materialize', try: '.hazel/agents/lock.json' },
  { id: 'F6', name: 'CLI smoke vs prod', try: 'npm run demo:smoke-cli' },
  { id: 'F7', name: 'HITL / durable suspend', try: 'AGENT_OS_HITL=1 + approvals API' },
  { id: 'F8', name: 'Policies / Gatekeeper', try: 'GET /api/gatekeeper/status · processRefund require_approval' },
  { id: 'F8b', name: 'Agent VM (optional)', try: 'AGENT_OS_AGENT_VM=1 · POST /api/agent-vm/speculate/travel' },
  { id: 'F9', name: 'Contracts + fallback', try: 'support-desk → safe-desk' },
  { id: 'F10', name: 'Digital twin / canary', try: '{"canary":true} on support chat' },
  { id: 'F11', name: 'Multiple DNA', try: '6 packages in lock after store:sync' },
  { id: 'F12', name: 'Multi-agent / router', try: `POST ${base}/api/chat` },
  { id: 'F13', name: 'Skillgate', try: `GET ${base}/api/skillgate/report` },
  { id: 'F14', name: 'MCP export', try: 'npm run mcp (API must be up)' },
  { id: 'F15', name: 'Inspector + timeline', try: `${base}/__hazel` },
  { id: 'F16', name: 'Eval smoke', try: 'npm test' },
  { id: 'F17', name: 'Templates link', try: 'README → hazel agent new grows into Meridian' },
  { id: 'F18', name: 'OSS-first boundary', try: 'local registry default; Cloud optional' },
  { id: 'F19', name: 'Local control plane', try: 'npm run platform:sync' },
  { id: 'F20', name: 'packageRef in manifests', try: 'platform/support.packageRef.yaml' },
  { id: 'F21', name: 'Platform events', try: '.hazel/platform/events.jsonl' },
  { id: 'F22', name: 'Optional remote registry', try: 'npm run store:sync:remote (HAZEL_REGISTRY_*)' },
];

console.log('Meridian Ops — Feature tour (F1–F22)\n');
for (const f of FEATURES) {
  console.log(`${f.id.padEnd(4)} ${f.name}`);
  console.log(`     try: ${f.try}\n`);
}

console.log('Phase 6 (optional): Agent VM · SQL durable · RAG helpdesk · Flow peer · k8s dry-run — see TOUR.md\n');

console.log(`Sample curls (server on :${PORT}):\n`);
console.log(`curl -s ${base}/api/support/chat -H 'content-type: application/json' -d '{"message":"Where is ORD-1001?"}'`);
console.log(`curl -s ${base}/api/fraud/chat -H 'content-type: application/json' -d '{"message":"Freeze ACC-RISK"}'`);
console.log(`curl -s ${base}/api/skillgate/report?json=1 | jq '.included|length'`);
console.log('\nFull walkthrough: TOUR.md');
