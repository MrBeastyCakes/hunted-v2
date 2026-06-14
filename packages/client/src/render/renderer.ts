import { Application, Container, Graphics, Text } from 'pixi.js';
import type { Building, Entity, GameState, Vec2 } from '@game/shared';
import { COLORS, TILE_H, TILE_W } from '../config';
import { worldToScreen, type ScreenPoint } from './iso';
import { lerpVec } from './interpolate';

const BUILDING_COLOR: Record<Building['type'], number> = {
  core: COLORS.core,
  tower: COLORS.tower,
  generator: COLORS.generator,
  workshop: COLORS.workshop,
  blacksmith: COLORS.blacksmith,
};

// Draws GameState each frame using immediate-mode Graphics. Few entities -> redraw is cheap.
export class GameRenderer {
  private readonly world = new Container();
  private readonly g = new Graphics();
  private readonly hud: Text;
  private readonly banner: Text;
  private readonly campfireLabel: Text;
  private cameraTargetId: number;
  private lastOrigin: ScreenPoint = { x: 0, y: 0 };
  private ghost?: { pos: Vec2; type: Building['type'] };

  constructor(
    private readonly app: Application,
    private readonly controlledId: number,
  ) {
    this.cameraTargetId = controlledId;
    this.world.addChild(this.g);
    this.app.stage.addChild(this.world);

    this.hud = new Text({ text: '', style: { fill: 0xe6edf3, fontSize: 14 } });
    this.hud.position.set(12, 12);
    this.app.stage.addChild(this.hud);

    this.banner = new Text({ text: '', style: { fill: 0xffffff, fontSize: 40, fontWeight: 'bold' } });
    this.banner.anchor.set(0.5);
    this.app.stage.addChild(this.banner);

    this.campfireLabel = new Text({ text: 'Campfire', style: { fill: 0xffd24d, fontSize: 12 } });
    this.campfireLabel.anchor.set(0.5, 1);
    this.app.stage.addChild(this.campfireLabel);
  }

  setCameraTarget(id: number): void {
    this.cameraTargetId = id;
  }

  cameraOrigin(): ScreenPoint {
    return this.lastOrigin;
  }

  setGhost(pos: Vec2 | undefined, type?: Building['type']): void {
    this.ghost = pos && type ? { pos, type } : undefined;
  }

  // prev/curr are consecutive sim states; alpha is 0..1 progress between them.
  render(prev: GameState, curr: GameState, alpha: number): void {
    const g = this.g;
    g.clear();

    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;

    // Camera: center the controlled actor (use its interpolated position).
    const controlledPos = this.interpPos(prev, curr, this.cameraTargetId, alpha) ?? curr.monster.pos;
    const camIso = worldToScreen(controlledPos, TILE_W, TILE_H, { x: 0, y: 0 });
    const origin: ScreenPoint = { x: screenW / 2 - camIso.x, y: screenH / 2 - camIso.y };
    this.lastOrigin = origin;

    const project = (p: Vec2) => worldToScreen(p, TILE_W, TILE_H, origin);

    // Ground diamond (map bounds corners).
    const c0 = project({ x: 0, y: 0 });
    const c1 = project({ x: curr.map.width, y: 0 });
    const c2 = project({ x: curr.map.width, y: curr.map.height });
    const c3 = project({ x: 0, y: curr.map.height });
    g.poly([c0.x, c0.y, c1.x, c1.y, c2.x, c2.y, c3.x, c3.y]).fill(COLORS.ground);

    // Resource + wildlife nodes.
    for (const n of curr.map.resourceNodes) this.dot(project(n.pos), 5, COLORS.resource);
    for (const mob of curr.map.mobs) {
      const color =
        mob.state === 'fleeing'
          ? COLORS.mobFlee
          : mob.species === 'villager'
            ? COLORS.villager
            : COLORS.wildlife;
      this.dot(project(mob.pos), mob.species === 'villager' ? 4 : 3, color);
    }

    // Buildings.
    for (const b of curr.buildings) {
      const p = project(b.pos);
      const size = b.type === 'core' ? 16 : 11;
      g.rect(p.x - size / 2, p.y - size, size, size).fill(BUILDING_COLOR[b.type]);
      this.hpBar(p.x, p.y - size - 6, b.health.hp / b.health.maxHp);
    }

    // Translucent build ghost during placement.
    if (this.ghost) {
      const gp = project(this.ghost.pos);
      const size = 11;
      this.g
        .rect(gp.x - size / 2, gp.y - size, size, size)
        .fill({ color: BUILDING_COLOR[this.ghost.type], alpha: 0.45 });
    }

    // "Campfire" label on the core (its level-1 name).
    const core = curr.buildings.find((b) => b.type === 'core');
    if (core) {
      const cp = project(core.pos);
      this.campfireLabel.position.set(cp.x, cp.y - 22);
      this.campfireLabel.visible = true;
    } else {
      this.campfireLabel.visible = false;
    }

    // Heroes.
    for (const h of curr.heroes) {
      if (!h.alive) continue;
      const p = project(this.interpEntity(prev, curr, h, alpha));
      const color = h.id === this.controlledId ? COLORS.heroControlled : COLORS.hero;
      this.dot(p, 7, color);
      this.hpBar(p.x, p.y - 14, h.health.hp / h.health.maxHp);
    }

    // Monster.
    if (curr.monster.alive) {
      const p = project(this.interpEntity(prev, curr, curr.monster, alpha));
      const radius = 8 + (curr.monster.evolution?.stage ?? 1) * 2;
      this.dot(p, radius, COLORS.monster);
      this.hpBar(p.x, p.y - radius - 6, curr.monster.health.hp / curr.monster.health.maxHp);
    }

    // HUD.
    const m = curr.monster;
    const me = findEntity(curr, this.controlledId);
    const spectating = me ? !me.alive : false;
    this.hud.text =
      `materials: ${Math.floor(curr.resources.materials)}\n` +
      `monster: L${m.evolution?.stage ?? 1}/5  hp ${Math.ceil(m.health.hp)}/${m.health.maxHp}  xp ${Math.floor(m.evolution?.xp ?? 0)}\n` +
      `tick: ${curr.tick}` +
      (spectating ? `\nSPECTATING — Tab/Space to cycle` : '');

    // Banner on game end.
    this.banner.position.set(screenW / 2, screenH / 2);
    if (curr.phase === 'monsterWon') this.banner.text = 'MONSTER WINS';
    else if (curr.phase === 'buildersWon') this.banner.text = 'BUILDERS WIN';
    else this.banner.text = '';
  }

  private dot(p: ScreenPoint, r: number, color: number): void {
    this.g.circle(p.x, p.y, r).fill(color);
  }

  private hpBar(cx: number, top: number, frac: number): void {
    const w = 20;
    const clamped = Math.max(0, Math.min(1, frac));
    this.g.rect(cx - w / 2, top, w, 3).fill(COLORS.hpBack);
    this.g.rect(cx - w / 2, top, w * clamped, 3).fill(COLORS.hpFill);
  }

  private interpEntity(prev: GameState, curr: GameState, entity: Entity, alpha: number): Vec2 {
    return this.interpPos(prev, curr, entity.id, alpha) ?? entity.pos;
  }

  private interpPos(prev: GameState, curr: GameState, id: number, alpha: number): Vec2 | undefined {
    const cur = findEntity(curr, id);
    if (!cur) return undefined;
    const old = findEntity(prev, id);
    return old ? lerpVec(old.pos, cur.pos, alpha) : cur.pos;
  }
}

function findEntity(state: GameState, id: number): Entity | undefined {
  if (state.monster.id === id) return state.monster;
  return state.heroes.find((h) => h.id === id);
}
