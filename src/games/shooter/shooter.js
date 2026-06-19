import { showScreen, submitScore, loadLeaderboard, supabase } from '../../core/shared.js';
import { track } from '../../lib/analytics.js';
import { ShooterGame } from './ShooterGame.js';

const GAME_W      = 800;
const GAME_H      = 380;
const GROUND_Y    = 310;   // canvas-Y of ground surface (feet land here)
const GRAVITY     = 0.55;
const JUMP_FORCE  = 10.5;  // applied as p.vy = -JUMP_FORCE
const PLAYER_SPD  = 3.5;
const PLAYER_HW   = 12;    // half-width for collision
const PLAYER_H    = 48;    // total height (used for bullet spawn offset)
const ENEMY_HW    = 13;
const ENEMY_H     = 36;
const BULLET_SPD  = 9;
const MAX_HEALTH  = 3;
const CAM_SPD     = 0.8;
const COLORS      = ['#FFD700', '#FF4455'];

let shName        = '';
let shGame        = null;
let shHostState   = null;
let shChannel     = null;
let shIsHost      = false;
let shMyId        = '';
let shLobbyPlayers = {};

export function initShooter(myId) {
  shMyId = myId;

  document.getElementById('btn-sh-solo').addEventListener('click', () => {
    shName = document.getElementById('sh-name').value.trim();
    if (!shName) return setShError('Enter your name first.');
    setShError(''); startSinglePlayer();
  });

  document.getElementById('btn-sh-coop').addEventListener('click', () => {
    shName = document.getElementById('sh-name').value.trim();
    if (!shName) return setShError('Enter your name first.');
    setShError(''); createShooterRoom();
  });

  document.getElementById('btn-sh-join-show').addEventListener('click', () =>
    document.getElementById('sh-join-form').classList.toggle('hidden'));

  document.getElementById('btn-sh-join').addEventListener('click', () => {
    shName = document.getElementById('sh-name').value.trim();
    const code = document.getElementById('sh-join-code').value.trim();
    if (!shName) return setShError('Enter your name first.');
    if (code.length < 4) return setShError('Enter a 4-letter room code.');
    setShError(''); joinShooterRoom(code);
  });

  document.getElementById('sh-join-code').addEventListener('input',
    e => e.target.value = e.target.value.toUpperCase());

  document.getElementById('btn-sh-lb-show').addEventListener('click', loadShooterLeaderboard);
  document.getElementById('btn-sh-lb-back').addEventListener('click', () => showScreen('screen-home'));
  document.getElementById('btn-sh-home').addEventListener('click',    () => { shCleanup(); showScreen('screen-home'); });
  document.getElementById('btn-sh-start').addEventListener('click',   hostStartShooterGame);
  document.getElementById('btn-sh-lobby-home').addEventListener('click', () => { shCleanup(); showScreen('screen-home'); });
  document.getElementById('btn-sh-restart').addEventListener('click', () => { if (shIsHost) hostStartShooterGame(); });
  document.getElementById('btn-sh-gameover-home').addEventListener('click', () => { shCleanup(); showScreen('screen-home'); });
}

function setShError(msg) { document.getElementById('sh-error').textContent = msg; }

// ── Single Player ─────────────────────────────────────────────────────────────
function startSinglePlayer() {
  shCleanup();
  shIsHost = true;
  shLobbyPlayers = { [shMyId]: { name: shName, color: COLORS[0] } };
  _launchGame();
}

let _shooterStartTime = 0;
function _launchGame() {
  shCleanupGame();
  showScreen('screen-shooter-game');
  const canvas = document.getElementById('sh-canvas');
  shGame = new ShooterGame(canvas, handleShInput, shMyId);
  shGame.start();
  initHostState();
  shHostState.gameLoop = setInterval(shHostTick, 1000 / 30);
  _shooterStartTime = Date.now();
  track('game_start', { game_name: 'shooter', player_name: shName });
}

// ── Multiplayer ───────────────────────────────────────────────────────────────
function genCode() { return Math.random().toString(36).substring(2, 6).toUpperCase(); }

async function createShooterRoom() {
  shCleanup();
  shIsHost = true;
  shLobbyPlayers = { [shMyId]: { name: shName, color: COLORS[0], isHost: true } };
  const code = genCode();
  await openShooterChannel(code);
  document.getElementById('sh-lobby-code').textContent = code;
  document.getElementById('sh-lobby-host-controls').classList.remove('hidden');
  document.getElementById('sh-lobby-guest-msg').classList.add('hidden');
  renderShooterLobby();
  showScreen('screen-shooter-lobby');
}

async function joinShooterRoom(code) {
  shCleanup();
  shIsHost = false;
  shLobbyPlayers = { [shMyId]: { name: shName, color: COLORS[1], isHost: false } };
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
      slot.innerHTML = '<div class="slot-bird">…</div><div class="slot-name">Open</div>';
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
    const map  = shChannel.presenceState();
    const seen = new Set();
    for (const [id, arr] of Object.entries(map)) {
      const info = arr[0];
      if (!shLobbyPlayers[id]) {
        const idx = Object.keys(shLobbyPlayers).length;
        shLobbyPlayers[id] = { name: info.name, color: COLORS[idx % 2], isHost: info.isHost };
      }
      seen.add(id);
    }
    for (const id of Object.keys(shLobbyPlayers)) if (!seen.has(id)) delete shLobbyPlayers[id];
    renderShooterLobby();
  });

  shChannel.on('broadcast', { event: 'sh_start' }, ({ payload }) => { if (!shIsHost) startGuestRenderer(payload); });
  shChannel.on('broadcast', { event: 'sh_state' }, ({ payload }) => { if (!shIsHost && shGame) shGame.updateState(payload); });
  shChannel.on('broadcast', { event: 'sh_over'  }, ({ payload }) => {
    if (!shIsHost) {
      if (shGame) { shGame.destroy(); shGame = null; }
      renderShooterGameOver(payload.results);
      showScreen('screen-shooter-gameover');
    }
  });
  shChannel.on('broadcast', { event: 'sh_input' }, ({ payload }) => {
    if (shIsHost && shHostState) shHostState.inputs[payload.id] = payload.input;
  });

  return new Promise(resolve => {
    shChannel.subscribe(async status => {
      if (status === 'SUBSCRIBED') { await shChannel.track({ name: shName, isHost: shIsHost }); resolve(); }
    });
  });
}

async function hostStartShooterGame() {
  _launchGame();
  const payload = serializeState(shHostState);
  shChannel?.send({ type: 'broadcast', event: 'sh_start', payload });
}

function startGuestRenderer(payload) {
  showScreen('screen-shooter-game');
  const canvas = document.getElementById('sh-canvas');
  if (shGame) shGame.destroy();
  shGame = new ShooterGame(canvas, handleShInput, shMyId);
  shGame.updateState(payload);
  shGame.start();
}

// ── Host physics ──────────────────────────────────────────────────────────────
function initHostState() {
  const players = {};
  let i = 0;
  for (const [id, info] of Object.entries(shLobbyPlayers)) {
    players[id] = makePlayer(id, info.name, info.color || COLORS[i % 2], i);
    i++;
  }
  shHostState = {
    players, enemies: [], bullets: [],
    platforms: [], platformGenX: 200,
    cameraX: 0, wave: 1, tickCount: 0,
    spawnTimer: 90,
    inputs: {},
    gameLoop: null, ended: false,
    bulletId: 0, enemyId: 0,
  };
  for (const id in players) shHostState.inputs[id] = { left: false, right: false, jump: false, shoot: false };
  genPlatforms(shHostState);
}

function makePlayer(id, name, color, slot) {
  return {
    id, name, color,
    x: 120 + slot * 30,
    y: GROUND_Y,      // feet on ground
    vx: 0, vy: 0,
    onGround: true, facingRight: true,
    health: MAX_HEALTH, score: 0, alive: true,
    shootCd: 0, iFrames: 0, jumpHeld: false,
  };
}

function serializeState(hs) {
  return {
    players:   serializePlayers(hs.players),
    enemies:   hs.enemies.map(e => ({ id: e.id, x: e.x, y: e.y, type: e.type, facingRight: e.facingRight, health: e.health })),
    bullets:   hs.bullets.map(b => ({ id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy, fromPlayer: b.fromPlayer })),
    platforms: hs.platforms.filter(p => p.x + p.w > hs.cameraX - 100 && p.x < hs.cameraX + GAME_W + 100),
    cameraX:   hs.cameraX,
    wave:      hs.wave,
  };
}

function serializePlayers(players) {
  const out = {};
  for (const id in players) {
    const p = players[id];
    out[id] = { id: p.id, name: p.name, color: p.color, x: p.x, y: p.y, vx: p.vx, vy: p.vy, onGround: p.onGround, facingRight: p.facingRight, health: p.health, score: p.score, alive: p.alive, iFrames: p.iFrames };
  }
  return out;
}

function handleShInput(input) {
  if (shIsHost && shHostState) shHostState.inputs[shMyId] = input;
  else shChannel?.send({ type: 'broadcast', event: 'sh_input', payload: { id: shMyId, input } });
}

function shHostTick() {
  if (!shHostState || shHostState.ended) return;
  const hs = shHostState;
  hs.tickCount++;

  // Camera scroll
  hs.cameraX += CAM_SPD + (hs.wave - 1) * 0.08;

  // Wave advancement
  if (hs.tickCount % 600 === 0) hs.wave++;

  // Platform generation + cleanup
  genPlatforms(hs);
  hs.platforms = hs.platforms.filter(p => p.x + p.w > hs.cameraX - 200);

  // Enemy spawn
  hs.spawnTimer--;
  if (hs.spawnTimer <= 0) {
    spawnEnemy(hs);
    hs.spawnTimer = Math.max(25, 90 - hs.wave * 5);
  }

  // Update players
  for (const id in hs.players) {
    const p = hs.players[id];
    if (!p.alive) continue;
    tickPlayer(p, hs.inputs[id] || {}, hs);
  }

  // Update enemies
  for (const en of hs.enemies) tickEnemy(en, hs);

  // Bullets
  tickBullets(hs);

  // Cleanup
  hs.enemies = hs.enemies.filter(e => !e.dead && e.x > hs.cameraX - 150);
  hs.bullets = hs.bullets.filter(b => !b.hit && b.x > hs.cameraX - 60 && b.x < hs.cameraX + GAME_W + 60 && b.y > -20 && b.y < GAME_H + 20);

  const payload = serializeState(hs);
  shChannel?.send({ type: 'broadcast', event: 'sh_state', payload });
  if (shGame) shGame.updateState(payload);

  if (Object.values(hs.players).every(p => !p.alive)) shHostEndGame();
}

function tickPlayer(p, input, hs) {
  const prevY = p.y;

  // Horizontal
  p.vx = input.left ? -PLAYER_SPD : input.right ? PLAYER_SPD : 0;
  if (p.vx > 0) p.facingRight = true;
  if (p.vx < 0) p.facingRight = false;

  // Jump (edge detection, only from ground)
  if (input.jump && !p.jumpHeld && p.onGround) {
    p.vy = -JUMP_FORCE;
    p.onGround = false;
    p.jumpHeld = true;
  }
  if (!input.jump) p.jumpHeld = false;

  // Gravity + move (y-down: positive vy = falling)
  p.vy += GRAVITY;
  p.x  += p.vx;
  p.y  += p.vy;

  // Ground
  if (p.y >= GROUND_Y) { p.y = GROUND_Y; p.vy = 0; p.onGround = true; }

  // Platforms: land on top surface when falling through
  if (p.vy >= 0) {
    for (const plat of hs.platforms) {
      const inX = p.x + PLAYER_HW > plat.x && p.x - PLAYER_HW < plat.x + plat.w;
      if (inX && prevY <= plat.y && p.y >= plat.y) {
        p.y = plat.y; p.vy = 0; p.onGround = true;
      }
    }
  }

  // Camera clamp (don't go off-screen)
  p.x = Math.max(hs.cameraX + PLAYER_HW + 5, Math.min(hs.cameraX + GAME_W - PLAYER_HW - 5, p.x));

  // Scrolled off left = die
  if (p.x - PLAYER_HW < hs.cameraX) { p.alive = false; return; }

  // Shoot
  if (p.shootCd > 0) p.shootCd--;
  if (input.shoot && p.shootCd <= 0) {
    p.shootCd = 8;
    hs.bullets.push({
      id: hs.bulletId++,
      x: p.x + (p.facingRight ? PLAYER_HW + 8 : -(PLAYER_HW + 8)),
      y: p.y - 22,
      vx: BULLET_SPD * (p.facingRight ? 1 : -1),
      vy: 0,
      fromPlayer: true, playerId: p.id,
    });
  }

  if (p.iFrames > 0) p.iFrames--;
}

function tickEnemy(en, hs) {
  const alive = Object.values(hs.players).filter(p => p.alive);
  if (!alive.length) return;
  const target = alive.reduce((a, b) => Math.abs(a.x - en.x) < Math.abs(b.x - en.x) ? a : b);
  const dx = target.x - en.x;
  const dy = target.y - en.y;  // y-down: positive dy = target is below enemy
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;

  if (en.type === 'walker') {
    en.facingRight = dx > 0;
    en.x += (dx > 0 ? 1 : -1) * 1.5;
    en.shootTimer--;
    if (en.shootTimer <= 0 && dist < 420) {
      en.shootTimer = 55 + Math.floor(Math.random() * 55);
      hs.bullets.push({
        id: hs.bulletId++,
        x: en.x + (en.facingRight ? ENEMY_HW + 8 : -(ENEMY_HW + 8)),
        y: en.y - 20,
        vx: (dx / dist) * 5, vy: (dy / dist) * 5,
        fromPlayer: false,
      });
    }
  } else {
    // Flyer: home toward player
    en.facingRight = dx > 0;
    en.x += (dx / dist) * 1.3;
    en.phase = (en.phase || 0) + 0.055;
    en.y = en.baseY + Math.sin(en.phase) * 38;
    en.shootTimer--;
    if (en.shootTimer <= 0 && dist < 380) {
      en.shootTimer = 48 + Math.floor(Math.random() * 48);
      hs.bullets.push({
        id: hs.bulletId++,
        x: en.x, y: en.y,
        vx: (dx / dist) * 5, vy: (dy / dist) * 5,
        fromPlayer: false,
      });
    }
  }
}

function tickBullets(hs) {
  // Move
  for (const b of hs.bullets) { b.x += b.vx; b.y += b.vy; }

  // Player bullets → enemies
  for (const b of hs.bullets) {
    if (!b.fromPlayer || b.hit) continue;
    for (const en of hs.enemies) {
      if (en.dead) continue;
      const hitH = en.type === 'walker' ? ENEMY_H : 34;
      if (Math.abs(b.x - en.x) < ENEMY_HW && b.y > en.y - hitH && b.y < en.y + 5) {
        b.hit = true; en.health--;
        if (en.health <= 0) {
          en.dead = true;
          const shooter = hs.players[b.playerId];
          if (shooter) shooter.score += en.type === 'flyer' ? 20 : 10;
        }
        break;
      }
    }
  }

  // Enemy bullets → players
  for (const b of hs.bullets) {
    if (b.fromPlayer || b.hit) continue;
    for (const p of Object.values(hs.players)) {
      if (!p.alive || p.iFrames > 0) continue;
      if (Math.abs(b.x - p.x) < PLAYER_HW && b.y > p.y - PLAYER_H && b.y < p.y + 5) {
        b.hit = true; p.health--; p.iFrames = 60;
        if (p.health <= 0) p.alive = false;
        break;
      }
    }
  }
}

function spawnEnemy(hs) {
  const isFlyer = Math.random() < 0.3;
  const sx = hs.cameraX + GAME_W + 60;
  if (isFlyer) {
    const baseY = 100 + Math.random() * 120;
    hs.enemies.push({ id: hs.enemyId++, type: 'flyer', x: sx, y: baseY, baseY, facingRight: false, health: 2, shootTimer: 80, phase: Math.random() * Math.PI * 2 });
  } else {
    hs.enemies.push({ id: hs.enemyId++, type: 'walker', x: sx, y: GROUND_Y, facingRight: false, health: 3, shootTimer: 80 });
  }
}

function genPlatforms(hs) {
  while (hs.platformGenX < hs.cameraX + GAME_W + 400) {
    hs.platformGenX += 160 + Math.floor(Math.random() * 120);
    if (Math.random() < 0.65) {
      const pw = 80 + Math.floor(Math.random() * 90);
      hs.platforms.push({
        x: hs.platformGenX,
        y: GROUND_Y - 90 - Math.floor(Math.random() * 100),  // canvas-Y of top surface
        w: pw,
        h: 16,
      });
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

  shHostState = null;

  track('game_end', { game_name: 'shooter', player_name: shName, duration_ms: Date.now() - _shooterStartTime, metadata: { results } });
  for (const r of results) {
    if (r.score > 0) await submitScore({ player_name: r.name, score: r.score, game_name: 'shooter' });
  }

  shChannel?.send({ type: 'broadcast', event: 'sh_over', payload: { results } });
  if (shGame) { shGame.destroy(); shGame = null; }
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
  if (shHostState) { clearInterval(shHostState.gameLoop); shHostState = null; }
  if (shGame) { shGame.destroy(); shGame = null; }
}

function shCleanup() {
  shCleanupGame();
  if (shChannel) { shChannel.unsubscribe(); shChannel = null; }
  shLobbyPlayers = {};
  shIsHost = false;
}
