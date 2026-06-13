import { Application } from 'pixi.js';
import { botThink, createInitialState, step, type GameState, type InputMap } from '@game/shared';
import { COLORS, DEFAULT_BUILD } from './config';
import { TICK_MS, renderAlpha, stepsToRun } from './loop';
import { actorIdForSide, inputFromKeys, type Side } from './control';
import { Keyboard } from './input/keyboard';
import { GameRenderer } from './render/renderer';
import { isActorAlive, nextSpectateTarget, spectatableIds } from './spectate';

async function startGame(side: Side): Promise<void> {
  const menu = document.getElementById('menu');
  if (menu) menu.style.display = 'none';

  const app = new Application();
  await app.init({ background: COLORS.background, resizeTo: window });
  document.getElementById('app')!.appendChild(app.canvas);

  let prev: GameState = createInitialState(Date.now() % 1_000_000);
  let curr: GameState = prev;
  const controlledId = actorIdForSide(curr, side) ?? curr.monster.id;

  const keyboard = new Keyboard();
  keyboard.attach();

  const renderer = new GameRenderer(app, controlledId);

  let spectating = false;
  let cameraTargetId = controlledId;

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
        inputs[controlledId] = inputFromKeys(controlledId, keyboard.state(), DEFAULT_BUILD);
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
