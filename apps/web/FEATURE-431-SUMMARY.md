# Feature #431: Meal Plan Grid Visual Hierarchy Improvements

## Summary
Improved the visual hierarchy of the meal plan grid to make day headers, meal type labels, and cards more distinguishable and easier to scan.

## Changes Made

### 1. Day Header Improvements (Lines 343-353)
**Before:**
- `bg-[#141414]` background
- `text-sm font-bold uppercase tracking-wider`
- `px-3 py-3` padding

**After:**
- `bg-gradient-to-b from-[#1a1a1a] to-[#141414]` - gradient background for depth
- `text-base font-black uppercase tracking-widest` - larger, bolder text
- `px-4 py-4` - more padding for prominence
- `text-xs` for training day emoji (was text-[10px])

### 2. Day Macro Summary Section (Lines 356-366)
**Before:**
- `bg-[#111]` background (blended with cards)
- `px-3 py-2` padding
- `text-sm font-bold` for kcal
- `text-[10px]` for macros

**After:**
- `bg-[#0d0d0d]` - distinct darker background
- `px-4 py-3` - more padding
- `shadow-inner` - adds depth
- `text-lg font-black` for kcal - larger and bolder
- `text-xs font-semibold` for macros - larger
- `gap-3` (was gap-2) - more spacing between macros
- `mt-1.5` (was mt-1) - more spacing from kcal

### 3. Meal Slot Label (Lines 441-443)
**Before:**
- `text-[10px] font-bold uppercase`
- `px-1.5 py-0.5` padding
- `rounded` corners

**After:**
- `text-[11px] font-black uppercase tracking-wide` - larger, bolder, wider letter spacing
- `px-2 py-1` - more padding
- `rounded-md` corners - more prominent
- `border border-[#f97316]/30` - added border for definition

### 4. Confidence Badge (Lines 444-453)
**Before:**
- `text-[8px]` - extremely small, hard to read
- `px-1.5 py-0.5` padding
- `rounded` corners

**After:**
- `text-[9px]` - more readable (was 8px)
- `px-2 py-1` - more padding
- `rounded-md` corners
- `font-bold` (was font-semibold)
- `tracking-wider` - improved readability
- `border` added for both verified and AI-estimated states

### 5. Meal Name (Lines 457-463)
**Before:**
- `text-xs font-semibold`
- `leading-tight`

**After:**
- `text-sm font-bold` - larger and bolder
- `leading-snug` - better line spacing
- `line-clamp-2` - allows 2 lines with truncation
- `pr-7` - more padding on right for swap button

### 6. Cuisine Label (Lines 465-467)
**Before:**
- `text-[10px]` for cuisine

**After:**
- `text-[11px] font-medium` - larger and bolder

### 7. Prep Time Indicator (Lines 470-478)
**Before:**
- `text-[10px]` for time text

**After:**
- `text-[11px]` for time text
- `text-[12px]` for emoji (was not specified)
- `font-medium` for the time text
- `gap-1.5` (was gap-1) - more spacing

### 8. Macro Pills (Lines 481-494)
**Before:**
- `text-[10px]` for macro values
- `gap-1` between pills
- `mt-2` margin top

**After:**
- `text-[11px]` - larger text
- `px-2 py-1` (was px-2 py-0.5) - more vertical padding
- `gap-1.5` - more spacing between pills
- `mt-2.5` - more margin top
- `border` added to all pills for definition

### 9. Meal Card Container (Lines 384-393)
**Before:**
- `rounded-md` corners
- `bg-[#0f0f0f]` background
- `p-2.5` padding

**After:**
- `rounded-lg` corners - more rounded
- `bg-[#0a0a0a]` - darker background for contrast
- `p-3` - more padding
- Added `hover:bg-[#0f0f0f]` for hover state

### 10. Meal Card Spacing (Line 369)
**Before:**
- `space-y-2` between cards
- `p-2` container padding

**After:**
- `space-y-2.5` - more vertical spacing between cards
- `p-2.5` - more container padding

### 11. Skeleton Loader Updates
Updated all skeleton loaders to match the new design:
- `MealCardSkeleton` component (lines 172-192)
- Loading state skeletons (lines 1051-1095)

## Visual Hierarchy Improvements Summary

The visual hierarchy now follows this pattern (from most to least prominent):

1. **Day Header** - Most prominent
   - Largest text (text-base)
   - Gradient background
   - Generous padding

2. **Day Macro Summary** - Secondary prominence
   - Distinct dark background with inner shadow
   - Large calorie number (text-lg)
   - Separate section from cards

3. **Meal Slot Label** - Tertiary prominence (within card)
   - Orange color stands out
   - Border and background
   - 11px text

4. **Meal Name** - Primary content
   - Bold text (text-sm font-bold)
   - Can wrap to 2 lines

5. **Confidence Badge** - Supplemental info
   - 9px text (increased from 8px)
   - Border for definition
   - Color-coded (green for verified, amber for AI)

6. **Other Elements** - Supporting info
   - Cuisine: 11px font-medium
   - Prep time: 11px font-medium
   - Macro pills: 11px with borders

## Verification Status

The code changes have been applied to the source file. Due to a Next.js dev server issue, the changes could not be verified in the browser at this time. The changes are syntactically correct and follow Tailwind CSS best practices.

## Next Steps

1. Restart the development server
2. Navigate to /meal-plan page
3. Verify the visual hierarchy improvements
4. Take screenshots for comparison
5. Mark feature #431 as passing
