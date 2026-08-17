/**
 * WHY: One door for chat — specialists stay independently versioned DNA packages.
 * @Delegate patches call the target agent via AgentRuntime at registerAgentInstance time.
 */

import { Service } from '@hazeljs/core';
import { Agent, Delegate } from '@hazeljs/agent';

@Agent({
  name: 'ops-router',
  description: 'Routes customer/ops intent to support-desk, fraud-triage, or api-concierge.',
  systemPrompt: `You are the Meridian Ops router. Pick exactly one specialist tool:
- support-desk: order status, tracking, refunds, customer CX
- fraud-triage: account risk, freezes, fraud
- api-concierge: ops listing tickets/refunds via REST skills, Skillgate report questions
- helpdesk: policy FAQ (refund SLA, returns window, support hours) — knowledge/RAG, no money tools
Pass the user's full message as input. Do not invent facts yourself.`,
  maxSteps: 4,
  temperature: 0.1,
})
@Service()
export class OpsRouterAgent {
  @Delegate({
    agent: 'support-desk',
    description: 'Customer support: orders, tracking, refunds',
    inputField: 'input',
  })
  async toSupport(_input: string): Promise<string> {
    return '';
  }

  @Delegate({
    agent: 'fraud-triage',
    description: 'Fraud triage: risk signals and account freezes',
    inputField: 'input',
  })
  async toFraud(_input: string): Promise<string> {
    return '';
  }

  @Delegate({
    agent: 'api-concierge',
    description: 'Ops concierge: Skillgate-governed REST skills',
    inputField: 'input',
  })
  async toConcierge(_input: string): Promise<string> {
    return '';
  }

  @Delegate({
    agent: 'helpdesk',
    description: 'Policy / FAQ helpdesk grounded in Meridian KB (RAG)',
    inputField: 'input',
  })
  async toHelpdesk(_input: string): Promise<string> {
    return '';
  }
}
