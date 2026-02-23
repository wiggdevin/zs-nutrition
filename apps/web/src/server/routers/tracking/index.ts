/**
 * Tracking Router — handles daily summary, tracked meals queries, and macro tracking.
 *
 * All dates are handled as local calendar days (midnight to midnight in user's timezone).
 * This ensures meals logged at 11:30 PM are assigned to the correct day.
 */
import { router } from '../../trpc';
import { dailyProcedures } from './daily';
import { trendsProcedures } from './trends';
import { waterProcedures } from './water';

export const trackingRouter = router({
  ...dailyProcedures,
  ...trendsProcedures,
  ...waterProcedures,
});
