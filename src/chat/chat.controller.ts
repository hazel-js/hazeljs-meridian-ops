import { Body, Controller, Get, Param, Post } from '@hazeljs/core';
import { ChatService, type ChatRequest } from './chat.service';

function pendingApproval(result: { metadata?: Record<string, unknown> }) {
  const pending = result.metadata?.pendingApproval as
    | { requestId?: string; toolName?: string }
    | undefined;
  if (!pending?.requestId) return undefined;
  return {
    requestId: pending.requestId,
    toolName: pending.toolName,
    approve: `POST /api/approvals/${pending.requestId}/approve`,
    reject: `POST /api/approvals/${pending.requestId}/reject`,
  };
}

function chatResponse(out: Awaited<ReturnType<ChatService['chat']>>) {
  return {
    agent: out.agent,
    response: out.result.response,
    state: out.result.state,
    executionId: out.result.executionId,
    loop: out.result.loop,
    agentOs: out.agentOs,
    twin: out.twin,
    pendingApproval: pendingApproval(out.result),
    steps: out.result.steps.map((s) => ({
      state: s.state,
      tool: s.action?.toolName,
      thought: s.action?.thought?.slice(0, 120),
    })),
  };
}

@Controller('api')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post('chat')
  async chatDefault(@Body() body: ChatRequest) {
    if (!body?.message?.trim()) return { error: 'message is required' };
    return chatResponse(await this.chat.chat({ ...body, agent: body.agent ?? 'ops-router' }));
  }

  @Post('support/chat')
  async supportChat(@Body() body: ChatRequest) {
    if (!body?.message?.trim()) return { error: 'message is required' };
    return chatResponse(await this.chat.chat({ ...body, agent: 'support-desk' }));
  }

  @Post('ops/chat')
  async opsChat(@Body() body: ChatRequest) {
    if (!body?.message?.trim()) return { error: 'message is required' };
    return chatResponse(await this.chat.chat({ ...body, agent: 'api-concierge' }));
  }

  @Post('fraud/chat')
  async fraudChat(@Body() body: ChatRequest) {
    if (!body?.message?.trim()) return { error: 'message is required' };
    return chatResponse(await this.chat.chat({ ...body, agent: 'fraud-triage' }));
  }

  @Get('timeline')
  timeline() {
    return this.chat.timeline();
  }

  @Post('approvals/:requestId/approve')
  async approve(@Param('requestId') requestId: string) {
    const result = await this.chat.approve(requestId);
    return {
      ok: true,
      requestId,
      state: result.state,
      response: result.response,
      executionId: result.executionId,
    };
  }

  @Post('approvals/:requestId/reject')
  async reject(@Param('requestId') requestId: string) {
    const result = await this.chat.reject(requestId);
    return {
      ok: true,
      requestId,
      state: result.state,
      response: result.response,
      executionId: result.executionId,
    };
  }
}
