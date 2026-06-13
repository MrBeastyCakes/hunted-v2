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

// --- Feeding ---
export const FEED_RANGE = 4; // world units
export const FEED_RATE = 5; // node amount drained per tick
export const XP_PER_AMOUNT = 1; // monster XP per amount drained

// --- Evolution ---
export const STAGE2_XP = 100;
export const STAGE3_XP = 250;
export const STAGE3_CITY_DAMAGE_REQ = 50; // must have damaged the city this much to reach stage 3
export const STAGE_HP_BONUS = 40; // +maxHp (and heal) per stage gained
export const STAGE_DAMAGE_BONUS = 4; // +combat.damage per stage gained

// --- Combat ---
export const CITY_DAMAGE_XP = 2; // monster XP per point of building damage dealt

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
