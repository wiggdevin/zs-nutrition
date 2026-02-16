'use client';

import { useState, useCallback } from 'react';
import { logger } from '@/lib/safe-logger';
import type { GroceryCategory } from './types';
import { formatGroceryAmount, getCategoryIcon } from './utils';

interface GroceryListProps {
  groceryList: GroceryCategory[];
}

export function GroceryList({ groceryList }: GroceryListProps) {
  const [expanded, setExpanded] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const totalItems = groceryList.reduce((sum, cat) => sum + cat.items.length, 0);

  // Format grocery list as plain text for export
  const formatGroceryListText = useCallback(() => {
    const lines: string[] = [];
    lines.push('ZERO SUM NUTRITION - GROCERY LIST');
    lines.push('================================');
    lines.push('');

    for (const cat of groceryList) {
      lines.push(`${cat.category} (${cat.items.length} items)`);
      lines.push('-'.repeat(Math.min(cat.category.length + 15, 40)));
      for (const item of cat.items) {
        const amount = formatGroceryAmount(item.amount, item.unit);
        lines.push(`  • ${item.name} - ${amount}`);
      }
      lines.push('');
    }

    lines.push('================================');
    lines.push(`Total: ${totalItems} items across ${groceryList.length} categories`);

    return lines.join('\n');
  }, [groceryList, totalItems]);

  // Copy grocery list to clipboard
  const handleCopyToClipboard = useCallback(async () => {
    try {
      const text = formatGroceryListText();
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      logger.error('Failed to copy to clipboard:', err);
    }
  }, [formatGroceryListText]);

  // Download grocery list as text file
  const handleDownloadText = useCallback(() => {
    const text = formatGroceryListText();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grocery-list-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [formatGroceryListText]);

  return (
    <div className="mx-auto max-w-[1600px] pb-8" data-testid="grocery-list-section">
      {/* Section header */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between px-5 py-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-3 flex-1"
            data-testid="grocery-list-toggle"
          >
            <span className="text-xl">🛒</span>
            <div className="text-left">
              <h2 className="text-lg font-bold uppercase tracking-wider text-foreground">
                Grocery List
              </h2>
              <p className="text-xs text-muted-foreground">
                {totalItems} items across {groceryList.length} categories
              </p>
            </div>
          </button>

          {/* Export buttons - shown on right side */}
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={handleCopyToClipboard}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
              data-testid="grocery-copy-button"
              aria-label="Copy grocery list to clipboard"
              title="Copy to clipboard"
            >
              {copySuccess ? (
                <>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M20 6L9 17L4 12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect
                      x="9"
                      y="9"
                      width="13"
                      height="13"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <path
                      d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>
                  Copy
                </>
              )}
            </button>
            <button
              onClick={handleDownloadText}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
              data-testid="grocery-download-button"
              aria-label="Download grocery list as text file"
              title="Download as text"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M7 10L12 15L17 10"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 15V3"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Download
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="ml-2 flex-shrink-0"
              data-testid="grocery-list-expand-toggle"
              aria-label={expanded ? 'Collapse grocery list' : 'Expand grocery list'}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                className={`text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
              >
                <path
                  d="M6 9L12 15L18 9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Category grid */}
      {expanded && (
        <div
          className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          data-testid="grocery-list-categories"
        >
          {groceryList.map((cat) => (
            <div
              key={cat.category}
              className="rounded-lg border border-border bg-card overflow-hidden"
              data-testid={`grocery-category-${cat.category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
            >
              {/* Category header */}
              <div className="border-b border-border bg-card px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">{getCategoryIcon(cat.category)}</span>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                    {cat.category}
                  </h3>
                  <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {cat.items.length}
                  </span>
                </div>
              </div>

              {/* Items */}
              <div className="divide-y divide-border">
                {cat.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-secondary"
                    data-testid={`grocery-item-${(item.name || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                  >
                    <span
                      className="text-sm text-foreground break-words"
                      title={item.name || 'Unknown Item'}
                    >
                      {item.name || 'Unknown Item'}
                    </span>
                    <span
                      className="ml-3 flex-shrink-0 whitespace-nowrap rounded bg-border px-2 py-0.5 font-mono text-xs font-bold text-muted-foreground"
                      data-testid={`grocery-amount-${(item.name || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                    >
                      {formatGroceryAmount(item.amount, item.unit)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
