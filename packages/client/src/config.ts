// Isometric tile size (2:1) and placeholder palette.
export const TILE_W = 32;
export const TILE_H = 16;

export const COLORS = {
  background: 0x11151c,
  ground: 0x1b2430,
  grid: 0x263041,
  monster: 0xff4d4d,
  hero: 0x4da3ff,
  heroControlled: 0x7ee787,
  core: 0xffd24d,
  tower: 0xb392f0,
  generator: 0x39c5cf,
  workshop: 0xf0883e,
  wildlife: 0x57ab5a,
  villager: 0xf2b66d,
  mobFlee: 0xffe08a,
  resource: 0x2f81f7,
  hpBack: 0x30363d,
  hpFill: 0x3fb950,
} as const;

// Default structure built when the build key is pressed (richer menu deferred).
export const DEFAULT_BUILD = 'tower' as const;

// Pointer-control tuning.
export const PICK_RADIUS = 3.5; // world units: how close a tap must be to grab a target
export const MOVE_ARRIVAL_EPS = 0.6; // stop moving when within this distance of the target

// Double-tap detection (for placing build ghosts).
export const DOUBLE_TAP_MS = 300; // max gap between taps
export const DOUBLE_TAP_DIST = 30; // max screen-pixel movement between taps
