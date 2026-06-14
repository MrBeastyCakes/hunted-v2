export interface ForestProp {
  x: number;
  y: number;
  kind: 'tree' | 'bush' | 'rock';
}

export interface Exclude {
  x: number;
  y: number;
  r: number;
}

// Deterministic scattered forest props, avoiding an excluded circle (the city).
export function generateForest(
  seed: number,
  width: number,
  height: number,
  count: number,
  exclude: Exclude,
): ForestProp[] {
  let s = seed >>> 0;
  const rnd = () => {
    let t = (s = (s + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const props: ForestProp[] = [];
  let attempts = 0;
  while (props.length < count && attempts < count * 6) {
    attempts += 1;
    const x = rnd() * width;
    const y = rnd() * height;
    if (Math.hypot(x - exclude.x, y - exclude.y) < exclude.r) continue;
    const r = rnd();
    const kind: ForestProp['kind'] = r < 0.62 ? 'tree' : r < 0.85 ? 'bush' : 'rock';
    props.push({ x, y, kind });
  }
  return props;
}
