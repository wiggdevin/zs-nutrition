'use client';

export const agentStages = [
  { number: 1, name: 'Intake Normalizer', desc: 'Cleaning and validating your data...' },
  { number: 2, name: 'Metabolic Calculator', desc: 'Calculating BMR, TDEE, and macro targets...' },
  { number: 3, name: 'Recipe Curator', desc: 'AI generating meal ideas matching your targets...' },
  { number: 4, name: 'Nutrition Compiler', desc: 'Verifying nutrition data via FatSecret...' },
  { number: 5, name: 'QA Validator', desc: 'Enforcing calorie and macro tolerances...' },
  { number: 6, name: 'Brand Renderer', desc: 'Generating your deliverables...' },
];

interface AgentProgressProps {
  currentAgent: number;
  jobId: string | null;
  isUsingPolling: boolean;
  isReconnecting: boolean;
}

export function AgentProgress({
  currentAgent,
  jobId,
  isUsingPolling,
  isReconnecting,
}: AgentProgressProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg">
        <div className="text-center">
          <h1 className="text-3xl font-heading uppercase tracking-wider text-foreground">
            Generating Plan
          </h1>
          <p className="mt-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {'/// NUTRITION ENGINE ACTIVE'}
          </p>
          {jobId && (
            <p className="mt-1 font-mono text-[10px] text-muted-foreground/50">Job: {jobId}</p>
          )}
          {isUsingPolling && (
            <p className="mt-1 font-mono text-[10px] text-primary/80">{'/// POLLING MODE'}</p>
          )}
          {isReconnecting && (
            <p className="mt-1 font-mono text-[10px] text-warning/80 animate-pulse">
              {'/// RECONNECTING...'}
            </p>
          )}
        </div>

        <div className="mt-8 space-y-3" aria-live="polite" aria-label="Agent pipeline progress">
          {agentStages.map((agent) => (
            <div
              key={agent.number}
              aria-current={agent.number === currentAgent ? 'step' : undefined}
              className={`rounded-lg border p-4 transition-all duration-500 ${
                agent.number < currentAgent
                  ? 'border-success/30 bg-success/5'
                  : agent.number === currentAgent
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border bg-card opacity-40'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                    agent.number < currentAgent
                      ? 'bg-success text-white'
                      : agent.number === currentAgent
                        ? 'bg-primary text-background'
                        : 'bg-border text-muted-foreground'
                  }`}
                >
                  {agent.number < currentAgent ? '\u2713' : agent.number}
                </div>
                <div className="flex-1">
                  <p
                    className={`text-sm font-bold ${
                      agent.number <= currentAgent ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    Agent {agent.number}: {agent.name}
                  </p>
                  {agent.number === currentAgent && (
                    <p className="text-xs text-muted-foreground">{agent.desc}</p>
                  )}
                </div>
                {agent.number === currentAgent && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
