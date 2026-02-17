import type { CompiledDay } from '../../../types/schemas';
import type { Violation } from '../tolerance-checks';

export interface RepairResult {
  adjustedDay: CompiledDay;
  description: string;
}

export interface RepairStrategy {
  name: string;
  attempt(day: CompiledDay, violation: Violation): RepairResult | null;
}
