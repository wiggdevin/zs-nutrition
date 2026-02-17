import puppeteer from 'puppeteer-core';
import type { Browser } from 'puppeteer-core';
import type { MealPlanValidated } from '../../types/schemas';

/**
 * Launch a browser instance, using @sparticuz/chromium in serverless
 * environments (AWS Lambda / Vercel) or Railway and the locally-installed
 * Chrome for development.
 */
async function getBrowser(): Promise<Browser> {
  if (
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.VERCEL ||
    process.env.RAILWAY_ENVIRONMENT
  ) {
    const chromium = await import('@sparticuz/chromium');
    return puppeteer.launch({
      args: chromium.default.args,
      executablePath: await chromium.default.executablePath(),
      headless: true,
    });
  }
  // Local development - use installed Chrome
  return puppeteer.launch({
    channel: 'chrome',
    headless: true,
  });
}

/**
 * Generate combined HTML for PDF with page breaks between sections
 */
function generateCombinedPdfHtml(
  _validated: MealPlanValidated,
  summaryHtml: string,
  gridHtml: string,
  groceryHtml: string
): string {
  // Extract body content from each HTML document
  const extractBody = (html: string) => {
    const match = html.match(/<body>([\s\S]*)<\/body>/);
    return match ? match[1] : html;
  };

  // Extract styles from each document
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
 * Generate a single PDF document combining all deliverables
 */
export async function generatePdf(
  validated: MealPlanValidated,
  summaryHtml: string,
  gridHtml: string,
  groceryHtml: string
): Promise<Buffer> {
  let browser: Browser | undefined;
  try {
    browser = await getBrowser();

    const page = await browser.newPage();

    // Create a combined HTML document with all sections
    const combinedHtml = generateCombinedPdfHtml(validated, summaryHtml, gridHtml, groceryHtml);

    await page.setContent(combinedHtml, { waitUntil: 'domcontentloaded' });

    // Generate PDF
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

    // Convert Uint8Array to Buffer
    return Buffer.from(pdfBuffer);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
