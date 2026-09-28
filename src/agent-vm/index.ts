export {
  agentVmFor,
  attachAgentVm,
  formatAgentVmBoot,
  type MeridianAgentVmBundle,
} from './create-agent-vm';

/** Re-export package demo — Meridian adds no speculation glue. */
export {
  runTravelSpeculationDemo,
  type TravelSpeculationDemoResult as TravelSpeculationResult,
} from '@hazeljs/agent-vm';
