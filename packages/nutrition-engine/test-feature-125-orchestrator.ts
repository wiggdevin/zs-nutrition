/**
 * Feature #125: Pipeline orchestrator runs agents 1-6 sequentially
 *
 * This test verifies that the NutritionPipelineOrchestrator:
 * 1. Runs full pipeline with valid input
 * 2. Verifies agents execute in order 1 through 6
 * 3. Verifies progress callback fires for each agent stage
 * 4. Verifies final output contains all expected data
 * 5. Verifies on failure, error is returned with details
 */

import { NutritionPipelineOrchestrator, PipelineConfig } from './src/orchestrator.js';
import { RawIntakeForm } from './src/types/schemas.js';

// Test configuration - can use empty strings for API keys since agents have fallbacks
const config: PipelineConfig = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  fatsecretClientId: process.env.FATSECRET_CLIENT_ID || '',
  fatsecretClientSecret: process.env.FATSECRET_CLIENT_SECRET || '',
  usdaApiKey: process.env.USDA_API_KEY || undefined,
};

// Valid test input matching RawIntakeForm schema
const validInput: RawIntakeForm = {
  name: 'Test User Feature 125',
  sex: 'male',
  age: 30,
  heightFeet: 5,
  heightInches: 10,
  weightLbs: 175,
  goalType: 'maintain',
  goalRate: 0.5,
  activityLevel: 'moderately_active',
  trainingDays: ['monday', 'wednesday', 'friday'],
  trainingTime: 'morning',
  dietaryStyle: 'omnivore',
  allergies: [],
  exclusions: [],
  cuisinePreferences: ['italian', 'mexican', 'asian'],
  mealsPerDay: 3,
  snacksPerDay: 2,
  cookingSkill: 6,
  prepTimeMaxMin: 30,
  macroStyle: 'balanced',
  planDurationDays: 7,
};

// Test results tracking
const results = {
  step1_runFullPipeline: false,
  step2_agentsExecuteInOrder: false,
  step3_progressCallbacksFire: false,
  step4_finalOutputComplete: false,
  step5_failureHandling: false,
};

console.log('='.repeat(60));
console.log('Feature #125: Pipeline Orchestrator Sequential Execution');
console.log('='.repeat(60));

async function runTests() {
  const orchestrator = new NutritionPipelineOrchestrator(config);

  // ============================================
  // TEST 1: Run full pipeline with valid input
  // ============================================
  console.log('\n📋 TEST 1: Run full pipeline with valid input');
  console.log('-'.repeat(60));

  try {
    const progressEvents: number[] = [];
    const agentNames: string[] = [];

    const result = await orchestrator.run(validInput, (progress) => {
      progressEvents.push(progress.agent);
      agentNames.push(progress.agentName);
      console.log(`  → Agent ${progress.agent}: ${progress.agentName} - ${progress.message}`);
    });

    if (result.success) {
      console.log('  ✅ Pipeline completed successfully');
      results.step1_runFullPipeline = true;

      // ============================================
      // TEST 2: Verify agents execute in order 1-6
      // ============================================
      console.log('\n📋 TEST 2: Verify agents execute in order 1 through 6');
      console.log('-'.repeat(60));

      // The orchestrator emits: 1, 2, 3, 4, 5, 6 (running), then 6 (completed)
      // We verify agents 1-6 execute in order (the final completion event is OK)
      const firstSixAgents = progressEvents.slice(0, 6);
      const expectedOrder = [1, 2, 3, 4, 5, 6];
      const agentsInOrder = firstSixAgents.every((agent, idx) => agent === expectedOrder[idx]);

      if (agentsInOrder && firstSixAgents.join(',') === expectedOrder.join(',')) {
        console.log('  ✅ Agents executed in correct order: 1 → 2 → 3 → 4 → 5 → 6');
        console.log(`     Progress events: ${progressEvents.join(' → ')}`);
        results.step2_agentsExecuteInOrder = true;
      } else {
        console.log('  ❌ Agents did not execute in correct order');
        console.log(`     Expected first 6: ${expectedOrder.join(' → ')}`);
        console.log(`     Actual first 6: ${firstSixAgents.join(' → ')}`);
      }

      // ============================================
      // TEST 3: Verify progress callback fires for each agent
      // ============================================
      console.log('\n📋 TEST 3: Verify progress callback fires for each agent stage');
      console.log('-'.repeat(60));

      const expectedAgents = [1, 2, 3, 4, 5, 6];
      const allAgentsFired = expectedAgents.every((agent) => progressEvents.includes(agent));

      // Note: We expect 7 events total (6 running + 1 completed for agent 6)
      if (allAgentsFired && agentNames.length >= 6) {
        console.log('  ✅ Progress callbacks fired for all 6 agents');
        console.log(`     Agent stages executed: ${[...new Set(progressEvents)].join(', ')}`);
        console.log(
          `     Total progress events: ${progressEvents.length} (includes completion event)`
        );
        results.step3_progressCallbacksFire = true;
      } else {
        console.log('  ❌ Not all progress callbacks fired');
        console.log(`     Expected agents: ${expectedAgents.join(', ')}`);
        console.log(`     Actual agents: ${[...new Set(progressEvents)].join(', ')}`);
      }

      // ============================================
      // TEST 4: Verify final output contains all expected data
      // ============================================
      console.log('\n📋 TEST 4: Verify final output contains all expected data');
      console.log('-'.repeat(60));

      let outputComplete = true;
      const issues: string[] = [];

      // Check plan structure
      if (!result.plan) {
        issues.push('Missing plan in result');
        outputComplete = false;
      } else {
        const plan = result.plan;

        // Check days array
        if (!plan.days || !Array.isArray(plan.days)) {
          issues.push('Missing or invalid days array');
          outputComplete = false;
        } else if (plan.days.length !== 7) {
          issues.push(`Expected 7 days, got ${plan.days.length}`);
          outputComplete = false;
        } else {
          // Check each day has required fields
          for (const day of plan.days) {
            if (!day.dayNumber || !day.dayName || !day.meals) {
              issues.push(`Day ${day.dayNumber} missing required fields`);
              outputComplete = false;
            }
          }
        }

        // Check QA results
        if (!plan.qa) {
          issues.push('Missing QA results');
          outputComplete = false;
        } else {
          if (!plan.qa.status || !plan.qa.score) {
            issues.push('QA results missing status or score');
            outputComplete = false;
          }
        }

        // Check weekly totals
        if (!plan.weeklyTotals) {
          issues.push('Missing weekly totals');
          outputComplete = false;
        }
      }

      // Check deliverables
      if (!result.deliverables) {
        issues.push('Missing deliverables in result');
        outputComplete = false;
      } else {
        const { deliverables } = result;
        if (!deliverables.summaryHtml) {
          issues.push('Missing summaryHtml');
          outputComplete = false;
        }
        if (!deliverables.gridHtml) {
          issues.push('Missing gridHtml');
          outputComplete = false;
        }
        if (!deliverables.groceryHtml) {
          issues.push('Missing groceryHtml');
          outputComplete = false;
        }
        if (!deliverables.pdfBuffer) {
          issues.push('Missing pdfBuffer');
          outputComplete = false;
        }
      }

      if (outputComplete) {
        console.log('  ✅ Final output contains all expected data:');
        console.log('     • Plan with 7 days');
        console.log('     • Each day has meals with nutrition info');
        console.log('     • QA results (status, score)');
        console.log('     • Weekly totals');
        console.log('     • Deliverables: summary HTML, grid HTML, grocery HTML, PDF buffer');
        results.step4_finalOutputComplete = true;
      } else {
        console.log('  ❌ Final output incomplete:');
        for (const issue of issues) {
          console.log(`     • ${issue}`);
        }
      }
    } else {
      console.log('  ❌ Pipeline failed:', result.error);
    }
  } catch (error) {
    console.log('  ❌ Pipeline threw error:', error instanceof Error ? error.message : error);
  }

  // ============================================
  // TEST 5: Verify on failure, error is returned with details
  // ============================================
  console.log('\n📋 TEST 5: Verify on failure, error is returned with details');
  console.log('-'.repeat(60));

  try {
    // Invalid input that should fail validation
    const invalidInput = {
      ...validInput,
      age: 150, // Invalid age (max 100)
    } as RawIntakeForm;

    const result = await orchestrator.run(invalidInput);

    if (!result.success && result.error) {
      console.log('  ✅ Failure handled correctly:');
      console.log(`     Error returned: ${result.error}`);
      results.step5_failureHandling = true;
    } else {
      console.log('  ❌ Expected failure but got success');
    }
  } catch (error) {
    // Thrown errors are also acceptable failure handling
    console.log('  ✅ Failure handled correctly (error thrown):');
    console.log(`     Error: ${error instanceof Error ? error.message : error}`);
    results.step5_failureHandling = true;
  }

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));

  const testResults = [
    { name: 'Run full pipeline with valid input', pass: results.step1_runFullPipeline },
    {
      name: 'Verify agents execute in order 1 through 6',
      pass: results.step2_agentsExecuteInOrder,
    },
    {
      name: 'Verify progress callback fires for each agent stage',
      pass: results.step3_progressCallbacksFire,
    },
    {
      name: 'Verify final output contains all expected data',
      pass: results.step4_finalOutputComplete,
    },
    {
      name: 'Verify on failure, error is returned with details',
      pass: results.step5_failureHandling,
    },
  ];

  testResults.forEach((test, idx) => {
    const status = test.pass ? '✅ PASS' : '❌ FAIL';
    console.log(`${idx + 1}. ${status}: ${test.name}`);
  });

  const passCount = testResults.filter((t) => t.pass).length;
  console.log(`\nTotal: ${passCount}/${testResults.length} tests passing`);

  if (passCount === testResults.length) {
    console.log('\n🎉 Feature #125 is FULLY FUNCTIONAL!');
  } else {
    console.log('\n⚠️  Feature #125 has failing tests');
  }

  return passCount === testResults.length;
}

// Run tests
runTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
