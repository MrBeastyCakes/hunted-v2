// Pure isometric drawing geometry (screen-space).

export function depthKey(x: number, y: number): number {
  return x + y;
}

// A diamond (rotated square) as a flat [x,y,...] array: top, right, bottom, left.
export function diamondPoints(cx: number, cy: number, hw: number, hh: number): number[] {
  return [cx, cy - hh, cx + hw, cy, cx, cy + hh, cx - hw, cy];
}

export interface IsoBoxFaces {
  top: number[];
  left: number[];
  right: number[];
}

// An isometric box: a top diamond raised by `height`, plus the two camera-facing side faces.
export function isoBoxFaces(
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  height: number,
): IsoBoxFaces {
  const top = [cx, cy - hh - height, cx + hw, cy - height, cx, cy + hh - height, cx - hw, cy - height];
  const left = [cx - hw, cy, cx, cy + hh, cx, cy + hh - height, cx - hw, cy - height];
  const right = [cx + hw, cy, cx, cy + hh, cx, cy + hh - height, cx + hw, cy - height];
  return { top, left, right };
}
