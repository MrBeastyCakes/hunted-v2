export interface VisionParams {
  fogRadius: number | null; // clear-bubble radius in screen px; null = no fog (full clear)
  blur: number; // pixi blur strength (0 = none)
  zoom: number; // world tile scale (<1 = see more)
}

export function visionParams(rank: number): VisionParams {
  switch (rank) {
    case 0:
      return { fogRadius: 90, blur: 6, zoom: 1 };
    case 1:
      return { fogRadius: 170, blur: 3, zoom: 1 };
    case 2:
      return { fogRadius: null, blur: 0, zoom: 1 };
    case 3:
      return { fogRadius: null, blur: 0, zoom: 0.8 };
    default:
      return { fogRadius: null, blur: 0, zoom: 0.62 };
  }
}
