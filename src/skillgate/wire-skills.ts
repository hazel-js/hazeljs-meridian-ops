/**
 * Register Skillgate skills onto AgentRuntime and print a governance report.
 */

import type { AgentRuntime } from '@hazeljs/agent';
import { formatSkillgateReport, type Skillgate, type SkillgateReport } from '@hazeljs/skillgate';
import { AGENT_NAME } from '../config';
import { buildGateFromModule } from './build-gate';

export const formatReport = formatSkillgateReport;

export function wireSkillgate(
  runtime: AgentRuntime,
  gate: Skillgate = buildGateFromModule()
): { gate: Skillgate; count: number; report: SkillgateReport } {
  const { count, report } = gate.registerOnRuntime(runtime, AGENT_NAME);
  return { gate, count, report };
}
