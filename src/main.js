import { createClient } from '@supabase/supabase-js';
import { FlappyGame } from './game/Game.js';

const SUPABASE_URL = 'https://owqqfjyisewemtxjgexq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_9gmatl0oDebnQsENECo0jQ_Mf8OmZZA';

// ─── Physics constants ────────────────────────────────────────────────────────
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
const myId = crypto.randomUUID();
let myName = '';
let isHost = false;
let level  = 'medium';
let channel = null;
let game    = null;

// Keyed by player id, populated immediately on join + updated by presence sync
// { [id]: { name, isHost, colorIndex } }
const lobbyPlayers = {};

// Physics state — only set on the host client during a live game
let hostState = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function setError(msg) { document.getElementById('landing-error').textContent = msg; }
function genCode() { return Math.random().toString(36).substring(2, 6).toUpperCase(); }
function hexColor(n) { return '#' + n.toString(16).padStart(6, '0'); }

// ─── Lobby rendering ──────────────────────────────────────────────────────────
function renderLobbyUI() {
  const grid    = document.getElementById('lobby-players');
  grid.innerHTML = '';
  const entries  = Object.entries(lobbyPlayers);

  for (let i = 0; i < 6; i++) {
    const slot = document.createElement('div');
    if (i < entries.length) {
      const [, info] = entries[i];
      slot.className = 'player-slot filled';
      slot.style.borderColor = hexColor(PLAYER_COLORS[i]);
      slot.innerHTML = `
        <div class="slot-bird">${BIRD_EMOJIS[i]}</div>
        <div class="slot-name">${info.name}</div>
        ${info.isHost ? '<div class="slot-host">👑 Host</div>' : ''}`;
    } else {
      slot.className = 'player-slot empty';
      slot.innerHTML = `<div class="slot-bird">…</div><div class="slot-name">Open</div>`;
    }
    grid.appendChild(slot);
  }
  document.getElementById('lobby-status').textContent = `${entries.length}/6 players`;
}

function applyLevel(l) {
  level = l;
  document.querySelectorAll('.lvl-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.level === l));
}

// ─── Presence helpers ─────────────────────────────────────────────────────────
function syncPresence(presenceMap) {
  // Rebuild lobbyPlayers from latest presence state
  // Keep existing entries that presence hasn't seen yet (avoids flicker)
  const seen = new Set();
  for (const [id, arr] of Object.entries(presenceMap)) {
    const info = arr[0];
    if (!lobbyPlayers[id]) {
      lobbyPlayers[id] = { name: info.name, isHost: info.isHost };
    }
    seen.add(id);
  }
  // Remove players that left
  for (const id of Object.keys(lobbyPlayers)) {
    if (!seen.has(id)) delete lobbyPlayers[id];
  }
  renderLobbyUI();
}

// ─── Channel setup ────────────────────────────────────────────────────────────
function openChannel(code) {
  channel = supabase.channel('flappy:' + code, {
    config: {
      broadcast: { self: true },   // self:true so host receives own events too
      presence:  { key: myId },
    },
  });

  channel.on('presence',  { event: 'sync' },         () => syncPresence(channel.presenceState()));
  channel.on('broadcast', { event: 'level_changed' }, ({ payload }) => applyLevel(payload.level));
  channel.on('broadcast', { event: 'game_start' },    ({ payload }) => {
    // Guests render; host already called startRendering directly
    if (!isHost) startRendering(payload);
  });
  channel.on('broadcast', { event: 'game_state' }, ({ payload }) => {
    // Guests update from host ticks; host updates directly in hostTick
    if (!isHost) {
      if (game) game.updateState(payload.pipes, payload.players);
      updateHUD(payload.players);
    }
  });
  channel.on('broadcast', { event: 'player_died' }, ({ payload }) => {
    if (!isHost && game) game.onPlayerDied(payload.id);
  });
  channel.on('broadcast', { event: 'game_over' }, ({ payload }) => {
    if (!isHost) {
      if (game) { game.destroy(); game = null; }
      renderGameOver(payload.results);
      showScreen('screen-gameover');
    }
  });
  // Guests send flap → host applies it to physics
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
  // Add self immediately so lobbyPlayers is never empty when host hits Start
  lobbyPlayers[myId] = { name: myName, isHost: true };

  const code = genCode();
  await openChannel(code);

  document.getElementById('lobby-code').textContent = code;
  document.getElementById('lobby-status').textContent = `Share code: ${code}`;
  document.getElementById('lobby-host-controls').classList.remove('hidden');
  document.getElementById('lobby-guest-msg').classList.add('hidden');
  applyLevel('medium');
  renderLobbyUI();
  showScreen('screen-lobby');
}

async function joinRoom(code) {
  isHost = false;
  lobbyPlayers[myId] = { name: myName, isHost: false };

  await openChannel(code.toUpperCase());

  document.getElementById('lobby-code').textContent = code.toUpperCase();
  document.getElementById('lobby-host-controls').classList.add('hidden');
  document.getElementById('lobby-guest-msg').classList.remove('hidden');
  renderLobbyUI();
  showScreen('screen-lobby');
}

// ─── Host physics ─────────────────────────────────────────────────────────────
function buildGamePlayers() {
  const out = {};
  let i = 0;
  for (const [id, info] of Object.entries(lobbyPlayers)) {
    out[id] = {
      name: info.name,
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      colorIndex: i,
      emoji: BIRD_EMOJIS[i % BIRD_EMOJIS.length],
      x: 150, y: CANVAS_H / 2, vy: 0, alive: true, score: 0,
    };
    i++;
  }
  return out;
}

function serializePlayers(players) {
  const out = {};
  for (const id in players) {
    const p = players[id];
    out[id] = { name: p.name, color: p.color, emoji: p.emoji, x: p.x, y: p.y, vy: p.vy, alive: p.alive, score: p.score };
  }
  return out;
}

async function hostStartGame() {
  // Clean up any previous game
  if (hostState) {
    clearInterval(hostState.gameLoop);
    clearInterval(hostState.pipeTimer);
    hostState = null;
  }
  if (game) { game.destroy(); game = null; }

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

  // Tell guests to start rendering
  const payload = { level, players: serializePlayers(players) };
  channel.send({ type: 'broadcast', event: 'game_start', payload });

  // Host starts rendering immediately
  startRendering(payload);
}

function hostTick() {
  if (!hostState || hostState.ended) return;
  const { players, pipes, cfg } = hostState;

  for (const pipe of pipes) pipe.x -= cfg.pipeSpeed;
  hostState.pipes = pipes.filter(p => p.x > -PIPE_WIDTH - 20);

  for (const id in players) {
    const p = players[id];
    if (!p.alive) continue;

    p.vy += GRAVITY;
    p.y  += p.vy;

    if (p.y >= CANVAS_H - BIRD_RADIUS || p.y <= BIRD_RADIUS) {
      p.alive = false;
      channel.send({ type: 'broadcast', event: 'player_died', payload: { id } });
      continue;
    }

    for (const pipe of hostState.pipes) {
      const inX = p.x + BIRD_RADIUS > pipe.x && p.x - BIRD_RADIUS < pipe.x + PIPE_WIDTH;
      const inY = p.y - BIRD_RADIUS < pipe.gapY || p.y + BIRD_RADIUS > pipe.gapY + pipe.gap;
      if (inX && inY) {
        p.alive = false;
        channel.send({ type: 'broadcast', event: 'player_died', payload: { id } });
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
    players: serializePlayers(players),
  };

  // Send to guests
  channel.send({ type: 'broadcast', event: 'game_state', payload: statePayload });

  // Host updates own renderer directly
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
  hostState = null;

  const inserts = results.filter(r => r.score > 0)
    .map(r => ({ player_name: r.name, score: r.score, level }));
  if (inserts.length) supabase.from('leaderboard').insert(inserts);

  channel.send({ type: 'broadcast', event: 'game_over', payload: { results } });

  if (game) { game.destroy(); game = null; }
  renderGameOver(results);
  showScreen('screen-gameover');
}

// ─── Flap ─────────────────────────────────────────────────────────────────────
function sendFlap() {
  if (isHost && hostState) {
    const p = hostState.players[myId];
    if (p?.alive) p.vy = FLAP_FORCE;
  } else {
    channel?.send({ type: 'broadcast', event: 'flap', payload: { id: myId } });
  }
}

// ─── Game rendering ───────────────────────────────────────────────────────────
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
    const div = document.createElement('div');
    div.className = 'hud-player' + (p.alive ? '' : ' hud-dead');
    div.innerHTML = `<span class="hud-dot" style="background:${hexColor(p.color)}"></span>${p.name}: ${p.score}`;
    container.appendChild(div);
  });
}

function renderGameOver(results) {
  const list = document.getElementById('results-list');
  list.innerHTML = '';
  results.forEach((r, i) => {
    const div = document.createElement('div');
    div.className = 'result-row';
    div.innerHTML = `
      <span class="result-rank ${['gold','silver','bronze'][i]||''}">${RANK_MEDALS[i]||`${i+1}.`}</span>
      <span class="result-name" style="color:${hexColor(r.color)}">${r.name}</span>
      <span class="result-score">${r.score} pts</span>`;
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
    .from('leaderboard').select('player_name,score,level').order('score', { ascending: false }).limit(20);
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
