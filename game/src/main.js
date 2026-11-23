// Vice Blocks — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there. The
// game moves between title, how-to, play, paused, game-over and story-complete
// screens. ?shot=title|driving|wanted|mission stages a scene instead of
// running the loop, paints it twice and sets window.__shotReady.
import { BEST_KEY, STEP } from './config.js';
import { createWorld, EVENT_BUSTED, EVENT_CASH, EVENT_CRASH, EVENT_CRIME, EVENT_MISSION_DONE, EVENT_MISSION_FAIL, EVENT_PICKUP, EVENT_WRECKED } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_HOWTO, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createSound } from './audio.js';
import { createRenderer, SCREEN_COMPLETE, SCREEN_HOWTO, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import { advanceMission, retryMission } from './missions.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261123;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
// Debug handle for automated playtests (harmless in the shipped game).
window.__vice = world;
const renderer = createRenderer(canvas);
const sound = createSound();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best cash then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, performance.now() / 1000);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let prevScreen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    world.startMissionAt(0);
    accumulator = 0;
    screen = SCREEN_PLAY;
    sound.unlock();
    sound.startMusic();
    announce('Playing. Rosa Marín’s first job: reach the downtown checkpoint.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.cash > best) {
      best = world.state.cash;
      saveBest(best);
    }
    sound.siren(false);
    sound.engine(0, false);
    announce(world.state.over === 'busted' ? 'Busted. Game over.' : 'Wrecked. Game over.');
  }

  function handleEvents(events) {
    if (events & EVENT_CRASH) sound.crash();
    if (events & EVENT_PICKUP) sound.pickup();
    if (events & EVENT_CASH) sound.pickup();
    if (events & EVENT_MISSION_DONE) sound.chime();
    if (events & EVENT_MISSION_FAIL) sound.busted();
    if (events & EVENT_BUSTED) { sound.busted(); endGame(); }
    if (events & EVENT_WRECKED) { sound.crash(); endGame(); }
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      sound.setMuted(!sound.isMuted());
      return;
    }
    const m = world.state.missions;
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_HOWTO) { prevScreen = SCREEN_TITLE; screen = SCREEN_HOWTO; }
      else if (actions & ACTION_CONFIRM) startGame();
    } else if (screen === SCREEN_HOWTO) {
      if (actions & (ACTION_HOWTO | ACTION_CONFIRM)) screen = prevScreen;
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (actions & ACTION_HOWTO) {
        prevScreen = SCREEN_PLAY;
        screen = SCREEN_HOWTO;
      } else if (actions & ACTION_CONFIRM) {
        if (m.phase === 'idle') world.startMissionAt(m.index);
        else if (m.phase === 'failed') retryMission(m);
        else if (m.phase === 'done' && m.banner <= 0) {
          const next = advanceMission(m);
          if (next === null) screen = SCREEN_COMPLETE;
        }
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) {
        screen = SCREEN_TITLE;
        world.reset();
        announce('Vice Blocks. Press Enter or click to start.');
      }
    } else if (screen === SCREEN_COMPLETE) {
      if (actions & ACTION_CONFIRM) screen = SCREEN_PLAY;
    }
  }

  function step() {
    if (screen === SCREEN_TITLE || screen === SCREEN_HOWTO) {
      // Ambient city behind the menus: traffic rolls, nothing scores.
      const idle = {
        up: () => false, down: () => false, left: () => false, right: () => false,
        handbrake: () => false, throttle: () => 0, steer: () => 0,
      };
      world.step(STEP, idle, 0);
      return;
    }
    const events = world.step(STEP, input, currentActions);
    handleEvents(events);
    if (world.state.cash > best) {
      best = world.state.cash;
      saveBest(best);
    }
  }

  // The actions taken this frame, shared with step() so a press is read once.
  let currentActions = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    currentActions = input.takeActions();
    handleActions(currentActions);
    if (screen === SCREEN_TITLE || screen === SCREEN_HOWTO || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_HOWTO || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    // Engine and siren follow the live state.
    const p = world.state.player;
    const driving = !p.onFoot && !!p.car;
    sound.engine(driving ? Math.abs(p.car.speed) / 460 : 0, driving);
    sound.siren(world.state.wanted > 0 && screen === SCREEN_PLAY);
    renderer.draw(world.state, screen, best, now / 1000);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Vice Blocks. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
