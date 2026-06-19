import { PacmanGame } from './PacmanGame.js';
import { showScreen, submitScore, loadLeaderboard } from '../../core/shared.js';
import { track } from '../../lib/analytics.js';
import { registerGame, unregisterGame, updateGameHUD } from '../../nav.js';

let pmName = '';
let pmGame = null;
let pmMode = 'classic';
let pmTheme = 'classic';

export function initPacman() {
  // Mode picker
  document.querySelectorAll('[data-pm-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      pmMode = btn.dataset.pmMode;
      document.querySelectorAll('[data-pm-mode]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Theme picker
  document.querySelectorAll('[data-pm-theme]').forEach(btn => {
    btn.addEventListener('click', () => {
      pmTheme = btn.dataset.pmTheme;
      document.querySelectorAll('[data-pm-theme]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document.getElementById('btn-pacman-play').addEventListener('click', () => startPacman(pmMode, pmTheme));

  document.getElementById('btn-pacman-lb-show').addEventListener('click', loadPacmanLeaderboard);
  document.getElementById('btn-pacman-lb-back').addEventListener('click', () => showScreen('screen-pacman-landing'));
  document.getElementById('btn-pacman-home').addEventListener('click', () => {
    if (pmGame) { pmGame.destroy(); pmGame = null; }
    showScreen('screen-home');
  });
  document.getElementById('btn-pacman-play-again').addEventListener('click', () => {
    startPacman(pmMode, pmTheme);
  });
  document.getElementById('btn-pacman-gameover-home').addEventListener('click', () => showScreen('screen-home'));
}

function startPacman(mode, theme) {
  pmName = document.getElementById('pacman-name').value.trim();
  if (!pmName) {
    document.getElementById('pacman-error').textContent = 'Enter your name first.';
    return;
  }
  document.getElementById('pacman-error').textContent = '';
  pmMode = mode;
  pmTheme = theme;

  if (pmGame) { pmGame.destroy(); pmGame = null; }

  showScreen('screen-pacman-game');
  const canvas = document.getElementById('pm-canvas');
  const _pmStartTime = Date.now();
  track('game_start', { game_name: 'pacman', player_name: pmName });

  pmGame = new PacmanGame(canvas, mode, async ({ score, level }) => {
    unregisterGame();
    pmGame = null;
    track('game_end', { game_name: 'pacman', player_name: pmName, duration_ms: Date.now() - _pmStartTime, metadata: { score, level } });

    if (score > 0) {
      await submitScore({
        player_name: pmName,
        score,
        level: `${mode}-L${level}`,
        game_name: 'pacman',
      });
    }

    document.getElementById('pm-gameover-score').textContent = score;
    document.getElementById('pm-gameover-level').textContent = level;
    document.getElementById('pm-gameover-mode').textContent =
      { classic: 'Classic', endless: 'Endless', timeattack: 'Time Attack' }[mode];
    showScreen('screen-pacman-gameover');
  }, theme);

  registerGame(pmGame);
  updateGameHUD({ name: pmName, score: 0 });
  pmGame.start();
}

async function loadPacmanLeaderboard() {
  showScreen('screen-pacman-lb');
  await loadLeaderboard('pacman', 'pm-lb-body', {
    ascending: false,
    render: (r, i) => `
      <tr><td>${i + 1}</td><td>${r.player_name}</td><td>${r.score}</td>
      <td><span class="lb-level">${r.level || ''}</span></td></tr>`,
  });
}
