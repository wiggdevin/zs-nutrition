/**
 * Generates a PDF buffer from meal plan data.
 * Uses a minimal hand-crafted PDF (no external PDF library needed).
 *
 * The generated PDF contains:
 * - Plan header with user info and macro targets
 * - 7-day meal breakdown with recipes and nutrition
 * - Grocery list
 * - QA score summary
 */

export interface PdfPlanData {
  days: Array<{
    dayNumber: number;
    dayName: string;
    isTrainingDay: boolean;
    targetKcal: number;
    meals: Array<{
      slot: string;
      name: string;
      nutrition: {
        kcal: number;
        proteinG: number;
        carbsG: number;
        fatG: number;
        fiberG?: number;
      };
      ingredients?: Array<{
        name: string;
        amount: number | string;
        unit?: string;
        fatsecretFoodId?: string;
      }>;
      instructions?: string[];
    }>;
  }>;
  groceryList?: Array<{ category: string; items: string[] }>;
  qa?: { status: string; score: number };
  weeklyTotals?: {
    avgKcal: number;
    avgProteinG: number;
    avgCarbsG: number;
    avgFatG: number;
  };
}

export interface PdfMetadata {
  planId: string;
  userName?: string;
  dailyKcalTarget?: number | null;
  dailyProteinG?: number | null;
  dailyCarbsG?: number | null;
  dailyFatG?: number | null;
  generatedAt: Date;
}

// Escape special PDF characters in text strings
function pdfEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/**
 * Build a minimal valid PDF document as a Buffer.
 * Uses PDF 1.4 spec with basic text content streams.
 */
export function generatePlanPdf(planData: PdfPlanData, metadata: PdfMetadata): Buffer {
  const _lines: string[] = [];

  // Helper to add a line of text content at a y position
  function textLine(x: number, y: number, text: string, fontSize: number = 10): string {
    return `BT /F1 ${fontSize} Tf ${x} ${y} Td (${pdfEscape(text)}) Tj ET`;
  }

  function boldTextLine(x: number, y: number, text: string, fontSize: number = 10): string {
    return `BT /F2 ${fontSize} Tf ${x} ${y} Td (${pdfEscape(text)}) Tj ET`;
  }

  // Build content pages
  const pages: string[][] = [];

  // === PAGE 1: Title and Summary ===
  const page1Lines: string[] = [];
  let y = 750;

  // Title
  page1Lines.push(boldTextLine(50, y, 'ZERO SUM NUTRITION', 20));
  y -= 25;
  page1Lines.push(boldTextLine(50, y, '7-Day Meal Plan', 16));
  y -= 20;
  page1Lines.push(textLine(50, y, `Generated: ${metadata.generatedAt.toLocaleDateString()}`, 9));
  y -= 15;
  page1Lines.push(textLine(50, y, `Plan ID: ${metadata.planId}`, 9));

  // Macro targets
  y -= 35;
  page1Lines.push(boldTextLine(50, y, 'DAILY MACRO TARGETS', 12));
  y -= 18;
  if (metadata.dailyKcalTarget) {
    page1Lines.push(textLine(60, y, `Calories: ${metadata.dailyKcalTarget} kcal`));
    y -= 15;
  }
  if (metadata.dailyProteinG) {
    page1Lines.push(textLine(60, y, `Protein: ${metadata.dailyProteinG}g`));
    y -= 15;
  }
  if (metadata.dailyCarbsG) {
    page1Lines.push(textLine(60, y, `Carbs: ${metadata.dailyCarbsG}g`));
    y -= 15;
  }
  if (metadata.dailyFatG) {
    page1Lines.push(textLine(60, y, `Fat: ${metadata.dailyFatG}g`));
    y -= 15;
  }

  // QA Score
  if (planData.qa) {
    y -= 20;
    page1Lines.push(boldTextLine(50, y, 'QA VALIDATION', 12));
    y -= 18;
    page1Lines.push(textLine(60, y, `Score: ${planData.qa.score}/100 - ${planData.qa.status}`));
    y -= 15;
  }

  // Weekly totals
  if (planData.weeklyTotals) {
    y -= 20;
    page1Lines.push(boldTextLine(50, y, 'WEEKLY AVERAGES', 12));
    y -= 18;
    page1Lines.push(
      textLine(
        60,
        y,
        `Avg Calories: ${planData.weeklyTotals.avgKcal} kcal | Protein: ${planData.weeklyTotals.avgProteinG}g | Carbs: ${planData.weeklyTotals.avgCarbsG}g | Fat: ${planData.weeklyTotals.avgFatG}g`
      )
    );
    y -= 15;
  }

  // Day overview on page 1
  y -= 25;
  page1Lines.push(boldTextLine(50, y, 'PLAN OVERVIEW', 12));
  y -= 20;

  for (const day of planData.days) {
    if (y < 80) break;
    const trainingTag = day.isTrainingDay ? ' [Training Day]' : ' [Rest Day]';
    page1Lines.push(
      boldTextLine(60, y, `${day.dayName}${trainingTag} - ${day.targetKcal} kcal`, 10)
    );
    y -= 14;
    for (const meal of day.meals) {
      if (y < 80) break;
      page1Lines.push(
        textLine(
          80,
          y,
          `${meal.slot}: ${meal.name} (${meal.nutrition.kcal} kcal, P:${meal.nutrition.proteinG}g C:${meal.nutrition.carbsG}g F:${meal.nutrition.fatG}g)`,
          8
        )
      );
      y -= 12;
    }
    y -= 6;
  }

  pages.push(page1Lines);

  // === PAGE 2+: Detailed day pages ===
  for (const day of planData.days) {
    const pageLines: string[] = [];
    let py = 750;

    const trainingTag = day.isTrainingDay ? ' [TRAINING DAY]' : ' [REST DAY]';
    pageLines.push(boldTextLine(50, py, `${day.dayName.toUpperCase()}${trainingTag}`, 16));
    py -= 20;
    pageLines.push(textLine(50, py, `Target: ${day.targetKcal} kcal`, 10));
    py -= 25;

    for (const meal of day.meals) {
      if (py < 100) break;
      pageLines.push(boldTextLine(50, py, `${meal.slot}: ${meal.name}`, 11));
      py -= 16;
      pageLines.push(
        textLine(
          60,
          py,
          `Calories: ${meal.nutrition.kcal} | Protein: ${meal.nutrition.proteinG}g | Carbs: ${meal.nutrition.carbsG}g | Fat: ${meal.nutrition.fatG}g${meal.nutrition.fiberG ? ` | Fiber: ${meal.nutrition.fiberG}g` : ''}`,
          9
        )
      );
      py -= 14;

      if (meal.ingredients && meal.ingredients.length > 0) {
        pageLines.push(textLine(60, py, 'Ingredients:', 9));
        py -= 12;
        for (const ing of meal.ingredients) {
          if (py < 100) break;
          // Handle both old format (amount as string) and new format (amount + unit)
          let amountText = '';
          if (typeof ing.amount === 'string') {
            amountText = ing.amount;
          } else if (typeof ing.amount === 'number') {
            amountText = `${ing.amount}${ing.unit || ''}`;
          }
          pageLines.push(textLine(70, py, `- ${ing.name}: ${amountText}`, 8));
          py -= 11;
        }
      }

      if (meal.instructions && meal.instructions.length > 0) {
        pageLines.push(textLine(60, py, 'Instructions:', 9));
        py -= 12;
        for (let i = 0; i < meal.instructions.length; i++) {
          if (py < 100) break;
          pageLines.push(textLine(70, py, `${i + 1}. ${meal.instructions[i]}`, 8));
          py -= 11;
        }
      }

      py -= 10;
    }

    pages.push(pageLines);
  }

  // === GROCERY LIST PAGE ===
  if (planData.groceryList && planData.groceryList.length > 0) {
    const groceryPageLines: string[] = [];
    let gy = 750;
    groceryPageLines.push(boldTextLine(50, gy, 'GROCERY LIST', 16));
    gy -= 30;

    for (const category of planData.groceryList) {
      if (gy < 100) break;
      groceryPageLines.push(boldTextLine(50, gy, category.category, 11));
      gy -= 16;
      for (const item of category.items) {
        if (gy < 100) break;
        groceryPageLines.push(textLine(70, gy, `- ${item}`, 9));
        gy -= 13;
      }
      gy -= 8;
    }
    pages.push(groceryPageLines);
  }

  // === BUILD PDF ===
  // PDF objects: 1=catalog, 2=pages, 3+=page objects, font objects, content streams
  const _objects: string[] = [];
  const offsets: number[] = [];
  let currentObj = 0;

  // Pre-calculate object numbers
  const catalogObj = ++currentObj; // 1
  const pagesObj = ++currentObj; // 2
  const fontObj = ++currentObj; // 3  (Helvetica)
  const boldFontObj = ++currentObj; // 4  (Helvetica-Bold)

  // Each page needs: page object + content stream object = 2 objects per page
  const _pageObjStart = currentObj + 1;
  const pageObjIds: number[] = [];
  const contentObjIds: number[] = [];
  for (let i = 0; i < pages.length; i++) {
    pageObjIds.push(++currentObj);
    contentObjIds.push(++currentObj);
  }

  // Now build the PDF
  let pdf = '%PDF-1.4\n';

  // Helper to add an object
  function addObj(id: number, content: string) {
    offsets[id] = Buffer.byteLength(pdf, 'utf-8');
    pdf += `${id} 0 obj\n${content}\nendobj\n`;
  }

  // Catalog
  addObj(catalogObj, `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);

  // Pages
  const kidsList = pageObjIds.map((id) => `${id} 0 R`).join(' ');
  addObj(pagesObj, `<< /Type /Pages /Kids [${kidsList}] /Count ${pages.length} >>`);

  // Fonts
  addObj(
    fontObj,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
  );
  addObj(
    boldFontObj,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
  );

  // Pages and content streams
  for (let i = 0; i < pages.length; i++) {
    const contentStr = pages[i].join('\n');
    const contentLength = Buffer.byteLength(contentStr, 'utf-8');

    // Content stream
    addObj(contentObjIds[i], `<< /Length ${contentLength} >>\nstream\n${contentStr}\nendstream`);

    // Page object
    addObj(
      pageObjIds[i],
      `<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 612 792] /Contents ${contentObjIds[i]} 0 R /Resources << /Font << /F1 ${fontObj} 0 R /F2 ${boldFontObj} 0 R >> >> >>`
    );
  }

  // Cross-reference table
  const xrefOffset = Buffer.byteLength(pdf, 'utf-8');
  const totalObjects = currentObj + 1;
  pdf += `xref\n0 ${totalObjects}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < totalObjects; i++) {
    const off = offsets[i] || 0;
    pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  }

  // Trailer
  pdf += `trailer\n<< /Size ${totalObjects} /Root ${catalogObj} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf-8');
}
