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

// --- Evolution (5 levels; xp required to be AT each stage, index 0 = stage 1) ---
export const MONSTER_STAGE_XP = [0, 100, 300, 800, 1800];
export const STAGE_HP_BONUS = 40; // +maxHp (and heal) per stage gained
export const STAGE_DAMAGE_BONUS = 4; // +combat.damage per stage gained

// --- Combat ---
export const CITY_DAMAGE_XP = 3; // monster XP per point of building damage dealt

// --- Hunting / mobs ---
export const WILDLIFE_HERD_COUNT = 3;
export const MOB_PER_HERD = 5;
export const VILLAGERS_AT_START = 5;
export const MOB_WANDER_SPEED = 2;
export const MOB_FLEE_SPEED = 5.5; // just under monster speed (6)
export const HERD_WANDER_RADIUS = 6;
export const SCATTER_RADIUS = 10;
export const SCATTER_TICKS = 40; // 2s at 20Hz
export const CATCH_RANGE = 1.5;
export const HERD_RESPAWN_TICKS = 100; // every 5s
export const WILDLIFE_XP = 25;
export const VILLAGER_XP = 120;

// --- Economy ---
export const STARTING_MATERIALS = 60;
export const GENERATOR_RATE = 1; // materials/tick per generator
export const ECONOMY_ROLE_BONUS = 2; // extra materials/tick if an economy hero is alive

// --- Building ---
export const BUILD_COSTS: Record<'generator' | 'tower' | 'workshop', number> = {
  generator: 40,
  tower: 50,
  workshop: 60,
};
export const BUILDING_HP: Record<'generator' | 'tower' | 'workshop', number> = {
  generator: 30,
  tower: 40,
  workshop: 30,
};
export const BUILDER_DISCOUNT = 0.5; // builder role pays this fraction of the cost
export const WORKSHOP_HERO_DAMAGE_BONUS = 3; // added to every hero's attack while a workshop stands
export const TOWER_COMBAT: Combat = {
  damage: 6,
  range: 12,
  cooldown: 15,
  cooldownRemaining: 0,
};

// --- Bots ---
export const MONSTER_ASSAULT_STAGE = 2; // monster feeds until this stage, then assaults the city
export const HERO_AGGRO_RADIUS = 20; // heroes swarm the monster when it gets this close to the core
export const HERO_HOLD_RADIUS = 5; // heroes regroup toward the core when farther than this
