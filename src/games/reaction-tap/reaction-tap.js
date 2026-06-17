import { showScreen, submitScore, loadLeaderboard } from '../../shared.js';

const ROUNDS = 5;
const PENALTY_MS = 1000;
const MIN_DELAY  = 1000;
const MAX_DELAY  = 4000;

let rtName        = '';
let rtRounds      = [];
let rtCurrentRound = 0;
let rtFlashTime   = null;
let rtWaiting     = false;  // true = waiting for flash (tap = too early)
let rtActive      = false;  // true = flash shown, waiting for tap
let rtTimer       = null;
let rtTapBound    = null;
let rtKeyBound    = null;

// ─── Screens ──────────────────────────────────────────────────────────────────
export function initReactionTap() {
  document.getElementById('btn-rt-play').addEventListener('click', () => {
    rtName = document.getElementById('rt-name').value.trim();
    if (!rtName) return setRtError('Enter your name first.');
    setRtError('');
    startReactionGame();
  });

  document.getElementById('btn-rt-lb-show').addEventListener('click', loadReactionLeaderboard);
  document.getElementById('btn-rt-lb-back').addEventListener('click', () => showScreen('screen-home'));
  document.getElementById('btn-rt-home').addEventListener('click', () => {
    cleanup();
    showScreen('screen-home');
  });
  document.getElementById('btn-rt-again').addEventListener('click', () => {
    rtName = document.getElementById('rt-name').value.trim() || rtName;
    startReactionGame();
  });
  document.getElementById('btn-rt-share').addEventListener('click', shareResult);
  document.getElementById('btn-rt-results-home').addEventListener('click', () => showScreen('screen-home'));
}

function setRtError(msg) {
  document.getElementById('rt-error').textContent = msg;
}

// ─── Game flow ────────────────────────────────────────────────────────────────
function startReactionGame() {
  cleanup();
  rtRounds        = [];
  rtCurrentRound  = 0;
  rtFlashTime     = null;
  rtWaiting       = false;
  rtActive        = false;

  const arena = document.getElementById('rt-arena');
  arena.className = 'reaction-arena waiting';

  document.getElementById('rt-round-counter').textContent = `Round 1 / ${ROUNDS}`;
  document.getElementById('rt-arena-msg').textContent     = 'Get ready…';
  document.getElementById('rt-last-time').textContent     = '';

  showScreen('screen-reaction-game');

  rtTapBound = handleTap;
  rtKeyBound = (e) => { if (e.code === 'Space') { e.preventDefault(); handleTap(); } };
  arena.addEventListener('click', rtTapBound);
  arena.addEventListener('touchstart', rtTapBound, { passive: true });
  window.addEventListener('keydown', rtKeyBound);

  setTimeout(() => nextRound(), 800);
}

function nextRound() {
  rtWaiting = true;
  rtActive  = false;
  rtFlashTime = null;

  const arena = document.getElementById('rt-arena');
  arena.className = 'reaction-arena waiting';
  document.getElementById('rt-arena-msg').textContent = 'Wait for green…';
  document.getElementById('rt-round-counter').textContent = `Round ${rtCurrentRound + 1} / ${ROUNDS}`;

  const delay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
  rtTimer = setTimeout(() => {
    rtFlashTime = Date.now();
    rtWaiting   = false;
    rtActive    = true;
    arena.className = 'reaction-arena go';
    document.getElementById('rt-arena-msg').textContent = 'TAP!';
  }, delay);
}

function handleTap() {
  if (!rtActive && !rtWaiting) return;

  const arena = document.getElementById('rt-arena');

  if (rtWaiting) {
    // Tapped before flash — penalty
    clearTimeout(rtTimer);
    rtRounds.push(PENALTY_MS);
    arena.className = 'reaction-arena penalty';
    document.getElementById('rt-arena-msg').textContent  = 'Too early! ⚠️';
    document.getElementById('rt-last-time').textContent  = `+${PENALTY_MS}ms penalty`;
  } else {
    const elapsed = Date.now() - rtFlashTime;
    rtRounds.push(elapsed);
    arena.className = 'reaction-arena result';
    document.getElementById('rt-arena-msg').textContent  = `${elapsed} ms`;
    document.getElementById('rt-last-time').textContent  = elapsed < 200 ? '⚡ Lightning fast!' : elapsed < 350 ? '👍 Nice!' : '😅 Keep trying!';
  }

  rtActive  = false;
  rtWaiting = false;
  rtCurrentRound++;

  if (rtCurrentRound >= ROUNDS) {
    setTimeout(finishGame, 900);
  } else {
    setTimeout(nextRound, 900);
  }
}

function finishGame() {
  cleanup();
  const avg = Math.round(rtRounds.reduce((a, b) => a + b, 0) / rtRounds.length);

  // Render results
  const list = document.getElementById('rt-round-results');
  list.innerHTML = rtRounds.map((ms, i) =>
    `<div class="rt-round-row ${ms === PENALTY_MS ? 'rt-penalty' : ''}">
       <span>Round ${i + 1}</span>
       <span>${ms === PENALTY_MS ? '⚠️ Too early' : `${ms} ms`}</span>
     </div>`
  ).join('');

  document.getElementById('rt-avg-display').textContent = `${avg} ms avg`;
  document.getElementById('rt-avg-label').textContent   =
    avg < 200 ? '⚡ Superhuman!' : avg < 250 ? '🚀 Excellent!' : avg < 350 ? '👍 Good!' : avg < 500 ? '😐 Average' : '🐢 Keep practising!';

  // Store avg for share button
  document.getElementById('btn-rt-share').dataset.avg = avg;

  showScreen('screen-reaction-results');

  // Submit — lower score = better, so store as-is and leaderboard sorts ascending
  submitScore({ player_name: rtName, score: avg, game_name: 'reaction-tap' });
}

function shareResult() {
  const avg = document.getElementById('btn-rt-share').dataset.avg;
  const text = `⚡ My reaction time: ${avg}ms avg on Reaction Tap — can you beat me?\n${location.origin}`;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('btn-rt-share');
    btn.textContent = 'Copied! ✓';
    setTimeout(() => { btn.textContent = '📋 Share Result'; }, 2000);
  });
}

function cleanup() {
  clearTimeout(rtTimer);
  rtTimer = null;
  const arena = document.getElementById('rt-arena');
  if (arena && rtTapBound) {
    arena.removeEventListener('click', rtTapBound);
    arena.removeEventListener('touchstart', rtTapBound);
  }
  if (rtKeyBound) window.removeEventListener('keydown', rtKeyBound);
  rtTapBound = null;
  rtKeyBound = null;
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────
async function loadReactionLeaderboard() {
  showScreen('screen-reaction-lb');
  await loadLeaderboard('reaction-tap', 'rt-lb-body', {
    ascending: true,
    render: (r, i) =>
      `<tr>
        <td>${i + 1}</td>
        <td>${r.player_name}</td>
        <td>${r.score} ms</td>
       </tr>`,
  });
}
