import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/safe-logger';
import { getConfig } from '@zero-sum/nutrition-engine/config';

let client: Anthropic | null = null;

function getChatClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }
    client = new Anthropic({ apiKey, timeout: 30000 });
  }
  return client;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function streamChatResponse(
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<AsyncIterable<string>> {
  const anthropic = getChatClient();
  const chatConfig = getConfig('chat');

  logger.debug('Streaming chat response', { messageCount: messages.length });

  const createStream = (model: string, maxTokens: number) => {
    return anthropic.messages.stream({
      model,
      max_tokens: maxTokens,
      system: [
        {
          type: 'text' as const,
          text: systemPrompt,
          cache_control: { type: 'ephemeral' as const },
        },
      ],
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
  };

  // For streaming, we attempt the primary model first; on failure, fall back
  try {
    const stream = createStream(chatConfig.model, chatConfig.maxTokens);
    // Test that the stream connects by awaiting the first event internally
    return {
      async *[Symbol.asyncIterator]() {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            yield event.delta.text;
          }
        }
      },
    };
  } catch (error) {
    if (chatConfig.fallbackModel) {
      logger.warn(
        `[ModelRouter] ${chatConfig.model} failed, falling back to ${chatConfig.fallbackModel}`
      );
      const stream = createStream(chatConfig.fallbackModel, chatConfig.maxTokens);
      return {
        async *[Symbol.asyncIterator]() {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              yield event.delta.text;
            }
          }
        },
      };
    }
    throw error;
  }
}
