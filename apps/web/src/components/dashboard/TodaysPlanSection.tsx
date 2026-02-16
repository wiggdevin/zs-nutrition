import Link from 'next/link';
import { PlanMealCard } from './PlanMealCard';
import type { PlanMeal } from './types';

interface TodaysPlanSectionProps {
  todayPlanMeals: PlanMeal[];
  loggedSlots: Set<string | null | undefined>;
  loggingSlot: string | null;
  onLogMeal: (meal: PlanMeal) => void;
}

export function TodaysPlanSection({
  todayPlanMeals,
  loggedSlots,
  loggingSlot,
  onLogMeal,
}: TodaysPlanSectionProps) {
  return (
    <section
      id="todays-plan"
      data-testid="todays-plan-section"
      className="bg-card border border-border rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground">
          {"/// Today's Plan"}
        </p>
        <Link
          href="/meal-plan"
          className="text-xs text-primary hover:text-primary/90 font-semibold uppercase tracking-wide transition-colors py-4 px-2 -mx-2 inline-block"
        >
          View Full Plan →
        </Link>
      </div>
      {todayPlanMeals.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground text-sm">No meal plan for today.</p>
          <Link
            href="/generate"
            className="text-primary text-sm mt-2 inline-block hover:underline py-4 px-2 -mx-2"
          >
            Generate a plan →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {todayPlanMeals.map((meal) => (
            <PlanMealCard
              key={meal.slot}
              mealSlot={meal.slot.charAt(0).toUpperCase() + meal.slot.slice(1)}
              name={meal.name}
              calories={meal.calories}
              protein={meal.protein}
              carbs={meal.carbs}
              fat={meal.fat}
              prepTime={meal.prepTime}
              isLogged={loggedSlots.has(meal.slot.toLowerCase())}
              isLogging={loggingSlot === meal.slot}
              onLog={() => onLogMeal(meal)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
