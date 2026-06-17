import { showScreen, submitScore, loadLeaderboard, supabase } from '../../shared.js';
import { ShooterGame } from './ShooterGame.js';

const GAME_W = 800, GAME_H = 380, GROUND_Y = 310;
const GRAVITY = 0.55, PLAYER_SPEED = 3.5, JUMP_FORCE = -11;
const PLAYER_W = 26, PLAYER_H = 38;
const ENEMY_W = 26, ENEMY_H = 34;
const BULLET_SPEED = 9, MAX_HEALTH = 3;
const CAMERA_SPEED_BASE = 0.8;
const SHOOTER_COLORS = ['#FFD700', '#FF4455'];

let shName = '';
let shGame = null;
let shHostState = null;
let shChannel = null;
let shIsHost = false;
let shMyId = '';
let shLobbyPlayers = {};

export function initShooter(myId) {
  shMyId = myId;

  document.getElementById('btn-sh-solo').addEventListener('click', () => {
    shName = document.getElementById('sh-name').value.trim();
    if (!shName) return setShError('Enter your name first.');
    setShError('');
    startSinglePlayer();
  });

  document.getElementById('btn-sh-coop').addEventListener('click', () => {
    shName = document.getElementById('sh-name').value.trim();
    if (!shName) return setShError('Enter your name first.');
    setShError('');
    createShooterRoom();
  });

  document.getElementById('btn-sh-join-show').addEventListener('click', () =>
    document.getElementById('sh-join-form').classList.toggle('hidden'));

  document.getElementById('btn-sh-join').addEventListener('click', () => {
    shName = document.getElementById('sh-name').value.trim();
    const code = document.getElementById('sh-join-code').value.trim();
    if (!shName) return setShError('Enter your name first.');
    if (code.length < 4) return setShError('Enter a 4-letter room code.');
    setShError('');
    joinShooterRoom(code);
  });

  document.getElementById('sh-join-code').addEventListener('input', e =>
    e.target.value = e.target.value.toUpperCase());

  document.getElementById('btn-sh-lb-show').addEventListener('click', loadShooterLeaderboard);
  document.getElementById('btn-sh-lb-back').addEventListener('click', () => showScreen('screen-home'));
  document.getElementById('btn-sh-home').addEventListener('click', () => { shCleanup(); showScreen('screen-home'); });
  document.getElementById('btn-sh-start').addEventListener('click', hostStartShooterGame);
  document.getElementById('btn-sh-lobby-home').addEventListener('click', () => { shCleanup(); showScreen('screen-home'); });
  document.getElementById('btn-sh-restart').addEventListener('click', () => {
    if (shIsHost) hostStartShooterGame();
  });
  document.getElementById('btn-sh-gameover-home').addEventListener('click', () => { shCleanup(); showScreen('screen-home'); });
}

function setShError(msg) {
  document.getElementById('sh-error').textContent = msg;
}

// ── Single Player ──────────────────────────────────────────────────────────────
function startSinglePlayer() {
  shIsHost = true;
  shCleanup();
  shLobbyPlayers = { [shMyId]: { name: shName, color: SHOOTER_COLORS[0] } };
  showScreen('screen-shooter-game');
  const canvas = document.getElementById('sh-canvas');
  shGame = new ShooterGame(canvas, handleShInput, shMyId);
  shGame.start();
  initHostState();
  shHostState.gameLoop = setInterval(shHostTick, 1000 / 30);
}

// ── Multiplayer ────────────────────────────────────────────────────────────────
function genCode() { return Math.random().toString(36).substring(2, 6).toUpperCase(); }

async function createShooterRoom() {
  shIsHost = true;
  shCleanup();
  shLobbyPlayers = { [shMyId]: { name: shName, color: SHOOTER_COLORS[0], isHost: true } };
  const code = genCode();
  await openShooterChannel(code);
  document.getElementById('sh-lobby-code').textContent = code;
  document.getElementById('sh-lobby-host-controls').classList.remove('hidden');
  document.getElementById('sh-lobby-guest-msg').classList.add('hidden');
  renderShooterLobby();
  showScreen('screen-shooter-lobby');
}

async function joinShooterRoom(code) {
  shIsHost = false;
  shCleanup();
  shLobbyPlayers = { [shMyId]: { name: shName, color: SHOOTER_COLORS[1], isHost: false } };
  await openShooterChannel(code.toUpperCase());
  document.getElementById('sh-lobby-code').textContent = code.toUpperCase();
  document.getElementById('sh-lobby-host-controls').classList.add('hidden');
  document.getElementById('sh-lobby-guest-msg').classList.remove('hidden');
  renderShooterLobby();
  showScreen('screen-shooter-lobby');
}

function renderShooterLobby() {
  const grid = document.getElementById('sh-lobby-players');
  grid.innerHTML = '';
  const entries = Object.entries(shLobbyPlayers);
  for (let i = 0; i < 2; i++) {
    const slot = document.createElement('div');
    if (i < entries.length) {
      const [, info] = entries[i];
      slot.className = 'player-slot filled';
      slot.style.borderColor = info.color;
      slot.innerHTML = `<div class="slot-bird">🔫</div><div class="slot-name">${info.name}</div>${info.isHost ? '<div class="slot-host">👑 Host</div>' : ''}`;
    } else {
      slot.className = 'player-slot empty';
      slot.innerHTML = `<div class="slot-bird">…</div><div class="slot-name">Open</div>`;
    }
    grid.appendChild(slot);
  }
  document.getElementById('sh-lobby-status').textContent = `${entries.length}/2 players`;
}

async function openShooterChannel(code) {
  shChannel = supabase.channel('shooter:' + code, {
    config: { broadcast: { self: true }, presence: { key: shMyId } },
  });

  shChannel.on('presence', { event: 'sync' }, () => {
    const map = shChannel.presenceState();
    const seen = new Set();
    for (const [id, arr] of Object.entries(map)) {
      const info = arr[0];
      if (!shLobbyPlayers[id]) {
        const idx = Object.keys(shLobbyPlayers).length;
        shLobbyPlayers[id] = { name: info.name, color: SHOOTER_COLORS[idx % 2], isHost: info.isHost };
      }
      seen.add(id);
    }
    for (const id of Object.keys(shLobbyPlayers)) {
      if (!seen.has(id)) delete shLobbyPlayers[id];
    }
    renderShooterLobby();
  });

  shChannel.on('broadcast', { event: 'sh_start' }, ({ payload }) => {
    if (!shIsHost) startGuestRenderer(payload);
  });

  shChannel.on('broadcast', { event: 'sh_state' }, ({ payload }) => {
    if (!shIsHost && shGame) shGame.updateState(payload);
  });

  shChannel.on('broadcast', { event: 'sh_over' }, ({ payload }) => {
    if (!shIsHost) {
      if (shGame) { shGame.destroy(); shGame = null; }
      renderShooterGameOver(payload.results);
      showScreen('screen-shooter-gameover');
    }
  });

  shChannel.on('broadcast', { event: 'sh_input' }, ({ payload }) => {
    if (!shIsHost || !shHostState) return;
    shHostState.inputs[payload.id] = payload.input;
  });

  return new Promise(resolve => {
    shChannel.subscribe(async status => {
      if (status === 'SUBSCRIBED') {
        await shChannel.track({ name: shName, isHost: shIsHost });
        resolve();
      }
    });
  });
}

async function hostStartShooterGame() {
  shCleanupGame();
  showScreen('screen-shooter-game');
  const canvas = document.getElementById('sh-canvas');
  shGame = new ShooterGame(canvas, handleShInput, shMyId);
  shGame.start();
  initHostState();
  const payload = { players: serializeSHPlayers(shHostState.players), platforms: shHostState.platforms, cameraX: 0, wave: 1 };
  shChannel?.send({ type: 'broadcast', event: 'sh_start', payload });
  shHostState.gameLoop = setInterval(shHostTick, 1000 / 30);
}

function startGuestRenderer(payload) {
  showScreen('screen-shooter-game');
  const canvas = document.getElementById('sh-canvas');
  if (shGame) shGame.destroy();
  shGame = new ShooterGame(canvas, handleShInput, shMyId);
  shGame.updateState(payload);
  shGame.start();
}

// ── Host physics ───────────────────────────────────────────────────────────────
function initHostState() {
  const players = {};
  let i = 0;
  for (const [id, info] of Object.entries(shLobbyPlayers)) {
    players[id] = makeSHPlayer(id, info.name, info.color || SHOOTER_COLORS[i % 2]);
    i++;
  }
  shHostState = {
    players, enemies: [], bullets: [],
    platforms: [], platformGenX: 300,
    cameraX: 0, wave: 1, tickCount: 0,
    spawnTimer: 60,
    inputs: { [shMyId]: { left: false, right: false, jump: false, shoot: false } },
    gameLoop: null, ended: false,
    bulletId: 0, enemyId: 0,
  };
  generatePlatforms(shHostState);
}

function makeSHPlayer(id, name, color) {
  return {
    id, name, color,
    x: 150, y: 0, vx: 0, vy: 0,
    onGround: true, facingRight: true,
    health: MAX_HEALTH, score: 0, alive: true,
    shootCooldown: 0, iFrames: 0, jumpHeld: false,
  };
}

function serializeSHPlayers(players) {
  const out = {};
  for (const id in players) {
    const p = players[id];
    out[id] = { id: p.id, name: p.name, color: p.color, x: p.x, y: p.y, vx: p.vx, vy: p.vy, onGround: p.onGround, facingRight: p.facingRight, health: p.health, score: p.score, alive: p.alive, iFrames: p.iFrames };
  }
  return out;
}

function handleShInput(inputState) {
  if (shIsHost && shHostState) {
    shHostState.inputs[shMyId] = inputState;
  } else if (shChannel) {
    shChannel.send({ type: 'broadcast', event: 'sh_input', payload: { id: shMyId, input: inputState } });
  }
}

function shHostTick() {
  if (!shHostState || shHostState.ended) return;
  const hs = shHostState;
  hs.tickCount++;

  // Scroll camera
  const scrollSpeed = CAMERA_SPEED_BASE + (hs.wave - 1) * 0.1;
  hs.cameraX += scrollSpeed;

  // Generate platforms
  generatePlatforms(hs);

  // Purge off-screen platforms
  hs.platforms = hs.platforms.filter(p => p.x + p.w > hs.cameraX - 200);

  // Spawn enemies
  hs.spawnTimer--;
  if (hs.spawnTimer <= 0) {
    spawnEnemy(hs);
    hs.spawnTimer = Math.max(30, 80 - hs.wave * 4);
  }

  // Advance wave every 600 ticks
  if (hs.tickCount % 600 === 0) hs.wave++;

  // Update players
  for (const id in hs.players) {
    const p = hs.players[id];
    if (!p.alive) continue;
    const input = hs.inputs[id] || {};
    updateSHPlayer(p, input, hs);
  }

  // Update enemies
  for (const en of hs.enemies) {
    updateEnemy(en, hs);
  }

  // Move bullets + collision
  updateBullets(hs);

  // Purge off-screen
  hs.enemies = hs.enemies.filter(en => en.x > hs.cameraX - 100);
  hs.bullets = hs.bullets.filter(b => b.x > hs.cameraX - 50 && b.x < hs.cameraX + GAME_W + 50 && b.y > -50 && b.y < GAME_H + 50);

  // Build state payload
  const statePayload = {
    players: serializeSHPlayers(hs.players),
    enemies: hs.enemies.map(e => ({ id: e.id, x: e.x, y: e.y, type: e.type, facingRight: e.facingRight, health: e.health })),
    bullets: hs.bullets.map(b => ({ id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy, fromPlayer: b.fromPlayer })),
    platforms: hs.platforms.filter(p => p.x - hs.cameraX < GAME_W + 100 && p.x + p.w > hs.cameraX - 100),
    cameraX: hs.cameraX, wave: hs.wave,
  };

  if (shChannel) shChannel.send({ type: 'broadcast', event: 'sh_state', payload: statePayload });
  if (shGame) shGame.updateState(statePayload);

  // Check game over
  if (Object.values(hs.players).every(p => !p.alive)) shHostEndGame();
}

function updateSHPlayer(p, input, hs) {
  const prevY = p.y;

  p.vx = input.left ? -PLAYER_SPEED : input.right ? PLAYER_SPEED : 0;
  if (p.vx > 0) p.facingRight = true;
  if (p.vx < 0) p.facingRight = false;

  // Jump
  if (input.jump && !p.jumpHeld && p.onGround) {
    p.vy = JUMP_FORCE;
    p.onGround = false;
    p.jumpHeld = true;
  }
  if (!input.jump) p.jumpHeld = false;

  // Gravity
  p.vy += GRAVITY;
  p.x += p.vx;
  p.y -= p.vy; // y is up, vy negative = moving up

  // Ground
  if (p.y <= 0) {
    p.y = 0; p.vy = 0; p.onGround = true;
  }

  // Platform collision
  for (const plat of hs.platforms) {
    const inX = p.x + PLAYER_W/2 > plat.x && p.x - PLAYER_W/2 < plat.x + plat.w;
    const platTopY = GAME_H - plat.y; // plat.y is the top surface in game coords
    if (inX && prevY >= platTopY && p.y < platTopY && p.vy > 0) {
      // Wait, let me think about coords. p.y is the feet position in game space (y up).
      // plat.y is the top of the platform surface in game space.
      // Player was above platform surface last tick, now below → land.
    }
  }

  // Better platform collision: p.y = feet height (y-up), platform.y = surface height
  for (const plat of hs.platforms) {
    const inX = p.x + PLAYER_W/2 > plat.x && p.x - PLAYER_W/2 < plat.x + plat.w;
    if (inX && p.vy > 0) { // vy > 0 means falling (y decreasing)
      if (p.y <= plat.y && prevY >= plat.y - 2) {
        p.y = plat.y; p.vy = 0; p.onGround = true;
      }
    }
  }

  // Camera clamp
  p.x = Math.max(hs.cameraX + 30, Math.min(hs.cameraX + GAME_W - 30, p.x));

  // Scrolled off left → die
  if (p.x < hs.cameraX + 5) { p.alive = false; return; }

  // Shoot
  if (p.shootCooldown > 0) p.shootCooldown--;
  if (input.shoot && p.shootCooldown <= 0) {
    p.shootCooldown = 8;
    hs.bullets.push({
      id: hs.bulletId++,
      x: p.x + (p.facingRight ? 18 : -18),
      y: p.y + PLAYER_H * 0.6,
      vx: BULLET_SPEED * (p.facingRight ? 1 : -1),
      vy: 0,
      fromPlayer: true,
      playerId: p.id,
    });
  }

  if (p.iFrames > 0) p.iFrames--;
}

function updateEnemy(en, hs) {
  const alivePlayers = Object.values(hs.players).filter(p => p.alive);
  if (!alivePlayers.length) return;
  const nearest = alivePlayers.reduce((a, b) => Math.abs(a.x - en.x) < Math.abs(b.x - en.x) ? a : b);
  const dx = nearest.x - en.x;
  const dy = nearest.y - en.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (en.type === 'walker') {
    const dir = dx > 0 ? 1 : -1;
    en.facingRight = dir > 0;
    en.x += dir * 1.5;
    en.shootTimer--;
    if (en.shootTimer <= 0) {
      en.shootTimer = 60 + Math.floor(Math.random() * 60);
      if (dist < 400) {
        hs.bullets.push({ id: hs.bulletId++, x: en.x + (en.facingRight ? 14 : -14), y: en.y + 20, vx: 5 * dir, vy: 0, fromPlayer: false });
      }
    }
  } else {
    // Flyer
    const spd = 1.2;
    en.x += (dist > 0 ? dx / dist : 0) * spd;
    en.phase = (en.phase || 0) + 0.06;
    en.y = en.baseY + Math.sin(en.phase) * 40;
    en.facingRight = dx > 0;
    en.shootTimer--;
    if (en.shootTimer <= 0) {
      en.shootTimer = 50 + Math.floor(Math.random() * 50);
      if (dist < 350 && dist > 0) {
        hs.bullets.push({ id: hs.bulletId++, x: en.x, y: en.y, vx: (dx / dist) * 5, vy: -(dy / dist) * 5, fromPlayer: false });
      }
    }
  }
}

function updateBullets(hs) {
  for (const b of hs.bullets) {
    b.x += b.vx;
    b.y -= b.vy; // y is up, so vy positive = moving up = canvas y decreasing
  }

  // Player bullets vs enemies
  for (const b of hs.bullets) {
    if (!b.fromPlayer || b.hit) continue;
    for (const en of hs.enemies) {
      if (Math.abs(b.x - en.x) < ENEMY_W && Math.abs(b.y - en.y) < ENEMY_H) {
        b.hit = true;
        en.health--;
        if (en.health <= 0) {
          en.dead = true;
          // Award score
          const shooter = Object.values(hs.players).find(p => p.id === b.playerId);
          if (shooter) shooter.score += en.type === 'flyer' ? 20 : 10;
        }
        break;
      }
    }
  }

  // Enemy bullets vs players
  for (const b of hs.bullets) {
    if (b.fromPlayer || b.hit) continue;
    for (const p of Object.values(hs.players)) {
      if (!p.alive || p.iFrames > 0) continue;
      if (Math.abs(b.x - p.x) < PLAYER_W && Math.abs(b.y - p.y) < PLAYER_H) {
        b.hit = true;
        p.health--;
        p.iFrames = 60;
        if (p.health <= 0) p.alive = false;
        break;
      }
    }
  }

  hs.bullets = hs.bullets.filter(b => !b.hit);
  hs.enemies = hs.enemies.filter(en => !en.dead);
}

function spawnEnemy(hs) {
  const isFlyer = Math.random() < 0.3;
  const spawnX = hs.cameraX + GAME_W + 60;
  if (isFlyer) {
    hs.enemies.push({ id: hs.enemyId++, type: 'flyer', x: spawnX, y: GROUND_Y - 80, baseY: GROUND_Y - 80, facingRight: false, health: 2, shootTimer: 80, phase: 0 });
  } else {
    hs.enemies.push({ id: hs.enemyId++, type: 'walker', x: spawnX, y: 0, facingRight: false, health: 3, shootTimer: 80 });
  }
}

function generatePlatforms(hs) {
  while (hs.platformGenX < hs.cameraX + GAME_W + 400) {
    const gap = 150 + Math.floor(Math.random() * 100);
    hs.platformGenX += gap;
    if (Math.random() < 0.6) {
      const pw = 90 + Math.floor(Math.random() * 80);
      const ph = 14;
      const py = GROUND_Y - 80 - Math.floor(Math.random() * 80); // surface height in game coords
      hs.platforms.push({ x: hs.platformGenX, y: py, w: pw, h: ph });
    }
  }
}

async function shHostEndGame() {
  if (!shHostState || shHostState.ended) return;
  shHostState.ended = true;
  clearInterval(shHostState.gameLoop);
  shHostState.gameLoop = null;

  const results = Object.values(shHostState.players)
    .map(p => ({ name: p.name, score: p.score, color: p.color }))
    .sort((a, b) => b.score - a.score);

  for (const r of results) {
    if (r.score > 0) await submitScore({ player_name: r.name, score: r.score, game_name: 'shooter' });
  }

  shChannel?.send({ type: 'broadcast', event: 'sh_over', payload: { results } });

  if (shGame) { shGame.destroy(); shGame = null; }
  shHostState = null;

  renderShooterGameOver(results);
  showScreen('screen-shooter-gameover');
}

function renderShooterGameOver(results) {
  const list = document.getElementById('sh-results-list');
  list.innerHTML = '';
  results.forEach((r, i) => {
    const div = document.createElement('div');
    div.className = 'result-row';
    div.innerHTML = `
      <span class="result-rank ${['gold','silver','bronze'][i]||''}">${['🥇','🥈','🥉'][i]||`${i+1}.`}</span>
      <span class="result-name" style="color:${r.color}">${r.name}</span>
      <span class="result-score">${r.score} pts</span>`;
    list.appendChild(div);
  });
  document.getElementById('btn-sh-restart').classList.toggle('hidden', !shIsHost);
}

async function loadShooterLeaderboard() {
  showScreen('screen-shooter-lb');
  await loadLeaderboard('shooter', 'sh-lb-body', {
    ascending: false,
    render: (r, i) => `<tr><td>${i+1}</td><td>${r.player_name}</td><td>${r.score}</td></tr>`,
  });
}

function shCleanupGame() {
  if (shHostState) {
    clearInterval(shHostState.gameLoop);
    shHostState = null;
  }
  if (shGame) { shGame.destroy(); shGame = null; }
}

function shCleanup() {
  shCleanupGame();
  if (shChannel) { shChannel.unsubscribe(); shChannel = null; }
  shLobbyPlayers = {};
  shIsHost = false;
}
