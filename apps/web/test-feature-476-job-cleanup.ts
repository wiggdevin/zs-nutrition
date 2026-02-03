/**
 * Test Feature #476: BullMQ Job Cleanup After Completion
 *
 * This test verifies that:
 * 1. Completed jobs are cleaned up according to removeOnComplete settings
 * 2. Failed jobs are retained for debugging according to removeOnFail settings
 * 3. Job status transitions work correctly: pending → running → completed/failed
 * 4. No zombie jobs exist after completion
 */

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

// Test configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const QUEUE_NAME = 'test-plan-generation-' + Date.now();

interface TestJobData {
  testId: string;
  shouldFail?: boolean;
}

interface JobState {
  pending: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

async function createRedisConnection(): IORedis {
  if (REDIS_URL.startsWith('rediss://') || REDIS_URL.startsWith('redis://')) {
    return new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      ...(REDIS_URL.startsWith('rediss://') ? { tls: {} } : {}),
    });
  }
  return new IORedis({
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

async function getJobCounts(queue: Queue): Promise<JobState> {
  const counts = await queue.getJobCounts();
  return {
    pending: counts.wait || 0,
    active: counts.active || 0,
    completed: counts.completed || 0,
    failed: counts.failed || 0,
    delayed: counts.delayed || 0,
  };
}

async function testJobStatusTransitions() {
  console.log('\n========================================');
  console.log('TEST 1: Job Status Transitions');
  console.log('========================================\n');

  const connection = createRedisConnection();
  const queue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      removeOnComplete: {
        age: 3600, // 1 hour
        count: 100,
      },
      removeOnFail: {
        age: 86400, // 24 hours
      },
    },
  });

  const queueEvents = new QueueEvents(QUEUE_NAME, { connection });

  const stateChanges: Array<{ jobId: string; from: string; to: string }> = [];

  queueEvents.on('waiting', ({ jobId }) => {
    stateChanges.push({ jobId, from: 'none', to: 'waiting' });
  });

  queueEvents.on('active', ({ jobId }) => {
    stateChanges.push({ jobId, from: 'waiting', to: 'active' });
  });

  queueEvents.on('completed', ({ jobId }) => {
    stateChanges.push({ jobId, from: 'active', to: 'completed' });
  });

  // Wait for event listeners to be ready
  await new Promise(resolve => setTimeout(resolve, 100));

  // Create a worker
  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      console.log(`  Processing job ${job.id}`);
      await new Promise(resolve => setTimeout(resolve, 100));
      return { success: true };
    },
    { connection }
  );

  await worker.waitUntilReady();

  // Add a job and track its state
  const jobData: TestJobData = { testId: 'transition-test-1' };
  const job = await queue.add('test-job', jobData);

  console.log(`  Job ${job.id} added to queue`);

  // Wait for job to complete
  await job.waitUntilFinished(queueEvents);

  // Wait a bit for all events to be processed
  await new Promise(resolve => setTimeout(resolve, 200));

  console.log('\n  State transitions:');
  stateChanges.forEach(change => {
    console.log(`    ${change.jobId}: ${change.from} → ${change.to}`);
  });

  // Verify the transitions
  const expectedTransitions = ['waiting', 'active', 'completed'];
  const actualTransitions = stateChanges.map(s => s.to);

  const hasCorrectTransitions = expectedTransitions.every(state =>
    actualTransitions.includes(state)
  );

  if (hasCorrectTransitions) {
    console.log('\n  ✅ Job status transitions: PASS');
    console.log('     pending → running → completed');
  } else {
    console.log('\n  ❌ Job status transitions: FAIL');
    console.log(`     Expected: ${expectedTransitions.join(' → ')}`);
    console.log(`     Actual: ${actualTransitions.join(' → ')}`);
  }

  // Cleanup
  await worker.close();
  await queueEvents.close();
  await queue.close();
  await connection.quit();

  return hasCorrectTransitions;
}

async function testCompletedJobsCleanup() {
  console.log('\n========================================');
  console.log('TEST 2: Completed Jobs Cleanup');
  console.log('========================================\n');

  const connection = createRedisConnection();
  const queue = new Queue(QUEUE_NAME + '-completed', {
    connection,
    defaultJobOptions: {
      removeOnComplete: {
        age: 5, // 5 seconds for testing
        count: 3, // Keep max 3 jobs
      },
    },
  });

  const worker = new Worker(
    QUEUE_NAME + '-completed',
    async (job: Job) => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return { success: true };
    },
    { connection }
  );

  await worker.waitUntilReady();

  // Add 5 completed jobs
  console.log('  Adding 5 jobs to queue...');
  for (let i = 1; i <= 5; i++) {
    const job = await queue.add('test-job', { testId: `cleanup-test-${i}` });
    await job.waitUntilFinished(worker);
  }

  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 500));

  let counts = await getJobCounts(queue);
  console.log(`\n  After adding 5 jobs:`);
  console.log(`    Completed: ${counts.completed}`);
  console.log(`    Should be <= 3 (count limit)`);

  const passesCountLimit = counts.completed <= 3;
  if (passesCountLimit) {
    console.log('    ✅ Count limit enforced: PASS');
  } else {
    console.log('    ❌ Count limit enforced: FAIL');
  }

  // Wait for age limit to kick in
  console.log('\n  Waiting 6 seconds for age limit (5s)...');
  await new Promise(resolve => setTimeout(resolve, 6000));

  counts = await getJobCounts(queue);
  console.log(`\n  After 6 seconds:`);
  console.log(`    Completed: ${counts.completed}`);
  console.log(`    Should be 0 (age limit)`);

  const passesAgeLimit = counts.completed === 0;
  if (passesAgeLimit) {
    console.log('    ✅ Age limit enforced: PASS');
  } else {
    console.log('    ❌ Age limit enforced: FAIL');
  }

  // Cleanup
  await worker.close();
  await queue.close();
  await connection.quit();

  return passesCountLimit && passesAgeLimit;
}

async function testFailedJobsRetention() {
  console.log('\n========================================');
  console.log('TEST 3: Failed Jobs Retention');
  console.log('========================================\n');

  const connection = createRedisConnection();
  const queue = new Queue(QUEUE_NAME + '-failed', {
    connection,
    defaultJobOptions: {
      removeOnFail: {
        age: 86400, // 24 hours
        count: 50, // Keep max 50 failed jobs
      },
      attempts: 2,
    },
  });

  const worker = new Worker(
    QUEUE_NAME + '-failed',
    async (job: Job) => {
      await new Promise(resolve => setTimeout(resolve, 50));
      throw new Error('Test failure');
    },
    { connection }
  );

  await worker.waitUntilReady();

  // Add failed jobs
  console.log('  Adding 5 failing jobs...');
  for (let i = 1; i <= 5; i++) {
    const job = await queue.add('failing-job', { testId: `fail-test-${i}` });
    try {
      await job.waitUntilFinished(worker);
    } catch (e) {
      // Expected to fail
    }
  }

  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 500));

  const counts = await getJobCounts(queue);
  console.log(`\n  After adding 5 failing jobs:`);
  console.log(`    Failed: ${counts.failed}`);
  console.log(`    Should be 5 (retained for debugging)`);

  const failedJobsRetained = counts.failed === 5;

  if (failedJobsRetained) {
    console.log('    ✅ Failed jobs retained: PASS');
  } else {
    console.log('    ❌ Failed jobs retained: FAIL');
  }

  // Verify we can get failed job details
  const failedJobs = await queue.getFailed(0, 10);
  console.log(`\n  Retrieved ${failedJobs.length} failed jobs from queue`);

  const canRetrieveFailedJobs = failedJobs.length === 5;
  if (canRetrieveFailedJobs) {
    console.log('    ✅ Can retrieve failed job details: PASS');
    console.log('    Failed jobs available for debugging');
  } else {
    console.log('    ❌ Can retrieve failed job details: FAIL');
  }

  // Cleanup
  await worker.close();
  await queue.close();
  await connection.quit();

  return failedJobsRetained && canRetrieveFailedJobs;
}

async function testNoZombieJobs() {
  console.log('\n========================================');
  console.log('TEST 4: No Zombie Jobs');
  console.log('========================================\n');

  const connection = createRedisConnection();
  const queue = new Queue(QUEUE_NAME + '-zombie', {
    connection,
    defaultJobOptions: {
      removeOnComplete: {
        age: 3600,
        count: 100,
      },
    },
  });

  const worker = new Worker(
    QUEUE_NAME + '-zombie',
    async (job: Job) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { success: true };
    },
    {
      connection,
      concurrency: 2,
    }
  );

  await worker.waitUntilReady();

  // Add and complete jobs
  console.log('  Adding and completing 10 jobs...');
  const jobs: Job[] = [];
  for (let i = 1; i <= 10; i++) {
    const job = await queue.add('test-job', { testId: `zombie-test-${i}` });
    jobs.push(job);
  }

  // Wait for all to complete
  for (const job of jobs) {
    await job.waitUntilFinished(worker);
  }

  await new Promise(resolve => setTimeout(resolve, 500));

  // Check for zombie jobs
  const counts = await getJobCounts(queue);
  console.log(`\n  Job counts after completion:`);
  console.log(`    Pending: ${counts.pending}`);
  console.log(`    Active: ${counts.active}`);
  console.log(`    Completed: ${counts.completed}`);
  console.log(`    Failed: ${counts.failed}`);
  console.log(`    Delayed: ${counts.delayed}`);

  // Zombie jobs would show as pending/active but not processing
  const hasZombieJobs = counts.active > 0 || counts.delayed > 0;
  const allJobsAccounted = counts.pending === 0 && counts.active === 0;

  console.log('\n  Zombie job check:');
  if (!hasZombieJobs && allJobsAccounted) {
    console.log('    ✅ No zombie jobs: PASS');
    console.log('    All jobs properly transitioned to completed');
  } else {
    console.log('    ❌ No zombie jobs: FAIL');
    if (hasZombieJobs) {
      console.log('    Found active/delayed jobs (potential zombies)');
    }
  }

  // Cleanup
  await worker.close();
  await queue.close();
  await connection.quit();

  return !hasZombieJobs && allJobsAccounted;
}

async function verifyProductionSettings() {
  console.log('\n========================================');
  console.log('TEST 5: Verify Production Settings');
  console.log('========================================\n');

  const fs = await import('fs');
  const path = await import('path');

  // Check web app queue settings
  const webQueuePath = 'zero-sum-nutrition/apps/web/src/lib/queue.ts';
  const webQueueContent = fs.readFileSync(webQueuePath, 'utf-8');

  console.log('  Web App Queue (apps/web/src/lib/queue.ts):');

  const hasRemoveOnComplete = webQueueContent.includes('removeOnComplete');
  const hasRemoveOnFail = webQueueContent.includes('removeOnFail');

  // Extract the settings
  const completeMatch = webQueueContent.match(/removeOnComplete:\s*{([^}]+)}/);
  const failMatch = webQueueContent.match(/removeOnFail:\s*{([^}]+)}/);

  if (completeMatch) {
    console.log(`    removeOnComplete: {${completeMatch[1]}}`);
  }
  if (failMatch) {
    console.log(`    removeOnFail: {${failMatch[1]}}`);
  }

  const webHasSettings = hasRemoveOnComplete && hasRemoveOnFail;
  if (webHasSettings) {
    console.log('    ✅ Web app has cleanup settings: PASS');
  } else {
    console.log('    ❌ Web app has cleanup settings: FAIL');
  }

  // Check worker queue settings
  const workerQueuePath = 'zero-sum-nutrition/workers/queue-processor/src/queues.ts';
  const workerQueueContent = fs.readFileSync(workerQueuePath, 'utf-8');

  console.log('\n  Worker Queue (workers/queue-processor/src/queues.ts):');

  const workerHasRemoveOnComplete = workerQueueContent.includes('removeOnComplete');
  const workerHasRemoveOnFail = workerQueueContent.includes('removeOnFail');

  const workerCompleteMatch = workerQueueContent.match(/removeOnComplete:\s*{([^}]+)}/);
  const workerFailMatch = workerQueueContent.match(/removeOnFail:\s*{([^}]+)}/);

  if (workerCompleteMatch) {
    console.log(`    removeOnComplete: {${workerCompleteMatch[1]}}`);
  }
  if (workerFailMatch) {
    console.log(`    removeOnFail: {${workerFailMatch[1]}}`);
  }

  const workerHasSettings = workerHasRemoveOnComplete && workerHasRemoveOnFail;
  if (workerHasSettings) {
    console.log('    ✅ Worker has cleanup settings: PASS');
  } else {
    console.log('    ❌ Worker has cleanup settings: FAIL');
  }

  // Check for consistency
  console.log('\n  Consistency Check:');
  if (completeMatch && workerCompleteMatch) {
    const webSettings = completeMatch[1];
    const workerSettings = workerCompleteMatch[1];

    if (webSettings === workerSettings) {
      console.log('    ✅ Settings consistent: PASS');
    } else {
      console.log('    ⚠️  Settings differ between web and worker');
      console.log('       Web app:  ' + webSettings);
      console.log('       Worker:   ' + workerSettings);
    }
  }

  return webHasSettings && workerHasSettings;
}

async function main() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║  Feature #476: BullMQ Job Cleanup Test  ║');
  console.log('╚════════════════════════════════════════════╝\n');

  const results: { name: string; passed: boolean }[] = [];

  try {
    // Test 1: Job status transitions
    results.push({
      name: 'Job Status Transitions',
      passed: await testJobStatusTransitions(),
    });

    // Test 2: Completed jobs cleanup
    results.push({
      name: 'Completed Jobs Cleanup',
      passed: await testCompletedJobsCleanup(),
    });

    // Test 3: Failed jobs retention
    results.push({
      name: 'Failed Jobs Retention',
      passed: await testFailedJobsRetention(),
    });

    // Test 4: No zombie jobs
    results.push({
      name: 'No Zombie Jobs',
      passed: await testNoZombieJobs(),
    });

    // Test 5: Verify production settings
    results.push({
      name: 'Production Settings',
      passed: await verifyProductionSettings(),
    });

  } catch (error) {
    console.error('\n❌ Test suite error:', error);
    process.exit(1);
  }

  // Print summary
  console.log('\n========================================');
  console.log('TEST SUMMARY');
  console.log('========================================\n');

  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${status} - ${result.name}`);
  });

  const allPassed = results.every(r => r.passed);
  const passCount = results.filter(r => r.passed).length;
  const totalCount = results.length;

  console.log(`\n  Total: ${passCount}/${totalCount} tests passed`);

  if (allPassed) {
    console.log('\n  🎉 All tests passed!\n');
    process.exit(0);
  } else {
    console.log('\n  ⚠️  Some tests failed\n');
    process.exit(1);
  }
}

main();
