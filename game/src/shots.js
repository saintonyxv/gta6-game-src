// The screenshot scenes behind ?shot=title|driving|wanted|mission. Each one
// stages the real game in a fixed state and plays it forward a few seconds
// with a simple autopilot (hold W, steer toward the objective), so the frame
// is what real play looks like and the same seed always gives the same frame.
import { STEP, streetX, streetY } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

// A minimal input the autopilot drives: only "up" (accelerate) is ever held.
function autoInput(up) {
  return {
    up: () => up, down: () => false, left: () => false, right: () => false,
    handbrake: () => false,
    throttle: () => (up ? 1 : 0),
    steer: () => 0,
  };
}

function putPlayerInCar(world) {
  const s = world.state;
  // Take the parked car nearest downtown and drive it.
  let best = null;
  let bestD = Infinity;
  for (const car of s.cars) {
    if (car.kind !== 'parked') continue;
    const dx = car.x - streetX(3), dy = car.y - streetY(3);
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) return;
  best.kind = 'player';
  best.parked = false;
  s.player.car = best;
  s.player.onFoot = false;
  s.player.x = best.x;
  s.player.y = best.y;
  s.player.angle = best.angle;
  s.wanted = 0;
}

export function stageShot(name, world) {
  const input = autoInput(true);
  if (name === 'driving') {
    world.reset();
    putPlayerInCar(world);
    world.startMissionAt(0);
    // Start far south-west of the downtown checkpoint and drive east along
    // the street, so the job is still in progress and the pink marker reads.
    const car = world.state.player.car;
    car.x = streetX(1); car.y = streetY(6); car.angle = 0;
    car.vx = 0; car.vy = 0; car.speed = 0;
    world.state.player.x = car.x; world.state.player.y = car.y;
    for (let i = 0; i < 3 / STEP; i += 1) world.step(STEP, input, 0);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'wanted') {
    world.reset();
    putPlayerInCar(world);
    world.startMissionAt(0);
    const car = world.state.player.car;
    car.x = streetX(1); car.y = streetY(6); car.angle = 0;
    car.vx = 0; car.vy = 0; car.speed = 0;
    world.state.player.x = car.x; world.state.player.y = car.y;
    world.state.wanted = 3;
    world.state.crimeTimer = 0;
    for (let i = 0; i < 4 / STEP; i += 1) world.step(STEP, input, 0);
    return { screen: SCREEN_PLAY, best: 250 };
  }
  if (name === 'mission') {
    world.reset();
    world.startMissionAt(0);
    const m = world.state.missions;
    // Drive the player onto the checkpoint to complete the job for real.
    world.state.player.x = m.target.x;
    world.state.player.y = m.target.y;
    world.step(STEP, autoInput(false), 0);
    return { screen: SCREEN_PLAY, best: 150 };
  }
  // title (and anything unknown): ambient city behind the title panel.
  world.reset();
  for (let i = 0; i < 5 / STEP; i += 1) world.step(STEP, autoInput(false), 0);
  return { screen: SCREEN_TITLE, best: 0 };
}
