import type { KeyMap } from '../control';

export function emptyKeyMap(): KeyMap {
  return { up: false, down: false, left: false, right: false, build: false };
}

const CODE_TO_FIELD: Record<string, keyof KeyMap | undefined> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  KeyB: 'build',
};

// Maps a KeyboardEvent.code to a KeyMap field; returns a NEW map (pure).
export function applyKey(map: KeyMap, code: string, pressed: boolean): KeyMap {
  const field = CODE_TO_FIELD[code];
  if (!field) return map;
  return { ...map, [field]: pressed };
}

// IMPURE: attaches window listeners and tracks the live key map.
// Not unit-tested (DOM glue); covered by build + manual run.
export class Keyboard {
  private map: KeyMap = emptyKeyMap();
  private readonly onDown = (e: KeyboardEvent) => {
    if (e.code in CODE_TO_FIELD) e.preventDefault();
    this.map = applyKey(this.map, e.code, true);
  };
  private readonly onUp = (e: KeyboardEvent) => {
    this.map = applyKey(this.map, e.code, false);
  };

  attach(target: Window = window): void {
    target.addEventListener('keydown', this.onDown);
    target.addEventListener('keyup', this.onUp);
  }

  detach(target: Window = window): void {
    target.removeEventListener('keydown', this.onDown);
    target.removeEventListener('keyup', this.onUp);
  }

  state(): KeyMap {
    return this.map;
  }
}
