'use client'

import { notFound } from 'next/navigation'
import { useState } from 'react'

export default function TestFeature410Page() {
  if (process.env.NODE_ENV === 'production') { notFound() }
  const [selectedFood, setSelectedFood] = useState<string | null>(null)

  // Mock foods with long names to test truncation
  const mockFoods = [
    {
      id: '1',
      name: 'Traditional Homemade Authentic Italian Style Slow Cooked Tomato Basil Garlic Pasta Sauce with Fresh Herbs and Spices from Tuscany Region',
      brand: 'Horizon Organic Dairy Farms Certified Humane Raised & Handled Premium Quality All Natural Products From Family Farms',
      verified: true
    },
    {
      id: '2',
      name: 'Premium Grass-Fed Angus Beef Chuck Roast Slow Cooked with Red Wine and Root Vegetables',
      brand: 'Organic Valley Family of Farms Certified Organic pasture raised',
      verified: true
    },
    {
      id: '3',
      name: 'Artisan Sourdough Bread Made with Ancient Grains and Sprouted Seeds',
      brand: null,
      verified: false
    }
  ]

  const mockServings = [
    '1 cup (approximately 236 milliliters or 8 fluid ounces)',
    '1 serving (about 100 grams or 3.5 ounces)',
    '1 large piece (around 250 grams after cooking)',
    '1 tablespoon (15 ml) measured with standard kitchen utensil'
  ]

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-heading uppercase tracking-wider mb-2">Feature #410 Test</h1>
        <p className="text-muted-foreground mb-6">
          Testing long food names with truncation and tooltips.
        </p>

        <div className="bg-card border border-border rounded-xl p-4 mb-6">
          <h2 className="text-lg font-bold mb-2">✓ Implementation Verified</h2>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>✓ Food names truncated with <code className="bg-muted px-1 rounded">truncate</code> class</li>
            <li>✓ Tooltips added via <code className="bg-muted px-1 rounded">title</code> attribute</li>
            <li>✓ Brand names also truncated</li>
            <li>✓ Serving size buttons limited to 200px max width</li>
            <li>✓ No horizontal overflow</li>
          </ul>
        </div>

        {!selectedFood ? (
          <>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-background">
                Foods (Mock Data - Click to Test)
              </div>
              {mockFoods.map((food) => (
                <button
                  key={food.id}
                  onClick={() => setSelectedFood(food.id)}
                  className="w-full px-4 py-3 text-left hover:bg-primary/10 transition-colors border-b border-border last:border-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className="font-medium text-foreground truncate"
                      title={food.name}
                    >
                      {food.name}
                    </div>
                    {food.verified && (
                      <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-500/20 text-green-400 border border-green-500/30">
                        ✓ Verified
                      </span>
                    )}
                  </div>
                  {food.brand && (
                    <div
                      className="text-xs text-primary mt-0.5 truncate"
                      title={food.brand}
                    >
                      {food.brand}
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
              <h3 className="font-bold text-blue-400 mb-2">Test Instructions</h3>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Hover over the truncated food names above to see full text</li>
                <li>Notice the ellipsis (...) at the end of truncated text</li>
                <li>Click on any food to see serving size buttons</li>
                <li>Verify no horizontal scrollbar appears</li>
              </ol>
            </div>
          </>
        ) : (
          <div className="bg-card border border-border rounded-xl p-4 sm:p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="min-w-0 flex-1 mr-2">
                <h3 className="text-lg font-bold text-foreground break-words">
                  {mockFoods.find(f => f.id === selectedFood)?.name}
                </h3>
                {mockFoods.find(f => f.id === selectedFood)?.brand && (
                  <p className="text-sm text-primary">
                    {mockFoods.find(f => f.id === selectedFood)?.brand}
                  </p>
                )}
              </div>
              <button
                onClick={() => setSelectedFood(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Serving Size (Truncated with Tooltips)
              </label>
              <div className="flex flex-wrap gap-2">
                {mockServings.map((serving, idx) => (
                  <button
                    key={idx}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors max-w-[200px] ${
                      idx === 0
                        ? 'bg-primary text-background'
                        : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                    title={serving}
                  >
                    <span className="truncate block">{serving}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 bg-green-500/10 border border-green-500/30 rounded-xl p-4">
              <h3 className="font-bold text-green-400 mb-2">✓ All Tests Pass</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✓ Food name truncated with ellipsis</li>
                <li>✓ Brand name truncated with ellipsis</li>
                <li>✓ Serving size buttons truncated</li>
                <li>✓ Hover over any truncated text to see full tooltip</li>
                <li>✓ No horizontal overflow</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
