import { BUILD_COSTS, BUILDER_DISCOUNT } from './constants';
import type { RoleType } from './types';

export type BuildableType = 'generator' | 'tower' | 'workshop';

// Material cost of a blueprint for a given role (builder gets a discount).
export function buildCost(role: RoleType | undefined, type: BuildableType): number {
  const base = BUILD_COSTS[type];
  return role === 'builder' ? Math.floor(base * BUILDER_DISCOUNT) : base;
}
