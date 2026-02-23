'use client';

import { useRef, useEffect, useState } from 'react';
import NavBar from '@/components/navigation/NavBar';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { useChat } from '@/lib/hooks/useChat';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';
import { QuickPrompts } from './QuickPrompts';
import { trpc } from '@/lib/trpc';

export default function ChatPage() {
  const {
    messages,
    isLoading,
    error,
    sessionId,
    sendMessage,
    stopGeneration,
    newSession,
    loadSession,
  } = useChat();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Auto-scroll on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Session history query
  const sessionsQuery = trpc.chat.getSessions.useQuery(undefined, {
    enabled: showHistory,
  });

  const handleLoadSession = async (sid: string) => {
    try {
      const msgs = await messagesUtils.fetch({ sessionId: sid });
      loadSession(
        msgs.map((m) => ({ id: m.id, role: m.role, content: m.content })),
        sid
      );
      setShowHistory(false);
    } catch (err) {
      console.error('[ChatPage] Failed to load session messages:', err);
    }
  };

  const messagesUtils = trpc.useUtils().chat.getSessionMessages;

  const deleteSession = trpc.chat.deleteSession.useMutation({
    onSuccess: () => sessionsQuery.refetch(),
  });

  return (
    <>
      <NavBar />
      <div className="flex flex-col h-[100dvh]">
        {/* Spacer for desktop nav */}
        <div className="hidden md:block h-14 shrink-0" />

        <PageHeader
          title="Chat"
          showPrefix
          sticky
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                className="text-xs"
              >
                History
              </Button>
              {sessionId && (
                <Button variant="ghost" size="sm" onClick={newSession} className="text-xs">
                  New Chat
                </Button>
              )}
            </div>
          }
        />

        {/* History panel */}
        {showHistory && (
          <div className="border-b border-border bg-background px-4 py-3">
            <div className="max-w-2xl mx-auto">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
                {'/// Recent Sessions'}
              </p>
              {sessionsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : sessionsQuery.data?.length === 0 ? (
                <p className="text-sm text-muted-foreground">No chat history yet.</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {sessionsQuery.data?.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-card transition-colors group"
                    >
                      <button
                        onClick={() => handleLoadSession(s.id)}
                        className="flex-1 text-left min-w-0"
                      >
                        <p className="text-sm font-medium text-foreground truncate">
                          {s.title || 'Untitled'}
                        </p>
                        {s.lastMessage && (
                          <p className="text-xs text-muted-foreground truncate">{s.lastMessage}</p>
                        )}
                      </button>
                      <button
                        onClick={() => deleteSession.mutate({ sessionId: s.id })}
                        className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        aria-label="Delete session"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.5}
                          className="h-4 w-4"
                        >
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Messages area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-2xl mx-auto">
            {messages.length === 0 ? (
              <QuickPrompts onSelect={sendMessage} />
            ) : (
              <ChatMessageList messages={messages} />
            )}

            {error && (
              <div className="mt-4 px-4 py-2 bg-destructive/10 border border-destructive/30 rounded-xl text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Input bar */}
        <div className="shrink-0 border-t border-border bg-background/80 backdrop-blur-sm px-4 py-3 pb-20 md:pb-3">
          <div className="max-w-2xl mx-auto">
            <ChatInput onSend={sendMessage} onStop={stopGeneration} isLoading={isLoading} />
          </div>
        </div>
      </div>
    </>
  );
}
