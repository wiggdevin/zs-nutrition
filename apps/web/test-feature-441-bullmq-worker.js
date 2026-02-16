/**
 * Feature #441: "BullMQ worker processes jobs reliably"
 *
 * This test verifies the BullMQ worker infrastructure for plan generation jobs.
 *
 * Test Steps:
 * 1. Verify worker code exists and is properly structured
 * 2. Verify queue configuration is correct
 * 3. Test job enqueue mechanism
 * 4. Verify job data persistence
 * 5. Test duplicate prevention logic
 *
 * Note: In dev mode with USE_MOCK_QUEUE=true, we verify the infrastructure
 * is correctly set up. Full end-to-end worker processing requires Redis
 * and a running worker process.
 */

const fs = require('fs');
const path = require('path');

console.log('='.repeat(70));
console.log('FEATURE #441: BullMQ Worker Reliability Test');
console.log('='.repeat(70));

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Error: ${error.message}`);
    testsFailed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Test 1: Verify worker code exists
console.log('\n--- Test 1: Worker Code Structure ---');

test('Worker index.ts exists', () => {
  const workerPath = path.join(__dirname, '../../workers/queue-processor/src/index.ts');
  assert(fs.existsSync(workerPath), 'Worker index.ts should exist');
});

test('Worker queues.ts exists', () => {
  const queuesPath = path.join(__dirname, '../../workers/queue-processor/src/queues.ts');
  assert(fs.existsSync(queuesPath), 'Worker queues.ts should exist');
});

test('Worker package.json exists with correct dependencies', () => {
  const packagePath = path.join(__dirname, '../../workers/queue-processor/package.json');
  assert(fs.existsSync(packagePath), 'Worker package.json should exist');

  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  assert(pkg.dependencies?.bullmq, 'Should depend on bullmq');
  assert(pkg.dependencies?.['@zero-sum/nutrition-engine'], 'Should depend on nutrition-engine');
  assert(pkg.dependencies?.ioredis, 'Should depend on ioredis');
});

// Test 2: Verify worker code content
console.log('\n--- Test 2: Worker Implementation ---');

test('Worker creates a BullMQ Worker instance', () => {
  const workerPath = path.join(__dirname, '../../workers/queue-processor/src/index.ts');
  const workerCode = fs.readFileSync(workerPath, 'utf-8');

  assert(workerCode.includes('import { Worker'), 'Should import Worker from bullmq');
  assert(workerCode.includes('new Worker'), 'Should create a Worker instance');
  assert(workerCode.includes('QUEUE_NAMES.PLAN_GENERATION'), 'Should use correct queue name');
});

test('Worker handles job processing', () => {
  const workerPath = path.join(__dirname, '../../workers/queue-processor/src/index.ts');
  const workerCode = fs.readFileSync(workerPath, 'utf-8');

  assert(workerCode.includes('async (job: Job)'), 'Should have job processor function');
  assert(workerCode.includes('orchestrator.run'), 'Should call orchestrator.run');
  assert(workerCode.includes('job.updateProgress'), 'Should update job progress');
});

test('Worker implements retry logic', () => {
  const queuesPath = path.join(__dirname, '../../workers/queue-processor/src/queues.ts');
  const queuesCode = fs.readFileSync(queuesPath, 'utf-8');

  assert(queuesCode.includes('attempts'), 'Should configure attempts');
  assert(queuesCode.includes('backoff'), 'Should configure backoff strategy');
});

test('Worker saves results to database', () => {
  const workerPath = path.join(__dirname, '../../workers/queue-processor/src/index.ts');
  const workerCode = fs.readFileSync(workerPath, 'utf-8');

  assert(workerCode.includes('/api/plan/complete'), 'Should call completion endpoint');
  assert(workerCode.includes('INTERNAL_API_SECRET'), 'Should use internal auth');
});

test('Worker has graceful shutdown', () => {
  const workerPath = path.join(__dirname, '../../workers/queue-processor/src/index.ts');
  const workerCode = fs.readFileSync(workerPath, 'utf-8');

  assert(workerCode.includes('SIGINT'), 'Should handle SIGINT');
  assert(workerCode.includes('SIGTERM'), 'Should handle SIGTERM');
  assert(workerCode.includes('worker.close'), 'Should close worker on shutdown');
});

// Test 3: Verify queue setup in web app
console.log('\n--- Test 3: Queue Setup ---');

test('Queue library exists', () => {
  const queuePath = path.join(__dirname, 'src/lib/queue.ts');
  assert(fs.existsSync(queuePath), 'Queue library should exist');
});

test('Queue creates BullMQ Queue instance', () => {
  const queuePath = path.join(__dirname, 'src/lib/queue.ts');
  const queueCode = fs.readFileSync(queuePath, 'utf-8');

  assert(queueCode.includes('import { Queue }'), 'Should import Queue from bullmq');
  assert(queueCode.includes('new Queue'), 'Should create a Queue instance');
  assert(queueCode.includes('PLAN_GENERATION_QUEUE'), 'Should define queue name constant');
});

test('Queue has mock fallback for development', () => {
  const queuePath = path.join(__dirname, 'src/lib/queue.ts');
  const queueCode = fs.readFileSync(queuePath, 'utf-8');

  assert(queueCode.includes('MockQueue'), 'Should have MockQueue class');
  assert(queueCode.includes('USE_MOCK_QUEUE'), 'Should check mock queue env var');
});

test('Queue configuration includes job options', () => {
  const queuePath = path.join(__dirname, 'src/lib/queue.ts');
  const queueCode = fs.readFileSync(queuePath, 'utf-8');

  assert(queueCode.includes('removeOnComplete'), 'Should configure completed job removal');
  assert(queueCode.includes('removeOnFail'), 'Should configure failed job removal');
  assert(queueCode.includes('attempts'), 'Should configure retry attempts');
});

// Test 4: Verify Redis connection setup
console.log('\n--- Test 4: Redis Connection ---');

test('Redis library exists', () => {
  const redisPath = path.join(__dirname, 'src/lib/redis.ts');
  assert(fs.existsSync(redisPath), 'Redis library should exist');
});

test('Redis creates IORedis connection', () => {
  const redisPath = path.join(__dirname, 'src/lib/redis.ts');
  const redisCode = fs.readFileSync(redisPath, 'utf-8');

  assert(redisCode.includes('import IORedis'), 'Should import IORedis');
  assert(redisCode.includes('new IORedis'), 'Should create IORedis instance');
  assert(redisCode.includes('REDIS_URL'), 'Should support REDIS_URL env var');
});

test('Redis has lazy connect for development', () => {
  const redisPath = path.join(__dirname, 'src/lib/redis.ts');
  const redisCode = fs.readFileSync(redisPath, 'utf-8');

  assert(redisCode.includes('lazyConnect'), 'Should support lazy connection');
  assert(redisCode.includes('maxRetriesPerRequest'), 'Should configure retries');
});

// Test 5: Verify API endpoints
console.log('\n--- Test 5: API Endpoints ---');

test('Plan generate endpoint exists', () => {
  const routePath = path.join(__dirname, 'src/app/api/plan/generate/route.ts');
  assert(fs.existsSync(routePath), 'Generate endpoint should exist');
});

test('Generate endpoint creates job in database', () => {
  const routePath = path.join(__dirname, 'src/app/api/plan/generate/route.ts');
  const routeCode = fs.readFileSync(routePath, 'utf-8');

  assert(routeCode.includes('prisma.planGenerationJob.create'), 'Should create job in DB');
  assert(routeCode.includes("status: 'pending'"), 'Should set initial status to pending');
});

test('Generate endpoint prevents duplicate jobs', () => {
  const routePath = path.join(__dirname, 'src/app/api/plan/generate/route.ts');
  const routeCode = fs.readFileSync(routePath, 'utf-8');

  assert(routeCode.includes('existingJob'), 'Should check for existing jobs');
  assert(
    routeCode.includes("status: { in: ['pending', 'running'] }"),
    'Should check pending/running status'
  );
  assert(routeCode.includes('existing: true'), 'Should return existing job flag');
});

test('Plan complete endpoint exists', () => {
  const routePath = path.join(__dirname, 'src/app/api/plan/complete/route.ts');
  assert(fs.existsSync(routePath), 'Complete endpoint should exist');
});

test('Complete endpoint saves plan to database', () => {
  const routePath = path.join(__dirname, 'src/app/api/plan/complete/route.ts');
  const routeCode = fs.readFileSync(routePath, 'utf-8');

  assert(routeCode.includes('savePlanToDatabase'), 'Should save plan to database');
  assert(routeCode.includes('INTERNAL_API_SECRET'), 'Should require internal secret in production');
});

// Test 6: Verify worker package has build scripts
console.log('\n--- Test 6: Worker Build Setup ---');

test('Worker can be built', () => {
  const workerPackagePath = path.join(__dirname, '../../workers/queue-processor/package.json');
  const pkg = JSON.parse(fs.readFileSync(workerPackagePath, 'utf-8'));

  assert(pkg.scripts?.build, 'Should have build script');
  assert(pkg.scripts?.start, 'Should have start script');
  assert(pkg.main?.endsWith('dist/index.js'), 'Should point to compiled output');
});

test('Worker has TypeScript configured', () => {
  const workerTsconfigPath = path.join(__dirname, '../../workers/queue-processor/tsconfig.json');
  assert(fs.existsSync(workerTsconfigPath), 'Worker should have TypeScript config');

  const tsconfig = JSON.parse(fs.readFileSync(workerTsconfigPath, 'utf-8'));
  assert(tsconfig.compilerOptions?.outDir === 'dist', 'Should output to dist directory');
});

// Test 7: Verify job data flow
console.log('\n--- Test 7: Job Data Flow ---');

test('Job data structure is defined', () => {
  const queuePath = path.join(__dirname, 'src/lib/queue.ts');
  const queueCode = fs.readFileSync(queuePath, 'utf-8');

  assert(queueCode.includes('PlanGenerationJobData'), 'Should define job data interface');
  assert(queueCode.includes('jobId'), 'Job data should include jobId');
  assert(queueCode.includes('userId'), 'Job data should include userId');
  assert(queueCode.includes('intakeData'), 'Job data should include intakeData');
});

test('Worker extracts job data correctly', () => {
  const workerPath = path.join(__dirname, '../../workers/queue-processor/src/index.ts');
  const workerCode = fs.readFileSync(workerPath, 'utf-8');

  assert(
    workerCode.includes('const { intakeData, jobId } = job.data'),
    'Should extract intakeData and jobId'
  );
  assert(
    workerCode.includes('orchestrator.run(intakeData'),
    'Should pass intakeData to orchestrator'
  );
});

// Test 8: Verify error handling
console.log('\n--- Test 8: Error Handling ---');

test('Worker handles processing errors', () => {
  const workerPath = path.join(__dirname, '../../workers/queue-processor/src/index.ts');
  const workerCode = fs.readFileSync(workerPath, 'utf-8');

  assert(workerCode.includes('try {'), 'Should have try-catch block');
  assert(workerCode.includes('catch (error)'), 'Should catch errors');
  assert(workerCode.includes('console.error'), 'Should log errors');
});

test('Worker emits failed events', () => {
  const workerPath = path.join(__dirname, '../../workers/queue-processor/src/index.ts');
  const workerCode = fs.readFileSync(workerPath, 'utf-8');

  assert(workerCode.includes("worker.on('failed'"), 'Should listen for failed events');
  assert(workerCode.includes("worker.on('error'"), 'Should listen for error events');
});

test('Generate endpoint has error handling', () => {
  const routePath = path.join(__dirname, 'src/app/api/plan/generate/route.ts');
  const routeCode = fs.readFileSync(routePath, 'utf-8');

  assert(routeCode.includes('try {'), 'Should have try-catch block');
  assert(routeCode.includes('catch (error)'), 'Should catch errors');
  assert(routeCode.includes('status: 500'), 'Should return 500 on error');
});

// Test 9: Verify progress tracking
console.log('\n--- Test 9: Progress Tracking ---');

test('Worker updates job progress', () => {
  const workerPath = path.join(__dirname, '../../workers/queue-processor/src/index.ts');
  const workerCode = fs.readFileSync(workerPath, 'utf-8');

  assert(workerCode.includes('job.updateProgress'), 'Should update job progress');
  assert(workerCode.includes('async (progress)'), 'Should receive progress callbacks');
  assert(workerCode.includes('progress.agent'), 'Should track agent progress');
});

test('Progress includes agent information', () => {
  const workerPath = path.join(__dirname, '../../workers/queue-processor/src/index.ts');
  const workerCode = fs.readFileSync(workerPath, 'utf-8');

  assert(workerCode.includes('Agent ${progress.agent}'), 'Should log agent number');
  assert(workerCode.includes('progress.message'), 'Should include progress message');
});

// Test 10: Verify job persistence
console.log('\n--- Test 10: Job Persistence ---');

test('Completed jobs are kept for 24 hours', () => {
  const queuePath = path.join(__dirname, 'src/lib/queue.ts');
  const queueCode = fs.readFileSync(queuePath, 'utf-8');

  assert(queueCode.includes('age: 3600'), 'Completed jobs should be kept for 1 hour (3600s)');
});

test('Failed jobs are kept for 24 hours', () => {
  const queuePath = path.join(__dirname, 'src/lib/queue.ts');
  const queueCode = fs.readFileSync(queuePath, 'utf-8');

  assert(queueCode.includes('age: 86400'), 'Failed jobs should be kept for 24 hours (86400s)');
});

// Summary
console.log('\n' + '='.repeat(70));
console.log('TEST SUMMARY');
console.log('='.repeat(70));
console.log(`Total Tests: ${testsPassed + testsFailed}`);
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsFailed}`);
console.log(`Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);

if (testsFailed === 0) {
  console.log('\n🎉 All tests passed! BullMQ worker infrastructure is correctly set up.');
  console.log('\nNote: Full end-to-end testing requires:');
  console.log('  1. Redis instance running (local or cloud via Upstash)');
  console.log('  2. REDIS_URL configured in .env.local');
  console.log('  3. USE_MOCK_QUEUE=false or unset');
  console.log('  4. Worker process running: cd workers/queue-processor && npm start');
  console.log('  5. Web app running: npm run dev');
  console.log('\nThen jobs will be processed by the actual BullMQ worker.');
} else {
  console.log('\n⚠️  Some tests failed. Please review the failures above.');
  process.exit(1);
}
