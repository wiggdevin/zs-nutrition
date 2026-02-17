/**
 * FatSecret API Proxy Routes
 *
 * Exposes FatSecret API endpoints through this Railway worker to solve
 * IP whitelisting issues (Vercel's dynamic IPs vs Railway's static IP).
 */

import { timingSafeEqual } from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { FatSecretAdapter } from '@zero-sum/nutrition-engine';

/**
 * Compare two strings in constant time to prevent timing attacks.
 * `crypto.timingSafeEqual` throws if buffer lengths differ, so we
 * check length first and return `false` immediately for mismatches.
 * The early-exit on length is safe because an attacker can already
 * determine the secret's length via other means (e.g. response size),
 * and it does not reveal any character-level information.
 */
function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Singleton adapter instance
let adapter: FatSecretAdapter | null = null;

function getAdapter(): FatSecretAdapter {
  if (!adapter) {
    adapter = new FatSecretAdapter(
      process.env.FATSECRET_CLIENT_ID || '',
      process.env.FATSECRET_CLIENT_SECRET || ''
    );
  }
  return adapter;
}

/**
 * Auth middleware - validates Bearer token against FATSECRET_PROXY_SECRET
 */
function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const expectedSecret = process.env.FATSECRET_PROXY_SECRET;

  if (!expectedSecret) {
    console.error('[FatSecret Proxy] FATSECRET_PROXY_SECRET not configured');
    res.status(500).json({ error: 'Proxy not configured' });
    return;
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix
  if (!timingSafeCompare(token, expectedSecret)) {
    res.status(403).json({ error: 'Invalid proxy secret' });
    return;
  }

  next();
}

/**
 * Create and configure the FatSecret proxy router
 */
export function createFatSecretProxyRouter(): Router {
  const router = Router();

  // Apply auth middleware to all routes
  router.use(authMiddleware);

  /**
   * POST /search
   * Body: { query: string, maxResults?: number, pageNumber?: number }
   */
  router.post('/search', async (req: Request, res: Response) => {
    try {
      const { query, maxResults = 20, pageNumber = 0 } = req.body;

      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Query is required' });
        return;
      }

      const fatSecret = getAdapter();
      const results = await fatSecret.searchFoods(query, maxResults, pageNumber);
      res.json({ results, pageNumber });
    } catch (error) {
      console.error(
        '[FatSecret Proxy] Search error:',
        error instanceof Error ? error.message : error
      );
      res.status(500).json({ error: 'Search failed' });
    }
  });

  /**
   * POST /food
   * Body: { foodId: string }
   */
  router.post('/food', async (req: Request, res: Response) => {
    try {
      const { foodId } = req.body;

      if (!foodId || typeof foodId !== 'string') {
        res.status(400).json({ error: 'foodId is required' });
        return;
      }

      const fatSecret = getAdapter();
      const food = await fatSecret.getFood(foodId);
      res.json({ food });
    } catch (error) {
      console.error(
        '[FatSecret Proxy] Get food error:',
        error instanceof Error ? error.message : error
      );
      res.status(500).json({ error: 'Food lookup failed' });
    }
  });

  /**
   * POST /autocomplete
   * Body: { query: string }
   */
  router.post('/autocomplete', async (req: Request, res: Response) => {
    try {
      const { query } = req.body;

      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Query is required' });
        return;
      }

      const fatSecret = getAdapter();
      const suggestions = await fatSecret.autocomplete(query);
      res.json({ suggestions });
    } catch (error) {
      console.error(
        '[FatSecret Proxy] Autocomplete error:',
        error instanceof Error ? error.message : error
      );
      res.status(500).json({ error: 'Autocomplete failed' });
    }
  });

  /**
   * POST /barcode
   * Body: { barcode: string }
   */
  router.post('/barcode', async (req: Request, res: Response) => {
    try {
      const { barcode } = req.body;

      if (!barcode || typeof barcode !== 'string') {
        res.status(400).json({ error: 'Barcode is required' });
        return;
      }

      const fatSecret = getAdapter();
      const food = await fatSecret.getFoodByBarcode(barcode);

      if (!food) {
        res.status(404).json({ error: 'Food not found for barcode' });
        return;
      }

      res.json({ food });
    } catch (error) {
      console.error(
        '[FatSecret Proxy] Barcode lookup error:',
        error instanceof Error ? error.message : error
      );
      res.status(500).json({ error: 'Barcode lookup failed' });
    }
  });

  /**
   * POST /recipes/search
   * Body: { query: string, maxResults?: number }
   */
  router.post('/recipes/search', async (req: Request, res: Response) => {
    try {
      const { query, maxResults = 10 } = req.body;

      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Query is required' });
        return;
      }

      const fatSecret = getAdapter();
      const results = await fatSecret.searchRecipes(query, maxResults);
      res.json({ results });
    } catch (error) {
      console.error(
        '[FatSecret Proxy] Recipe search error:',
        error instanceof Error ? error.message : error
      );
      res.status(500).json({ error: 'Recipe search failed' });
    }
  });

  /**
   * POST /recipes/details
   * Body: { recipeId: string }
   */
  router.post('/recipes/details', async (req: Request, res: Response) => {
    try {
      const { recipeId } = req.body;

      if (!recipeId || typeof recipeId !== 'string') {
        res.status(400).json({ error: 'recipeId is required' });
        return;
      }

      const fatSecret = getAdapter();
      const recipe = await fatSecret.getRecipe(recipeId);
      res.json({ recipe });
    } catch (error) {
      console.error(
        '[FatSecret Proxy] Recipe details error:',
        error instanceof Error ? error.message : error
      );
      res.status(500).json({ error: 'Recipe lookup failed' });
    }
  });

  return router;
}
