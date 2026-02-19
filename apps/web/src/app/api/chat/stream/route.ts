import { requireActiveUser } from '@/lib/auth';
import { chatLimiter, checkRateLimit, rateLimitExceededResponse } from '@/lib/rate-limit';
import { buildChatContext } from '@/lib/chat/build-chat-context';
import { streamChatResponse } from '@/lib/chat/claude-chat';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/safe-logger';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  // Auth
  let clerkUserId: string;
  let dbUserId: string;
  try {
    ({ clerkUserId, dbUserId } = await requireActiveUser());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    const status = message === 'Account is deactivated' ? 403 : 401;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Rate limit
  const rateLimitResult = await checkRateLimit(chatLimiter, clerkUserId);
  if (rateLimitResult && !rateLimitResult.success) {
    return rateLimitExceededResponse(rateLimitResult.reset);
  }

  // Parse body
  let message: string;
  let sessionId: string | undefined;
  try {
    const body = await request.json();
    message = body.message;
    sessionId = body.sessionId;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!message || typeof message !== 'string') {
    return new Response(JSON.stringify({ error: 'Message is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (message.length > 2000) {
    return new Response(JSON.stringify({ error: 'Message too long (max 2000 chars)' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Build context
    const { systemPrompt } = await buildChatContext(dbUserId);

    // Session management
    let session: { id: string };
    if (sessionId) {
      const existing = await prisma.chatSession.findFirst({
        where: { id: sessionId, userId: dbUserId, isActive: true },
        select: { id: true },
      });
      if (!existing) {
        return new Response(JSON.stringify({ error: 'Session not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      session = existing;
    } else {
      session = await prisma.chatSession.create({
        data: {
          userId: dbUserId,
          title: message.slice(0, 100),
        },
        select: { id: true },
      });
    }

    // Save user message
    await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: message,
      },
    });

    // Load history (last 20 messages)
    const history = await prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: { role: true, content: true },
    });

    const chatMessages = history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Stream response
    const textStream = await streamChatResponse(systemPrompt, chatMessages);

    const encoder = new TextEncoder();
    let fullResponse = '';
    const currentSessionId = session.id;

    const readable = new ReadableStream({
      async start(controller) {
        try {
          // First chunk: session ID
          controller.enqueue(
            encoder.encode(JSON.stringify({ type: 'session', sessionId: currentSessionId }) + '\n')
          );

          for await (const text of textStream) {
            fullResponse += text;
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'delta', text }) + '\n'));
          }

          controller.enqueue(encoder.encode(JSON.stringify({ type: 'done' }) + '\n'));
          controller.close();

          // Save assistant message (fire-and-forget)
          prisma.chatMessage
            .create({
              data: {
                sessionId: currentSessionId,
                role: 'assistant',
                content: fullResponse,
              },
            })
            .then(() =>
              prisma.chatSession.update({
                where: { id: currentSessionId },
                data: { updatedAt: new Date() },
              })
            )
            .catch((err) => logger.error('Failed to save assistant message', err));
        } catch (err) {
          logger.error('Chat stream error', err);
          try {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ type: 'error', message: 'Stream interrupted' }) + '\n'
              )
            );
          } catch {
            // controller may already be closed
          }
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    logger.error('Error in /api/chat/stream:', error);
    return new Response(JSON.stringify({ error: 'Failed to process chat message' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
