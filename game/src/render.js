// Drawing only: the world state and the current screen in, pixels out.
// The camera follows the player across a fixed 1280x720 viewport, scaled to
// fit the window. Flat canvas shapes, canvas text for the HUD, the minimap
// and the menu panels.
import {
  BEACH_W, BLOCK, CITY, FONT, GRID, PALETTE, ROAD, SEA_W, blockX, blockY,
  clamp, streetX, streetY,
} from './config.js';
import { worldHeight, worldWidth } from './city.js';
import { MISSION_COUNT } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_HOWTO = 'howto';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_COMPLETE = 'complete';

const VIEW_W = 1280;
const VIEW_H = 720;
const MAP_SIZE = 176;

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const camera = { x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW_W, height / VIEW_H);
    view.x = (width - VIEW_W * view.scale) / 2;
    view.y = (height - VIEW_H * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align = 'left', weight = '') {
    const key = `${weight}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  // --- the city -------------------------------------------------------------
  function drawCity(state, camX, camY) {
    const city = state.city;
    const ww = worldWidth(), wh = worldHeight();
    // Ground: grass base, sea on the east.
    context.fillStyle = PALETTE.grass;
    context.fillRect(camX, camY, ww, wh);
    context.fillStyle = PALETTE.sea;
    context.fillRect(camX + CITY + BEACH_W, camY, SEA_W, wh);
    context.fillStyle = PALETTE.seaDeep;
    for (let i = 0; i < 5; i += 1) {
      context.fillRect(camX + CITY + BEACH_W + 30 + i * 38, camY + 60 + i * 130, 90, 6);
    }
    // Sand strip.
    context.fillStyle = PALETTE.sand;
    context.fillRect(camX + CITY, camY, BEACH_W, wh);
    // City asphalt base.
    context.fillStyle = PALETTE.asphalt;
    context.fillRect(camX, camY, CITY, CITY);
    // Parks.
    for (const park of city.parks) {
      context.fillStyle = PALETTE.grass;
      context.fillRect(camX + park.x, camY + park.y, park.w, park.h);
      context.fillStyle = PALETTE.parkDark;
      context.fillRect(camX + park.x + 14, camY + park.y + 14, park.w - 28, park.h - 28);
    }
    // Trees.
    for (const t of city.trees) {
      context.fillStyle = '#2fae62';
      context.beginPath();
      context.arc(camX + t.x, camY + t.y, t.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#1d7a44';
      context.beginPath();
      context.arc(camX + t.x - 3, camY + t.y - 3, t.r * 0.55, 0, Math.PI * 2);
      context.fill();
    }
    // Beach umbrellas.
    for (const u of city.umbrellas) {
      context.fillStyle = u.color;
      context.beginPath();
      context.arc(camX + u.x, camY + u.y, 14, Math.PI, 0);
      context.fill();
      context.strokeStyle = '#7a5a30';
      context.beginPath();
      context.moveTo(camX + u.x, camY + u.y);
      context.lineTo(camX + u.x, camY + u.y + 16);
      context.stroke();
    }
    // Sidewalks around each block.
    context.fillStyle = PALETTE.sidewalk;
    for (let i = 0; i < GRID; i += 1) {
      for (let j = 0; j < GRID; j += 1) {
        context.fillRect(camX + blockX(i) - 10, camY + blockY(j) - 10, BLOCK + 20, BLOCK + 20);
      }
    }
    // Lane dashes on every street.
    context.fillStyle = PALETTE.lane;
    for (let i = 0; i <= GRID; i += 1) {
      for (let s = ROAD + 20; s < CITY - 20; s += 56) {
        context.fillRect(camX + s, camY + streetY(i) - 2, 26, 4);
        context.fillRect(camX + streetX(i) - 2, camY + s, 4, 26);
      }
    }
    // Buildings with neon roof edges downtown.
    for (const b of city.buildings) {
      context.fillStyle = b.color;
      context.fillRect(camX + b.x, camY + b.y, b.w, b.h);
      context.fillStyle = b.roof;
      context.fillRect(camX + b.x + 6, camY + b.y + 6, b.w - 12, b.h - 12);
      context.fillStyle = 'rgba(255,255,255,0.16)';
      context.fillRect(camX + b.x + 10, camY + b.y + 10, b.w - 20, 8);
      if (b.neon) {
        context.strokeStyle = b.roof;
        context.lineWidth = 3;
        context.strokeRect(camX + b.x + 1.5, camY + b.y + 1.5, b.w - 3, b.h - 3);
      }
      if (b.tall) {
        context.fillStyle = 'rgba(0,0,0,0.25)';
        context.fillRect(camX + b.x + b.w - 14, camY + b.y + 8, 6, b.h - 16);
      }
    }
    // Sunset glow along the west edge.
    const glow = context.createLinearGradient(camX, camY, camX + 200, camY);
    glow.addColorStop(0, 'rgba(255, 94, 164, 0.10)');
    glow.addColorStop(1, 'rgba(255, 94, 164, 0)');
    context.fillStyle = glow;
    context.fillRect(camX, camY, 200, wh);
  }

  function drawCar(car, camX, camY, now) {
    const x = camX + car.x, y = camY + car.y;
    context.save();
    context.translate(x, y);
    context.rotate(car.angle);
    // Body: 34 long, 18 wide.
    context.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(-17, -8, 34, 18, 5);
    context.fill();
    context.fillStyle = car.color;
    roundRect(-18, -9, 36, 18, 5);
    context.fill();
    // Windshield and rear window.
    context.fillStyle = '#1c2b3a';
    context.fillRect(4, -7, 7, 14);
    context.fillRect(-13, -7, 5, 14);
    // Headlights.
    context.fillStyle = '#fff7c0';
    context.fillRect(16, -7, 3, 4);
    context.fillRect(16, 3, 3, 4);
    if (car.kind === 'police') {
      // Flashing light bar.
      const phase = Math.floor(now * 4 + car.sirenPhase) % 2 === 0;
      context.fillStyle = phase ? '#ff2e4d' : '#2f7bff';
      context.fillRect(-4, -8, 8, 5);
      context.fillStyle = phase ? '#2f7bff' : '#ff2e4d';
      context.fillRect(-4, 3, 8, 5);
    }
    if (car.kind === 'player') {
      context.strokeStyle = PALETTE.neonYellow;
      context.lineWidth = 2;
      roundRect(-18, -9, 36, 18, 5);
      context.stroke();
    }
    context.restore();
  }

  function drawPed(ped, camX, camY) {
    const x = camX + ped.x, y = camY + ped.y;
    if (ped.state === 'down') {
      context.fillStyle = ped.color;
      context.beginPath();
      context.ellipse(x, y, 10, 5, ped.angle, 0, Math.PI * 2);
      context.fill();
      return;
    }
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.beginPath();
    context.ellipse(x, y + 5, 7, 3, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = ped.color;
    context.beginPath();
    context.arc(x, y, 7, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#2b1c33';
    context.beginPath();
    context.arc(x + Math.cos(ped.angle) * 3, y + Math.sin(ped.angle) * 3, 3, 0, Math.PI * 2);
    context.fill();
  }

  function drawPlayer(state, camX, camY) {
    const p = state.player;
    if (!p.onFoot) return;
    const x = camX + p.x, y = camY + p.y;
    context.fillStyle = 'rgba(0,0,0,0.35)';
    context.beginPath();
    context.ellipse(x, y + 6, 9, 4, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(x, y, 10, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#2b1c33';
    context.beginPath();
    context.arc(x + Math.cos(p.angle) * 4, y + Math.sin(p.angle) * 4, 4, 0, Math.PI * 2);
    context.fill();
    // Direction tick so the player reads at a glance.
    context.strokeStyle = PALETTE.player;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(x + Math.cos(p.angle) * 10, y + Math.sin(p.angle) * 10);
    context.lineTo(x + Math.cos(p.angle) * 18, y + Math.sin(p.angle) * 18);
    context.stroke();
  }

  function drawMarker(state, camX, camY, now) {
    const m = state.missions;
    if (!m.target) return;
    const x = camX + m.target.x, y = camY + m.target.y;
    const pulse = 26 + Math.sin(now * 4) * 5;
    context.strokeStyle = PALETTE.neonPink;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(x, y, pulse, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = 'rgba(255, 46, 136, 0.25)';
    context.beginPath();
    context.arc(x, y, pulse, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.neonPink;
    context.beginPath();
    context.arc(x, y, 7, 0, Math.PI * 2);
    context.fill();
    // Edge arrow when the target is off-screen.
    if (x < 40 || x > VIEW_W - 40 || y < 40 || y > VIEW_H - 40) {
      const ax = clamp(x, 60, VIEW_W - 60);
      const ay = clamp(y, 60, VIEW_H - 60);
      const a = Math.atan2(y - VIEW_H / 2, x - VIEW_W / 2);
      context.save();
      context.translate(ax, ay);
      context.rotate(a);
      context.fillStyle = PALETTE.neonPink;
      context.beginPath();
      context.moveTo(16, 0);
      context.lineTo(-10, -11);
      context.lineTo(-10, 11);
      context.closePath();
      context.fill();
      context.restore();
    }
  }

  function drawPickups(state, camX, camY, now) {
    for (const pk of state.pickups) {
      const x = camX + pk.x, y = camY + pk.y + Math.sin(pk.bob) * 3;
      context.fillStyle = '#2ecc71';
      context.beginPath();
      context.arc(x, y, 11, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffffff';
      context.font = 'bold 13px ' + FONT;
      context.textAlign = 'center';
      context.fillText('$', x, y + 5);
    }
  }

  // --- HUD ------------------------------------------------------------------
  function drawStars(wanted) {
    for (let i = 0; i < 5; i += 1) {
      const x = VIEW_W / 2 - 62 + i * 26;
      const y = 34;
      context.fillStyle = i < wanted ? PALETTE.neonYellow : 'rgba(255,255,255,0.25)';
      context.beginPath();
      for (let k = 0; k < 5; k += 1) {
        const a = -Math.PI / 2 + (k * 4 * Math.PI) / 5;
        const px = x + Math.cos(a) * 11;
        const py = y + Math.sin(a) * 11;
        if (k === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
    }
  }

  function drawMinimap(state) {
    const mx = VIEW_W - MAP_SIZE - 16;
    const my = 16;
    const scale = MAP_SIZE / worldWidth();
    context.fillStyle = PALETTE.hudBg;
    roundRect(mx - 6, my - 6, MAP_SIZE + 12, MAP_SIZE + 12, 8);
    context.fill();
    context.save();
    context.beginPath();
    context.rect(mx, my, MAP_SIZE, MAP_SIZE);
    context.clip();
    context.fillStyle = PALETTE.asphalt;
    context.fillRect(mx, my, MAP_SIZE, MAP_SIZE);
    context.fillStyle = PALETTE.sand;
    context.fillRect(mx + CITY * scale, my, BEACH_W * scale, MAP_SIZE);
    context.fillStyle = PALETTE.sea;
    context.fillRect(mx + (CITY + BEACH_W) * scale, my, SEA_W * scale, MAP_SIZE);
    // Roads.
    context.fillStyle = 'rgba(255,255,255,0.14)';
    for (let i = 0; i <= GRID; i += 1) {
      context.fillRect(mx, my + streetY(i) * scale - 1, CITY * scale, 2);
      context.fillRect(mx + streetX(i) * scale - 1, my, 2, CITY * scale);
    }
    const dot = (x, y, r, color) => {
      context.fillStyle = color;
      context.beginPath();
      context.arc(mx + x * scale, my + y * scale, r, 0, Math.PI * 2);
      context.fill();
    };
    for (const car of state.cars) if (car.kind === 'traffic') dot(car.x, car.y, 2, '#ffffff');
    for (const car of state.police) dot(car.x, car.y, 3, PALETTE.police);
    if (state.missions.target) dot(state.missions.target.x, state.missions.target.y, 4, PALETTE.neonPink);
    dot(state.player.x, state.player.y, 4, PALETTE.neonYellow);
    context.restore();
    context.strokeStyle = 'rgba(255,255,255,0.35)';
    context.lineWidth = 1;
    roundRect(mx - 6, my - 6, MAP_SIZE + 12, MAP_SIZE + 12, 8);
    context.stroke();
  }

  function drawHud(state, best) {
    const m = state.missions;
    context.fillStyle = PALETTE.hudBg;
    roundRect(12, 12, 250, 64, 10);
    context.fill();
    text(`$${state.cash}`, 26, 40, 26, '#ffffff', 'left', 'bold ');
    text(`Best $${Math.max(best, state.cash)}`, 26, 64, 14, '#cfc4e8');
    drawStars(state.wanted);
    // Objective bar.
    context.fillStyle = PALETTE.hudBg;
    roundRect(12, 84, 560, 34, 10);
    context.fill();
    context.fillStyle = PALETTE.neonPink;
    context.beginPath();
    context.arc(30, 101, 6, 0, Math.PI * 2);
    context.fill();
    const obj = m.objective.length > 64 ? m.objective.slice(0, 64) + '…' : m.objective;
    text(obj, 44, 107, 16, '#ffffff');
    // Mission timer.
    if ((m.phase === 'active' || m.phase === 'pickup' || m.phase === 'deliver') && m.timer > 0) {
      const t = Math.max(0, Math.ceil(m.timer));
      const col = t <= 15 ? '#ff5d5d' : '#ffffff';
      text(`${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`, VIEW_W / 2, 78, 24, col, 'center', 'bold ');
    }
    // Mission counter.
    text(`Job ${Math.min(m.index + 1, MISSION_COUNT)} / ${MISSION_COUNT}`, VIEW_W - MAP_SIZE - 30, 218, 14, '#cfc4e8', 'right');
    drawMinimap(state);
    // Speed, when driving.
    const p = state.player;
    if (!p.onFoot && p.car) {
      const mph = Math.round(Math.abs(p.car.speed) * 0.12);
      text(`${mph}`, VIEW_W - 30, VIEW_H - 30, 44, '#ffffff', 'right', 'bold ');
      text('MPH', VIEW_W - 30, VIEW_H - 8, 14, '#cfc4e8', 'right');
      // Car health bar.
      context.fillStyle = 'rgba(0,0,0,0.5)';
      roundRect(VIEW_W - 230, VIEW_H - 26, 140, 12, 6);
      context.fill();
      context.fillStyle = p.car.health > 40 ? '#2ecc71' : '#ff5d5d';
      roundRect(VIEW_W - 230, VIEW_H - 26, 140 * clamp(p.car.health / 100, 0, 1), 12, 6);
      context.fill();
    }
    // Mission-complete banner.
    if (m.banner > 0 && m.lastCompleted) {
      context.fillStyle = 'rgba(16, 8, 32, 0.85)';
      roundRect(VIEW_W / 2 - 260, 150, 520, 92, 14);
      context.fill();
      text('JOB COMPLETE', VIEW_W / 2, 188, 30, PALETTE.neonYellow, 'center', 'bold ');
      text(`${m.lastCompleted.name}  ·  +$${m.lastCompleted.reward}`, VIEW_W / 2, 222, 20, '#ffffff', 'center');
    }
    if (m.phase === 'failed') {
      text('JOB FAILED — press Enter to retry', VIEW_W / 2, 150, 24, '#ff5d5d', 'center', 'bold ');
    }
  }

  // --- panels ---------------------------------------------------------------
  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 32 + 70;
    const x = (VIEW_W - width) / 2;
    const y = (VIEW_H - height) / 2;
    context.fillStyle = 'rgba(10, 5, 20, 0.88)';
    roundRect(x, y, width, height, 16);
    context.fill();
    context.strokeStyle = accent;
    context.lineWidth = 3;
    roundRect(x, y, width, height, 16);
    context.stroke();
    text(title, VIEW_W / 2, y + 66, 46, accent, 'center', 'bold ');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW_W / 2, y + 118 + i * 32, 19, '#e8e2f5', 'center');
    }
    text(prompt, VIEW_W / 2, y + height - 30, 20, PALETTE.neonYellow, 'center');
  }

  function drawWorld(state, now) {
    const p = state.player;
    const shake = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 24 : 0;
    camera.x = clamp(p.x - VIEW_W / 2 + shake, 0, Math.max(0, worldWidth() - VIEW_W));
    camera.y = clamp(p.y - VIEW_H / 2 + shake, 0, Math.max(0, worldHeight() - VIEW_H));
    const camX = -camera.x;
    const camY = -camera.y;
    drawCity(state, camX, camY);
    drawPickups(state, camX, camY, now);
    drawMarker(state, camX, camY, now);
    for (const car of state.cars) drawCar(car, camX, camY, now);
    for (const car of state.police) drawCar(car, camX, camY, now);
    for (const ped of state.peds) drawPed(ped, camX, camY);
    for (const pt of state.particles) {
      context.fillStyle = pt.color;
      context.globalAlpha = clamp(pt.life * 2, 0, 1);
      context.fillRect(camX + pt.x - 2, camY + pt.y - 2, 4, 4);
      context.globalAlpha = 1;
    }
    drawPlayer(state, camX, camY);
  }

  const TITLE_LINES = [
    'Neon Bay is yours. Walk it, steal it, drive it.',
    'Take jobs from Rosa Marín. Outrun the Neon Bay force.',
    'WASD / arrows — move & drive · E — enter / exit a car',
    'Space — handbrake · P — pause · M — mute · H — how to play',
  ];
  const HOWTO_LINES = [
    'On foot: WASD or arrows to walk. Stand by a car and press E to take it.',
    'Driving: W / Up to speed up, S / Down to brake and reverse, A D to steer.',
    'Space is the handbrake — useful for hard turns and sharp escapes.',
    'Stealing a car or hitting a pedestrian raises your wanted stars.',
    'Police chase you while you have stars. Lie low and the heat fades.',
    'Follow the pink marker: finish all 3 of Rosa’s jobs to beat the story.',
    'Green $ pickups pay $25. Your best cash is saved on this machine.',
  ];

  function draw(state, screen, best, now) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#12081f';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawWorld(state, now);
    if (screen === SCREEN_TITLE) {
      context.fillStyle = 'rgba(10, 5, 20, 0.45)';
      context.fillRect(0, 0, VIEW_W, VIEW_H);
      text('VICE BLOCKS', VIEW_W / 2, 108, 84, PALETTE.neonPink, 'center', 'bold ');
      text('N E O N   B A Y', VIEW_W / 2, 152, 26, PALETTE.neonTeal, 'center', 'bold ');
      drawPanel('Welcome to Neon Bay', TITLE_LINES, 'Press Enter or click to start  ·  H for how to play', PALETTE.neonPink);
      return;
    }
    drawHud(state, best);
    if (screen === SCREEN_HOWTO) {
      drawPanel('How to play', HOWTO_LINES, 'Press H or Enter to go back', PALETTE.neonTeal);
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits for you.'], 'Press P to resume', PALETTE.neonTeal);
    } else if (screen === SCREEN_OVER) {
      const over = state.over === 'busted' ? 'BUSTED' : 'WRECKED';
      const lines = state.over === 'busted'
        ? ['The Neon Bay force caught you on foot.', `Cash kept: $${state.cash}`]
        : ['Your ride is totalled.', `Cash kept: $${state.cash}`];
      drawPanel(over, lines, 'Press Enter to play again', '#ff5d5d');
    } else if (screen === SCREEN_COMPLETE) {
      drawPanel('STORY COMPLETE', [
        'All three of Rosa’s jobs are done. Neon Bay is yours.',
        `Final cash: $${state.cash}`,
        'Free roam continues — keep driving, keep earning.',
      ], 'Press Enter to keep playing', PALETTE.neonYellow);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
