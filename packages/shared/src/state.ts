import {
  CORE_START_HP,
  HERO_SPEED,
  HERO_START_HP,
  MAP_HEIGHT,
  MAP_WIDTH,
  MOB_PER_HERD,
  MONSTER_SPEED,
  MONSTER_START_HP,
  STARTING_MATERIALS,
  VILLAGERS_AT_START,
  WILDLIFE_HERD_COUNT,
} from './constants';
import type {
  Building,
  Entity,
  GameState,
  Herd,
  Mob,
  MobSpecies,
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

  const resourceNodes: ResourceNode[] = [
    { id: id(), pos: { x: 40, y: 30 }, amount: 100 },
    { id: id(), pos: { x: 60, y: 30 }, amount: 100 },
    { id: id(), pos: { x: 50, y: 70 }, amount: 100 },
  ];

  const herds: Herd[] = [];
  const mobs: Mob[] = [];
  const spawnHerd = (species: MobSpecies, home: { x: number; y: number }, size: number) => {
    const herdId = id();
    herds.push({ id: herdId, species, home: { ...home } });
    for (let i = 0; i < size; i++) {
      const ang = (i / size) * Math.PI * 2;
      mobs.push({
        id: id(),
        herdId,
        species,
        pos: { x: home.x + Math.cos(ang) * 2, y: home.y + Math.sin(ang) * 2 },
        state: 'calm',
        fleeTicks: 0,
      });
    }
  };

  const wildlifeHomes = [
    { x: 18, y: 18 },
    { x: 82, y: 22 },
    { x: 50, y: 80 },
  ];
  for (let i = 0; i < WILDLIFE_HERD_COUNT; i++) {
    spawnHerd('wildlife', wildlifeHomes[i % wildlifeHomes.length], MOB_PER_HERD);
  }
  spawnHerd('villager', center, VILLAGERS_AT_START);

  return {
    tick: 0,
    phase: 'playing',
    rngSeed: seed,
    rngState: seed,
    map: { width: MAP_WIDTH, height: MAP_HEIGHT, resourceNodes, mobs, herds },
    monster,
    heroes,
    buildings,
    resources: { materials: STARTING_MATERIALS, food: 0 },
  };
}
