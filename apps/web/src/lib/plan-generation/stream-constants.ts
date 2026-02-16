/**
 * Agent messages used by the SSE stream to display progress.
 */
export const AGENT_MESSAGES: Record<number, { name: string; message: string }> = {
  1: { name: 'Intake Normalizer', message: 'Cleaning and validating your data...' },
  2: { name: 'Metabolic Calculator', message: 'Calculating BMR, TDEE, and macro targets...' },
  3: { name: 'Recipe Curator', message: 'AI generating meal ideas matching your targets...' },
  4: { name: 'Nutrition Compiler', message: 'Verifying nutrition data via FatSecret...' },
  5: { name: 'QA Validator', message: 'Enforcing calorie and macro tolerances...' },
  6: { name: 'Brand Renderer', message: 'Generating your deliverables...' },
};

/**
 * Format data as a Server-Sent Event string.
 */
export function formatSSE(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}
