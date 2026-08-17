/**
 * Validate agent-gatekeeper.yaml (same checks as `hazel gatekeeper validate`).
 */
import * as fs from 'fs';
import * as path from 'path';
import { loadPoliciesFromFileSync } from '@hazeljs/agent-gatekeeper';

const file = path.join(process.cwd(), 'agent-gatekeeper.yaml');
const loaded = loadPoliciesFromFileSync(fs, file);
console.log(
  `ok  ${file}  mode=${loaded.mode ?? 'enforce'}  default=${loaded.defaultDecision ?? 'deny'}  policies=${loaded.policies.length}`
);
