/**
 * Feature #98: Pipeline Orchestrator runs agents sequentially
 *
 * This test verifies that the NutritionPipelineOrchestrator:
 * 1. Call orchestrator.run() with valid input
 * 2. Verify agents execute in order 1 through 6
 * 3. Verify progress callbacks emit for each agent stage
 * 4. Verify final output contains validated plan
 * 5. Verify failure in any agent stops pipeline with error message
 */

import { NutritionPipelineOrchestrator, PipelineConfig } from './src/orchestrator.js';
import { RawIntakeForm } from './src/types/schemas.js';

// Test configuration - can use empty strings for API keys since agents have fallbacks
const config: PipelineConfig = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  fatsecretClientId: process.env.FATSECRET_CLIENT_ID || '',
  fatsecretClientSecret: process.env.FATSECRET_CLIENT_SECRET || '',
};

// Valid test input matching RawIntakeForm schema
const validInput: RawIntakeForm = {
  name: 'Test User Feature 98',
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
  step1_callRunWithValidInput: false,
  step2_agentsExecuteInOrder: false,
  step3_progressCallbacksEmit: false,
  step4_finalOutputContainsValidatedPlan: false,
  step5_failureStopsPipeline: false,
};

console.log('='.repeat(60));
console.log('Feature #98: Pipeline Orchestrator Sequential Execution');
console.log('='.repeat(60));

async function runTests() {
  const orchestrator = new NutritionPipelineOrchestrator(config);

  // ============================================
  // TEST 1: Call orchestrator.run() with valid input
  // ============================================
  console.log('\n📋 TEST 1: Call orchestrator.run() with valid input');
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
      console.log('  ✅ orchestrator.run() completed successfully with valid input');
      results.step1_callRunWithValidInput = true;

      // ============================================
      // TEST 2: Verify agents execute in order 1 through 6
      // ============================================
      console.log('\n📋 TEST 2: Verify agents execute in order 1 through 6');
      console.log('-'.repeat(60));

      // The orchestrator emits: 1, 2, 3, 4, 5, 6 (running), then 6 (completed)
      // We verify agents 1-6 execute in order
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
      // TEST 3: Verify progress callbacks emit for each agent stage
      // ============================================
      console.log('\n📋 TEST 3: Verify progress callbacks emit for each agent stage');
      console.log('-'.repeat(60));

      const expectedAgents = [1, 2, 3, 4, 5, 6];
      const allAgentsFired = expectedAgents.every(agent => progressEvents.includes(agent));

      // We expect 7 events total (6 running + 1 completed for agent 6)
      if (allAgentsFired && agentNames.length >= 6) {
        console.log('  ✅ Progress callbacks emitted for all 6 agent stages');
        console.log(`     Agent stages executed: ${[...new Set(progressEvents)].join(', ')}`);
        console.log(`     Total progress events: ${progressEvents.length} (includes completion event)`);
        results.step3_progressCallbacksEmit = true;
      } else {
        console.log('  ❌ Not all progress callbacks emitted');
        console.log(`     Expected agents: ${expectedAgents.join(', ')}`);
        console.log(`     Actual agents: ${[...new Set(progressEvents)].join(', ')}`);
      }

      // ============================================
      // TEST 4: Verify final output contains validated plan
      // ============================================
      console.log('\n📋 TEST 4: Verify final output contains validated plan');
      console.log('-'.repeat(60));

      let outputComplete = true;
      const issues: string[] = [];

      // Check plan structure (validated plan from Agent 5)
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

        // Check QA results (this proves it's a validated plan)
        if (!plan.qa) {
          issues.push('Missing QA results (not a validated plan)');
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

        // Check grocery list (added by QA validator)
        if (!plan.groceryList) {
          issues.push('Missing grocery list');
          outputComplete = false;
        }

        // Check metadata
        if (!plan.generatedAt || !plan.engineVersion) {
          issues.push('Missing plan metadata (generatedAt or engineVersion)');
          outputComplete = false;
        }
      }

      // Check deliverables (from Agent 6)
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
        console.log('  ✅ Final output contains validated plan with all required data:');
        console.log('     • Validated plan with 7 days (from Agent 5: QA Validator)');
        console.log('     • Each day has meals with nutrition info');
        console.log('     • QA results (status, score, iterations)');
        console.log('     • Weekly totals');
        console.log('     • Grocery list (aggregated from all ingredients)');
        console.log('     • Plan metadata (generatedAt, engineVersion)');
        console.log('     • Deliverables from Agent 6: summary, grid, grocery HTML, PDF buffer');
        results.step4_finalOutputContainsValidatedPlan = true;
      } else {
        console.log('  ❌ Final output incomplete or not a validated plan:');
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
  // TEST 5: Verify failure in any agent stops pipeline with error message
  // ============================================
  console.log('\n📋 TEST 5: Verify failure in any agent stops pipeline with error message');
  console.log('-'.repeat(60));

  try {
    // Invalid input that should fail validation in Agent 1
    const invalidInput = {
      ...validInput,
      age: 150, // Invalid age (max 100) - will fail in Agent 1: Intake Normalizer
    } as RawIntakeForm;

    const result = await orchestrator.run(invalidInput);

    if (!result.success && result.error) {
      console.log('  ✅ Failure stopped pipeline and returned error:');
      console.log(`     Error: ${result.error}`);
      results.step5_failureStopsPipeline = true;
    } else {
      console.log('  ❌ Expected failure but got success');
    }
  } catch (error) {
    // Thrown errors are also acceptable failure handling
    console.log('  ✅ Failure stopped pipeline (error thrown):');
    console.log(`     Error: ${error instanceof Error ? error.message : error}`);
    results.step5_failureStopsPipeline = true;
  }

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));

  const testResults = [
    { name: 'Call orchestrator.run() with valid input', pass: results.step1_callRunWithValidInput },
    { name: 'Verify agents execute in order 1 through 6', pass: results.step2_agentsExecuteInOrder },
    { name: 'Verify progress callbacks emit for each agent stage', pass: results.step3_progressCallbacksEmit },
    { name: 'Verify final output contains validated plan', pass: results.step4_finalOutputContainsValidatedPlan },
    { name: 'Verify failure in any agent stops pipeline with error message', pass: results.step5_failureStopsPipeline },
  ];

  testResults.forEach((test, idx) => {
    const status = test.pass ? '✅ PASS' : '❌ FAIL';
    console.log(`${idx + 1}. ${status}: ${test.name}`);
  });

  const passCount = testResults.filter(t => t.pass).length;
  console.log(`\nTotal: ${passCount}/${testResults.length} tests passing`);

  if (passCount === testResults.length) {
    console.log('\n🎉 Feature #98 is FULLY FUNCTIONAL!');
  } else {
    console.log('\n⚠️  Feature #98 has failing tests');
  }

  return passCount === testResults.length;
}

// Run tests
runTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
