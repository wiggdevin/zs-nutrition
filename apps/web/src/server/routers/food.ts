import { z } from 'zod'
import { protectedProcedure, router } from '../trpc'
import { FatSecretAdapter } from '@zero-sum/nutrition-engine'

// Singleton FatSecret adapter instance
let fatSecretAdapter: FatSecretAdapter | null = null

function getFatSecretAdapter(): FatSecretAdapter {
  if (!fatSecretAdapter) {
    fatSecretAdapter = new FatSecretAdapter(
      process.env.FATSECRET_CLIENT_ID || '',
      process.env.FATSECRET_CLIENT_SECRET || ''
    )
  }
  return fatSecretAdapter
}

/**
 * Food Router — handles food search via FatSecret API with autocomplete and details.
 */
export const foodRouter = router({
  /**
   * autocomplete: Returns food name suggestions for a partial query.
   * Lightweight endpoint for real-time autocomplete as user types.
   */
  autocomplete: protectedProcedure
    .input(
      z.object({
        query: z.string().min(2).max(100),
      })
    )
    .query(async ({ input }) => {
      const adapter = getFatSecretAdapter()
      const suggestions = await adapter.autocomplete(input.query)
      return { suggestions }
    }),

  /**
   * search: Full food search returning food items with descriptions.
   * Used when user submits a search or selects an autocomplete suggestion.
   * Supports pagination via pageNumber parameter (zero-based).
   */
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(100),
        maxResults: z.number().int().min(1).max(50).default(10),
        pageNumber: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const adapter = getFatSecretAdapter()
      const results = await adapter.searchFoods(input.query, input.maxResults, input.pageNumber)
      return { results, pageNumber: input.pageNumber }
    }),

  /**
   * getDetails: Get full food details including all serving sizes and nutrition.
   * Called when user selects a specific food from search results.
   */
  getDetails: protectedProcedure
    .input(
      z.object({
        foodId: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const adapter = getFatSecretAdapter()
      const food = await adapter.getFood(input.foodId)
      return { food }
    }),
})
