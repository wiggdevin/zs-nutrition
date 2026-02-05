import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser, isDevMode } from '@/lib/auth'
import { safeLogError } from '@/lib/safe-logger'

/**
 * SSE endpoint for streaming plan generation progress.
 *
 * Client connects to /api/plan-stream/[jobId] and receives real-time progress events.
 * Each event is a JSON object with:
 *   - status: 'pending' | 'running' | 'completed' | 'failed'
 *   - agent: current agent number (1-6)
 *   - message: human-readable progress message
 *   - planId: (only on 'completed') the generated plan ID
 */

const agentMessages: Record<number, { name: string; message: string }> = {
  1: { name: 'Intake Normalizer', message: 'Cleaning and validating your data...' },
  2: { name: 'Metabolic Calculator', message: 'Calculating BMR, TDEE, and macro targets...' },
  3: { name: 'Recipe Curator', message: 'AI generating meal ideas matching your targets...' },
  4: { name: 'Nutrition Compiler', message: 'Verifying nutrition data via FatSecret...' },
  5: { name: 'QA Validator', message: 'Enforcing calorie and macro tolerances...' },
  6: { name: 'Brand Renderer', message: 'Generating your deliverables...' },
}

function formatSSE(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params

  // Auth check
  let clerkUserId: string
  let dbUserId: string
  try {
    ({ clerkUserId, dbUserId } = await requireActiveUser())
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    const status = message === 'Account is deactivated' ? 403 : 401
    return new Response(message, { status })
  }

  // Verify job exists and belongs to user
  const job = await prisma.planGenerationJob.findUnique({
    where: { id: jobId },
    include: {
      user: { select: { clerkUserId: true } },
    },
  })

  if (!job) {
    return new Response('Job not found', { status: 404 })
  }

  if (job.user.clerkUserId !== clerkUserId) {
    return new Response('Forbidden', { status: 403 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(formatSSE(data)))
        } catch {
          // Stream may be closed
        }
      }

      // Check if already completed or failed
      if (job.status === 'completed') {
        const result = job.result ? JSON.parse(job.result) : {}
        // Send all agents as complete, then final event
        for (let i = 1; i <= 6; i++) {
          send({
            status: 'running',
            agent: i,
            agentName: agentMessages[i].name,
            message: `Agent ${i} complete`,
          })
        }
        send({
          status: 'completed',
          agent: 6,
          agentName: agentMessages[6].name,
          message: 'Plan generation complete!',
          planId: result.planId || null,
        })
        controller.close()
        return
      }

      if (job.status === 'failed') {
        send({
          status: 'failed',
          agent: job.currentAgent || 0,
          message: job.error || 'Plan generation failed',
        })
        controller.close()
        return
      }

      // For dev mode with mock queue: the plan is generated synchronously
      // in the generate endpoint, so simulate the pipeline progression via SSE
      // In production, we'd poll the job status from the database as the worker updates it
      if (isDevMode || process.env.USE_MOCK_QUEUE === 'true') {
        // Simulate agent pipeline progression
        for (let agentNum = 1; agentNum <= 6; agentNum++) {
          // Check if client disconnected
          if (request.signal.aborted) {
            controller.close()
            return
          }

          const agent = agentMessages[agentNum]
          send({
            status: 'running',
            agent: agentNum,
            agentName: agent.name,
            message: agent.message,
          })

          // Update the job's currentAgent in the database
          try {
            await prisma.planGenerationJob.update({
              where: { id: jobId },
              data: {
                status: 'running',
                currentAgent: agentNum,
                progress: JSON.stringify({
                  agent: agentNum,
                  agentName: agent.name,
                  message: agent.message,
                  timestamp: new Date().toISOString(),
                }),
                ...(agentNum === 1 ? { startedAt: new Date() } : {}),
              },
            })
          } catch {
            // Non-blocking - continue even if DB update fails
          }

          // Wait between agents (simulating work)
          await new Promise((resolve) => setTimeout(resolve, 1500))
        }

        // Check for the completed plan
        const completedJob = await prisma.planGenerationJob.findUnique({
          where: { id: jobId },
        })

        const result = completedJob?.result ? JSON.parse(completedJob.result) : {}
        const planId = result.planId || null

        send({
          status: 'completed',
          agent: 6,
          agentName: agentMessages[6].name,
          message: 'Plan generation complete!',
          planId,
        })

        controller.close()
        return
      }

      // Production mode: poll job status from database
      let lastAgent = 0
      const maxPolls = 120 // 2 minutes max at 1s intervals
      let pollCount = 0

      const poll = async () => {
        while (pollCount < maxPolls) {
          if (request.signal.aborted) {
            controller.close()
            return
          }

          pollCount++
          try {
            const currentJob = await prisma.planGenerationJob.findUnique({
              where: { id: jobId },
            })

            if (!currentJob) {
              send({ status: 'failed', agent: 0, message: 'Job not found' })
              controller.close()
              return
            }

            const currentAgent = currentJob.currentAgent || 0

            // Send progress update if agent changed
            if (currentAgent > lastAgent) {
              for (let i = lastAgent + 1; i <= currentAgent; i++) {
                const agent = agentMessages[i]
                if (agent) {
                  send({
                    status: 'running',
                    agent: i,
                    agentName: agent.name,
                    message: agent.message,
                  })
                }
              }
              lastAgent = currentAgent
            }

            // Check terminal states
            if (currentJob.status === 'completed') {
              const result = currentJob.result ? JSON.parse(currentJob.result) : {}
              send({
                status: 'completed',
                agent: 6,
                agentName: agentMessages[6].name,
                message: 'Plan generation complete!',
                planId: result.planId || null,
              })
              controller.close()
              return
            }

            if (currentJob.status === 'failed') {
              send({
                status: 'failed',
                agent: currentAgent,
                message: currentJob.error || 'Plan generation failed',
              })
              controller.close()
              return
            }
          } catch (err) {
            safeLogError('[plan-stream] Poll error:', err)
          }

          // Wait 1 second between polls
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }

        // Timeout
        send({
          status: 'failed',
          agent: lastAgent,
          message: 'Plan generation timed out',
        })
        controller.close()
      }

      await poll()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
