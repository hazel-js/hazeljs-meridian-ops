import OpenAI from 'openai';
import type { LLMProvider, LLMChatRequest, LLMChatResponse, LLMToolCall } from '@hazeljs/agent';

export class OpenAILLMProvider implements LLMProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(opts: { apiKey?: string; model?: string; baseURL?: string } = {}) {
    this.client = new OpenAI({
      apiKey: opts.apiKey ?? process.env.OPENAI_API_KEY,
      baseURL: opts.baseURL,
    });
    this.model = opts.model ?? process.env.AGENT_MODEL ?? 'gpt-4o-mini';
  }

  async chat(request: LLMChatRequest): Promise<LLMChatResponse> {
    const response = await this.client.chat.completions.create({
      model: request.model ?? this.model,
      messages: request.messages as OpenAI.Chat.ChatCompletionMessageParam[],
      tools: request.tools as OpenAI.Chat.ChatCompletionTool[] | undefined,
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens,
    });

    const choice = response.choices[0];
    const message = choice.message;
    const toolCalls: LLMToolCall[] | undefined = message.tool_calls?.map((tc) => ({
      id: tc.id,
      type: 'function' as const,
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    }));

    return {
      content: message.content ?? '',
      tool_calls: toolCalls,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
      finishReason: choice.finish_reason ?? undefined,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  getSupportedModels(): string[] {
    return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'];
  }
}
