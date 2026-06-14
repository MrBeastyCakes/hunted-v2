import type { Vec2 } from './math';

export type { Vec2 };

export type EntityId = number;
export type RoleType = 'builder' | 'defender' | 'scout' | 'economy';
export type Phase = 'lobby' | 'playing' | 'monsterWon' | 'buildersWon';
export type ActionType = 'attack' | 'build' | 'ability' | 'craft' | 'spend';
export type SkillPath = 'vision' | 'hearing' | 'smell';
export type BuildingType = 'core' | 'generator' | 'tower' | 'workshop' | 'blacksmith';

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
  xp: number; // spendable bank
  level: number; // 1..; rises each rank bought
  skills: { vision: number; hearing: number; smell: number };
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
  equipped?: WeaponType; // heroes; undefined = unarmed
}

export interface ResourceNode {
  id: EntityId;
  pos: Vec2;
  amount: number;
}

export type MobSpecies = 'wildlife' | 'villager';

export type WeaponType = 'sword' | 'bow';

export interface WeaponItem {
  id: EntityId;
  type: WeaponType;
  pos: Vec2;
}

export interface Mob {
  id: EntityId;
  herdId: number;
  species: MobSpecies;
  pos: Vec2;
  state: 'calm' | 'fleeing';
  fleeTicks: number;
  hp: number;
}

export interface Herd {
  id: number;
  species: MobSpecies;
  home: Vec2;
}

export interface MapState {
  width: number;
  height: number;
  resourceNodes: ResourceNode[];
  mobs: Mob[];
  herds: Herd[];
  weapons: WeaponItem[];
}

export interface Building {
  id: EntityId;
  type: BuildingType;
  pos: Vec2;
  health: Health;
  level: number;
  combat?: Combat; // towers have one
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
  buildType?: BuildingType; // used when action === 'build'
  craftType?: WeaponType; // used when action === 'craft'
  skillPath?: SkillPath; // used when action === 'spend'
}

// Inputs for one tick, keyed by actorId.
export type InputMap = Record<EntityId, Input>;
