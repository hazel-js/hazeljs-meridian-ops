/**
 * WHY: RAG helpdesk — answers policy from retrieved KB only; no money-moving tools.
 */

import { Service } from '@hazeljs/core';
import { Agent, Tool } from '@hazeljs/agent';
import { helpdeskRag } from '../rag/helpdesk-kb';

@Agent({
  name: 'helpdesk',
  description:
    'Knowledge-grounded helpdesk. Answers refund SLA, tracking, and returns policy from Meridian KB via RAG.',
  systemPrompt: `You are the Meridian Commerce knowledge helpdesk.
Answer ONLY from retrieved knowledge (ragContext). If the KB does not cover the question, say you do not know and suggest support-desk for order-specific tools.
Never invent refund IDs, tracking numbers, or account freezes.
Cite the policy topic in plain language (e.g. “per refund SLA”).`,
  maxSteps: 4,
  temperature: 0.1,
})
@Service()
export class HelpdeskAgent {
  @Tool({
    name: 'listKbTopics',
    description: 'List knowledge-base topic ids available to this helpdesk.',
    parameters: [],
  })
  async listKbTopics() {
    return {
      topics: helpdeskRag.listDocuments().map((d) => ({
        id: d.id,
        topic: d.metadata?.topic,
      })),
    };
  }
}
