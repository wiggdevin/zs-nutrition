'use client';

import type { Message } from '@/lib/hooks/useChat';
import { ChatMessageBubble } from './ChatMessageBubble';

interface ChatMessageListProps {
  messages: Message[];
}

export function ChatMessageList({ messages }: ChatMessageListProps) {
  return (
    <div role="log" aria-label="Chat messages" className="flex flex-col gap-4">
      {messages.map((msg) => (
        <ChatMessageBubble key={msg.id} message={msg} />
      ))}
    </div>
  );
}
