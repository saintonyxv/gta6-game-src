// Keyboard and pointer input. Held keys give movement/steering; one-shot presses
// (confirm, pause, enter car, mute, how-to) are queued as bit flags and taken once
// by the loop, so a press between two frames is never lost or counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_MUTE = 8;
export const ACTION_HOWTO = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const MUTE = new Set(['KeyM']);
const HOWTO = new Set(['KeyH']);
const HANDBRAKE = new Set(['Space']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) ||
        RIGHT.has(event.code) || HANDBRAKE.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
      event.preventDefault();
    } else if (ENTER.has(event.code)) {
      if (!event.repeat) actions |= ACTION_ENTER;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (HOWTO.has(event.code)) {
      if (!event.repeat) actions |= ACTION_HOWTO;
    } else return;
  });
  window.addEventListener('keyup', (event) => { held.delete(event.code); });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => { held.clear(); });
  target.addEventListener('pointerdown', () => { actions |= ACTION_CONFIRM; });

  function any(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    up() { return any(UP); },
    down() { return any(DOWN); },
    left() { return any(LEFT); },
    right() { return any(RIGHT); },
    handbrake() { return any(HANDBRAKE); },
    /** -1 for left, 1 for right, 0 for neither or both. */
    steer() { return (any(RIGHT) ? 1 : 0) - (any(LEFT) ? 1 : 0); },
    /** -1 for back, 1 for forward, 0 for neither or both. */
    throttle() { return (any(UP) ? 1 : 0) - (any(DOWN) ? 1 : 0); },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
