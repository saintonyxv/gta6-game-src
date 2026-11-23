// The simulation: the player on foot and in cars, traffic, pedestrians, police,
// the wanted system, cash pickups, particles and the mission flow. No drawing
// and no browser in here — step() advances one fixed step and returns what
// happened as bit flags, so the caller can react (sound, screens) without the
// world knowing about them.
import {
  BEACH_W, BLOCK, CITY, GRID, ROAD, SEA_W, clamp, dist2, makeRng, pick, rr,
  streetX, streetY,
} from './config.js';
import { buildCity, randomStreetPoint, resolveBuildings, worldHeight, worldWidth } from './city.js';
import { advanceMission, completeMission, createMissions, failMission, missionDef, retryMission, startMission } from './missions.js';
import { ACTION_ENTER } from './input.js';

export const EVENT_CRASH = 1;
export const EVENT_CRIME = 2;
export const EVENT_PICKUP = 4;
export const EVENT_MISSION_DONE = 8;
export const EVENT_MISSION_FAIL = 16;
export const EVENT_BUSTED = 32;
export const EVENT_WRECKED = 64;
export const EVENT_CASH = 128;

const CAR_COLORS = ['#e84545', '#f2a541', '#4fc3f7', '#9b59d0', '#e8e8e8', '#2ecc71', '#ff7a59', '#ffd23f'];
const PED_COLORS = ['#f2c94c', '#e8e8e8', '#7cc7ff', '#ff9ecf', '#8affc1', '#ffb347'];
const WALK_SPEED = 175;
const CAR_ACCEL = 520;
const CAR_MAX_SPEED = 460;
const CAR_MAX_REVERSE = 160;
const POLICE_BASE_SPEED = 400;

function makeCar(rng, x, y, angle, color, kind) {
  return {
    x, y, angle, vx: 0, vy: 0, speed: 0, color, kind, // kind: traffic | parked | police | player
    health: 100, parked: kind === 'parked',
    axis: 'h', street: 0, s: x, dir: 1, targetSpeed: 120 + rng() * 90,
    lane: rng() < 0.5 ? -14 : 14, turnCooldown: 0, sirenPhase: rng() * Math.PI * 2,
  };
}

export function createWorld(seed) {
  const rng = makeRng(seed);
  const city = buildCity(seed);
  const state = {
    city, seed,
    time: 0,
    player: { x: streetX(3), y: streetY(4), angle: -Math.PI / 2, onFoot: true, car: null, walkAngle: -Math.PI / 2 },
    cars: [],       // traffic + parked + police (player car lives here too while driven)
    peds: [],
    police: [],
    particles: [],
    pickups: [],
    wanted: 0,
    crimeTimer: 0,  // seconds since the last crime
    decayTimer: 0,
    cash: 0,
    missions: createMissions(),
    over: null,     // null | 'busted' | 'wrecked'
    shake: 0,
  };

  function spawnTrafficCar() {
    const p = randomStreetPoint(rng);
    const horizontal = rng() < 0.5;
    const street = Math.floor(rng() * (GRID + 1));
    const car = makeCar(rng, p.x, p.y, horizontal ? 0 : Math.PI / 2, pick(rng, CAR_COLORS), 'traffic');
    car.axis = horizontal ? 'h' : 'v';
    car.street = street;
    car.s = horizontal ? p.x : p.y;
    car.dir = rng() < 0.5 ? 1 : -1;
    car.angle = horizontal ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    car.speed = car.targetSpeed;
    return car;
  }

  function spawnParkedCar() {
    const p = randomStreetPoint(rng);
    const car = makeCar(rng, p.x, p.y, rng() * Math.PI * 2, pick(rng, CAR_COLORS), 'parked');
    car.angle = rng() < 0.5 ? 0 : Math.PI / 2;
    return car;
  }

  function spawnPed() {
    const p = randomStreetPoint(rng);
    return {
      x: p.x + (rng() < 0.5 ? -30 : 30), y: p.y + (rng() < 0.5 ? -30 : 30),
      angle: rng() * Math.PI * 2, speed: 40 + rng() * 35,
      color: pick(rng, PED_COLORS), state: 'walk', timer: 0, turnTimer: rr(rng, 2, 6),
    };
  }

  function spawnPickup() {
    const p = randomStreetPoint(rng);
    return { x: p.x, y: p.y, amount: 25, bob: rng() * Math.PI * 2 };
  }

  function reset() {
    state.time = 0;
    state.player.x = streetX(3);
    state.player.y = streetY(4);
    state.player.angle = -Math.PI / 2;
    state.player.walkAngle = -Math.PI / 2;
    state.player.onFoot = true;
    state.player.car = null;
    state.cars = [];
    state.peds = [];
    state.police = [];
    state.particles = [];
    state.pickups = [];
    state.wanted = 0;
    state.crimeTimer = 0;
    state.decayTimer = 0;
    state.cash = 0;
    state.missions = createMissions();
    state.over = null;
    state.shake = 0;
    for (let i = 0; i < 10; i += 1) state.cars.push(spawnTrafficCar());
    for (let i = 0; i < 7; i += 1) state.cars.push(spawnParkedCar());
    for (let i = 0; i < 14; i += 1) state.peds.push(spawnPed());
    for (let i = 0; i < 8; i += 1) state.pickups.push(spawnPickup());
  }

  function addCrime(levels) {
    state.wanted = clamp(state.wanted + levels, 0, 5);
    state.crimeTimer = 0;
  }

  function spark(x, y, color, n) {
    for (let i = 0; i < n; i += 1) {
      const a = rng() * Math.PI * 2;
      const sp = 60 + rng() * 220;
      state.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4 + rng() * 0.4, color });
    }
  }

  function nearestCar(x, y, maxDist, kinds) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const car of state.cars) {
      if (kinds && !kinds.includes(car.kind)) continue;
      const d = dist2(x, y, car.x, car.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    for (const car of state.police) {
      if (kinds && !kinds.includes(car.kind)) continue;
      const d = dist2(x, y, car.x, car.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  // --- player ---------------------------------------------------------------
  function stepPlayer(dt, input, actions, events) {
    const p = state.player;
    if (p.onFoot) {
      let mx = (input.right() ? 1 : 0) - (input.left() ? 1 : 0);
      let my = (input.down() ? 1 : 0) - (input.up() ? 1 : 0);
      if (mx !== 0 || my !== 0) {
        const len = Math.hypot(mx, my);
        mx /= len; my /= len;
        p.x += mx * WALK_SPEED * dt;
        p.y += my * WALK_SPEED * dt;
        p.walkAngle = Math.atan2(my, mx);
        p.angle = p.walkAngle;
      }
      p.x = clamp(p.x, 16, worldWidth() - 16);
      p.y = clamp(p.y, 16, worldHeight() - 16);
      resolveBuildings(city, p, 13);
      if (actions & ACTION_ENTER) {
        const car = nearestCar(p.x, p.y, 64, ['parked', 'traffic']);
        if (car) {
          // Stealing a car is a crime: the heat goes up.
          car.kind = 'player';
          car.parked = false;
          car.speed = 0; car.vx = 0; car.vy = 0;
          p.car = car;
          p.onFoot = false;
          p.angle = car.angle;
          addCrime(1);
          events |= EVENT_CRIME;
          return events;
        }
      }
      return events;
    }

    // Driving.
    const car = p.car;
    if (!car) { p.onFoot = true; return events; }
    const throttle = input.throttle();
    const steer = input.steer();
    const handbrake = input.handbrake();
    if (throttle > 0) car.speed += CAR_ACCEL * dt;
    else if (throttle < 0) {
      if (car.speed > 20) car.speed -= CAR_ACCEL * 1.4 * dt; // brake
      else car.speed -= CAR_ACCEL * 0.5 * dt; // reverse
    } else {
      car.speed -= Math.sign(car.speed) * 140 * dt;
      if (Math.abs(car.speed) < 8) car.speed = 0;
    }
    if (handbrake) car.speed *= Math.max(0, 1 - 3.2 * dt);
    car.speed = clamp(car.speed, -CAR_MAX_REVERSE, CAR_MAX_SPEED);
    const steerAuthority = clamp(Math.abs(car.speed) / 120, 0, 1);
    car.angle += steer * 2.4 * steerAuthority * Math.sign(car.speed || 1) * dt;
    // Drift: velocity blends toward the heading, so fast turns slide.
    const drift = handbrake ? 0.86 : 0.94;
    const tx = Math.cos(car.angle) * car.speed;
    const ty = Math.sin(car.angle) * car.speed;
    car.vx = car.vx * drift + tx * (1 - drift);
    car.vy = car.vy * drift + ty * (1 - drift);
    car.x += car.vx * dt;
    car.y += car.vy * dt;
    car.x = clamp(car.x, 14, worldWidth() - 14);
    car.y = clamp(car.y, 14, worldHeight() - 14);
    if (resolveBuildings(city, car, 17)) {
      const impact = Math.hypot(car.vx, car.vy);
      if (impact > 180) {
        car.health -= Math.min(30, (impact - 180) / 12);
        spark(car.x, car.y, '#ffd23f', 10);
        state.shake = 0.25;
        events |= EVENT_CRASH;
      }
      car.speed *= 0.45;
      car.vx *= 0.4; car.vy *= 0.4;
    }
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    if (car.health <= 0) {
      car.kind = 'parked'; // a wreck, left on the street
      p.car = null;
      p.onFoot = true;
      p.x = car.x + 30; p.y = car.y + 30;
      state.over = 'wrecked';
      events |= EVENT_WRECKED;
      return events;
    }
    if (actions & ACTION_ENTER) {
      p.car = null;
      p.onFoot = true;
      car.kind = 'parked';
      car.parked = true;
      car.speed = 0; car.vx = 0; car.vy = 0;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    }
    return events;
  }

  // --- traffic --------------------------------------------------------------
  function stepTraffic(dt) {
    for (const car of state.cars) {
      if (car.kind !== 'traffic') continue;
      car.turnCooldown -= dt;
      // Slow down for a car ahead on the same street.
      let ahead = false;
      for (const other of state.cars) {
        if (other === car || other.kind === 'parked') continue;
        if (other.axis !== car.axis || other.street !== car.street || other.dir !== car.dir) continue;
        const gap = (other.s - car.s) * car.dir;
        if (gap > 0 && gap < 90) { ahead = true; break; }
      }
      const target = ahead ? 0 : car.targetSpeed;
      car.speed += clamp(target - car.speed, -260 * dt, 180 * dt);
      car.s += car.dir * car.speed * dt;
      // Reached the end of the street: turn around.
      if (car.s < ROAD / 2) { car.s = ROAD / 2; car.dir = 1; }
      if (car.s > CITY - ROAD / 2) { car.s = CITY - ROAD / 2; car.dir = -1; }
      // At an intersection, sometimes turn onto the cross street.
      if (car.turnCooldown <= 0) {
        for (let k = 0; k <= GRID; k += 1) {
          const c = car.axis === 'h' ? streetX(k) : streetY(k);
          const along = car.axis === 'h' ? car.s : car.s;
          if (Math.abs(along - c) < car.speed * dt + 2 && rng() < 0.22) {
            const here = car.axis === 'h' ? car.y : car.x;
            car.axis = car.axis === 'h' ? 'v' : 'h';
            car.street = k;
            car.s = here;
            car.dir = rng() < 0.5 ? 1 : -1;
            car.turnCooldown = 2;
            break;
          }
        }
      }
      if (car.axis === 'h') {
        car.x = car.s;
        car.y = streetY(car.street) + car.lane;
        car.angle = car.dir > 0 ? 0 : Math.PI;
      } else {
        car.x = streetX(car.street) + car.lane;
        car.y = car.s;
        car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      resolveBuildings(city, car, 16);
    }
    // Car-car bumps: push apart, trade a little speed.
    const all = state.cars.concat(state.police);
    for (let i = 0; i < all.length; i += 1) {
      for (let j = i + 1; j < all.length; j += 1) {
        const a = all[i], b = all[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= 34 * 34 || d2 < 0.01) continue;
        const d = Math.sqrt(d2);
        const push = (34 - d) / 2;
        const nx = dx / d, ny = dy / d;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        if (a.kind === 'player' || b.kind === 'player') {
          const pc = a.kind === 'player' ? a : b;
          const other = a.kind === 'player' ? b : a;
          const impact = Math.abs((a.vx - b.vx) * nx + (a.vy - b.vy) * ny);
          if (impact > 120) {
            pc.health -= Math.min(18, (impact - 120) / 14);
            spark(pc.x, pc.y, '#ff5da2', 8);
            state.shake = 0.2;
          }
          if (other.kind === 'traffic') other.speed *= 0.3;
        }
        a.vx *= 0.6; a.vy *= 0.6; b.vx *= 0.6; b.vy *= 0.6;
      }
    }
  }

  // --- pedestrians ----------------------------------------------------------
  function stepPeds(dt, events) {
    const p = state.player;
    const playerCar = !p.onFoot && p.car ? p.car : null;
    for (const ped of state.peds) {
      ped.timer -= dt;
      if (ped.state === 'down') {
        if (ped.timer <= 0) { ped.state = 'walk'; ped.speed = 60 + rng() * 30; }
        continue;
      }
      // Flee a fast car bearing down on them.
      let fleeX = 0, fleeY = 0;
      const threat = playerCar || null;
      if (threat) {
        const d = Math.hypot(threat.x - ped.x, threat.y - ped.y);
        if (d < 150 && Math.abs(threat.speed) > 120) {
          fleeX = (ped.x - threat.x) / d;
          fleeY = (ped.y - threat.y) / d;
        }
      }
      if (fleeX !== 0 || fleeY !== 0) {
        ped.angle = Math.atan2(fleeY, fleeX);
        ped.speed = 150;
      } else {
        ped.turnTimer -= dt;
        if (ped.turnTimer <= 0) {
          ped.angle += rr(rng, -1.2, 1.2);
          ped.turnTimer = rr(rng, 2, 6);
        }
        ped.speed = 55;
      }
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      ped.x = clamp(ped.x, 16, worldWidth() - 16);
      ped.y = clamp(ped.y, 16, worldHeight() - 16);
      resolveBuildings(city, ped, 10);
      // Hit by the player's car: a crime, and the pedestrian goes down.
      if (playerCar && Math.abs(playerCar.speed) > 120) {
        const d = Math.hypot(playerCar.x - ped.x, playerCar.y - ped.y);
        if (d < 26) {
          ped.state = 'down';
          ped.timer = 8;
          addCrime(1);
          spark(ped.x, ped.y, '#ff5da2', 12);
          state.shake = 0.3;
          events |= EVENT_CRIME | EVENT_CRASH;
        }
      }
    }
    return events;
  }

  // --- police ---------------------------------------------------------------
  function ensurePolice() {
    const want = Math.min(state.wanted, 4);
    while (state.police.length < want) {
      const p = state.player;
      const a = rng() * Math.PI * 2;
      const d = 500 + rng() * 300;
      const x = clamp(p.x + Math.cos(a) * d, 40, worldWidth() - 40);
      const y = clamp(p.y + Math.sin(a) * d, 40, worldHeight() - 40);
      const car = makeCar(rng, x, y, 0, '#2f7bff', 'police');
      car.targetSpeed = POLICE_BASE_SPEED + state.wanted * 22;
      state.police.push(car);
    }
  }

  function stepPolice(dt, events) {
    ensurePolice();
    const p = state.player;
    for (const car of state.police) {
      const dx = p.x - car.x, dy = p.y - car.y;
      const d = Math.hypot(dx, dy) || 1;
      const wantAngle = Math.atan2(dy, dx);
      // Steer toward the player, faster when close.
      let turn = wantAngle - car.angle;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      car.angle += clamp(turn, -2.6 * dt, 2.6 * dt);
      const target = d > 700 ? car.targetSpeed : car.targetSpeed * 0.92;
      car.speed += clamp(target - car.speed, -400 * dt, 320 * dt);
      car.vx = Math.cos(car.angle) * car.speed;
      car.vy = Math.sin(car.angle) * car.speed;
      car.x += car.vx * dt;
      car.y += car.vy * dt;
      car.x = clamp(car.x, 14, worldWidth() - 14);
      car.y = clamp(car.y, 14, worldHeight() - 14);
      if (resolveBuildings(city, car, 16)) { car.speed *= 0.5; car.vx *= 0.5; car.vy *= 0.5; }
      // Ram the player.
      if (d < 34) {
        if (p.onFoot) {
          state.over = 'busted';
          events |= EVENT_BUSTED;
          return events;
        }
        const pc = p.car;
        if (pc) {
          pc.health -= 14;
          spark(pc.x, pc.y, '#2f7bff', 10);
          state.shake = 0.3;
          events |= EVENT_CRASH;
          // Shove the player's car away from the ram.
          pc.vx += (dx / d) * 160;
          pc.vy += (dy / d) * 160;
          car.x -= (dx / d) * 20;
          car.y -= (dy / d) * 20;
          if (pc.health <= 0) {
            pc.kind = 'parked';
            p.car = null;
            p.onFoot = true;
            state.over = 'wrecked';
            events |= EVENT_WRECKED;
            return events;
          }
        }
      }
    }
    return events;
  }

  // --- missions -------------------------------------------------------------
  function stepMissions(dt, events) {
    const m = state.missions;
    if (m.banner > 0) m.banner -= dt;
    if (m.phase === 'idle' || m.phase === 'done' || m.phase === 'failed' || m.phase === 'complete') return events;
    if (m.phase === 'active' || m.phase === 'pickup' || m.phase === 'deliver') {
      m.timer -= dt;
      if (m.timer <= 0) {
        failMission(m);
        events |= EVENT_MISSION_FAIL;
        return events;
      }
      const p = state.player;
      const def = missionDef(m.index);
      if (m.target && dist2(p.x, p.y, m.target.x, m.target.y) < 46 * 46) {
        if (m.phase === 'pickup') {
          m.phase = 'deliver';
          m.target = def.deliverTarget;
          m.objective = def.deliverObjective;
          m.timer = Math.max(m.timer, 60);
          events |= EVENT_PICKUP;
          return events;
        }
        state.cash = completeMission(m, state.cash);
        if (m.phase === 'done' && def.heat) state.wanted = 0; // escaped clean
        events |= EVENT_MISSION_DONE;
      }
    }
    return events;
  }

  function stepPickups(dt, events) {
    const p = state.player;
    for (const pk of state.pickups) {
      pk.bob += dt * 3;
      if (dist2(p.x, p.y, pk.x, pk.y) < 30 * 30) {
        state.cash += pk.amount;
        events |= EVENT_CASH;
        const np = spawnPickup();
        pk.x = np.x; pk.y = np.y;
      }
    }
    return events;
  }

  // --- one fixed step -------------------------------------------------------
  // `actions` is the bitmask main.js took from the input this frame, so the
  // world never consumes a press the screens also need.
  function step(dt, input, actions) {
    let events = 0;
    if (state.over) return events;
    state.time += dt;
    state.crimeTimer += dt;
    // Wanted decay: lie low and the heat fades.
    if (state.wanted > 0 && state.crimeTimer > 20) {
      let nearest = Infinity;
      for (const car of state.police) {
        nearest = Math.min(nearest, Math.hypot(car.x - state.player.x, car.y - state.player.y));
      }
      if (state.police.length === 0 || nearest > 480) {
        state.decayTimer += dt;
        if (state.decayTimer > 8) {
          state.wanted -= 1;
          state.decayTimer = 0;
          if (state.wanted === 0) state.police = [];
        }
      } else state.decayTimer = 0;
    }
    events = stepPlayer(dt, input, actions, events);
    if (state.over) return events;
    stepTraffic(dt);
    events = stepPeds(dt, events);
    if (state.wanted > 0) events = stepPolice(dt, events);
    else if (state.police.length > 0) {
      // Heat gone: the cruisers drift away and despawn.
      state.police = state.police.filter((car) => {
        const d = Math.hypot(car.x - state.player.x, car.y - state.player.y);
        return d < 900;
      });
    }
    events = stepMissions(dt, events);
    events = stepPickups(dt, events);
    // Particles.
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.94; pt.vy *= 0.94;
      pt.life -= dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt);
    // Keep traffic topped up.
    const traffic = state.cars.filter((c) => c.kind === 'traffic').length;
    if (traffic < 10) state.cars.push(spawnTrafficCar());
    return events;
  }

  function startMissionAt(index) {
    const def = startMission(state.missions, index);
    if (def.heat) {
      state.wanted = Math.max(state.wanted, 3);
      state.crimeTimer = 0;
    }
    return def;
  }

  reset();
  return { state, reset, step, startMissionAt, addCrime };
}
