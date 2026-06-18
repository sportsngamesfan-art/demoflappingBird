import { CELL, COLS, ROWS, WALL, GHOST_DOOR, TUNNEL, GHOST_INT } from './Maze.js';

const DIR = { RIGHT: 0, DOWN: 1, LEFT: 2, UP: 3 };
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

const SCATTER_TARGETS = {
  blinky: { col: 25, row: 0 },
  pinky:  { col: 2,  row: 0 },
  inky:   { col: 27, row: 30 },
  clyde:  { col: 0,  row: 30 },
};

// Mode schedule (seconds): [scatter, chase, scatter, chase, scatter, chase, scatter, chase∞]
const MODE_SCHEDULE = [7, 20, 7, 20, 5, 20, 5, Infinity];

const HOUSE_EXIT = { col: 13, row: 11 }; // tile just above ghost door

function dist(ax, ay, bx, by) {
  return (ax - bx) ** 2 + (ay - by) ** 2; // squared distance — no sqrt needed for comparisons
}

export class Ghost {
  constructor(name, color, startTile, releaseDelay) {
    this.name = name;
    this.color = color;
    this.startTile = startTile;

    this.releaseDelay = releaseDelay; // pellets eaten before release
    this.mode = 'house';              // house | exiting | scatter | chase | frightened | eaten
    this._modeTimer = 0;
    this._modePhase = 0;             // index into MODE_SCHEDULE
    this._frightenTimer = 0;
    this._flashTimer = 0;
    this._exitPhase = 0;             // sub-phase for exiting animation

    this.dir = DIR.LEFT;
    this.speed = 1.5 * CELL;         // pixels per second, updated per mode

    this._reset();
  }

  _reset() {
    const tc = this.startTile;
    this.x = tc.col * CELL + CELL / 2;
    this.y = tc.row * CELL + CELL / 2;
    this.dir = DIR.LEFT;
    this.mode = 'house';
    this._modeTimer = 0;
    this._modePhase = 0;
    this._frightenTimer = 0;
    this._exitPhase = 0;
  }

  respawn() {
    this._reset();
    this.mode = 'eaten'; // travel back to house
  }

  frighten(duration) {
    if (this.mode === 'eaten' || this.mode === 'house' || this.mode === 'exiting') return;
    this.mode = 'frightened';
    this._frightenTimer = duration;
    this._flashTimer = 0;
    // Reverse direction
    this.dir = (this.dir + 2) % 4;
  }

  unfrighten() {
    if (this.mode !== 'frightened') return;
    this.mode = this._modePhase % 2 === 0 ? 'scatter' : 'chase';
  }

  _getChaseTarget(pacman, blinky) {
    const pc = Math.floor(pacman.x / CELL);
    const pr = Math.floor(pacman.y / CELL);

    switch (this.name) {
      case 'blinky':
        return { col: pc, row: pr };

      case 'pinky': {
        const tc = pc + DX[pacman.dir] * 4;
        const tr = pr + DY[pacman.dir] * 4;
        return { col: tc, row: tr };
      }

      case 'inky': {
        const pivot_c = pc + DX[pacman.dir] * 2;
        const pivot_r = pr + DY[pacman.dir] * 2;
        const bc = Math.floor(blinky.x / CELL);
        const br = Math.floor(blinky.y / CELL);
        return { col: 2 * pivot_c - bc, row: 2 * pivot_r - br };
      }

      case 'clyde': {
        const bc = Math.floor(blinky.x / CELL);
        const br = Math.floor(blinky.y / CELL);
        const d2 = dist(pc, pr, bc, br);
        if (d2 > 64) return { col: pc, row: pr };
        return SCATTER_TARGETS.clyde;
      }
    }
    return { col: pc, row: pr };
  }

  _getTarget(pacman, blinky) {
    if (this.mode === 'scatter') return SCATTER_TARGETS[this.name];
    if (this.mode === 'chase')   return this._getChaseTarget(pacman, blinky);
    if (this.mode === 'eaten')   return { col: 13, row: 13 }; // ghost house entrance
    return { col: 13, row: 11 }; // fallback
  }

  _chooseDirection(maze, target) {
    const col = Math.floor(this.x / CELL);
    const row = Math.floor(this.y / CELL);
    const reverse = (this.dir + 2) % 4;
    let bestDir = -1;
    let bestDist = Infinity;

    for (let d = 0; d < 4; d++) {
      if (d === reverse) continue; // no 180°
      const nc = col + DX[d];
      const nr = row + DY[d];
      const cellType = maze.get(nc, nr);
      if (cellType === WALL || cellType === GHOST_INT) continue;
      // Ghosts (except when eaten/exiting) cannot go back through ghost door from outside
      if (cellType === GHOST_DOOR && this.mode !== 'eaten' && this.mode !== 'exiting') continue;

      const d2 = dist(nc, nr, target.col, target.row);
      if (d2 < bestDist) { bestDist = d2; bestDir = d; }
    }

    return bestDir === -1 ? reverse : bestDir;
  }

  update(dt, maze, pacman, blinky, pelletsEaten, level) {
    this._frightenTimer -= dt;

    // Release from house
    if (this.mode === 'house' && pelletsEaten >= this.releaseDelay) {
      this.mode = 'exiting';
      this._exitPhase = 0;
    }

    const baseSpeed = CELL * (1.3 + level * 0.07);
    switch (this.mode) {
      case 'frightened': this.speed = baseSpeed * 0.5; break;
      case 'eaten':      this.speed = baseSpeed * 2.5; break;
      case 'house':      this.speed = baseSpeed * 0.4; break;
      case 'exiting':    this.speed = baseSpeed * 0.6; break;
      default:           this.speed = baseSpeed; break;
    }

    if (this.mode === 'house') {
      // Bounce up/down inside ghost house
      this.y += Math.sin(Date.now() * 0.004) * this.speed * dt * 0.3;
      return;
    }

    if (this.mode === 'exiting') {
      this._doExit(dt, maze);
      return;
    }

    // Mode timer (scatter/chase cycling, not during frightened/eaten)
    if (this.mode === 'scatter' || this.mode === 'chase') {
      this._modeTimer += dt;
      const limit = MODE_SCHEDULE[this._modePhase];
      if (this._modeTimer >= limit && limit !== Infinity) {
        this._modeTimer = 0;
        this._modePhase = Math.min(this._modePhase + 1, MODE_SCHEDULE.length - 1);
        this.mode = this._modePhase % 2 === 0 ? 'scatter' : 'chase';
        this.dir = (this.dir + 2) % 4; // reverse on mode switch
      }
    }

    if (this.mode === 'frightened') {
      if (this._frightenTimer <= 0) {
        this.unfrighten();
      }
    }

    this._moveAlongPath(dt, maze, pacman, blinky);

    // Tunnel wrap
    if (this.x < -CELL / 2) this.x = COLS * CELL + CELL / 2;
    if (this.x > COLS * CELL + CELL / 2) this.x = -CELL / 2;
  }

  _doExit(dt, maze) {
    // Move toward the exit tile above ghost door
    const tx = HOUSE_EXIT.col * CELL + CELL / 2;
    const ty = HOUSE_EXIT.row * CELL + CELL / 2;
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 2) {
      this.x = tx; this.y = ty;
      this.mode = this._modePhase % 2 === 0 ? 'scatter' : 'chase';
      this._modeTimer = 0;
    } else {
      const step = this.speed * dt;
      this.x += (dx / d) * step;
      this.y += (dy / d) * step;
    }
  }

  _moveAlongPath(dt, maze, pacman, blinky) {
    const col = Math.floor(this.x / CELL);
    const row = Math.floor(this.y / CELL);
    const cx = col * CELL + CELL / 2;
    const cy = row * CELL + CELL / 2;
    const step = this.speed * dt;

    // At tile center: choose next direction
    if (Math.abs(this.x - cx) < step + 0.5 && Math.abs(this.y - cy) < step + 0.5) {
      this.x = cx; this.y = cy;

      let newDir;
      if (this.mode === 'frightened') {
        // Random valid direction
        const valid = [];
        const rev = (this.dir + 2) % 4;
        for (let d = 0; d < 4; d++) {
          if (d === rev) continue;
          const nc = col + DX[d], nr = row + DY[d];
          const t = maze.get(nc, nr);
          if (t !== WALL && t !== GHOST_INT && t !== GHOST_DOOR) valid.push(d);
        }
        newDir = valid.length ? valid[Math.floor(Math.random() * valid.length)] : (this.dir + 2) % 4;
      } else {
        const target = this._getTarget(pacman, blinky);
        newDir = this._chooseDirection(maze, target);
      }

      this.dir = newDir;
    }

    // Move in current direction
    this.x += DX[this.dir] * step;
    this.y += DY[this.dir] * step;
  }

  isFlashing() {
    return this.mode === 'frightened' && this._frightenTimer < 2;
  }

  render(ctx, offsetX, offsetY, scale) {
    const sx = offsetX + this.x * scale;
    const sy = offsetY + this.y * scale;
    const r = (CELL / 2 - 1) * scale;

    if (this.mode === 'eaten') {
      this._drawEyes(ctx, sx, sy, scale, '#fff', 0);
      return;
    }

    const flash = this.isFlashing();
    const frightened = this.mode === 'frightened';
    const bodyColor = frightened
      ? (flash && Math.floor(Date.now() / 300) % 2 === 0 ? '#fff' : '#0033cc')
      : this.color;

    // Neon glow
    ctx.save();
    ctx.shadowBlur = 12 * scale;
    ctx.shadowColor = frightened ? '#0055ff' : this.color;

    // Ghost body (rounded top, wavy bottom)
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(sx, sy - r * 0.2, r, Math.PI, 0, false); // top semicircle
    ctx.lineTo(sx + r, sy + r * 0.8);

    // Wavy bottom (3 arcs)
    const waveW = (r * 2) / 3;
    for (let i = 2; i >= 0; i--) {
      const wx = sx - r + i * waveW + waveW / 2;
      ctx.arc(wx, sy + r * 0.8, waveW / 2, 0, Math.PI, i % 2 === 0);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Eyes
    if (!frightened) {
      this._drawEyes(ctx, sx, sy - r * 0.1, scale, '#fff', 1);
    } else {
      // Frightened face
      const fc = flash && Math.floor(Date.now() / 300) % 2 === 0 ? '#f00' : '#fff';
      ctx.fillStyle = fc;
      ctx.beginPath();
      ctx.arc(sx - r * 0.3, sy - r * 0.15, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx + r * 0.3, sy - r * 0.15, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
      // Wavy mouth
      ctx.strokeStyle = fc;
      ctx.lineWidth = scale;
      ctx.beginPath();
      ctx.moveTo(sx - r * 0.5, sy + r * 0.3);
      for (let i = 0; i <= 4; i++) {
        const mx = sx - r * 0.5 + i * r * 0.25;
        const my = sy + r * 0.3 + (i % 2 === 0 ? r * 0.15 : -r * 0.1);
        ctx.lineTo(mx, my);
      }
      ctx.stroke();
    }
  }

  _drawEyes(ctx, sx, sy, scale, white, pupilMode) {
    const r = (CELL / 2 - 1) * scale;
    const eyeR = r * 0.28;
    const ex1 = sx - r * 0.32, ex2 = sx + r * 0.32, ey = sy;

    // White of eyes
    ctx.fillStyle = white;
    ctx.beginPath(); ctx.arc(ex1, ey, eyeR, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex2, ey, eyeR, 0, Math.PI * 2); ctx.fill();

    if (pupilMode) {
      // Colored pupil pointing in travel direction
      const pdx = DX[this.dir] * eyeR * 0.4;
      const pdy = DY[this.dir] * eyeR * 0.4;
      ctx.fillStyle = '#00f';
      ctx.beginPath(); ctx.arc(ex1 + pdx, ey + pdy, eyeR * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ex2 + pdx, ey + pdy, eyeR * 0.5, 0, Math.PI * 2); ctx.fill();
    }
  }
}
