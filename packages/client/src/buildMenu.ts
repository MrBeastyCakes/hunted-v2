import type { BuildableType, SkillPath, WeaponType } from '@game/shared';

export interface BlueprintItem {
  type: BuildableType;
  cost: number;
  affordable: boolean;
}

let panel: HTMLDivElement | undefined;

function ensurePanel(): HTMLDivElement {
  if (panel) return panel;
  panel = document.createElement('div');
  panel.id = 'buildmenu';
  Object.assign(panel.style, {
    position: 'fixed',
    left: '50%',
    bottom: '24px',
    transform: 'translateX(-50%)',
    display: 'none',
    gap: '8px',
    padding: '10px',
    background: '#161b22ee',
    border: '1px solid #2f81f7',
    borderRadius: '10px',
    zIndex: '20',
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(panel);
  return panel;
}

function styleButton(btn: HTMLButtonElement, enabled: boolean): void {
  Object.assign(btn.style, {
    fontSize: '15px',
    padding: '8px 12px',
    cursor: enabled ? 'pointer' : 'not-allowed',
    opacity: enabled ? '1' : '0.45',
    border: '1px solid #30363d',
    borderRadius: '8px',
    background: '#0d1117',
    color: '#e6edf3',
  } satisfies Partial<CSSStyleDeclaration>);
}

// Shows the blueprint menu; calls onSelect(type) or onCancel and hides itself.
export function showBuildMenu(
  items: BlueprintItem[],
  onSelect: (type: BuildableType) => void,
  onCancel: () => void,
): void {
  const el = ensurePanel();
  el.innerHTML = '';
  el.style.display = 'flex';

  for (const item of items) {
    const btn = document.createElement('button');
    btn.textContent = `${item.type} (${item.cost})`;
    btn.disabled = !item.affordable;
    styleButton(btn, item.affordable);
    btn.addEventListener('click', () => {
      hideBuildMenu();
      onSelect(item.type);
    });
    el.appendChild(btn);
  }

  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  styleButton(cancel, true);
  cancel.addEventListener('click', () => {
    hideBuildMenu();
    onCancel();
  });
  el.appendChild(cancel);
}

export function hideBuildMenu(): void {
  if (panel) panel.style.display = 'none';
}

export interface WeaponItemChoice {
  type: WeaponType;
  cost: number;
  affordable: boolean;
}

let craftPanel: HTMLDivElement | undefined;

function ensureCraftPanel(): HTMLDivElement {
  if (craftPanel) return craftPanel;
  craftPanel = document.createElement('div');
  craftPanel.id = 'craftmenu';
  Object.assign(craftPanel.style, {
    position: 'fixed',
    left: '50%',
    bottom: '24px',
    transform: 'translateX(-50%)',
    display: 'none',
    gap: '8px',
    padding: '10px',
    background: '#161b22ee',
    border: '1px solid #f2b66d',
    borderRadius: '10px',
    zIndex: '20',
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(craftPanel);
  return craftPanel;
}

// Shows the weapon craft menu; calls onSelect(type) or onCancel and hides itself.
export function showCraftMenu(
  items: WeaponItemChoice[],
  onSelect: (type: WeaponType) => void,
  onCancel: () => void,
): void {
  const el = ensureCraftPanel();
  el.innerHTML = '';
  el.style.display = 'flex';
  for (const item of items) {
    const btn = document.createElement('button');
    btn.textContent = `${item.type} (${item.cost})`;
    btn.disabled = !item.affordable;
    styleButton(btn, item.affordable);
    btn.addEventListener('click', () => {
      hideCraftMenu();
      onSelect(item.type);
    });
    el.appendChild(btn);
  }
  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  styleButton(cancel, true);
  cancel.addEventListener('click', () => {
    hideCraftMenu();
    onCancel();
  });
  el.appendChild(cancel);
}

export function hideCraftMenu(): void {
  if (craftPanel) craftPanel.style.display = 'none';
}

export interface SkillChoice {
  path: SkillPath;
  rank: number;
  cost: number;
  affordable: boolean;
  maxed: boolean;
}

let skillPanel: HTMLDivElement | undefined;

function ensureSkillPanel(): HTMLDivElement {
  if (skillPanel) return skillPanel;
  skillPanel = document.createElement('div');
  skillPanel.id = 'skillmenu';
  Object.assign(skillPanel.style, {
    position: 'fixed',
    left: '50%',
    bottom: '24px',
    transform: 'translateX(-50%)',
    display: 'none',
    gap: '8px',
    padding: '10px',
    background: '#161b22ee',
    border: '1px solid #7ee787',
    borderRadius: '10px',
    zIndex: '20',
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(skillPanel);
  return skillPanel;
}

// Shows the monster's skill menu; calls onSelect(path) or onCancel and hides itself.
export function showSkillMenu(
  items: SkillChoice[],
  onSelect: (path: SkillPath) => void,
  onCancel: () => void,
): void {
  const el = ensureSkillPanel();
  el.innerHTML = '';
  el.style.display = 'flex';
  for (const item of items) {
    const btn = document.createElement('button');
    btn.textContent = item.maxed
      ? `${item.path} MAX`
      : `${item.path} ${item.rank}→${item.rank + 1} (${item.cost})`;
    const usable = item.affordable && !item.maxed;
    btn.disabled = !usable;
    styleButton(btn, usable);
    btn.addEventListener('click', () => {
      hideSkillMenu();
      onSelect(item.path);
    });
    el.appendChild(btn);
  }
  const cancel = document.createElement('button');
  cancel.textContent = 'Close';
  styleButton(cancel, true);
  cancel.addEventListener('click', () => {
    hideSkillMenu();
    onCancel();
  });
  el.appendChild(cancel);
}

export function hideSkillMenu(): void {
  if (skillPanel) skillPanel.style.display = 'none';
}

// A small instruction line while placing a ghost.
let hint: HTMLDivElement | undefined;
export function setPlacingHint(visible: boolean): void {
  if (!hint) {
    hint = document.createElement('div');
    Object.assign(hint.style, {
      position: 'fixed',
      left: '50%',
      bottom: '24px',
      transform: 'translateX(-50%)',
      padding: '8px 12px',
      background: '#161b22ee',
      borderRadius: '8px',
      color: '#e6edf3',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      zIndex: '20',
    } satisfies Partial<CSSStyleDeclaration>);
    hint.textContent =
      'Double-tap to place • tap the ghost to confirm • tap the campfire to cancel';
    document.body.appendChild(hint);
  }
  hint.style.display = visible ? 'block' : 'none';
}
