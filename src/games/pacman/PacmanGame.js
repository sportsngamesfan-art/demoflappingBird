import { CELL, COLS, ROWS, PELLET, POWER, TUNNEL, Maze, MAZES } from './Maze.js';
import { Ghost } from './Ghost.js';
import { PacmanAudio } from './Audio.js';

const THEMES = {
  classic:    { bg: '#000011', wallFill: '#001a4d', wallGlow: '#00aaff', door: '#ff69b4', pellet: '#ddd',    powerGlow: '#FFD700', pacman: '#FFD700' },
  neon:       { bg: '#0a000f', wallFill: '#1a0035', wallGlow: '#bf00ff', door: '#ff00aa', pellet: '#ff80ff', powerGlow: '#ff00ff', pacman: '#00ffdd' },
  fire:       { bg: '#0f0000', wallFill: '#2d0800', wallGlow: '#ff4500', door: '#ff8800', pellet: '#ffaa55', powerGlow: '#ff0000', pacman: '#ff9900' },
};

const MAZE_W = COLS * CELL; // 448
const MAZE_H = ROWS * CELL; // 496

const DIR = { RIGHT: 0, DOWN: 1, LEFT: 2, UP: 3 };
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

const GHOST_START_TILES = [
  { col: 13, row: 11 }, // blinky (starts outside)
  { col: 13, row: 14 }, // pinky
  { col: 11, row: 14 }, // inky
  { col: 15, row: 14 }, // clyde
];

const GHOST_CONFIGS = [
  { name: 'blinky', color: '#FF0000', release: 0 },
  { name: 'pinky',  color: '#FFB8FF', release: 0 },
  { name: 'inky',   color: '#00FFFF', release: 30 },
  { name: 'clyde',  color: '#FFB847', release: 60 },
];

const PACMAN_START = { col: 13, row: 23 };
const PACMAN_SPEED_BASE = CELL * 5;  // px per second (~5 tiles/s)
const FRIGHTEN_DURATION = 8;          // seconds
const EXTRA_LIFE_SCORE = 10000;

const FRUIT_SCORES  = [100, 300, 500, 700, 1000, 2000, 3000, 5000];
const FRUIT_EMOJIS  = ['🍒', '🍓', '🍊', '🍎', '🍈', '🔔', '🔑', '🍄'];
const FRUIT_SPAWN_1 = 70;
const FRUIT_SPAWN_2 = 170;
const FRUIT_DURATION = 9; // seconds

export class PacmanGame {
  constructor(canvas, mode, onEnd, theme = 'classic') {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._mode = mode;      // 'classic' | 'endless' | 'timeattack'
    this._onEnd = onEnd;    // callback({ score, level })
    this._theme = THEMES[theme] || THEMES.classic;
    this._audio = new PacmanAudio();

    this._raf = null;
    this._keys = {};
    this._onKey = e => this._handleKey(e);
    this._onClick = e => this._handleTap(e);
    this._swipeStart = null;
    this._onTouchStart = e => { const t = e.touches[0]; this._swipeStart = { x: t.clientX, y: t.clientY }; };
    this._onTouchEnd = e => {
      if (!this._swipeStart) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - this._swipeStart.x;
      const dy = t.clientY - this._swipeStart.y;
      this._swipeStart = null;
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return; // tap, not swipe
      if (Math.abs(dx) > Math.abs(dy)) {
        this._pm.nextDir = dx > 0 ? DIR.RIGHT : DIR.LEFT;
      } else {
        this._pm.nextDir = dy > 0 ? DIR.DOWN : DIR.UP;
      }
    };
    window.addEventListener('keydown', this._onKey);
    canvas.addEventListener('click', this._onClick);
    canvas.addEventListener('touchstart', this._onTouchStart, { passive: true });
    canvas.addEventListener('touchend',   this._onTouchEnd,   { passive: true });

    this._level = 1;
    this._score = 0;
    this._lives = 3;
    this._extraLifeGiven = false;
    this._mazeIdx = 0;
    this._maze = new Maze(MAZES[0]);
    this._ghosts = GHOST_CONFIGS.map((cfg, i) =>
      new Ghost(cfg.name, cfg.color, GHOST_START_TILES[i], cfg.release));
    this._pelletsEaten = 0;
    this._ghostChain = 0;
    this._particles = [];
    this._scorePopups = [];
    this._shakeT = 0;
    this._shakeAmp = 0;
    this._levelFlash = 0;
    this._dying = false;
    this._deathT = 0;
    this._waiting = false; // brief pause after death/level before resume
    this._waitT = 0;
    this._paused = false;
    this._fruit = null; // { emoji, score, x, y, timer }
    this._fruitSpawned = [false, false];
    this._timer = mode === 'timeattack' ? 180 : 0; // countdown for time attack
    this._lastT = null;
    this._ended = false;

    this._initPacman();
    this._resize();
    this._resizeBound = () => this._resize();
    window.addEventListener('resize', this._resizeBound);

    this._audio.playIntro();
    this._waiting = true;
    this._waitT = 1.0;
  }

  _initPacman() {
    const sc = this._maze.tileCenter(PACMAN_START.col, PACMAN_START.row);
    this._pm = {
      x: sc.x, y: sc.y,
      dir: DIR.LEFT,
      nextDir: DIR.LEFT,
      speed: PACMAN_SPEED_BASE * (1 + (this._level - 1) * 0.05),
      alive: true,
      mouthT: 0,
      _snapCol: -1, _snapRow: -1, // tile where last direction decision was made
    };
  }

  _resize() {
    const canvas = this._canvas;
    const W = window.innerWidth, H = window.innerHeight;
    canvas.width = W; canvas.height = H;
    this._scale = Math.min(W / MAZE_W, H / (MAZE_H + 60));
    this._offX = (W - MAZE_W * this._scale) / 2;
    this._offY = (H - (MAZE_H + 60) * this._scale) / 2 + 30 * this._scale;
  }

  start() {
    this._lastT = performance.now();
    this._raf = requestAnimationFrame(t => this._loop(t));
  }

  pause()  { this._paused = true; }
  resume() { this._paused = false; this._lastT = performance.now(); }

  destroy() {
    this._ended = true;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('resize', this._resizeBound);
    this._canvas.removeEventListener('click', this._onClick);
    this._canvas.removeEventListener('touchstart', this._onTouchStart);
    this._canvas.removeEventListener('touchend',   this._onTouchEnd);
  }

  _loop(t) {
    if (this._ended) return;
    const dt = Math.min((t - this._lastT) / 1000, 0.05);
    this._lastT = t;
    this._tick(dt);
    if (this._ended) return; // _tick may have ended the game this frame
    this._render();
    this._raf = requestAnimationFrame(ts => this._loop(ts));
  }

  _handleKey(e) {
    const map = {
      ArrowRight: DIR.RIGHT, ArrowLeft: DIR.LEFT,
      ArrowDown: DIR.DOWN, ArrowUp: DIR.UP,
      d: DIR.RIGHT, a: DIR.LEFT, s: DIR.DOWN, w: DIR.UP,
      D: DIR.RIGHT, A: DIR.LEFT, S: DIR.DOWN, W: DIR.UP,
    };
    if (e.key in map) {
      this._pm.nextDir = map[e.key];
      e.preventDefault();
    }
  }

  _handleTap() {
    // No-op for Pac-Man (touch steering handled via swipe or buttons)
  }

  // ─── Tick ─────────────────────────────────────────────────────────────────

  _tick(dt) {
    if (this._paused) return;

    if (this._waiting) {
      this._waitT -= dt;
      if (this._waitT <= 0) { this._waiting = false; }
      return;
    }

    if (this._dying) {
      this._deathT -= dt;
      if (this._deathT <= 0) {
        this._dying = false;
        this._lives--;
        if (this._lives <= 0) {
          this._gameOver();
        } else {
          this._resetPositions();
          this._waiting = true;
          this._waitT = 1.5;
        }
      }
      return;
    }

    // Time attack countdown
    if (this._mode === 'timeattack') {
      this._timer -= dt;
      if (this._timer <= 0) { this._timer = 0; this._gameOver(); return; }
    }

    this._movePacman(dt);
    this._checkPellet();
    this._checkFruit(dt);
    this._updateGhosts(dt);
    this._checkCollisions();
    this._updateParticles(dt);
    this._updateShake(dt);

    if (this._levelFlash > 0) this._levelFlash -= dt;

    // Level complete
    if (this._maze.remaining === 0) {
      this._levelComplete();
    }
  }

  _movePacman(dt) {
    const pm = this._pm;
    const step = pm.speed * dt;

    if (pm.x < -CELL / 2) { pm.x = COLS * CELL + CELL / 2; return; }
    if (pm.x > COLS * CELL + CELL / 2) { pm.x = -CELL / 2; return; }

    const col = Math.floor(pm.x / CELL);
    const row = Math.floor(pm.y / CELL);
    const cx = col * CELL + CELL / 2;
    const cy = row * CELL + CELL / 2;

    // Block 1: direction decision when entering a new tile (fires once per tile)
    if ((col !== pm._snapCol || row !== pm._snapRow) &&
        Math.abs(pm.x - cx) <= step + 1 && Math.abs(pm.y - cy) <= step + 1) {
      pm._snapCol = col; pm._snapRow = row;
      pm.x = cx; pm.y = cy;
      if (this._maze.canMove(cx, cy, pm.nextDir)) pm.dir = pm.nextDir;
    }

    // Block 2: stop check — fires every frame while sitting at a tile centre
    if (Math.abs(pm.x - cx) < 0.5 && Math.abs(pm.y - cy) < 0.5) {
      // Re-check buffered direction so player can unstick by pressing a key
      if (this._maze.canMove(cx, cy, pm.nextDir)) pm.dir = pm.nextDir;
      if (!this._maze.canMove(cx, cy, pm.dir)) {
        pm.mouthT += dt;
        return;
      }
    }

    pm.x += DX[pm.dir] * step;
    pm.y += DY[pm.dir] * step;
    pm.mouthT += dt;
    pm.y = Math.max(CELL / 2, Math.min(pm.y, ROWS * CELL - CELL / 2));
  }

  _checkPellet() {
    const pm = this._pm;
    const { col, row } = this._maze.pixelToTile(pm.x, pm.y);
    const eaten = this._maze.eat(col, row);
    if (!eaten) return;

    this._pelletsEaten++;

    if (eaten === PELLET) {
      this._score += 10;
      this._audio.playPellet();
      this._spawnPelletParticles(pm.x, pm.y);
    } else if (eaten === POWER) {
      this._score += 50;
      this._audio.playPower();
      this._ghostChain = 0;
      this._ghosts.forEach(g => g.frighten(FRIGHTEN_DURATION));
      this._spawnPowerParticles(pm.x, pm.y);
    }

    this._checkExtraLife();
    this._checkFruitSpawn();
  }

  _checkExtraLife() {
    if (!this._extraLifeGiven && this._score >= EXTRA_LIFE_SCORE) {
      this._extraLifeGiven = true;
      this._lives++;
      this._audio.playExtraLife();
    }
  }

  _checkFruitSpawn() {
    const pe = this._pelletsEaten;
    if (pe >= FRUIT_SPAWN_1 && !this._fruitSpawned[0]) {
      this._fruitSpawned[0] = true;
      this._spawnFruit();
    } else if (pe >= FRUIT_SPAWN_2 && !this._fruitSpawned[1]) {
      this._fruitSpawned[1] = true;
      this._spawnFruit();
    }
  }

  _spawnFruit() {
    const idx = Math.min(this._level - 1, FRUIT_SCORES.length - 1);
    const tc = this._maze.tileCenter(13, 17);
    this._fruit = {
      emoji: FRUIT_EMOJIS[idx],
      score: FRUIT_SCORES[idx],
      x: tc.x, y: tc.y,
      timer: FRUIT_DURATION,
    };
  }

  _checkFruit(dt) {
    if (!this._fruit) return;
    this._fruit.timer -= dt;
    if (this._fruit.timer <= 0) { this._fruit = null; return; }

    const pm = this._pm;
    const dx = pm.x - this._fruit.x, dy = pm.y - this._fruit.y;
    if (dx * dx + dy * dy < (CELL * 0.8) ** 2) {
      this._score += this._fruit.score;
      this._addScorePopup(this._fruit.x, this._fruit.y, this._fruit.score);
      this._fruit = null;
    }
  }

  _updateGhosts(dt) {
    const blinky = this._ghosts[0];
    this._ghosts.forEach(g =>
      g.update(dt, this._maze, this._pm, blinky, this._pelletsEaten, this._level));
  }

  _checkCollisions() {
    const pm = this._pm;
    for (const g of this._ghosts) {
      if (g.mode === 'eaten' || g.mode === 'house' || g.mode === 'exiting') continue;
      const dx = pm.x - g.x, dy = pm.y - g.y;
      if (dx * dx + dy * dy > (CELL * 0.7) ** 2) continue;

      if (g.mode === 'frightened') {
        // Eat ghost
        this._ghostChain++;
        const pts = [200, 400, 800, 1600][Math.min(this._ghostChain - 1, 3)];
        this._score += pts;
        this._audio.playGhostEat(this._ghostChain);
        this._addScorePopup(g.x, g.y, pts);
        g.respawn();
      } else {
        // Pac-Man dies
        this._killPacman();
        break;
      }
    }
  }

  _killPacman() {
    if (this._dying) return;
    this._dying = true;
    this._deathT = 1.5;
    this._audio.playDeath();
    this._shakeAmp = 4;
    this._shakeT = 0.4;
  }

  _resetPositions() {
    this._initPacman();
    this._ghosts.forEach((g, i) => {
      g.mode = i === 0 ? 'scatter' : 'house';
      const tc = this._maze.tileCenter(GHOST_START_TILES[i].col, GHOST_START_TILES[i].row);
      g.x = tc.x; g.y = tc.y;
    });
    this._ghostChain = 0;
  }

  _levelComplete() {
    this._audio.playLevelComplete();
    this._levelFlash = 1.5;
    this._waiting = true;
    this._waitT = 2.5;

    this._level++;
    if (this._mode === 'endless') {
      this._mazeIdx = (this._mazeIdx + 1) % MAZES.length;
      this._maze = new Maze(MAZES[this._mazeIdx]);
    } else {
      this._maze.reset();
    }

    this._pelletsEaten = 0;
    this._fruitSpawned = [false, false];
    this._fruit = null;

    this._ghosts.forEach((g, i) => {
      const tc = this._maze.tileCenter(GHOST_START_TILES[i].col, GHOST_START_TILES[i].row);
      g.x = tc.x; g.y = tc.y;
      g.mode = i === 0 ? 'scatter' : 'house';
      g._modePhase = 0;
      g._modeTimer = 0;
      g.releaseDelay = GHOST_CONFIGS[i].release;
    });

    this._initPacman();
  }

  _gameOver() {
    this._ended = true;
    this.destroy();
    this._onEnd({ score: this._score, level: this._level });
  }

  // ─── Particles ─────────────────────────────────────────────────────────────

  _spawnPelletParticles(x, y) {
    for (let i = 0; i < 4; i++) {
      const angle = Math.random() * Math.PI * 2;
      this._particles.push({ x, y, vx: Math.cos(angle) * 30, vy: Math.sin(angle) * 30, life: 0.3, maxLife: 0.3, r: 2, color: '#fff' });
    }
  }

  _spawnPowerParticles(x, y) {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      this._particles.push({ x, y, vx: Math.cos(angle) * 60, vy: Math.sin(angle) * 60, life: 0.5, maxLife: 0.5, r: 4, color: '#FFD700' });
    }
  }

  _addScorePopup(x, y, pts) {
    this._scorePopups.push({ x, y, text: '+' + pts, life: 1.0, vy: -25 });
  }

  _updateParticles(dt) {
    this._particles = this._particles.filter(p => {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.life -= dt;
      return p.life > 0;
    });
    this._scorePopups = this._scorePopups.filter(p => {
      p.y += p.vy * dt; p.life -= dt;
      return p.life > 0;
    });
  }

  _updateShake(dt) {
    if (this._shakeT > 0) this._shakeT -= dt;
    else this._shakeAmp = 0;
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  _render() {
    const ctx = this._ctx;
    const W = this._canvas.width, H = this._canvas.height;
    ctx.fillStyle = this._theme.bg;
    ctx.fillRect(0, 0, W, H);

    const s = this._scale;
    const ox = this._offX + (this._shakeAmp > 0 ? (Math.random() - 0.5) * this._shakeAmp * 2 : 0);
    const oy = this._offY;

    // Level flash overlay
    if (this._levelFlash > 0) {
      const alpha = Math.abs(Math.sin(this._levelFlash * Math.PI * 4)) * 0.4;
      ctx.save();
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillRect(ox, oy, MAZE_W * s, MAZE_H * s);
      ctx.restore();
    }

    // Maze
    this._maze.render(ctx, performance.now() / 1000, ox, oy, s, this._theme);

    // Fruit
    if (this._fruit) {
      ctx.font = `${CELL * s * 1.2}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this._fruit.emoji, ox + this._fruit.x * s, oy + this._fruit.y * s);
    }

    // Ghosts
    this._ghosts.forEach(g => g.render(ctx, ox, oy, s));

    // Pac-Man
    if (!this._dying || this._deathT > 0.3) {
      this._drawPacman(ctx, ox, oy, s);
    }

    // Particles — batch all into one fill call per color group
    if (this._particles.length) {
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      this._particles.forEach(p => {
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.moveTo(ox + p.x * s + p.r * s, oy + p.y * s);
        ctx.arc(ox + p.x * s, oy + p.y * s, p.r * s, 0, Math.PI * 2);
      });
      ctx.fill();
      ctx.restore();
    }

    // Score popups
    this._scorePopups.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = '#FFD700';
      ctx.font = `bold ${11 * s}px 'Fredoka One', cursive`;
      ctx.textAlign = 'center';
      ctx.fillText(p.text, ox + p.x * s, oy + p.y * s);
      ctx.restore();
    });

    // HUD
    this._drawHUD(ctx, s);
  }

  _drawPacman(ctx, ox, oy, s) {
    const pm = this._pm;
    const sx = ox + pm.x * s;
    const sy = oy + pm.y * s;
    const r = (CELL / 2 - 1) * s;

    const mouthMax = this._dying ? Math.PI * (1 - this._deathT / 1.5) : 0.22 * Math.PI;
    const mouth = mouthMax * Math.abs(Math.sin(pm.mouthT * 8));

    const angleMap = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
    const rotation = angleMap[pm.dir];

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(rotation);

    const deathScale = this._dying ? Math.max(0, this._deathT / 1.5) : 1;
    ctx.scale(deathScale, deathScale);

    ctx.fillStyle = this._theme.pacman;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, mouth, Math.PI * 2 - mouth);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  _drawHUD(ctx, s) {
    const W = this._canvas.width;
    const hudY = this._offY - 25 * s;

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${13 * s}px 'Fredoka One', cursive`;
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE: ${this._score}`, this._offX, hudY);

    ctx.textAlign = 'center';
    ctx.fillText(`LEVEL ${this._level}`, this._offX + MAZE_W * s / 2, hudY);

    if (this._mode === 'timeattack') {
      const t = Math.ceil(this._timer);
      const m = Math.floor(t / 60), sec = t % 60;
      ctx.fillStyle = this._timer < 30 ? '#f55' : '#FFD700';
      ctx.textAlign = 'right';
      ctx.fillText(`${m}:${String(sec).padStart(2, '0')}`, this._offX + MAZE_W * s, hudY);
    } else {
      // Lives
      const lifeR = 6 * s;
      for (let i = 0; i < this._lives; i++) {
        const lx = this._offX + MAZE_W * s - (i + 1) * (lifeR * 2 + 3 * s);
        const ly = hudY - lifeR / 2;
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.arc(lx, ly, lifeR, 0.25 * Math.PI, 1.75 * Math.PI);
        ctx.closePath();
        ctx.fill();
      }
    }

    if (this._waiting && !this._dying) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, W, this._canvas.height);
      ctx.fillStyle = '#FFD700';
      ctx.font = `bold ${22 * s}px 'Fredoka One', cursive`;
      ctx.textAlign = 'center';
      ctx.fillText(this._waitT > 2 ? 'READY!' : 'GO!', this._offX + MAZE_W * s / 2, this._offY + MAZE_H * s / 2);
      ctx.restore();
    }
  }
}
