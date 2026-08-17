#!/usr/bin/env node
/** Helper to build marketplace DNA JSON packages. */
function pkg(
  name: string,
  version: string,
  dna: Record<string, unknown>,
  extras: { readme?: string; keywords?: string[] } = {}
) {
  return {
    name,
    version,
    description: dna.description,
    dna,
    readme: extras.readme ?? `${name} for Meridian Ops`,
    keywords: extras.keywords ?? ['meridian', 'agent-os'],
  };
}

export const PACKAGES = [
  pkg(
    '@meridian/support-desk-agent',
    '1.0.0',
    {
      format: 'hazeljs.agent.dna',
      version: '1.0.0',
      name: 'support-desk',
      description:
        'Meridian Commerce customer support. Looks up orders, tracks shipments, refunds with human approval.',
      systemPrompt:
        'You are the Meridian Commerce support desk agent.\nBe concise and factual. Always use tools for order facts.',
      tools: [
        { name: 'lookupOrder', description: 'Look up order' },
        { name: 'trackShipment', description: 'Track shipment' },
        { name: 'processRefund', description: 'Process refund', requiresApproval: true },
      ],
      policies: [
        {
          id: 'refund-needs-approval',
          tool: 'processRefund',
          effect: 'require_approval',
          priority: 20,
        },
      ],
      contracts: [
        { name: 'support-desk-slo', maxLatencyMs: 120000, fallbackAgent: 'safe-desk' },
      ],
      exportedAt: '2026-08-07T12:00:00.000Z',
    },
    { keywords: ['support', 'cx'] }
  ),
  pkg(
    '@meridian/safe-desk-agent',
    '1.0.0',
    {
      format: 'hazeljs.agent.dna',
      version: '1.0.0',
      name: 'safe-desk',
      description: 'Conservative fallback support agent — lookup only, no refunds.',
      systemPrompt:
        'You are a safe fallback support agent. Only look up order status. Never promise refunds.',
      tools: [{ name: 'lookupOrder', description: 'Look up order' }],
      exportedAt: '2026-08-07T12:00:00.000Z',
    },
    { keywords: ['fallback', 'twin'] }
  ),
  pkg(
    '@meridian/api-concierge-agent',
    '1.0.0',
    {
      format: 'hazeljs.agent.dna',
      version: '1.0.0',
      name: 'api-concierge',
      description: 'Ops concierge — Skillgate-governed REST skills (tools registered at runtime).',
      systemPrompt:
        'You are the Meridian Commerce ops concierge.\nUse Skillgate tools for every factual claim. Prefer reads first.',
      tools: [],
      exportedAt: '2026-08-07T12:00:00.000Z',
    },
    { keywords: ['skillgate', 'ops'] }
  ),
  pkg(
    '@meridian/fraud-triage-agent',
    '1.0.0',
    {
      format: 'hazeljs.agent.dna',
      version: '1.0.0',
      name: 'fraud-triage',
      description: 'Fraud triage — risk signals and HITL account freezes.',
      systemPrompt:
        'You are Meridian fraud triage. Always getRiskSignals before freezeAccount. Freeze only when risk is high.',
      tools: [
        { name: 'getRiskSignals', description: 'Fetch risk signals' },
        {
          name: 'freezeAccount',
          description: 'Freeze account',
          requiresApproval: true,
        },
      ],
      policies: [
        {
          id: 'freeze-needs-approval',
          tool: 'freezeAccount',
          effect: 'require_approval',
          priority: 20,
        },
      ],
      exportedAt: '2026-08-07T12:00:00.000Z',
    },
    { keywords: ['fraud', 'hitl'] }
  ),
  pkg(
    '@meridian/router-agent',
    '1.0.0',
    {
      format: 'hazeljs.agent.dna',
      version: '1.0.0',
      name: 'ops-router',
      description: 'Intent router — delegates to support-desk, fraud-triage, api-concierge, or helpdesk.',
      systemPrompt:
        'You are the Meridian Ops router. Pick exactly one specialist: support-desk, fraud-triage, api-concierge, or helpdesk.',
      tools: [
        { name: 'support-desk', description: 'Delegate to support' },
        { name: 'fraud-triage', description: 'Delegate to fraud' },
        { name: 'api-concierge', description: 'Delegate to concierge' },
        { name: 'helpdesk', description: 'Delegate to RAG helpdesk' },
      ],
      exportedAt: '2026-08-07T12:00:00.000Z',
    },
    { keywords: ['router', 'multi-agent'] }
  ),
  pkg(
    '@meridian/helpdesk-agent',
    '1.0.0',
    {
      format: 'hazeljs.agent.dna',
      version: '1.0.0',
      name: 'helpdesk',
      description:
        'Knowledge-grounded helpdesk — refund SLA, tracking, returns policy via RAG (no money tools).',
      systemPrompt:
        'You are the Meridian Commerce knowledge helpdesk. Answer ONLY from retrieved knowledge. Never invent refund IDs.',
      tools: [{ name: 'listKbTopics', description: 'List KB topic ids' }],
      exportedAt: '2026-08-15T12:00:00.000Z',
    },
    { keywords: ['rag', 'helpdesk', 'kb'] }
  ),
];
