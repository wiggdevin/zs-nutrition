"use client";

import { notFound } from 'next/navigation'
import { useState, useRef } from "react";

import { useEffect } from "react";

/**
 * Test page for Feature #149: SSE connection handles reconnection gracefully
 *
 * This page allows manual testing of SSE reconnection by:
 * 1. Starting a plan generation
 * 2. Simulating connection drop (close EventSource)
 * 3. Verifying automatic reconnection with exponential backoff
 * 4. Checking that progress continues from current state
 */

// Quick dev auth helper
const quickDevAuth = async () => {
  try {
    const res = await fetch("http://localhost:3456/api/dev-auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test149@example.com",
        password: "test123",
      }),
    });
    const data = await res.json();
    if (data.success) {
      window.location.reload();
    }
  } catch (err) {
    console.error("Auth failed:", err);
  }
};

export default function TestFeature149() {
  if (process.env.NODE_ENV === 'production') { notFound() }
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("idle");
  const [currentAgent, setCurrentAgent] = useState<number>(0);
  const [reconnectAttempts, setReconnectAttempts] = useState<number>(0);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  // Quick dev auth on mount
  useEffect(() => {
    const checkAuthAndSetup = async () => {
      try {
        // Try to sign in (will create if not exists)
        const res = await fetch("http://localhost:3456/api/dev-auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "test149@example.com",
            password: "test123",
          }),
        });
        const data = await res.json();
        if (data.success) {
          addLog("Dev auth successful");
        }
      } catch (err) {
        addLog(`Auth check: ${err}`);
      }
    };
    checkAuthAndSetup();
  }, []);

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString().split("T")[1].slice(0, -1);
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev].slice(0, 50));
  };

  const startGeneration = async () => {
    try {
      addLog("Starting plan generation...");
      const res = await fetch("http://localhost:3456/api/plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (res.ok && data.jobId) {
        setJobId(data.jobId);
        addLog(`Job created: ${data.jobId}`);
        connectToSSE(data.jobId);
      } else {
        addLog(`Failed to start generation: ${data.error || data.message}`);
      }
    } catch (err) {
      addLog(`Error: ${err}`);
    }
  };

  const connectToSSE = (streamJobId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    addLog(`Connecting to SSE for job ${streamJobId}...`);
    const eventSource = new EventSource(`http://localhost:3456/api/plan-stream/${streamJobId}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        reconnectAttemptsRef.current = 0;
        setIsReconnecting(false);
        setReconnectAttempts(0);

        if (data.agent) {
          setCurrentAgent(data.agent);
          addLog(`Agent ${data.agent} progress: ${data.message}`);
        }

        if (data.status === "completed") {
          setStatus("completed");
          addLog("✓ Generation completed!");
          eventSource.close();
          eventSourceRef.current = null;
        } else if (data.status === "failed") {
          setStatus("failed");
          addLog(`✗ Generation failed: ${data.message}`);
          eventSource.close();
          eventSourceRef.current = null;
        }
      } catch (err) {
        addLog(`Parse error: ${err}`);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      eventSourceRef.current = null;

      reconnectAttemptsRef.current += 1;
      const attempt = reconnectAttemptsRef.current;

      if (attempt <= maxReconnectAttempts) {
        const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        addLog(
          `⚠ SSE connection lost (attempt ${attempt}/${maxReconnectAttempts}). ` +
          `Reconnecting in ${backoffDelay}ms...`
        );
        setIsReconnecting(true);
        setReconnectAttempts(attempt);

        reconnectTimeoutRef.current = setTimeout(() => {
          if (jobId === streamJobId) {
            addLog(`Attempting reconnection ${attempt}...`);
            connectToSSE(streamJobId);
          }
        }, backoffDelay);
      } else {
        setIsReconnecting(false);
        addLog(`✗ Max reconnect attempts reached. Would fall back to polling.`);
        setStatus("failed");
      }
    };
  };

  const simulateDisconnection = () => {
    if (eventSourceRef.current) {
      addLog("🔌 Simulating connection drop (closing EventSource)...");
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    } else {
      addLog("No active SSE connection to close");
    }
  };

  const cleanup = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setJobId(null);
    setStatus("idle");
    setCurrentAgent(0);
    setReconnectAttempts(0);
    setIsReconnecting(false);
    reconnectAttemptsRef.current = 0;
    addLog("Cleaned up state");
  };

  return (
    <div className="min-h-screen bg-gray-950 p-8 font-mono text-sm">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-2 text-2xl font-bold text-white">
          Feature #149: SSE Reconnection Test
        </h1>
        <p className="mb-6 text-gray-400">
          Test SSE reconnection with exponential backoff during plan generation
        </p>

        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <button
              onClick={startGeneration}
              disabled={!!jobId}
              className="w-full rounded bg-orange-500 px-4 py-2 font-bold text-black hover:bg-orange-600 disabled:opacity-50"
            >
              1. Start Generation
            </button>
            <button
              onClick={simulateDisconnection}
              disabled={!jobId || status === "completed" || status === "failed"}
              className="w-full rounded bg-red-600 px-4 py-2 font-bold text-white hover:bg-red-700 disabled:opacity-50"
            >
              2. Simulate Connection Drop
            </button>
            <button
              onClick={cleanup}
              className="w-full rounded bg-gray-700 px-4 py-2 font-bold text-white hover:bg-gray-600"
            >
              Reset
            </button>
          </div>

          <div className="rounded border border-gray-700 bg-gray-900 p-4">
            <h3 className="mb-2 font-bold text-white">Status</h3>
            <div className="space-y-1 text-xs">
              <p className="text-gray-300">Job ID: <span className="text-orange-400">{jobId || "None"}</span></p>
              <p className="text-gray-300">Status: <span className="text-orange-400">{status}</span></p>
              <p className="text-gray-300">Current Agent: <span className="text-orange-400">{currentAgent}/6</span></p>
              <p className="text-gray-300">Reconnecting: <span className="text-orange-400">{isReconnecting ? "Yes" : "No"}</span></p>
              <p className="text-gray-300">Reconnect Attempts: <span className="text-orange-400">{reconnectAttempts}/{maxReconnectAttempts}</span></p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="mb-2 font-bold text-white">Agent Progress</h2>
          <div className="grid grid-cols-6 gap-2">
            {[1, 2, 3, 4, 5, 6].map((agent) => (
              <div
                key={agent}
                className={`rounded border p-3 text-center ${
                  agent < currentAgent
                    ? "border-green-500 bg-green-500/20 text-green-400"
                    : agent === currentAgent
                    ? "border-orange-500 bg-orange-500/20 text-orange-400"
                    : "border-gray-700 bg-gray-900 text-gray-600"
                }`}
              >
                <div className="font-bold">Agent {agent}</div>
                <div className="text-xs">
                  {agent < currentAgent ? "✓ Complete" : agent === currentAgent ? "Running..." : "Pending"}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-white">Event Log</h2>
          <div className="h-96 overflow-y-auto rounded border border-gray-700 bg-gray-900 p-4">
            {logs.length === 0 ? (
              <p className="text-gray-500">No events yet...</p>
            ) : (
              <div className="space-y-1">
                {logs.map((log, i) => (
                  <div key={i} className="text-xs text-gray-300">
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 rounded border border-blue-500/30 bg-blue-500/10 p-4">
          <h3 className="mb-2 font-bold text-blue-400">Testing Checklist</h3>
          <ol className="list-inside list-decimal space-y-1 text-sm text-gray-300">
            <li>Click "Start Generation" to create a job and connect to SSE</li>
            <li>Wait for at least one agent to start (Agent 1 should light up)</li>
            <li>Click "Simulate Connection Drop" to close the SSE connection</li>
            <li>Watch logs - should see "SSE connection lost" message</li>
            <li>Verify automatic reconnection starts after backoff delay (1s, 2s, 4s, 8s, 10s max)</li>
            <li>Verify progress continues from current agent (doesn't restart from 0)</li>
            <li>Verify generation completes successfully</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
