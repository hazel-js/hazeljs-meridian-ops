/**
 * Meridian Gatekeeper — policies + env around @hazeljs/agent-gatekeeper setup helpers.
 */

import {
  bindGatekeeper,
  createAgentGatekeeperBundle,
  formatGatekeeperBootLine,
  getBoundGatekeeper,
  type AgentGatekeeperBundle,
  type HumanTaskServiceLike,
} from '@hazeljs/agent-gatekeeper';
import {
  gatekeeperEnabled,
  gatekeeperMode,
  meridianEnvironment,
  meridianTenantId,
} from '../config';
import { createMeridianPolicies } from './policies';

export type MeridianHumanTasks = HumanTaskServiceLike;
export type MeridianGatekeeperBundle = AgentGatekeeperBundle;

export { bindGatekeeper };

export function gatekeeperFor(runtime: object): MeridianGatekeeperBundle | undefined {
  return getBoundGatekeeper(runtime);
}

export function createMeridianGatekeeper(opts: {
  humanTasks?: MeridianHumanTasks;
}): MeridianGatekeeperBundle {
  return createAgentGatekeeperBundle({
    policies: createMeridianPolicies(),
    enabled: gatekeeperEnabled(),
    mode: gatekeeperMode(),
    humanTasks: opts.humanTasks,
    tenantId: meridianTenantId(),
    environment: meridianEnvironment(),
  });
}

export function formatGatekeeperBoot(bundle: MeridianGatekeeperBundle): string {
  return formatGatekeeperBootLine(bundle, {
    tenantId: meridianTenantId(),
    environment: meridianEnvironment(),
  });
}
