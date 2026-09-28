/**
 * Overlay local control-plane DNA onto the live AgentRuntime (prompt/model/policies only).
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
