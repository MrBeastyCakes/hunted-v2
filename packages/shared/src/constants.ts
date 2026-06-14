export const TICK_RATE = 20; // simulation ticks per second
export const DT = 1 / TICK_RATE; // seconds per tick

// Default vertical-slice map dimensions (world units).
export const MAP_WIDTH = 100;
export const MAP_HEIGHT = 100;

// Default actor speeds (world units per second).
export const MONSTER_SPEED = 6;
export const HERO_SPEED = 5;

// Default starting health.
export const MONSTER_START_HP = 60;
export const HERO_START_HP = 40;
export const CORE_START_HP = 200;

import type { Combat } from './types';

// --- Day/night survival ---
export const DAY_TICKS = 8000; // ~6.67 min @ 20Hz
export const NIGHT_TICKS = 4000; // ~3.33 min
export const NIGHTS_TO_SURVIVE = 3;

// --- Monster skill tree ---
export const XP_PER_LEVEL_COST = 25; // cost to reach level n is XP_PER_LEVEL_COST * n
export const MONSTER_START_XP = 50; // one free first-level pick on spawn (= levelCost at level 1)
export const SKILL_MAX_RANK = 4;
export const LEVEL_HP_BONUS = 25; // +maxHp (and heal) per level gained
export const LEVEL_DAMAGE_BONUS = 2; // +combat.damage per level gained

// --- Hunting / mobs ---
export const WILDLIFE_HERD_COUNT = 3;
export const MOB_PER_HERD = 5;
export const VILLAGERS_AT_START = 5;
export const MOB_WANDER_SPEED = 2;
export const MOB_FLEE_SPEED = 3.5; // well under monster speed (6) so prey is catchable
export const HERD_WANDER_RADIUS = 14; // animals roam wider
export const SCATTER_RADIUS = 7; // panic later, easier to approach
export const SCATTER_TICKS = 40; // 2s at 20Hz
export const CATCH_RANGE = 2.2; // bigger bite reach
export const MOB_BITE_DAMAGE = 4; // monster damage per tick to a mob in catch range
export const HERD_RESPAWN_TICKS = 100; // every 5s
export const PREY_STATS: Record<
  'critter' | 'medium' | 'large' | 'villager',
  { hp: number; xp: number }
> = {
  critter: { hp: 6, xp: 10 },
  medium: { hp: 16, xp: 20 },
  large: { hp: 30, xp: 40 },
  villager: { hp: 16, xp: 100 },
};
export const LARGE_BITE_BACK = 3; // damage a large creature deals to the monster per hunt tick

// --- Economy ---
export const STARTING_MATERIALS = 60;
export const GENERATOR_RATE = 1; // materials/tick per generator
export const ECONOMY_ROLE_BONUS = 2; // extra materials/tick if an economy hero is alive

// --- Building ---
export const BUILD_COSTS: Record<'generator' | 'tower' | 'workshop' | 'blacksmith', number> = {
  generator: 40,
  tower: 50,
  workshop: 60,
  blacksmith: 60,
};
export const BUILDING_HP: Record<'generator' | 'tower' | 'workshop' | 'blacksmith', number> = {
  generator: 30,
  tower: 40,
  workshop: 30,
  blacksmith: 35,
};
export const BUILDING_CAP: Record<'generator' | 'tower' | 'workshop' | 'blacksmith', number> = {
  generator: 3,
  tower: 6,
  workshop: 1,
  blacksmith: 1,
};
export const MATERIALS_CAP = 400; // shared materials pool is clamped here
export const BUILDER_DISCOUNT = 0.5; // builder role pays this fraction of the cost
export const WORKSHOP_HERO_DAMAGE_BONUS = 3; // added to every hero's attack while a workshop stands
export const TOWER_COMBAT: Combat = {
  damage: 6,
  range: 12,
  cooldown: 15,
  cooldownRemaining: 0,
};

// --- Weapons / equipment ---
export const UNARMED_RANGE = 1.4;
export const UNARMED_DAMAGE = 2;
export const WEAPON_RANGE: Record<'sword' | 'bow', number> = { sword: 1.8, bow: 9 };
export const WEAPON_DAMAGE: Record<'sword' | 'bow', number> = { sword: 8, bow: 4 };
export const CRAFT_COST: Record<'sword' | 'bow', number> = { sword: 30, bow: 45 };
export const PICKUP_RANGE = 1.2;
export const RACK_OFFSET = { x: 3, y: -2 };

// --- Gathering ---
export const GATHER_RANGE = 2.5;
export const GATHER_RATE = 4; // materials/tick per harvesting hero
export const RESOURCE_NODE_AMOUNT = 300;
export const NODE_RESPAWN_TICKS = 300;
export const NODE_RESPAWN_AMOUNT = 100;

// --- Herd roaming ---
export const HERD_MIGRATE_TICKS = 120;
export const HERD_MIGRATE_STEP = 6;

// --- Bots ---
export const MONSTER_ASSAULT_STAGE = 2; // monster feeds until this stage, then assaults the city
export const HERO_AGGRO_RADIUS = 20; // heroes swarm the monster when it gets this close to the core
export const HERO_HOLD_RADIUS = 5; // heroes regroup toward the core when farther than this
