import {
  CORE_START_HP,
  HERO_SPEED,
  HERO_START_HP,
  MAP_HEIGHT,
  MAP_WIDTH,
  MONSTER_SPEED,
  MONSTER_START_HP,
  STARTING_MATERIALS,
} from './constants';
import type {
  Building,
  Entity,
  GameState,
  ResourceNode,
  RoleType,
} from './types';

const ROLES: RoleType[] = ['builder', 'defender', 'scout', 'economy'];

export function createInitialState(seed: number): GameState {
  let nextId = 1;
  const id = () => nextId++;

  const center = { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };

  const monster: Entity = {
    id: id(),
    kind: 'monster',
    pos: { x: 5, y: 5 }, // starts in a corner, away from the city
    speed: MONSTER_SPEED,
    health: { hp: MONSTER_START_HP, maxHp: MONSTER_START_HP },
    alive: true,
    evolution: { xp: 0, stage: 1, cityDamageDealt: 0 },
    combat: { damage: 5, range: 2, cooldown: 10, cooldownRemaining: 0 },
  };

  const heroes: Entity[] = ROLES.map((role, i) => ({
    id: id(),
    kind: 'hero',
    pos: { x: center.x + (i - 1.5) * 3, y: center.y + 4 },
    speed: HERO_SPEED,
    health: { hp: HERO_START_HP, maxHp: HERO_START_HP },
    alive: true,
    role,
    combat: { damage: 4, range: 3, cooldown: 12, cooldownRemaining: 0 },
  }));

  const buildings: Building[] = [
    {
      id: id(),
      type: 'core',
      pos: { ...center },
      health: { hp: CORE_START_HP, maxHp: CORE_START_HP },
      level: 1,
    },
  ];

  const wildlifeNodes: ResourceNode[] = [
    { id: id(), pos: { x: 15, y: 15 }, amount: 100 },
    { id: id(), pos: { x: 85, y: 20 }, amount: 100 },
    { id: id(), pos: { x: 20, y: 80 }, amount: 100 },
    { id: id(), pos: { x: 80, y: 85 }, amount: 100 },
  ];

  const resourceNodes: ResourceNode[] = [
    { id: id(), pos: { x: 40, y: 30 }, amount: 100 },
    { id: id(), pos: { x: 60, y: 30 }, amount: 100 },
    { id: id(), pos: { x: 50, y: 70 }, amount: 100 },
  ];

  return {
    tick: 0,
    phase: 'playing',
    rngSeed: seed,
    rngState: seed,
    map: { width: MAP_WIDTH, height: MAP_HEIGHT, wildlifeNodes, resourceNodes },
    monster,
    heroes,
    buildings,
    resources: { materials: STARTING_MATERIALS, food: 0 },
  };
}
