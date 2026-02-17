import type { MealPlanValidated } from '../../types/schemas';
import { renderHtml } from './html-renderer';
import { renderPdf } from './pdf-renderer';

// Re-export split renderers for direct use
export { renderHtml, type HtmlRenderResult } from './html-renderer';
export { renderPdf, closeBrowserPool } from './pdf-renderer';

/**
 * Agent 6: Brand Renderer
 * Generates HTML and PDF deliverables from validated meal plan.
 *
 * This class delegates to the split HtmlRenderer (pure CPU) and
 * PdfRenderer (async Puppeteer with browser pool). Maintained for
 * backward compatibility with the orchestrator.
 */
export class BrandRenderer {
  async render(validated: MealPlanValidated): Promise<{
    summaryHtml: string;
    gridHtml: string;
    groceryHtml: string;
    pdfBuffer: Buffer;
  }> {
    // Stage 1: Pure HTML generation (~50-150ms)
    const { summaryHtml, gridHtml, groceryHtml } = renderHtml(validated);

    // Stage 2: Async PDF generation (~1-8s, browser pool reused)
    const pdfBuffer = await renderPdf(summaryHtml, gridHtml, groceryHtml);

    return { summaryHtml, gridHtml, groceryHtml, pdfBuffer };
  }
}
