'use client';

import type { Message } from '@/lib/hooks/useChat';

interface ChatMessageBubbleProps {
  message: Message;
}

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] px-4 py-2.5 bg-primary text-primary-foreground rounded-2xl rounded-br-md text-sm">
          {message.content}
        </div>
      </div>
    );
  }

  // Assistant message
  const isEmpty = !message.content;

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%]">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
          {'/// Coach'}
        </p>
        <div className="px-4 py-2.5 bg-card border border-border rounded-2xl rounded-bl-md text-sm prose prose-sm dark:prose-invert max-w-none">
          {isEmpty && message.isStreaming ? (
            <span className="inline-flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
            </span>
          ) : (
            <>
              <span className="whitespace-pre-wrap">{message.content}</span>
              {message.isStreaming && (
                <span className="inline-block w-0.5 h-4 ml-0.5 bg-primary animate-pulse align-middle" />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
