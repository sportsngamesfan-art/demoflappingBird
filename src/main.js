import { createClient } from '@supabase/supabase-js';
import { FlappyGame } from './game/Game.js';

const SUPABASE_URL = 'https://owqqfjyisewemtxjgexq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_9gmatl0oDebnQsENECo0jQ_Mf8OmZZA';

// ─── Physics constants (host runs these) ─────────────────────────────────────
const GRAVITY     = 0.45;
const FLAP_FORCE  = -8.5;
const BIRD_RADIUS = 18;
const CANVAS_W    = 800;
const CANVAS_H    = 600;
const PIPE_WIDTH  = 60;

const LEVELS = {
  easy:   { pipeSpeed: 2.5, pipeGap: 200, pipeInterval: 2200 },
  medium: { pipeSpeed: 3.5, pipeGap: 160, pipeInterval: 1800 },
  hard:   { pipeSpeed: 5.0, pipeGap: 115, pipeInterval: 1400 },
};

const PLAYER_COLORS = [0xFFD700, 0xFF4455, 0x44AAFF, 0x44DD66, 0xBB44FF, 0xFF8822];
const BIRD_EMOJIS   = ['🐦', '🐧', '🦜', '🦚', '🦉', '🦅'];
const RANK_MEDALS   = ['🥇', '🥈', '🥉'];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── App state ────────────────────────────────────────────────────────────────
const myId   = crypto.randomUUID();
let myName   = '';
let isHost   = false;
let level    = 'medium';
let channel  = null;
let game     = null;
let lobbyPlayers = {};  // presence state: { [id]: { name, isHost } }
let hostState    = null; // physics, only non-null on host

// ─── Helpers ──────────────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function setError(msg) { document.getElementById('landing-error').textContent = msg; }
function genCode() { return Math.random().toString(36).substring(2, 6).toUpperCase(); }

// ─── Lobby UI ─────────────────────────────────────────────────────────────────
function renderLobby(presenceMap) {
  lobbyPlayers = {};
  for (const [id, arr] of Object.entries(presenceMap)) lobbyPlayers[id] = arr[0];

  const grid = document.getElementById('lobby-players');
  grid.innerHTML = '';
  const entries = Object.entries(lobbyPlayers);
  for (let i = 0; i < 6; i++) {
    const slot = document.createElement('div');
    if (i < entries.length) {
      const [, info] = entries[i];
      const hex = '#' + PLAYER_COLORS[i].toString(16).padStart(6, '0');
      slot.className = 'player-slot filled';
      slot.style.borderColor = hex;
      slot.innerHTML = `
        <div class="slot-bird">${BIRD_EMOJIS[i]}</div>
        <div class="slot-name">${info.name}</div>
        ${info.isHost ? '<div class="slot-host">👑 Host</div>' : ''}
      `;
    } else {
      slot.className = 'player-slot empty';
      slot.innerHTML = `<div class="slot-bird">…</div><div class="slot-name">Open</div>`;
    }
    grid.appendChild(slot);
  }
  document.getElementById('lobby-status').textContent =
    `${entries.length}/6 players`;
}

function applyLevel(l) {
  level = l;
  document.querySelectorAll('.lvl-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.level === l));
}

// ─── Supabase Realtime channel ────────────────────────────────────────────────
function openChannel(code) {
  channel = supabase.channel('flappy:' + code, {
    config: {
      broadcast: { self: false },
      presence:  { key: myId },
    },
  });

  // Presence → lobby player list
  channel.on('presence', { event: 'sync' }, () => renderLobby(channel.presenceState()));

  // Level change from host
  channel.on('broadcast', { event: 'level_changed' }, ({ payload }) => applyLevel(payload.level));

  // Host starts game
  channel.on('broadcast', { event: 'game_start' }, ({ payload }) => startRendering(payload));

  // Host ticks
  channel.on('broadcast', { event: 'game_state' }, ({ payload }) => {
    if (game) game.updateState(payload.pipes, payload.players);
    updateHUD(payload.players);
  });

  channel.on('broadcast', { event: 'player_died' }, ({ payload }) => {
    if (game) game.onPlayerDied(payload.id);
  });

  channel.on('broadcast', { event: 'game_over' }, ({ payload }) => {
    if (game) { game.destroy(); game = null; }
    renderGameOver(payload.results);
    showScreen('screen-gameover');
  });

  // Guest flap → host applies it
  channel.on('broadcast', { event: 'flap' }, ({ payload }) => {
    if (!isHost || !hostState) return;
    const p = hostState.players[payload.id];
    if (p?.alive) p.vy = FLAP_FORCE;
  });

  return new Promise(resolve => {
    channel.subscribe(async status => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ name: myName, isHost });
        resolve();
      }
    });
  });
}

// ─── Create / Join ────────────────────────────────────────────────────────────
async function createRoom() {
  isHost = true;
  const code = genCode();
  await openChannel(code);
  document.getElementById('lobby-code').textContent = code;
  document.getElementById('lobby-status').textContent = `Share code: ${code}`;
  document.getElementById('lobby-host-controls').classList.remove('hidden');
  document.getElementById('lobby-guest-msg').classList.add('hidden');
  applyLevel('medium');
  showScreen('screen-lobby');
}

async function joinRoom(code) {
  isHost = false;
  await openChannel(code.toUpperCase());
  document.getElementById('lobby-code').textContent = code.toUpperCase();
  document.getElementById('lobby-host-controls').classList.add('hidden');
  document.getElementById('lobby-guest-msg').classList.remove('hidden');
  showScreen('screen-lobby');
}

// ─── Host physics ─────────────────────────────────────────────────────────────
function buildGamePlayers() {
  const out = {};
  let i = 0;
  for (const [id, info] of Object.entries(lobbyPlayers)) {
    out[id] = {
      name: info.name, color: PLAYER_COLORS[i], colorIndex: i,
      x: 150, y: CANVAS_H / 2, vy: 0, alive: true, score: 0,
    };
    i++;
  }
  return out;
}

function serialize(players) {
  const out = {};
  for (const id in players) {
    const p = players[id];
    out[id] = { name: p.name, color: p.color, x: p.x, y: p.y, vy: p.vy, alive: p.alive, score: p.score };
  }
  return out;
}

async function hostStartGame() {
  if (hostState) {
    clearInterval(hostState.gameLoop);
    clearInterval(hostState.pipeTimer);
  }

  const cfg     = LEVELS[level] || LEVELS.medium;
  const players = buildGamePlayers();
  hostState = { players, pipes: [], gameLoop: null, pipeTimer: null, cfg, ended: false };

  const spawnPipe = () => {
    if (!hostState) return;
    const gapY = 100 + Math.random() * (CANVAS_H - 200 - cfg.pipeGap);
    hostState.pipes.push({ x: CANVAS_W + 80, gapY, gap: cfg.pipeGap, passed: new Set() });
  };
  setTimeout(spawnPipe, 1500);
  hostState.pipeTimer = setInterval(spawnPipe, cfg.pipeInterval);
  hostState.gameLoop  = setInterval(hostTick, 1000 / 30);

  const payload = { level, players: serialize(players) };
  await channel.send({ type: 'broadcast', event: 'game_start', payload });
  startRendering(payload); // host renders locally too
}

function hostTick() {
  if (!hostState || hostState.ended) return;
  const { players, cfg } = hostState;

  for (const pipe of hostState.pipes) pipe.x -= cfg.pipeSpeed;
  hostState.pipes = hostState.pipes.filter(p => p.x > -PIPE_WIDTH - 20);

  for (const id in players) {
    const p = players[id];
    if (!p.alive) continue;
    p.vy += GRAVITY;
    p.y  += p.vy;

    if (p.y >= CANVAS_H - BIRD_RADIUS || p.y <= BIRD_RADIUS) {
      p.alive = false;
      channel.send({ type: 'broadcast', event: 'player_died', payload: { id } });
      if (game) game.onPlayerDied(id);
      continue;
    }

    for (const pipe of hostState.pipes) {
      const inX = p.x + BIRD_RADIUS > pipe.x && p.x - BIRD_RADIUS < pipe.x + PIPE_WIDTH;
      const inY = p.y - BIRD_RADIUS < pipe.gapY || p.y + BIRD_RADIUS > pipe.gapY + pipe.gap;
      if (inX && inY) {
        p.alive = false;
        channel.send({ type: 'broadcast', event: 'player_died', payload: { id } });
        if (game) game.onPlayerDied(id);
        break;
      }
      if (!pipe.passed.has(id) && pipe.x + PIPE_WIDTH < p.x) {
        pipe.passed.add(id);
        p.score++;
      }
    }
  }

  const statePayload = {
    pipes:   hostState.pipes.map(p => ({ x: p.x, gapY: p.gapY, gap: p.gap })),
    players: serialize(players),
  };
  channel.send({ type: 'broadcast', event: 'game_state', payload: statePayload });
  // host updates own render
  if (game) game.updateState(statePayload.pipes, statePayload.players);
  updateHUD(statePayload.players);

  if (Object.values(players).every(p => !p.alive)) hostEndGame();
}

async function hostEndGame() {
  if (!hostState || hostState.ended) return;
  hostState.ended = true;
  clearInterval(hostState.gameLoop);
  clearInterval(hostState.pipeTimer);

  const results = Object.values(hostState.players)
    .map(p => ({ name: p.name, score: p.score, color: p.color }))
    .sort((a, b) => b.score - a.score);

  const inserts = results.filter(r => r.score > 0)
    .map(r => ({ player_name: r.name, score: r.score, level }));
  if (inserts.length) await supabase.from('leaderboard').insert(inserts);

  await channel.send({ type: 'broadcast', event: 'game_over', payload: { results } });
  if (game) { game.destroy(); game = null; }
  renderGameOver(results);
  showScreen('screen-gameover');
  hostState = null;
}

// ─── Flap ─────────────────────────────────────────────────────────────────────
function sendFlap() {
  if (isHost && hostState) {
    // Apply directly to physics
    const p = hostState.players[myId];
    if (p?.alive) p.vy = FLAP_FORCE;
  } else {
    channel?.send({ type: 'broadcast', event: 'flap', payload: { id: myId } });
  }
}

// ─── Rendering ────────────────────────────────────────────────────────────────
function startRendering({ level: l, players }) {
  showScreen('screen-game');
  const hint = document.getElementById('flap-hint');
  hint.style.animation = '';
  void hint.offsetWidth;
  hint.style.animation = 'fadeOut 3s forwards 4s';
  document.getElementById('hud-level').textContent =
    `${l.charAt(0).toUpperCase() + l.slice(1)} Mode`;

  if (game) game.destroy();
  game = new FlappyGame(document.getElementById('game-canvas'), sendFlap, players);
  game.start();
}

function updateHUD(players) {
  const container = document.getElementById('hud-scores');
  container.innerHTML = '';
  Object.values(players).sort((a, b) => b.score - a.score).forEach(p => {
    const hex = '#' + p.color.toString(16).padStart(6, '0');
    const div = document.createElement('div');
    div.className = 'hud-player' + (p.alive ? '' : ' hud-dead');
    div.innerHTML = `<span class="hud-dot" style="background:${hex}"></span>${p.name}: ${p.score}`;
    container.appendChild(div);
  });
}

function renderGameOver(results) {
  const list = document.getElementById('results-list');
  list.innerHTML = '';
  results.forEach((r, i) => {
    const hex = '#' + r.color.toString(16).padStart(6, '0');
    const div = document.createElement('div');
    div.className = 'result-row';
    div.innerHTML = `
      <span class="result-rank ${['gold','silver','bronze'][i]||''}">${RANK_MEDALS[i]||`${i+1}.`}</span>
      <span class="result-name" style="color:${hex}">${r.name}</span>
      <span class="result-score">${r.score} pts</span>
    `;
    list.appendChild(div);
  });
  document.getElementById('gameover-host-btns').classList.toggle('hidden', !isHost);
  document.getElementById('gameover-guest-msg').classList.toggle('hidden', isHost);
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────
async function loadLeaderboard() {
  showScreen('screen-leaderboard');
  const tbody = document.getElementById('lb-body');
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;opacity:.5">Loading…</td></tr>';
  const { data, error } = await supabase
    .from('leaderboard').select('player_name,score,level').order('score',{ascending:false}).limit(20);
  if (error || !data?.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;opacity:.5">No scores yet!</td></tr>';
    return;
  }
  tbody.innerHTML = data.map((r, i) => `
    <tr><td>${i+1}</td><td>${r.player_name}</td><td>${r.score}</td>
    <td><span class="lb-level">${r.level}</span></td></tr>`).join('');
}

// ─── Event listeners ──────────────────────────────────────────────────────────
document.getElementById('btn-join-show').addEventListener('click', () =>
  document.getElementById('join-form').classList.toggle('hidden'));

document.getElementById('btn-create').addEventListener('click', async () => {
  myName = document.getElementById('landing-name').value.trim();
  if (!myName) return setError('Enter your name first.');
  setError('');
  await createRoom();
});

document.getElementById('btn-join').addEventListener('click', async () => {
  myName = document.getElementById('landing-name').value.trim();
  const code = document.getElementById('join-code').value.trim();
  if (!myName) return setError('Enter your name first.');
  if (code.length < 4) return setError('Enter a 4-letter room code.');
  setError('');
  await joinRoom(code);
});

document.getElementById('join-code').addEventListener('input', e =>
  e.target.value = e.target.value.toUpperCase());

document.getElementById('btn-leaderboard-show').addEventListener('click', loadLeaderboard);

document.querySelectorAll('.lvl-btn').forEach(btn =>
  btn.addEventListener('click', () => {
    if (!isHost) return;
    applyLevel(btn.dataset.level);
    channel?.send({ type: 'broadcast', event: 'level_changed', payload: { level: btn.dataset.level } });
  }));

document.getElementById('btn-start').addEventListener('click', hostStartGame);
document.getElementById('btn-play-again').addEventListener('click', hostStartGame);
document.getElementById('btn-back-lobby').addEventListener('click', () => showScreen('screen-lobby'));
document.getElementById('btn-lb-back').addEventListener('click', () => showScreen('screen-landing'));
