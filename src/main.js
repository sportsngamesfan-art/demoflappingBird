import { FlappyGame } from './games/flappy/FlappyGame.js';
import { supabase, showScreen, genCode, hexColor, PLAYER_COLORS, RANK_MEDALS, submitScore } from './core/shared.js';
import { initReactionTap } from './games/reaction-tap/reaction-tap.js';
import { initShooter } from './games/shooter/shooter.js';
import { initPacman } from './games/pacman/pacman.js';
import { initChess } from './games/chess/chess.js';
import { initHomeBg } from './home-bg.js';
import { gsap } from 'gsap';
import { initNav, updateGameHUD } from './nav.js';
import { initLobby3D, destroyLobby3D } from './lobby3d.js';

// ─── Physics constants ────────────────────────────────────────────────────────
const GRAVITY     = 0.45;
const FLAP_FORCE  = -8.5;
const BIRD_RADIUS = 17;
const CANVAS_W    = 800;
const CANVAS_H    = 600;
const PIPE_WIDTH  = 60;

const LEVELS = {
  easy:   { pipeSpeed: 2.5, pipeGap: 200, pipeInterval: 2200 },
  medium: { pipeSpeed: 3.5, pipeGap: 160, pipeInterval: 1800 },
  hard:   { pipeSpeed: 5.0, pipeGap: 115, pipeInterval: 1400 },
};

const BIRD_EMOJIS = ['🐦', '🐧', '🦜', '🦚', '🦉', '🦅'];

// ─── App state ────────────────────────────────────────────────────────────────
const myId = crypto.randomUUID();
let myName   = '';
let isHost   = false;
let myBirdIdx = 0;
let level  = 'medium';
let channel = null;
let game    = null;

// Keyed by player id, populated immediately on join + updated by presence sync
// { [id]: { name, isHost, colorIndex } }
const lobbyPlayers = {};

// Physics state — only set on the host client during a live game
let hostState = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function setError(msg) { document.getElementById('landing-error').textContent = msg; }

function renderBirdPicker() {
  const row = document.getElementById('bird-options-row');
  row.innerHTML = '';
  BIRD_EMOJIS.forEach((emoji, i) => {
    const btn = document.createElement('button');
    btn.className = 'bird-opt-btn' + (i === myBirdIdx ? ' selected' : '');
    btn.textContent = emoji;
    btn.addEventListener('click', () => {
      myBirdIdx = i;
      if (lobbyPlayers[myId]) lobbyPlayers[myId].birdIdx = myBirdIdx;
      renderBirdPicker();
      channel?.track({ name: myName, isHost, birdIdx: myBirdIdx });
    });
    row.appendChild(btn);
  });
  document.getElementById('lobby-bird-picker').classList.remove('hidden');
}

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
        <div class="slot-bird">${BIRD_EMOJIS[info.birdIdx ?? i]}</div>
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
      lobbyPlayers[id] = { name: info.name, isHost: info.isHost, birdIdx: info.birdIdx ?? 0 };
    } else {
      lobbyPlayers[id].birdIdx = info.birdIdx ?? lobbyPlayers[id].birdIdx ?? 0;
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
        await channel.track({ name: myName, isHost, birdIdx: myBirdIdx });
        resolve();
      }
    });
  });
}

// ─── Create / Join ────────────────────────────────────────────────────────────
async function createRoom() {
  isHost = true;
  // Add self immediately so lobbyPlayers is never empty when host hits Start
  lobbyPlayers[myId] = { name: myName, isHost: true, birdIdx: myBirdIdx };

  const code = genCode();
  await openChannel(code);

  document.getElementById('lobby-code').textContent = code;
  document.getElementById('lobby-status').textContent = `Share code: ${code}`;
  document.getElementById('lobby-host-controls').classList.remove('hidden');
  document.getElementById('lobby-guest-msg').classList.add('hidden');
  applyLevel('medium');
  renderLobbyUI();
  renderBirdPicker();
  showScreen('screen-lobby');
}

async function joinRoom(code) {
  isHost = false;
  lobbyPlayers[myId] = { name: myName, isHost: false, birdIdx: myBirdIdx };

  await openChannel(code.toUpperCase());

  document.getElementById('lobby-code').textContent = code.toUpperCase();
  document.getElementById('lobby-host-controls').classList.add('hidden');
  document.getElementById('lobby-guest-msg').classList.remove('hidden');
  renderLobbyUI();
  renderBirdPicker();
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
      emoji: BIRD_EMOJIS[info.birdIdx ?? (i % BIRD_EMOJIS.length)],
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
  hostState.pipeTimer = setTimeout(() => {
    spawnPipe();
    hostState.pipeTimer = setInterval(spawnPipe, cfg.pipeInterval);
  }, 1500);
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
    .map(r => ({ player_name: r.name, score: r.score, level, game_name: 'flappy' }));
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
  const sorted = Object.values(players).sort((a, b) => b.score - a.score);
  sorted.forEach(p => {
    const div = document.createElement('div');
    div.className = 'hud-player' + (p.alive ? '' : ' hud-dead');
    div.innerHTML = `<span class="hud-dot" style="background:${hexColor(p.color)}"></span>${p.name}: ${p.score}`;
    container.appendChild(div);
  });
  // Feed top player into universal HUD overlay
  if (sorted.length) updateGameHUD({ name: sorted[0].name, score: sorted[0].score });
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
async function loadFlappyLeaderboard() {
  showScreen('screen-leaderboard');
  await loadLeaderboard('flappy', 'lb-body', {
    ascending: false,
    render: (r, i) => `
      <tr><td>${i+1}</td><td>${r.player_name}</td><td>${r.score}</td>
      <td><span class="lb-level">${r.level || ''}</span></td></tr>`,
  });
}

// ─── Activity feed ────────────────────────────────────────────────────────────
const _ACT_NAMES = ['Ayan','Riaan','Siddharth','Priya','Lucas','Emma','James','Sofia','Noah','Mia'];
const _ACT_GAMES = ['Flappy Bird','Pac-Man','Shooter','Reaction Tap','Chess'];
const _ACT_VERBS = ['playing','in lobby for','just scored in','challenging friends in','started a room for'];
const _VERB_ICON = {
  'playing': '🎮',
  'in lobby for': '👥',
  'just scored in': '🏆',
  'challenging friends in': '⚡',
  'started a room for': '🚀',
};

function startActivityFeed() {
  const feed = document.getElementById('activity-feed');
  if (!feed) return;
  function add() {
    const name = _ACT_NAMES[Math.floor(Math.random() * _ACT_NAMES.length)];
    const game = _ACT_GAMES[Math.floor(Math.random() * _ACT_GAMES.length)];
    const verb = _ACT_VERBS[Math.floor(Math.random() * _ACT_VERBS.length)];
    const icon = _VERB_ICON[verb] || '🎮';
    const ts = Date.now();
    const div = document.createElement('div');
    div.className = 'activity-item';
    div.dataset.ts = ts;
    div.innerHTML = `<span class="activity-icon">${icon}</span><span class="activity-text">${name} is ${verb} ${game}</span><span class="activity-time">just now</span>`;
    feed.prepend(div);
    while (feed.children.length > 5) feed.lastChild.remove();
  }
  add();
  setInterval(add, 3500);
  // Update relative timestamps every 30s
  setInterval(() => {
    feed.querySelectorAll('.activity-item[data-ts]').forEach(el => {
      const age = Math.round((Date.now() - el.dataset.ts) / 60000);
      el.querySelector('.activity-time').textContent = age < 1 ? 'just now' : `${age}m ago`;
    });
  }, 30000);
}

// ─── Live Match widget ────────────────────────────────────────────────────────
const MINI_START = [
  'rnbqkbnr/pp2pppp/2p5/3p4/3PP3/5N2/PPP2PPP/RNBQKB1R',
];
const MINI_MOVES = [
  // [fromR,fromC, toR,toC] — 0-indexed from top-left (rank 8)
  [4,3, 3,3], // d5xd4? simple pawn capture sim
  [7,6, 5,5], // Nf3 already placed, fake move
  [1,4, 2,4], // e7-e6
  [0,3, 2,5], // Qd8-f6 sim
  [7,4, 7,5], // King side move sim (placeholder)
  [3,3, 4,3], // pawn back sim
];

function buildMiniBoardFromFen(fen) {
  const SYMS = {
    K:'♔',Q:'♕',R:'♖',B:'♗',N:'♘',P:'♙',
    k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟',
  };
  const board = document.getElementById('mini-board');
  if (!board) return;
  board.innerHTML = '';
  const ranks = fen.split(' ')[0].split('/');
  const cells = [];
  for (const rank of ranks) {
    for (const ch of rank) {
      if (/\d/.test(ch)) { for (let i=0;i<+ch;i++) cells.push(null); }
      else cells.push(ch);
    }
  }
  cells.forEach((piece, i) => {
    const r = Math.floor(i/8), c = i%8;
    const sq = document.createElement('div');
    sq.className = `mb-sq ${(r+c)%2===0 ? 'light':'dark'}`;
    sq.dataset.idx = i;
    if (piece) {
      const isWhite = piece === piece.toUpperCase();
      sq.style.color = isWhite ? '#fff' : '#1a1a1a';
      sq.style.textShadow = isWhite ? '0 1px 2px rgba(0,0,0,.5)' : '0 1px 2px rgba(255,255,255,.2)';
      sq.textContent = SYMS[piece] || '';
    }
    board.appendChild(sq);
  });
}

function startLiveMatchWidget() {
  buildMiniBoardFromFen(MINI_START[0]);
  let moveIdx = 0;
  let whiteTurn = false; // starting state shown as white already moved
  const statusDot  = document.getElementById('lm-status')?.querySelector('.lm-status-dot');
  const statusText = document.getElementById('lm-status-text');
  const moveCount  = document.getElementById('lm-move-count');
  if (!statusText) return;

  setInterval(() => {
    const board = document.getElementById('mini-board');
    if (!board) return;
    const [fr,fc,tr,tc] = MINI_MOVES[moveIdx % MINI_MOVES.length];
    const fromIdx = fr*8+fc, toIdx = tr*8+tc;
    const fromSq = board.children[fromIdx];
    const toSq   = board.children[toIdx];
    if (fromSq && toSq && fromSq.textContent) {
      // Brief highlight
      fromSq.classList.add('highlight'); toSq.classList.add('highlight');
      setTimeout(() => {
        toSq.textContent   = fromSq.textContent;
        toSq.style.color   = fromSq.style.color;
        toSq.style.textShadow = fromSq.style.textShadow;
        fromSq.textContent = '';
        fromSq.classList.remove('highlight'); toSq.classList.remove('highlight');
      }, 400);
    }
    moveIdx++;
    whiteTurn = !whiteTurn;
    if (statusDot) { statusDot.className = `lm-status-dot ${whiteTurn ? 'white' : 'black'}`; }
    if (statusText) statusText.textContent = whiteTurn ? 'White to move' : 'Black to move';
    const baseMove = 7 + moveIdx;
    if (moveCount) moveCount.textContent = `Move ${baseMove}`;
  }, 3200);

  // Watch/Join buttons → chess landing
  document.getElementById('btn-watch-match')?.addEventListener('click', () => showScreen('screen-chess-landing'));
  document.getElementById('btn-join-queue')?.addEventListener('click',  () => showScreen('screen-chess-landing'));
}

function animateHomeEntrance() {
  gsap.from('.home-hero',       { y: -18, opacity: 0, duration: .55, ease: 'power2.out' });
  gsap.from('.quick-actions',   { y: 20,  opacity: 0, duration: .48, delay: .12, ease: 'power2.out' });
  gsap.from('.game-card-lg',    { y: 28,  opacity: 0, duration: .42, stagger: .08, delay: .28, ease: 'power2.out' });
  gsap.from('.activity-panel',  { y: 18,  opacity: 0, duration: .38, delay: .55, ease: 'power2.out' });
  gsap.from('.home-right',      { x: 20,  opacity: 0, duration: .52, delay: .35, ease: 'power2.out' });
}

// ─── Event listeners ──────────────────────────────────────────────────────────
document.getElementById('btn-join-show').addEventListener('click', () =>
  document.getElementById('join-form').classList.toggle('hidden'));

document.getElementById('btn-create').addEventListener('click', async () => {
  myName = document.getElementById('landing-name').value.trim() || 'Player' + Math.floor(Math.random() * 999);
  setError('');
  await createRoom();
});

document.getElementById('btn-join').addEventListener('click', async () => {
  myName = document.getElementById('landing-name').value.trim() || 'Player' + Math.floor(Math.random() * 999);
  const code = document.getElementById('join-code').value.trim();
  if (code.length < 4) return setError('Enter a 4-letter room code.');
  setError('');
  await joinRoom(code);
});

document.getElementById('join-code').addEventListener('input', e =>
  e.target.value = e.target.value.toUpperCase());

document.getElementById('btn-leaderboard-show').addEventListener('click', loadFlappyLeaderboard);

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
document.getElementById('btn-flappy-home').addEventListener('click', () => showScreen('screen-home'));

// ─── Home screen ─────────────────────────────────────────────────────────────
document.getElementById('card-flappy')?.addEventListener('click', () => showScreen('screen-landing'));
document.getElementById('card-flappy-carousel')?.addEventListener('click', () => showScreen('screen-landing'));
document.getElementById('card-reaction')?.addEventListener('click', () => showScreen('screen-reaction-landing'));
document.getElementById('card-shooter')?.addEventListener('click', () => showScreen('screen-shooter-landing'));
document.getElementById('card-pacman')?.addEventListener('click', () => showScreen('screen-pacman-landing'));
document.getElementById('card-chess')?.addEventListener('click', () => showScreen('screen-chess-landing'));

// ─── Carousel scroll buttons ──────────────────────────────────────────────────
(function initCarousel() {
  const carousel = document.getElementById('game-carousel');
  const btnPrev  = document.getElementById('carousel-prev');
  const btnNext  = document.getElementById('carousel-next');
  if (!carousel || !btnPrev || !btnNext) return;
  const SCROLL_BY = 201; // card width (185) + gap (16)
  function updateBtns() {
    btnPrev.disabled = carousel.scrollLeft <= 4;
    btnNext.disabled = carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - 4;
  }
  btnPrev.addEventListener('click', () => { carousel.scrollBy({ left: -SCROLL_BY, behavior: 'smooth' }); });
  btnNext.addEventListener('click', () => { carousel.scrollBy({ left:  SCROLL_BY, behavior: 'smooth' }); });
  carousel.addEventListener('scroll', updateBtns, { passive: true });
  updateBtns();
})();

// ─── Quick-action modals ──────────────────────────────────────────────────────
const GAME_ROUTES = {
  flappy:   () => showScreen('screen-landing'),
  reaction: () => showScreen('screen-reaction-landing'),
  shooter:  () => showScreen('screen-shooter-landing'),
  pacman:   () => showScreen('screen-pacman-landing'),
  chess:    () => showScreen('screen-chess-landing'),
};

function openCreateModal() {
  document.getElementById('create-room-result').classList.add('hidden');
  document.querySelectorAll('.qm-game-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('create-room-modal').classList.remove('hidden');
}
function closeCreateModal() { document.getElementById('create-room-modal').classList.add('hidden'); }
function openJoinModal() {
  document.getElementById('qm-join-code').value = '';
  document.getElementById('qm-join-error').textContent = '';
  document.getElementById('join-room-modal').classList.remove('hidden');
}
function closeJoinModal() { document.getElementById('join-room-modal').classList.add('hidden'); }

let _pendingGameKey = null;

document.querySelectorAll('.qm-game-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    document.querySelectorAll('.qm-game-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    _pendingGameKey = btn.dataset.game;
    myName = myName || 'Player' + Math.floor(Math.random() * 999);
    await createRoom();
    const code = document.getElementById('lobby-code').textContent;
    document.getElementById('create-room-code').textContent = code;
    document.getElementById('create-room-result').classList.remove('hidden');
  });
});

document.getElementById('create-room-copy')?.addEventListener('click', () => {
  const code = document.getElementById('create-room-code').textContent;
  const url = `${location.origin}${location.pathname}?join=${code}&game=${_pendingGameKey || 'flappy'}`;
  navigator.clipboard.writeText(url).catch(() => {});
  document.getElementById('create-room-copy').textContent = '✅ Copied!';
  setTimeout(() => { document.getElementById('create-room-copy').textContent = '📋 Copy Invite Link'; }, 2000);
});

document.getElementById('create-room-goto')?.addEventListener('click', () => {
  closeCreateModal();
  // lobby is already open — screen-lobby was set by createRoom()
});

document.getElementById('create-room-close')?.addEventListener('click', closeCreateModal);
document.getElementById('join-room-close')?.addEventListener('click', closeJoinModal);

document.getElementById('qm-join-btn')?.addEventListener('click', async () => {
  const code = document.getElementById('qm-join-code').value.trim().toUpperCase();
  if (code.length < 4) { document.getElementById('qm-join-error').textContent = 'Enter a 4-letter code.'; return; }
  myName = myName || 'Player' + Math.floor(Math.random() * 999);
  closeJoinModal();
  await joinRoom(code);
});

document.getElementById('qm-join-code')?.addEventListener('input', e => {
  e.target.value = e.target.value.toUpperCase();
});

// Quick Actions
document.getElementById('qa-create')?.addEventListener('click', openCreateModal);
document.getElementById('qa-join')?.addEventListener('click', openJoinModal);
document.getElementById('qa-quickmatch')?.addEventListener('click', async () => {
  const games = Object.keys(GAME_ROUTES);
  _pendingGameKey = games[Math.floor(Math.random() * games.length)];
  myName = myName || 'Player' + Math.floor(Math.random() * 999);
  await createRoom();
});

// URL invite-link auto-join (?join=CODE&game=flappy)
(function checkInviteUrl() {
  const p = new URLSearchParams(location.search);
  const code = p.get('join'), game = p.get('game');
  if (code && code.length === 4) {
    myName = myName || 'Player' + Math.floor(Math.random() * 999);
    _pendingGameKey = game || 'flappy';
    joinRoom(code.toUpperCase());
    history.replaceState({}, '', location.pathname);
  }
})();

// ─── Init ─────────────────────────────────────────────────────────────────────
initNav();
initReactionTap();
initShooter(myId);
initPacman();
initChess();
initHomeBg();
startActivityFeed();
startLiveMatchWidget();

// ─── 3D Lobby toggle ──────────────────────────────────────────────────────────
let lobby3DActive = localStorage.getItem('lobbyMode') === '3d';
const lobbyCanvas = document.getElementById('lobby-canvas');
const lobbyToggle = document.getElementById('btn-lobby-toggle');

function applyLobbyMode() {
  if (lobby3DActive) {
    lobbyCanvas?.classList.remove('hidden');
    if (lobbyToggle) lobbyToggle.textContent = '◼ 2D View';
    if (lobbyCanvas) initLobby3D(lobbyCanvas, screenId => showScreen(screenId));
  } else {
    lobbyCanvas?.classList.add('hidden');
    if (lobbyToggle) lobbyToggle.textContent = '🎮 3D View';
    destroyLobby3D();
  }
}

lobbyToggle?.addEventListener('click', () => {
  lobby3DActive = !lobby3DActive;
  localStorage.setItem('lobbyMode', lobby3DActive ? '3d' : '2d');
  applyLobbyMode();
});

applyLobbyMode();
showScreen('screen-home');
// Animate after screen is visible so GSAP doesn't start on display:none elements
requestAnimationFrame(animateHomeEntrance);
