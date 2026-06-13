import { BLUEPRINTS, buildFlowReducer, canAfford, type BuildFlow } from './buildFlow';
import { createInitialState } from '@game/shared';

test('BLUEPRINTS are the three buildable structures', () => {
  expect(BLUEPRINTS).toEqual(['tower', 'generator', 'workshop']);
});

test('open -> menu, select -> placing', () => {
  let r = buildFlowReducer({ phase: 'idle' }, { t: 'open' });
  expect(r.flow.phase).toBe('menu');
  r = buildFlowReducer(r.flow, { t: 'select', blueprint: 'tower' });
  expect(r.flow).toEqual({ phase: 'placing', blueprint: 'tower' });
});

test('placeGhost records the ghost position while placing', () => {
  const flow: BuildFlow = { phase: 'placing', blueprint: 'tower' };
  const r = buildFlowReducer(flow, { t: 'placeGhost', point: { x: 5, y: 6 } });
  expect(r.flow).toEqual({ phase: 'placing', blueprint: 'tower', ghost: { x: 5, y: 6 } });
});

test('placeGhost is ignored when not placing', () => {
  const r = buildFlowReducer({ phase: 'menu' }, { t: 'placeGhost', point: { x: 1, y: 1 } });
  expect(r.flow).toEqual({ phase: 'menu' });
});

test('confirm with a ghost emits a build command and returns to idle', () => {
  const flow: BuildFlow = { phase: 'placing', blueprint: 'generator', ghost: { x: 9, y: 2 } };
  const r = buildFlowReducer(flow, { t: 'confirm' });
  expect(r.flow).toEqual({ phase: 'idle' });
  expect(r.build).toEqual({ buildType: 'generator', target: { x: 9, y: 2 } });
});

test('confirm without a ghost does nothing', () => {
  const flow: BuildFlow = { phase: 'placing', blueprint: 'tower' };
  const r = buildFlowReducer(flow, { t: 'confirm' });
  expect(r.flow).toEqual(flow);
  expect(r.build).toBeUndefined();
});

test('cancel returns to idle', () => {
  const r = buildFlowReducer(
    { phase: 'placing', blueprint: 'tower', ghost: { x: 1, y: 1 } },
    { t: 'cancel' },
  );
  expect(r.flow).toEqual({ phase: 'idle' });
});

test('canAfford compares materials against the role-adjusted cost', () => {
  const s = createInitialState(1);
  const builder = s.heroes.find((h) => h.role === 'builder')!;
  s.resources.materials = 0;
  expect(canAfford(s, builder.role, 'tower')).toBe(false);
  s.resources.materials = 1000;
  expect(canAfford(s, builder.role, 'tower')).toBe(true);
});
