import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/safe-logger';

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

  logger.debug('Streaming chat response', { messageCount: messages.length });

  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

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
