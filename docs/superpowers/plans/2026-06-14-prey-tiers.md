# Prey Tiers (monster sub-project 2)

> REQUIRED SUB-SKILL: superpowers:executing-plans.

**Goal:** Neutral creatures come in tiers — critter (10xp, frail, flees), medium (20xp, tougher, flees), large (40xp, tough, **bites back**) — plus villager townsfolk (100xp). Per-tier HP/XP; large counterattacks the monster while hunted. Sim + small client rendering.

---

### Task 1: Types + per-tier stats + spawn mix

- [ ] `types.ts`: add `export type PreyTier = 'critter' | 'medium' | 'large' | 'villager';` and add
  `tier: PreyTier;` to `Mob`.
- [ ] `constants.ts`: remove `MOB_HP`, `WILDLIFE_XP`, `VILLAGER_XP`; add
```ts
export const PREY_STATS: Record<'critter' | 'medium' | 'large' | 'villager', { hp: number; xp: number }> = {
  critter: { hp: 6, xp: 10 },
  medium: { hp: 16, xp: 20 },
  large: { hp: 30, xp: 40 },
  villager: { hp: 16, xp: 100 },
};
export const LARGE_BITE_BACK = 3; // damage a large creature deals to the monster per hunt tick
```
- [ ] `state.ts`: in `spawnHerd`, give each mob a `tier` + `hp` from `PREY_STATS`. Wildlife herds mix
  by index (0–2 critter, 3 medium, 4 large); villager herd → `tier: 'villager'`.
- [ ] `state.test.ts`: assert wildlife mobs have tiers and villager mobs are `tier:'villager'`.
- [ ] tsc note: `hunting.ts` will error on removed constants — fixed in Task 2.

### Task 2: huntingSystem — tier XP + large counterattack

- [ ] `systems/hunting.ts`: XP on kill = `PREY_STATS[mob.tier].xp`; respawn mobs with tier
  (`'critter'`/`'villager'`) + `PREY_STATS` hp; when the bitten target is `tier:'large'`, the monster
  takes `LARGE_BITE_BACK` damage (and dies if it hits 0 — set `alive=false`).
- [ ] `systems/hunting.test.ts`: rewrite to PREY_STATS (critter dies fast/low xp; villager 100xp;
  a large creature damages the monster when hunted).
- [ ] `bots/monster.test.ts`, `bots/dispatch.test.ts`: their wildlife mob literals need `tier:'critter'`.

### Task 3: Client renders tiers

- [ ] `render/renderer.ts` `drawMob`: size/color by tier (critter tiny, medium bigger, large biggest +
  reddish/dangerous tint); villager unchanged. tsc + build.

### Task 4: Sweep + deploy

- [ ] `pnpm -r test`, client build, merge, push, verify live.
