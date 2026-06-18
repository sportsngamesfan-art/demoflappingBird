import { PacmanGame } from './PacmanGame.js';
import { showScreen, submitScore, loadLeaderboard } from '../../shared.js';

let pmName = '';
let pmGame = null;
let pmMode = 'classic';

export function initPacman() {
  document.getElementById('btn-pacman-classic').addEventListener('click', () => startPacman('classic'));
  document.getElementById('btn-pacman-endless').addEventListener('click', () => startPacman('endless'));
  document.getElementById('btn-pacman-timeattack').addEventListener('click', () => startPacman('timeattack'));

  document.getElementById('btn-pacman-lb-show').addEventListener('click', loadPacmanLeaderboard);
  document.getElementById('btn-pacman-lb-back').addEventListener('click', () => showScreen('screen-pacman-landing'));
  document.getElementById('btn-pacman-home').addEventListener('click', () => {
    if (pmGame) { pmGame.destroy(); pmGame = null; }
    showScreen('screen-home');
  });
  document.getElementById('btn-pacman-play-again').addEventListener('click', () => {
    startPacman(pmMode);
  });
  document.getElementById('btn-pacman-gameover-home').addEventListener('click', () => showScreen('screen-home'));
}

function startPacman(mode) {
  pmName = document.getElementById('pacman-name').value.trim();
  if (!pmName) {
    document.getElementById('pacman-error').textContent = 'Enter your name first.';
    return;
  }
  document.getElementById('pacman-error').textContent = '';
  pmMode = mode;

  if (pmGame) { pmGame.destroy(); pmGame = null; }

  showScreen('screen-pacman-game');
  const canvas = document.getElementById('pm-canvas');

  pmGame = new PacmanGame(canvas, mode, async ({ score, level }) => {
    pmGame = null;

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
  });

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
