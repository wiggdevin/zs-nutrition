import { router } from '../../trpc';
import { planCrudRouter } from './crud';
import { planGenerationRouter } from './generation';

/**
 * Plan Router — merges CRUD and generation sub-routers.
 * All procedures remain at the same path to maintain backward compatibility.
 */
export const planRouter = router({
  // CRUD / queries
  getActivePlan: planCrudRouter.getActivePlan,
  getPlanById: planCrudRouter.getPlanById,
  getJobStatus: planCrudRouter.getJobStatus,

  // Generation / mutations
  generatePlan: planGenerationRouter.generatePlan,
  completeJob: planGenerationRouter.completeJob,
  regeneratePlan: planGenerationRouter.regeneratePlan,
});
