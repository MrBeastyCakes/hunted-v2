import { Application } from 'pixi.js';
import { createInitialState, step, type GameState, type InputMap } from '@game/shared';
import { COLORS, DEFAULT_BUILD } from './config';
import { TICK_MS, renderAlpha, stepsToRun } from './loop';
import { actorIdForSide, inputFromKeys, type Side } from './control';
import { Keyboard } from './input/keyboard';
import { GameRenderer } from './render/renderer';

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
      // Only the controlled actor sends input this plan; others stand still (bots = Plan 4).
      inputs[controlledId] = inputFromKeys(controlledId, keyboard.state(), DEFAULT_BUILD);
      prev = curr;
      curr = step(curr, inputs);
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
