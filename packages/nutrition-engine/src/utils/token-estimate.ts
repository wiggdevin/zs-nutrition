// Rough estimation: ~4 characters per token for English text
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Claude Sonnet context window is 200k tokens
// Reserve tokens for response + system overhead
const MAX_PROMPT_TOKENS = 180000;

export { MAX_PROMPT_TOKENS };
