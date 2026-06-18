// Universal navigation overlay + in-game HUD + exit modal

let _currentGame = null;    // { pause(), resume(), destroy() }
let _currentScreen = '';

const GAME_SCREENS = new Set([
  'screen-game', 'screen-reaction-game', 'screen-shooter-game', 'screen-pacman-game', 'screen-chess-game',
]);

const HOME_SCREENS = new Set([
  'screen-home',
]);

export function initNav() {
  document.getElementById('nav-btn-home').addEventListener('click', () => {
    import('./core/shared.js').then(({ showScreen }) => showScreen('screen-home'));
  });

  document.getElementById('nav-btn-exit').addEventListener('click', () => {
    _pauseCurrentGame();
    document.getElementById('exit-modal').classList.remove('hidden');
  });

  document.getElementById('exit-modal-resume').addEventListener('click', () => {
    document.getElementById('exit-modal').classList.add('hidden');
    _resumeCurrentGame();
  });

  document.getElementById('exit-modal-quit').addEventListener('click', () => {
    document.getElementById('exit-modal').classList.add('hidden');
    _destroyCurrentGame();
    import('./core/shared.js').then(({ showScreen }) => showScreen('screen-home'));
  });
}

export function setNavContext(screenId) {
  _currentScreen = screenId;
  const nav = document.getElementById('global-nav');
  const btnHome = document.getElementById('nav-btn-home');
  const btnExit = document.getElementById('nav-btn-exit');

  if (HOME_SCREENS.has(screenId)) {
    nav.classList.add('hidden');
    return;
  }

  nav.classList.remove('hidden');

  if (GAME_SCREENS.has(screenId)) {
    btnHome.classList.add('hidden');
    btnExit.classList.remove('hidden');
  } else {
    btnHome.classList.remove('hidden');
    btnExit.classList.add('hidden');
  }

  // Hide HUD when leaving game screens
  if (!GAME_SCREENS.has(screenId)) {
    document.getElementById('game-hud-overlay').classList.add('hidden');
  }
}

export function registerGame(gameObj) {
  // gameObj should have optional pause(), resume(), destroy()
  _currentGame = gameObj;
}

export function unregisterGame() {
  _currentGame = null;
}

export function updateGameHUD({ name, score }) {
  const hud = document.getElementById('game-hud-overlay');
  hud.classList.remove('hidden');
  document.getElementById('hud-player-name').textContent = name || '';
  document.getElementById('hud-player-score').textContent = score ?? '';
}

function _pauseCurrentGame() {
  if (_currentGame?.pause) _currentGame.pause();
}

function _resumeCurrentGame() {
  if (_currentGame?.resume) _currentGame.resume();
}

function _destroyCurrentGame() {
  if (_currentGame?.destroy) _currentGame.destroy();
  _currentGame = null;
}
