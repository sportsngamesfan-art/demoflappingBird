import { io } from 'socket.io-client';
import { createClient } from '@supabase/supabase-js';
import { FlappyGame } from './game/Game.js';

// ─── Supabase ─────────────────────────────────────────────────────────────────
const supabase = createClient(
  'https://owqqfjyisewemtxjgexq.supabase.co',
  'sb_publishable_9gmatl0oDebnQsENECo0jQ_Mf8OmZZA'
);

// ─── Socket ───────────────────────────────────────────────────────────────────
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
const socket = io(BACKEND_URL);

// ─── State ────────────────────────────────────────────────────────────────────
let isHost = false;
let myName = '';
let game = null;

const BIRD_EMOJIS = ['🐦', '🐧', '🦜', '🦚', '🦉', '🦅'];
const RANK_MEDALS = ['🥇', '🥈', '🥉'];

// ─── Screen helpers ───────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function setError(elId, msg) {
  const el = document.getElementById(elId);
  if (el) el.textContent = msg;
}

// ─── Lobby helpers ────────────────────────────────────────────────────────────
function renderLobbyPlayers(players) {
  const grid = document.getElementById('lobby-players');
  grid.innerHTML = '';
  const ids = Object.keys(players);
  for (let i = 0; i < 6; i++) {
    const slot = document.createElement('div');
    if (i < ids.length) {
      const p = players[ids[i]];
      slot.className = 'player-slot filled';
      slot.style.borderColor = `#${p.color.toString(16).padStart(6, '0')}`;
      slot.innerHTML = `
        <div class="slot-bird">${BIRD_EMOJIS[i]}</div>
        <div class="slot-name">${p.name}</div>
        ${i === 0 ? '<div class="slot-host">👑 Host</div>' : ''}
      `;
    } else {
      slot.className = 'player-slot empty';
      slot.innerHTML = `<div class="slot-bird">…</div><div class="slot-name">Open</div>`;
    }
    grid.appendChild(slot);
  }
}

function setLobbyLevel(level) {
  document.querySelectorAll('.lvl-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.level === level);
  });
}

// ─── Landing ──────────────────────────────────────────────────────────────────
document.getElementById('btn-join-show').addEventListener('click', () => {
  document.getElementById('join-form').classList.toggle('hidden');
});

document.getElementById('btn-create').addEventListener('click', () => {
  myName = document.getElementById('landing-name').value.trim();
  if (!myName) return setError('landing-error', 'Enter your name first.');
  setError('landing-error', '');
  socket.emit('create_room', { name: myName, level: 'medium' });
});

document.getElementById('btn-join').addEventListener('click', () => {
  myName = document.getElementById('landing-name').value.trim();
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  if (!myName) return setError('landing-error', 'Enter your name first.');
  if (code.length < 4) return setError('landing-error', 'Enter a 4-letter room code.');
  setError('landing-error', '');
  socket.emit('join_room', { name: myName, code });
});

document.getElementById('join-code').addEventListener('input', e => {
  e.target.value = e.target.value.toUpperCase();
});

document.getElementById('btn-leaderboard-show').addEventListener('click', loadLeaderboard);

// ─── Lobby controls ───────────────────────────────────────────────────────────
document.querySelectorAll('.lvl-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!isHost) return;
    socket.emit('change_level', { level: btn.dataset.level });
  });
});

document.getElementById('btn-start').addEventListener('click', () => {
  socket.emit('start_game');
});

// ─── Game Over controls ───────────────────────────────────────────────────────
document.getElementById('btn-play-again').addEventListener('click', () => {
  socket.emit('play_again');
});

document.getElementById('btn-back-lobby').addEventListener('click', () => {
  showScreen('screen-lobby');
});

document.getElementById('btn-lb-back').addEventListener('click', () => {
  showScreen('screen-landing');
});

// ─── Socket events ────────────────────────────────────────────────────────────
socket.on('room_created', ({ code, players }) => {
  isHost = true;
  document.getElementById('lobby-code').textContent = code;
  document.getElementById('lobby-status').textContent = `Share code: ${code}`;
  document.getElementById('lobby-host-controls').classList.remove('hidden');
  document.getElementById('lobby-guest-msg').classList.add('hidden');
  renderLobbyPlayers(players);
  setLobbyLevel('medium');
  showScreen('screen-lobby');
});

socket.on('room_joined', ({ code, players, level }) => {
  isHost = false;
  document.getElementById('lobby-code').textContent = code;
  document.getElementById('lobby-status').textContent = `Room ${code} — ${Object.keys(players).length}/6`;
  document.getElementById('lobby-host-controls').classList.add('hidden');
  document.getElementById('lobby-guest-msg').classList.remove('hidden');
  renderLobbyPlayers(players);
  setLobbyLevel(level || 'medium');
  showScreen('screen-lobby');
});

socket.on('lobby_update', ({ players }) => {
  renderLobbyPlayers(players);
  document.getElementById('lobby-status').textContent =
    `${Object.keys(players).length}/6 players`;
});

socket.on('level_changed', ({ level }) => setLobbyLevel(level));

socket.on('join_error', msg => setError('landing-error', msg));

socket.on('game_start', ({ level, players }) => {
  showScreen('screen-game');
  document.getElementById('flap-hint').style.animation = '';
  void document.getElementById('flap-hint').offsetWidth;
  document.getElementById('flap-hint').style.animation = 'fadeOut 3s forwards 4s';

  document.getElementById('hud-level').textContent =
    `${level.charAt(0).toUpperCase() + level.slice(1)} Mode`;

  if (game) game.destroy();
  game = new FlappyGame(
    document.getElementById('game-canvas'),
    socket,
    players
  );
  game.start();
});

socket.on('game_state', ({ pipes, players }) => {
  if (game) game.updateState(pipes, players);
  updateHUD(players);
});

socket.on('player_died', ({ id }) => {
  if (game) game.onPlayerDied(id);
});

socket.on('game_over', ({ results }) => {
  if (game) { game.destroy(); game = null; }
  renderGameOver(results);
  showScreen('screen-gameover');
});

// ─── HUD ──────────────────────────────────────────────────────────────────────
function updateHUD(players) {
  const container = document.getElementById('hud-scores');
  container.innerHTML = '';
  const sorted = Object.values(players).sort((a, b) => b.score - a.score);
  for (const p of sorted) {
    const hex = '#' + p.color.toString(16).padStart(6, '0');
    const div = document.createElement('div');
    div.className = 'hud-player' + (p.alive ? '' : ' hud-dead');
    div.innerHTML = `<span class="hud-dot" style="background:${hex}"></span>${p.name}: ${p.score}`;
    container.appendChild(div);
  }
}

// ─── Game Over ────────────────────────────────────────────────────────────────
function renderGameOver(results) {
  const list = document.getElementById('results-list');
  list.innerHTML = '';
  results.forEach((r, i) => {
    const hex = '#' + r.color.toString(16).padStart(6, '0');
    const rankLabel = RANK_MEDALS[i] || `${i + 1}.`;
    const rankClass = ['gold', 'silver', 'bronze'][i] || '';
    const div = document.createElement('div');
    div.className = 'result-row';
    div.innerHTML = `
      <span class="result-rank ${rankClass}">${rankLabel}</span>
      <span class="result-name" style="color:${hex}">${r.name}</span>
      <span class="result-score">${r.score} pts</span>
    `;
    list.appendChild(div);
  });

  if (isHost) {
    document.getElementById('gameover-host-btns').classList.remove('hidden');
    document.getElementById('gameover-guest-msg').classList.add('hidden');
  } else {
    document.getElementById('gameover-host-btns').classList.add('hidden');
    document.getElementById('gameover-guest-msg').classList.remove('hidden');
  }
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────
async function loadLeaderboard() {
  showScreen('screen-leaderboard');
  const tbody = document.getElementById('lb-body');
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;opacity:.5">Loading…</td></tr>';

  const { data, error } = await supabase
    .from('leaderboard')
    .select('player_name, score, level, created_at')
    .order('score', { ascending: false })
    .limit(20);

  if (error || !data?.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;opacity:.5">No scores yet!</td></tr>';
    return;
  }

  tbody.innerHTML = data.map((row, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${row.player_name}</td>
      <td>${row.score}</td>
      <td><span class="lb-level">${row.level}</span></td>
    </tr>
  `).join('');
}
