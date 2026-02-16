/**
 * FatSecret autocomplete/suggestion methods
 */

import { OAuthManager, apiRequest } from './oauth';
import { LocalFoodDatabase } from './local-fallback';
import type { FatSecretAutocompleteResponse } from './types';

export async function autocomplete(
  oauth: OAuthManager,
  isConfigured: boolean,
  query: string
): Promise<string[]> {
  if (!isConfigured) {
    return LocalFoodDatabase.autocomplete(query);
  }

  const data = (await apiRequest(oauth, 'foods.autocomplete', {
    expression: query,
  })) as FatSecretAutocompleteResponse;

  const suggestions = data?.suggestions?.suggestion;
  if (!suggestions) {
    return [];
  }

  const arr = Array.isArray(suggestions) ? suggestions : [suggestions];
  return arr.map((s) => {
    if (typeof s === 'string') return s;
    if (typeof s === 'object' && s !== null && 'suggestion' in s) return s.suggestion;
    return String(s);
  });
}
