import { BUILD_COSTS, BUILDER_DISCOUNT, BUILDING_HP, TOWER_COMBAT } from '../constants';
import type { Building, BuildingType, GameState, InputMap, Vec2 } from '../types';

type BuildableType = 'generator' | 'tower' | 'workshop';

function isBuildable(type: BuildingType): type is BuildableType {
  return type === 'generator' || type === 'tower' || type === 'workshop';
}

function isVec2(t: unknown): t is Vec2 {
  return typeof t === 'object' && t !== null && 'x' in t && 'y' in t;
}

function maxId(state: GameState): number {
  let max = state.monster.id;
  for (const h of state.heroes) max = Math.max(max, h.id);
  for (const b of state.buildings) max = Math.max(max, b.id);
  for (const n of state.map.wildlifeNodes) max = Math.max(max, n.id);
  for (const n of state.map.resourceNodes) max = Math.max(max, n.id);
  return max;
}

// Heroes with the 'build' action spend shared materials to place structures.
export function buildingSystem(state: GameState, inputs: InputMap): void {
  let nextId = maxId(state) + 1;
  for (const hero of state.heroes) {
    if (!hero.alive) continue;
    const input = inputs[hero.id];
    if (!input || input.action !== 'build' || !input.buildType) continue;
    if (!isBuildable(input.buildType)) continue;

    const type = input.buildType;
    const base = BUILD_COSTS[type];
    const cost = hero.role === 'builder' ? Math.floor(base * BUILDER_DISCOUNT) : base;
    if (state.resources.materials < cost) continue;

    state.resources.materials -= cost;
    const pos = isVec2(input.target) ? { x: input.target.x, y: input.target.y } : { ...hero.pos };
    const building: Building = {
      id: nextId++,
      type,
      pos,
      health: { hp: BUILDING_HP[type], maxHp: BUILDING_HP[type] },
      level: 1,
    };
    if (type === 'tower') building.combat = { ...TOWER_COMBAT };
    state.buildings.push(building);
  }
}
