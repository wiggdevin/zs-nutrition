#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * Baseline Test Runner for Nutrition Engine Testing & Validation
 *
 * Runs all 10 synthetic personas through the full pipeline, captures:
 * - ClientIntake (Agent 1 output)
 * - MetabolicProfile (Agent 2 output)
 * - MealPlanDraft (Agent 3 output)
 * - MealPlanValidated (Agent 5 output, includes QA scores)
 * - Pipeline timing data
 *
 * Usage:
 *   cd packages/nutrition-engine
 *   tsx src/__tests__/baseline-runner.ts [options]
 *
 * Options:
 *   --personas=all|1|2|3,...     Comma-separated persona numbers (default: all)
 *   --output-dir=path            Output directory (default: NE Implementation output dir)
 *   --stage1-only                Run only Stage 1 (deterministic, no API calls)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { IntakeNormalizer } from '../agents/intake-normalizer';
import { MetabolicCalculator } from '../agents/metabolic-calculator';
import {
  NutritionPipelineOrchestrator,
  type PipelineConfig,
  type PipelineResult,
} from '../orchestrator';
import type { RawIntakeForm, ClientIntake, MetabolicProfile } from '../types/schemas';

// ============================================================
// Load environment from monorepo root .env
// ============================================================

function loadEnv(): void {
  const envPath = resolve(__dirname, '../../../../.env');
  if (!existsSync(envPath)) {
    console.error(`ERROR: .env file not found at ${envPath}`);
    process.exit(1);
  }
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Remove surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

// ============================================================
// Persona Definitions (matching synthetic-personas.md)
// ============================================================

const PERSONAS: Record<string, { name: string; slug: string; input: RawIntakeForm }> = {
  '1': {
    name: 'The Busy Professional (Marcus)',
    slug: 'busy-professional-marcus',
    input: {
      name: 'Marcus',
      sex: 'male',
      age: 32,
      heightFeet: 5,
      heightInches: 10,
      weightLbs: 195,
      goalType: 'cut',
      goalRate: 1.5,
      activityLevel: 'sedentary',
      trainingDays: ['monday', 'wednesday', 'friday'],
      dietaryStyle: 'omnivore',
      allergies: [],
      exclusions: [],
      cuisinePreferences: ['american', 'mediterranean'],
      mealsPerDay: 3,
      snacksPerDay: 1,
      cookingSkill: 4,
      prepTimeMaxMin: 20,
      macroStyle: 'high_protein',
      planDurationDays: 7,
    },
  },
  '2': {
    name: 'The College Athlete (Kayla)',
    slug: 'college-athlete-kayla',
    input: {
      name: 'Kayla',
      sex: 'female',
      age: 21,
      heightFeet: 5,
      heightInches: 7,
      weightLbs: 145,
      goalType: 'bulk',
      goalRate: 0.5,
      activityLevel: 'extremely_active',
      trainingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      trainingTime: 'afternoon',
      dietaryStyle: 'omnivore',
      allergies: [],
      exclusions: [],
      cuisinePreferences: ['american', 'asian'],
      mealsPerDay: 4,
      snacksPerDay: 2,
      cookingSkill: 3,
      prepTimeMaxMin: 25,
      macroStyle: 'balanced',
      planDurationDays: 7,
    },
  },
  '3': {
    name: 'The Vegan Distance Runner (Raj)',
    slug: 'vegan-runner-raj',
    input: {
      name: 'Raj',
      sex: 'male',
      age: 28,
      heightCm: 180,
      weightKg: 72,
      goalType: 'maintain',
      goalRate: 0,
      activityLevel: 'very_active',
      trainingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
      trainingTime: 'morning',
      dietaryStyle: 'vegan',
      allergies: ['soy'],
      exclusions: [],
      cuisinePreferences: ['mediterranean', 'indian', 'thai'],
      mealsPerDay: 3,
      snacksPerDay: 2,
      cookingSkill: 7,
      prepTimeMaxMin: 45,
      macroStyle: 'high_protein',
      planDurationDays: 7,
    },
  },
  '4': {
    name: 'The Keto Mom (Jennifer)',
    slug: 'keto-mom-jennifer',
    input: {
      name: 'Jennifer',
      sex: 'female',
      age: 38,
      heightFeet: 5,
      heightInches: 5,
      weightLbs: 160,
      goalType: 'cut',
      goalRate: 1.0,
      activityLevel: 'lightly_active',
      trainingDays: ['tuesday', 'thursday', 'saturday'],
      dietaryStyle: 'omnivore',
      allergies: ['dairy'],
      exclusions: [],
      cuisinePreferences: ['american', 'mexican'],
      mealsPerDay: 3,
      snacksPerDay: 1,
      cookingSkill: 6,
      prepTimeMaxMin: 30,
      macroStyle: 'keto',
      planDurationDays: 7,
    },
  },
  '5': {
    name: 'The Senior with Allergies (Robert)',
    slug: 'senior-allergies-robert',
    input: {
      name: 'Robert',
      sex: 'male',
      age: 67,
      heightFeet: 5,
      heightInches: 9,
      weightLbs: 180,
      goalType: 'maintain',
      goalRate: 0,
      activityLevel: 'sedentary',
      trainingDays: [],
      dietaryStyle: 'omnivore',
      allergies: ['peanut', 'tree nut', 'shellfish', 'gluten'],
      exclusions: [],
      cuisinePreferences: ['american', 'italian', 'greek'],
      mealsPerDay: 3,
      snacksPerDay: 0,
      cookingSkill: 5,
      prepTimeMaxMin: 40,
      macroStyle: 'balanced',
      planDurationDays: 7,
    },
  },
  '6': {
    name: 'The Petite Woman Cutting (Sarah)',
    slug: 'petite-cutting-sarah',
    input: {
      name: 'Sarah',
      sex: 'female',
      age: 24,
      heightFeet: 5,
      heightInches: 2,
      weightLbs: 110,
      goalType: 'cut',
      goalRate: 2.0,
      activityLevel: 'moderately_active',
      trainingDays: ['monday', 'wednesday', 'friday', 'saturday'],
      dietaryStyle: 'omnivore',
      allergies: [],
      exclusions: [],
      cuisinePreferences: ['american', 'asian', 'mediterranean'],
      mealsPerDay: 3,
      snacksPerDay: 1,
      cookingSkill: 5,
      prepTimeMaxMin: 30,
      macroStyle: 'high_protein',
      planDurationDays: 7,
    },
  },
  '7': {
    name: 'The Pescatarian Bodybuilder (Takeshi)',
    slug: 'pescatarian-bodybuilder-takeshi',
    input: {
      name: 'Takeshi',
      sex: 'male',
      age: 29,
      heightCm: 178,
      weightKg: 85,
      bodyFatPercent: 14,
      goalType: 'bulk',
      goalRate: 0.5,
      activityLevel: 'very_active',
      trainingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
      trainingTime: 'afternoon',
      dietaryStyle: 'pescatarian',
      allergies: [],
      exclusions: [],
      cuisinePreferences: ['japanese', 'mediterranean', 'thai'],
      mealsPerDay: 5,
      snacksPerDay: 1,
      cookingSkill: 8,
      prepTimeMaxMin: 60,
      macroStyle: 'high_protein',
      planDurationDays: 7,
    },
  },
  '8': {
    name: 'The Minimalist Cook (Diane)',
    slug: 'minimalist-cook-diane',
    input: {
      name: 'Diane',
      sex: 'female',
      age: 45,
      heightFeet: 5,
      heightInches: 6,
      weightLbs: 155,
      goalType: 'maintain',
      goalRate: 0,
      activityLevel: 'lightly_active',
      trainingDays: ['wednesday', 'saturday'],
      dietaryStyle: 'omnivore',
      allergies: ['egg'],
      exclusions: [],
      cuisinePreferences: ['american'],
      mealsPerDay: 3,
      snacksPerDay: 1,
      cookingSkill: 2,
      prepTimeMaxMin: 15,
      macroStyle: 'low_carb',
      planDurationDays: 7,
    },
  },
  '9': {
    name: 'The Teen Vegetarian (Priya)',
    slug: 'teen-vegetarian-priya',
    input: {
      name: 'Priya',
      sex: 'female',
      age: 18,
      heightCm: 163,
      weightKg: 55,
      goalType: 'maintain',
      goalRate: 0,
      activityLevel: 'moderately_active',
      trainingDays: ['monday', 'wednesday', 'friday'],
      dietaryStyle: 'vegetarian',
      allergies: [],
      exclusions: [],
      cuisinePreferences: ['indian', 'italian'],
      mealsPerDay: 3,
      snacksPerDay: 2,
      cookingSkill: 3,
      prepTimeMaxMin: 20,
      macroStyle: 'balanced',
      planDurationDays: 7,
    },
  },
  '10': {
    name: 'The Large Man Bulking (Darius)',
    slug: 'large-man-bulking-darius',
    input: {
      name: 'Darius',
      sex: 'male',
      age: 25,
      heightFeet: 6,
      heightInches: 4,
      weightLbs: 245,
      bodyFatPercent: 18,
      goalType: 'bulk',
      goalRate: 2.0,
      activityLevel: 'extremely_active',
      trainingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      trainingTime: 'morning',
      dietaryStyle: 'omnivore',
      allergies: [],
      exclusions: [],
      cuisinePreferences: ['american', 'mexican', 'korean'],
      mealsPerDay: 4,
      snacksPerDay: 2,
      cookingSkill: 6,
      prepTimeMaxMin: 45,
      macroStyle: 'high_protein',
      planDurationDays: 7,
    },
  },
};

// ============================================================
// CLI Argument Parsing
// ============================================================

interface RunnerArgs {
  personas: string[];
  outputDir: string;
  stage1Only: boolean;
}

function parseArgs(): RunnerArgs {
  const args = process.argv.slice(2);
  const DEFAULT_OUTPUT_DIR = resolve(
    __dirname,
    '../../../../../NE Implementation/Nutrition Engine testing:validation'
  );

  const parsed: RunnerArgs = {
    personas: Object.keys(PERSONAS),
    outputDir: DEFAULT_OUTPUT_DIR,
    stage1Only: false,
  };

  for (const arg of args) {
    if (arg === '--stage1-only') {
      parsed.stage1Only = true;
      continue;
    }
    const [key, value] = arg.split('=');
    switch (key) {
      case '--personas':
        if (value === 'all') {
          parsed.personas = Object.keys(PERSONAS);
        } else {
          parsed.personas = value.split(',').map((s) => s.trim());
        }
        break;
      case '--output-dir':
        parsed.outputDir = resolve(value);
        break;
    }
  }

  // Validate persona IDs
  for (const id of parsed.personas) {
    if (!PERSONAS[id]) {
      console.error(`Unknown persona ID: "${id}". Valid IDs: ${Object.keys(PERSONAS).join(', ')}`);
      process.exit(1);
    }
  }

  return parsed;
}

// ============================================================
// Stage 1 Runner (Deterministic, no API calls)
// ============================================================

interface Stage1Result {
  personaId: string;
  personaName: string;
  rawInput: RawIntakeForm;
  clientIntake: ClientIntake;
  metabolicProfile: MetabolicProfile | null;
  constraintsCompatible: boolean;
  constraintWarnings: string[];
}

function runStage1(personaId: string): Stage1Result {
  const persona = PERSONAS[personaId];
  const normalizer = new IntakeNormalizer();
  const calculator = new MetabolicCalculator();

  const clientIntake = normalizer.normalize(persona.input);

  let metabolicProfile: MetabolicProfile | null = null;
  if (clientIntake.constraintsCompatible) {
    metabolicProfile = calculator.calculate(clientIntake);
  }

  return {
    personaId,
    personaName: persona.name,
    rawInput: persona.input,
    clientIntake,
    metabolicProfile,
    constraintsCompatible: clientIntake.constraintsCompatible,
    constraintWarnings: clientIntake.constraintWarnings,
  };
}

// ============================================================
// Full Pipeline Runner
// ============================================================

interface BaselineTestResult {
  personaId: string;
  personaName: string;
  personaSlug: string;
  timestamp: string;
  rawInput: RawIntakeForm;
  stage1: {
    clientIntake: ClientIntake;
    metabolicProfile: MetabolicProfile | null;
    constraintsCompatible: boolean;
    constraintWarnings: string[];
  };
  pipeline: {
    success: boolean;
    error?: string;
    totalTimeMs: number;
  };
  draft?: unknown; // MealPlanDraft (serialized)
  plan?: unknown; // MealPlanValidated (serialized, excludes deliverables)
  progressLog: Array<{ timestamp: string; agent: number; agentName: string; message: string }>;
}

async function runFullPipeline(
  personaId: string,
  config: PipelineConfig
): Promise<BaselineTestResult> {
  const persona = PERSONAS[personaId];
  const progressLog: BaselineTestResult['progressLog'] = [];

  // Stage 1 (deterministic)
  const stage1 = runStage1(personaId);

  if (!stage1.constraintsCompatible) {
    return {
      personaId,
      personaName: persona.name,
      personaSlug: persona.slug,
      timestamp: new Date().toISOString(),
      rawInput: persona.input,
      stage1: {
        clientIntake: stage1.clientIntake,
        metabolicProfile: stage1.metabolicProfile,
        constraintsCompatible: false,
        constraintWarnings: stage1.constraintWarnings,
      },
      pipeline: {
        success: false,
        error: `Incompatible constraints: ${stage1.constraintWarnings.join('; ')}`,
        totalTimeMs: 0,
      },
      progressLog,
    };
  }

  // Full pipeline
  const orchestrator = new NutritionPipelineOrchestrator(config);
  const startTime = Date.now();

  const result: PipelineResult = await orchestrator.run(persona.input, (progress) => {
    progressLog.push({
      timestamp: new Date().toISOString(),
      agent: progress.agent,
      agentName: progress.agentName,
      message: progress.message,
    });
  });

  const totalTimeMs = Date.now() - startTime;

  return {
    personaId,
    personaName: persona.name,
    personaSlug: persona.slug,
    timestamp: new Date().toISOString(),
    rawInput: persona.input,
    stage1: {
      clientIntake: stage1.clientIntake,
      metabolicProfile: stage1.metabolicProfile,
      constraintsCompatible: true,
      constraintWarnings: stage1.constraintWarnings,
    },
    pipeline: {
      success: result.success,
      error: result.error,
      totalTimeMs,
    },
    // Exclude deliverables (HTML/PDF) from JSON output — too large
    draft: result.draft,
    plan: result.plan,
    progressLog,
  };
}

// ============================================================
// PDF Mock (avoids needing Chrome for rendering)
// ============================================================

async function installPdfMock(): Promise<void> {
  try {
    const brandRenderer = await import('../agents/brand-renderer/index');
    const pdfRenderer = await import('../agents/brand-renderer/pdf-renderer');

    const mockPdf = async (): Promise<Buffer> => {
      return Buffer.from('%PDF-1.4 mock test runner pdf');
    };

    Object.defineProperty(pdfRenderer, 'renderPdf', {
      value: mockPdf,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(brandRenderer, 'renderPdf', {
      value: mockPdf,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(pdfRenderer, 'closeBrowserPool', {
      value: async () => {},
      writable: true,
      configurable: true,
    });
    Object.defineProperty(brandRenderer, 'closeBrowserPool', {
      value: async () => {},
      writable: true,
      configurable: true,
    });
  } catch (err) {
    console.warn('Warning: Failed to install PDF mock.', err);
  }
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  loadEnv();
  const args = parseArgs();

  // Ensure output dir exists
  if (!existsSync(args.outputDir)) {
    mkdirSync(args.outputDir, { recursive: true });
  }

  console.log('='.repeat(60));
  console.log('  Nutrition Engine Baseline Test Runner');
  console.log('='.repeat(60));
  console.log(
    `  Mode:        ${args.stage1Only ? 'Stage 1 only (deterministic)' : 'Full pipeline'}`
  );
  console.log(`  Personas:    ${args.personas.join(', ')}`);
  console.log(`  Output dir:  ${args.outputDir}`);
  console.log('='.repeat(60));
  console.log('');

  if (args.stage1Only) {
    // Stage 1 only — fast, no API calls
    const results: Stage1Result[] = [];

    for (const id of args.personas) {
      const persona = PERSONAS[id];
      console.log(`[${id}/${args.personas.length}] ${persona.name}...`);
      const result = runStage1(id);
      results.push(result);

      const mp = result.metabolicProfile;
      if (mp) {
        console.log(
          `  BMR: ${mp.bmrKcal} | TDEE: ${mp.tdeeKcal} | Goal: ${mp.goalKcal} kcal` +
            ` | Floor: ${mp.goalKcalFloorApplied ? 'YES' : 'no'}` +
            ` | P: ${mp.proteinTargetG}g C: ${mp.carbsTargetG}g F: ${mp.fatTargetG}g`
        );
      } else {
        console.log(`  REJECTED: ${result.constraintWarnings.join('; ')}`);
      }
    }

    // Save stage1 summary
    const outputPath = join(args.outputDir, 'stage1-metabolic-profiles.json');
    writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`\nStage 1 results saved to: ${outputPath}`);
    return;
  }

  // Full pipeline mode
  await installPdfMock();

  const config: PipelineConfig = {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    usdaApiKey: process.env.USDA_API_KEY || '',
    fatsecretClientId: process.env.FATSECRET_CLIENT_ID || undefined,
    fatsecretClientSecret: process.env.FATSECRET_CLIENT_SECRET || undefined,
  };

  // Validate config
  if (!config.anthropicApiKey.startsWith('sk-ant-')) {
    console.error('ERROR: ANTHROPIC_API_KEY is missing or invalid. Check .env file.');
    process.exit(1);
  }
  if (!config.usdaApiKey) {
    console.error('ERROR: USDA_API_KEY is missing. Check .env file.');
    process.exit(1);
  }

  const summaryRows: Array<{
    id: string;
    name: string;
    success: boolean;
    timeMs: number;
    qaScore?: number;
    qaStatus?: string;
    error?: string;
  }> = [];

  for (let i = 0; i < args.personas.length; i++) {
    const id = args.personas[i];
    const persona = PERSONAS[id];
    console.log(`\n[${'='.repeat(50)}]`);
    console.log(`[${i + 1}/${args.personas.length}] Running: ${persona.name}`);
    console.log(`[${'='.repeat(50)}]`);

    const result = await runFullPipeline(id, config);

    // Save individual result
    const outputPath = join(args.outputDir, `baseline-test-${persona.slug}.json`);
    writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');

    const qaScore = result.plan
      ? (result.plan as { qa?: { score?: number; status?: string } }).qa?.score
      : undefined;
    const qaStatus = result.plan
      ? (result.plan as { qa?: { score?: number; status?: string } }).qa?.status
      : undefined;

    summaryRows.push({
      id,
      name: persona.name,
      success: result.pipeline.success,
      timeMs: result.pipeline.totalTimeMs,
      qaScore,
      qaStatus,
      error: result.pipeline.error,
    });

    if (result.pipeline.success) {
      console.log(
        `  SUCCESS in ${(result.pipeline.totalTimeMs / 1000).toFixed(1)}s` +
          ` | QA: ${qaStatus} (${qaScore?.toFixed(1)}/100)` +
          ` | Saved: baseline-test-${persona.slug}.json`
      );
    } else {
      console.log(`  FAILED: ${result.pipeline.error}`);
    }
  }

  // Print summary table
  console.log('\n' + '='.repeat(80));
  console.log('  BASELINE TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(
    'ID'.padEnd(4) +
      'Persona'.padEnd(40) +
      'Status'.padEnd(8) +
      'Time'.padEnd(10) +
      'QA'.padEnd(12) +
      'Score'
  );
  console.log('-'.repeat(80));

  for (const row of summaryRows) {
    console.log(
      row.id.padEnd(4) +
        row.name.padEnd(40) +
        (row.success ? 'OK' : 'FAIL').padEnd(8) +
        `${(row.timeMs / 1000).toFixed(1)}s`.padEnd(10) +
        (row.qaStatus ?? 'N/A').padEnd(12) +
        (row.qaScore !== undefined ? `${row.qaScore.toFixed(1)}/100` : (row.error ?? 'N/A'))
    );
  }

  console.log('='.repeat(80));

  // Save summary
  const summaryPath = join(args.outputDir, 'baseline-run-summary.json');
  writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        personasRun: args.personas.length,
        successful: summaryRows.filter((r) => r.success).length,
        failed: summaryRows.filter((r) => !r.success).length,
        results: summaryRows,
      },
      null,
      2
    ),
    'utf-8'
  );
  console.log(`\nSummary saved to: ${summaryPath}`);
}

main().catch((err) => {
  console.error('Baseline runner failed:', err);
  process.exit(1);
});
