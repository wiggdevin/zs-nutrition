import puppeteer from 'puppeteer-core';
import type { Browser } from 'puppeteer-core';

// ============================================================
// Browser Pool (P4-T02)
// Module-level singleton with health checks and auto-relaunch.
// Reuse browser across renders (page-level isolation).
// ============================================================

let browserInstance: Browser | null = null;
let browserLaunchPromise: Promise<Browser> | null = null;

/**
 * Detect serverless/container environment for Chromium selection.
 */
function isServerlessEnv(): boolean {
  return !!(
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.VERCEL ||
    process.env.RAILWAY_ENVIRONMENT
  );
}

/**
 * Launch a fresh browser instance.
 */
async function launchBrowser(): Promise<Browser> {
  if (isServerlessEnv()) {
    const chromium = await import('@sparticuz/chromium');
    return puppeteer.launch({
      args: chromium.default.args,
      executablePath: await chromium.default.executablePath(),
      headless: true,
    });
  }
  return puppeteer.launch({
    channel: 'chrome',
    headless: true,
  });
}

/**
 * Get a pooled browser instance. Returns existing browser if connected,
 * otherwise launches a new one. Concurrent calls share the same launch promise.
 */
async function getPooledBrowser(): Promise<Browser> {
  // Check if existing browser is still usable
  if (browserInstance) {
    try {
      if (browserInstance.connected) {
        return browserInstance;
      }
    } catch {
      // Browser disconnected — fall through to relaunch
    }
    browserInstance = null;
    browserLaunchPromise = null;
  }

  // Deduplicate concurrent launch requests
  if (!browserLaunchPromise) {
    browserLaunchPromise = launchBrowser()
      .then((browser) => {
        browserInstance = browser;

        // Auto-clear on unexpected disconnect so next call relaunches
        browser.on('disconnected', () => {
          if (browserInstance === browser) {
            browserInstance = null;
            browserLaunchPromise = null;
          }
        });

        return browser;
      })
      .catch((err) => {
        browserLaunchPromise = null;
        throw err;
      });
  }

  return browserLaunchPromise;
}

/**
 * Close the pooled browser. Call during graceful shutdown.
 */
export async function closeBrowserPool(): Promise<void> {
  if (browserInstance) {
    try {
      await browserInstance.close();
    } catch {
      // Ignore close errors during shutdown
    }
    browserInstance = null;
    browserLaunchPromise = null;
  }
}

// Graceful shutdown: close browser on SIGTERM/SIGINT
const shutdownHandler = () => {
  closeBrowserPool();
};
process.on('SIGTERM', shutdownHandler);
process.on('SIGINT', shutdownHandler);

// ============================================================
// PDF Rendering
// ============================================================

/**
 * Generate combined HTML for PDF with page breaks between sections.
 */
function generateCombinedPdfHtml(
  summaryHtml: string,
  gridHtml: string,
  groceryHtml: string
): string {
  const extractBody = (html: string) => {
    const match = html.match(/<body>([\s\S]*)<\/body>/);
    return match ? match[1] : html;
  };

  const extractStyles = (html: string) => {
    const matches = html.match(/<style>([\s\S]*?)<\/style>/g);
    return matches ? matches.join('\n') : '';
  };

  const allStyles = `
      ${extractStyles(summaryHtml)}
      ${extractStyles(gridHtml)}
      ${extractStyles(groceryHtml)}
      <style>
        .pdf-section {
          page-break-after: always;
        }
        .pdf-section:last-child {
          page-break-after: avoid;
        }
      </style>
    `;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    ${allStyles}
  </style>
</head>
<body>
  <div class="pdf-section">
    ${extractBody(summaryHtml)}
  </div>
  <div class="pdf-section">
    ${extractBody(gridHtml)}
  </div>
  <div class="pdf-section">
    ${extractBody(groceryHtml)}
  </div>
</body>
</html>
    `.trim();
}

/**
 * PdfRenderer (P4-T01 + P4-T02)
 * Async Puppeteer renderer with browser pool. Returns PDF Buffer.
 * Page-level isolation: new page per render, closed after.
 */
export async function renderPdf(
  summaryHtml: string,
  gridHtml: string,
  groceryHtml: string
): Promise<Buffer> {
  const browser = await getPooledBrowser();
  const page = await browser.newPage();

  try {
    const combinedHtml = generateCombinedPdfHtml(summaryHtml, gridHtml, groceryHtml);

    await page.setContent(combinedHtml, { waitUntil: 'domcontentloaded' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        bottom: '10mm',
        left: '10mm',
        right: '10mm',
      },
      displayHeaderFooter: false,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await page.close();
  }
}
