import { Application } from 'pixi.js';
import {
  botThink,
  buildCost,
  CRAFT_COST,
  createInitialState,
  step,
  type BuildingType,
  type GameState,
  type InputMap,
  type WeaponType,
} from '@game/shared';
import {
  COLORS,
  DEFAULT_BUILD,
  DOUBLE_TAP_DIST,
  DOUBLE_TAP_MS,
  MOVE_ARRIVAL_EPS,
  PICK_RADIUS,
  TILE_H,
  TILE_W,
} from './config';
import { TICK_MS, renderAlpha, stepsToRun } from './loop';
import { actorIdForSide, inputFromKeys, type Side } from './control';
import { Keyboard } from './input/keyboard';
import { GameRenderer } from './render/renderer';
import { screenToWorld } from './render/iso';
import {
  applyIntent,
  controlToInput,
  findActor,
  pickTarget,
  resolveTapIntent,
  type PointerControl,
} from './pointer';
import {
  BLUEPRINTS,
  buildFlowReducer,
  canAfford,
  isDoubleTap,
  placingTapAction,
  type BuildFlow,
} from './buildFlow';
import { setPlacingHint, showBuildMenu, showCraftMenu } from './buildMenu';
import { isActorAlive, nextSpectateTarget, spectatableIds } from './spectate';

async function startGame(side: Side): Promise<void> {
  const menu = document.getElementById('menu');
  if (menu) menu.style.display = 'none';

  const app = new Application();
  await app.init({
    background: COLORS.background,
    resizeTo: window,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  document.getElementById('app')!.appendChild(app.canvas);

  let prev: GameState = createInitialState(Date.now() % 1_000_000);
  let curr: GameState = prev;
  const controlledId = actorIdForSide(curr, side) ?? curr.monster.id;

  const keyboard = new Keyboard();
  keyboard.attach();

  const renderer = new GameRenderer(app, controlledId);

  let spectating = false;
  let cameraTargetId = controlledId;
  let control: PointerControl = {};
  let flow: BuildFlow = { phase: 'idle' };
  let pendingBuild: { buildType: BuildingType; target: { x: number; y: number } } | undefined;
  let lastTapMs: number | undefined;
  let lastTapPos: { x: number; y: number } | undefined;
  let craftOpen = false;
  let pendingCraft: WeaponType | undefined;

  const isCampfireHit = (world: { x: number; y: number }): boolean => {
    const pick = pickTarget(curr, world, PICK_RADIUS);
    if (!pick || pick.kind !== 'building') return false;
    return curr.buildings.find((b) => b.id === pick.id)?.type === 'core';
  };

  // Tap/click to move and interact (works for touch and mouse).
  app.canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const rect = app.canvas.getBoundingClientRect();
    const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const world = screenToWorld(screen, TILE_W, TILE_H, renderer.cameraOrigin());

    const now = performance.now();
    const doubleTap = isDoubleTap(lastTapMs, lastTapPos, now, screen, DOUBLE_TAP_MS, DOUBLE_TAP_DIST);
    lastTapMs = now;
    lastTapPos = screen;

    if (flow.phase === 'menu' || craftOpen) return; // handled by overlay buttons

    if (flow.phase === 'placing') {
      const action = placingTapAction(world, doubleTap, flow.ghost, isCampfireHit(world), PICK_RADIUS);
      if (action.t === 'placeGhost') {
        flow = buildFlowReducer(flow, { t: 'placeGhost', point: action.point }).flow;
        renderer.setGhost(flow.ghost, flow.blueprint);
      } else if (action.t === 'confirm') {
        const r = buildFlowReducer(flow, { t: 'confirm' });
        flow = r.flow;
        renderer.setGhost(undefined);
        setPlacingHint(false);
        if (r.build) pendingBuild = r.build;
      } else if (action.t === 'cancel') {
        flow = buildFlowReducer(flow, { t: 'cancel' }).flow;
        renderer.setGhost(undefined);
        setPlacingHint(false);
      }
      return;
    }

    // idle phase: normal intents
    const intent = resolveTapIntent(curr, controlledId, world, PICK_RADIUS);
    if (intent.kind === 'openBuildMenu') {
      flow = buildFlowReducer(flow, { t: 'open' }).flow;
      const me = findActor(curr, controlledId);
      const items = BLUEPRINTS.map((type) => ({
        type,
        cost: buildCost(me?.role, type),
        affordable: canAfford(curr, me?.role, type),
      }));
      showBuildMenu(
        items,
        (type) => {
          flow = buildFlowReducer(flow, { t: 'select', blueprint: type }).flow;
          setPlacingHint(true);
        },
        () => {
          flow = buildFlowReducer(flow, { t: 'cancel' }).flow;
        },
      );
      return;
    }
    if (intent.kind === 'openCraftMenu') {
      craftOpen = true;
      const types: WeaponType[] = ['sword', 'bow'];
      const items = types.map((type) => ({
        type,
        cost: CRAFT_COST[type],
        affordable: curr.resources.materials >= CRAFT_COST[type],
      }));
      showCraftMenu(
        items,
        (type) => {
          craftOpen = false;
          pendingCraft = type;
        },
        () => {
          craftOpen = false;
        },
      );
      return;
    }
    if (intent.kind === 'spectate') {
      cameraTargetId = intent.actorId;
      renderer.setCameraTarget(cameraTargetId);
    } else {
      control = applyIntent(control, intent);
    }
  });

  // Edge-triggered cycle key, active only while spectating.
  window.addEventListener('keydown', (e) => {
    if (!spectating) return;
    if (e.code !== 'Tab' && e.code !== 'Space') return;
    e.preventDefault();
    cameraTargetId = nextSpectateTarget(cameraTargetId, spectatableIds(curr, controlledId)) ?? cameraTargetId;
    renderer.setCameraTarget(cameraTargetId);
  });

  let accumulatorMs = 0;
  let lastMs = performance.now();

  app.ticker.add(() => {
    const now = performance.now();
    accumulatorMs += now - lastMs;
    lastMs = now;

    const { steps, remainderMs } = stepsToRun(accumulatorMs, TICK_MS);
    accumulatorMs = remainderMs;

    for (let i = 0; i < steps; i++) {
      const inputs: InputMap = {};
      // The human controls one actor while alive; bots fill every other living seat.
      if (isActorAlive(curr, controlledId)) {
        if (pendingBuild) {
          inputs[controlledId] = {
            actorId: controlledId,
            move: { x: 0, y: 0 },
            action: 'build',
            buildType: pendingBuild.buildType,
            target: pendingBuild.target,
          };
          pendingBuild = undefined;
        } else if (pendingCraft) {
          inputs[controlledId] = {
            actorId: controlledId,
            move: { x: 0, y: 0 },
            action: 'craft',
            craftType: pendingCraft,
          };
          pendingCraft = undefined;
        } else {
          const k = keyboard.state();
          const keyboardActive = k.up || k.down || k.left || k.right || k.build;
          inputs[controlledId] = keyboardActive
            ? inputFromKeys(controlledId, k, DEFAULT_BUILD)
            : controlToInput(curr, controlledId, control, MOVE_ARRIVAL_EPS);
        }
      }
      for (const actor of [curr.monster, ...curr.heroes]) {
        if (actor.id === controlledId || !actor.alive) continue;
        inputs[actor.id] = botThink(curr, actor.id);
      }
      prev = curr;
      curr = step(curr, inputs);
    }

    // Enter (and maintain) spectate mode once the player's hero is dead.
    if (!isActorAlive(curr, controlledId)) {
      const options = spectatableIds(curr, controlledId);
      if (!spectating) {
        spectating = true;
        cameraTargetId = nextSpectateTarget(undefined, options) ?? cameraTargetId;
        renderer.setCameraTarget(cameraTargetId);
      } else if (!isActorAlive(curr, cameraTargetId)) {
        // The actor we were watching died; advance to the next living one.
        cameraTargetId = nextSpectateTarget(undefined, options) ?? cameraTargetId;
        renderer.setCameraTarget(cameraTargetId);
      }
    }

    renderer.render(prev, curr, renderAlpha(accumulatorMs, TICK_MS));
  });
}

function wireMenu(): void {
  const menu = document.getElementById('menu');
  if (!menu) return;
  for (const btn of Array.from(menu.querySelectorAll<HTMLButtonElement>('button[data-side]'))) {
    btn.addEventListener('click', () => {
      void startGame(btn.dataset.side as Side);
    });
  }
}

wireMenu();
