import { createServer } from 'node:http';
import { logger } from './logger.js';

const HEALTH_PORT = parseInt(process.env.HEALTH_PORT || '3457', 10);

let activeJobs = 0;
let lastJobCompletedAt: string | null = null;
let startedAt: string = new Date().toISOString();

export function recordJobStart(): void {
  activeJobs++;
}

export function recordJobEnd(): void {
  activeJobs = Math.max(0, activeJobs - 1);
  lastJobCompletedAt = new Date().toISOString();
}

export function startHealthServer(): void {
  startedAt = new Date().toISOString();

  const server = createServer((_req, res) => {
    const payload = {
      status: 'ok',
      activeJobs,
      lastJobCompletedAt,
      startedAt,
      uptime: process.uptime(),
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
  });

  server.listen(HEALTH_PORT, () => {
    logger.info('Health server listening', { port: HEALTH_PORT });
  });
}
