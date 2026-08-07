/**
 * Contrast DNA stub smoke vs real app tools.
 * Does not require the HTTP server for the message — documents the difference.
 */

import * as path from 'path';
import * as fs from 'fs';

const dna = path.join(process.cwd(), 'dna', 'support-desk.marketplace.json');

console.log(`
┌─ Stub vs real ─────────────────────────────────────────────────────
│ Stub (DNA smoke):
│   hazel agent run ${dna} -i "Where is ORD-1001?"
│   → tool handlers are stubs; OrdersStore / commerceStore NOT updated
│
│ Real (product):
│   npm run dev
│   curl -s localhost:3060/api/support/chat \\
│     -H 'content-type: application/json' \\
│     -d '{"message":"Where is ORD-1001?"}'
│   → @Tool handlers hit commerceStore; Inspector shows real timeline
│
│ Apply is neither:
│   npm run platform:sync  → desired state only
└────────────────────────────────────────────────────────────────────
`);

if (!fs.existsSync(dna)) {
  console.warn('DNA file missing — run npm run store:sync first');
  process.exitCode = 1;
}
