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
  resource: 0x2f81f7,
  hpBack: 0x30363d,
  hpFill: 0x3fb950,
} as const;

// Default structure built when the build key is pressed (richer menu deferred).
export const DEFAULT_BUILD = 'tower' as const;
