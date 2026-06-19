import { ChessGame } from './ChessGame.js';
import { showScreen, submitScore, loadLeaderboard } from '../../core/shared.js';
import { track } from '../../lib/analytics.js';
import { registerGame, unregisterGame, updateGameHUD } from '../../nav.js';

let chessGame = null;

export function initChess() {
  document.getElementById('btn-chess-play').addEventListener('click', startChess);
  document.getElementById('btn-chess-lb-show').addEventListener('click', loadChessLeaderboard);
  document.getElementById('btn-chess-lb-back').addEventListener('click', () => showScreen('screen-chess-landing'));
  document.getElementById('btn-chess-home').addEventListener('click', () => {
    if (chessGame) { chessGame.destroy(); chessGame = null; }
    showScreen('screen-home');
  });
  document.getElementById('btn-chess-play-again').addEventListener('click', startChess);
  document.getElementById('btn-chess-gameover-home').addEventListener('click', () => showScreen('screen-home'));
}

function startChess() {
  const p1 = document.getElementById('chess-name-white').value.trim() || 'White';
  const p2 = document.getElementById('chess-name-black').value.trim() || 'Black';
  document.getElementById('chess-error').textContent = '';

  if (chessGame) { chessGame.destroy(); chessGame = null; }

  showScreen('screen-chess-game');
  const canvas = document.getElementById('chess-canvas');
  const _chessStartTime = Date.now();
  track('game_start', { game_name: 'chess', player_name: p1 });

  chessGame = new ChessGame(canvas, { player1: p1, player2: p2 }, async ({ winner, reason, moves }) => {
    unregisterGame();
    const prevGame = chessGame;
    chessGame = null;
    track('game_end', { game_name: 'chess', player_name: p1, duration_ms: Date.now() - _chessStartTime, metadata: { winner, reason, moves } });

    let winnerName, score1, score2;
    if (winner === 'draw') {
      winnerName = 'Draw';
      score1 = 50; score2 = 50;
    } else {
      winnerName = winner === 'w' ? p1 : p2;
      score1 = winner === 'w' ? 100 : 0;
      score2 = winner === 'b' ? 100 : 0;
    }

    await Promise.all([
      score1 > 0 && submitScore({ player_name: p1, score: score1, level: `chess-${reason}`, game_name: 'chess' }),
      score2 > 0 && submitScore({ player_name: p2, score: score2, level: `chess-${reason}`, game_name: 'chess' }),
    ].filter(Boolean));

    document.getElementById('chess-gameover-winner').textContent = winner === 'draw' ? 'Draw!' : `${winnerName} wins!`;
    document.getElementById('chess-gameover-reason').textContent =
      { checkmate: 'by Checkmate', stalemate: 'Stalemate' }[reason] || reason;
    document.getElementById('chess-gameover-moves').textContent = moves;
    showScreen('screen-chess-gameover');
  });

  registerGame(chessGame);
  updateGameHUD({ name: `${p1} vs ${p2}`, score: '' });
  chessGame.start();
}

async function loadChessLeaderboard() {
  showScreen('screen-chess-lb');
  await loadLeaderboard('chess', 'chess-lb-body', {
    ascending: false,
    render: (r, i) => `
      <tr><td>${i + 1}</td><td>${r.player_name}</td><td>${r.score}</td>
      <td><span class="lb-level">${r.level || ''}</span></td></tr>`,
  });
}
