import { gatheringSystem } from './gathering';
import { createInitialState } from '../state';
import { GATHER_RATE, NODE_RESPAWN_TICKS, RESOURCE_NODE_AMOUNT } from '../constants';

test('a hero on a resource node harvests it into the materials pool', () => {
  const s = createInitialState(1);
  const node = s.map.resourceNodes[0];
  s.resources.materials = 0;
  s.heroes[0].pos = { ...node.pos };
  for (const h of s.heroes.slice(1)) h.pos = { x: 0, y: 0 };
  gatheringSystem(s);
  expect(s.resources.materials).toBe(GATHER_RATE);
  expect(node.amount).toBe(RESOURCE_NODE_AMOUNT - GATHER_RATE);
});

test('multiple heroes harvest a node faster', () => {
  const s = createInitialState(1);
  const node = s.map.resourceNodes[0];
  s.resources.materials = 0;
  s.heroes[0].pos = { ...node.pos };
  s.heroes[1].pos = { ...node.pos };
  for (const h of s.heroes.slice(2)) h.pos = { x: 0, y: 0 };
  gatheringSystem(s);
  expect(s.resources.materials).toBe(GATHER_RATE * 2);
});

test('a depleted node yields nothing and is not over-drained', () => {
  const s = createInitialState(1);
  const node = s.map.resourceNodes[0];
  node.amount = 2;
  s.resources.materials = 0;
  s.heroes[0].pos = { ...node.pos };
  for (const h of s.heroes.slice(1)) h.pos = { x: 0, y: 0 };
  gatheringSystem(s);
  expect(node.amount).toBe(0);
  expect(s.resources.materials).toBe(2);
});

test('nodes replenish on the respawn tick', () => {
  const s = createInitialState(1);
  const node = s.map.resourceNodes[0];
  node.amount = 0;
  for (const h of s.heroes) h.pos = { x: 0, y: 0 };
  s.tick = NODE_RESPAWN_TICKS;
  gatheringSystem(s);
  expect(node.amount).toBeGreaterThan(0);
});
