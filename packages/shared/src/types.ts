import type { Vec2 } from './math';

export type { Vec2 };

export type EntityId = number;
export type RoleType = 'builder' | 'defender' | 'scout' | 'economy';
export type Phase = 'lobby' | 'playing' | 'monsterWon' | 'buildersWon';
export type ActionType = 'attack' | 'feed' | 'build' | 'ability';
export type BuildingType = 'core' | 'generator' | 'tower' | 'workshop';

export interface Health {
  hp: number;
  maxHp: number;
}

export interface Combat {
  damage: number;
  range: number;
  cooldown: number; // ticks between attacks
  cooldownRemaining: number;
}

export interface Evolution {
  xp: number;
  stage: number; // 1..3 in the slice
}

export interface Entity {
  id: EntityId;
  kind: 'monster' | 'hero';
  pos: Vec2;
  speed: number; // world units per second
  health: Health;
  alive: boolean;
  combat?: Combat;
  evolution?: Evolution; // monster only
  role?: RoleType; // hero only
}

export interface ResourceNode {
  id: EntityId;
  pos: Vec2;
  amount: number;
}

export interface MapState {
  width: number;
  height: number;
  wildlifeNodes: ResourceNode[];
  resourceNodes: ResourceNode[];
}

export interface Building {
  id: EntityId;
  type: BuildingType;
  pos: Vec2;
  health: Health;
  level: number;
}

export interface ResourcePool {
  materials: number;
  food: number;
}

export interface GameState {
  tick: number;
  phase: Phase;
  rngSeed: number;
  rngState: number; // advances each RNG draw; lives in state for determinism
  map: MapState;
  monster: Entity;
  heroes: Entity[];
  buildings: Building[];
  resources: ResourcePool;
}

export interface Input {
  actorId: EntityId;
  move: Vec2; // desired direction; not required to be normalized
  action?: ActionType;
  target?: EntityId | Vec2;
}

// Inputs for one tick, keyed by actorId.
export type InputMap = Record<EntityId, Input>;
