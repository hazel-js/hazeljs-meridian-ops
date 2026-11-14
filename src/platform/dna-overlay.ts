/**
 * Overlay local control-plane DNA onto the live AgentRuntime (prompt/model/policies only).
 *
 * This is the **store/platform** apply path (fleet). It does not replace decorator DNA:
 * `safe-desk` already loads `dna/safe-desk.dna.json` via `@Agent({ dna: true })` on register.
 * Overlay can still re-apply marketplace/platform DNA for agents that appear in the store.
 * See README — “Two DNA apply paths”.
 */

import {
  applyDnaOverlays as applyPackageDnaOverlays,
  formatDnaOverlayReport,
  overlayDnaWithoutTools,
  type AgentRuntime,
  type DnaOverlayReport,
} from '@hazeljs/agent';
import { mergeDnaPolicies } from '@hazeljs/agent-gatekeeper';
import { projectRegistryRoot } from '../config';
import { gatekeeperFor } from '../gatekeeper';

export type { DnaOverlayReport };
export { formatDnaOverlayReport as formatOverlayReport };
export { overlayDnaWithoutTools as safeOverlayDna };

export async function applyDnaOverlays(
  runtime: AgentRuntime,
  projectRoot: string = process.cwd()
): Promise<DnaOverlayReport> {
  return applyPackageDnaOverlays(runtime, {
    projectRoot,
    registryRoot: projectRegistryRoot(projectRoot),
    onApplied: (dna) => {
      const bundle = gatekeeperFor(runtime);
      if (bundle?.enabled) mergeDnaPolicies(bundle.policies, dna);
    },
  });
}
