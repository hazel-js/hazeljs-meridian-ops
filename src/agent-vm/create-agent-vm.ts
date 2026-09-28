/**
 * Meridian Agent VM — thin aliases around @hazeljs/agent-vm status helpers.
 */

export {
  attachAgentVmStatusFromEnv as attachAgentVm,
  getBoundAgentVmStatus as agentVmFor,
  formatAgentVmStatusBoot as formatAgentVmBoot,
  type AgentVmStatus as MeridianAgentVmBundle,
} from '@hazeljs/agent-vm';
