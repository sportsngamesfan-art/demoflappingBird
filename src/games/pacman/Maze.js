export const CELL = 16;
export const COLS = 28;
export const ROWS = 31;

// Cell types
export const WALL         = 0;
export const PATH         = 1;
export const PELLET       = 2;
export const POWER        = 3;
export const GHOST_DOOR   = 4;
export const TUNNEL       = 5;
export const GHOST_INT    = 6;

// Classic Pac-Man maze — 28×31 grid, row-major
// This is a faithful encoding of the original arcade maze
// Key layout: ghost house at rows 13-15 cols 10-17, tunnels at row 14 cols 0&27
// Power pellets at (1,3), (26,3), (1,23), (26,23)
const CLASSIC_RAW = [
// col: 0  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 0
  [0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0], // 1
  [0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 2, 0, 0, 2, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0], // 2
  [0, 3, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 2, 0, 0, 2, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 3, 0], // 3 power pellets
  [0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 2, 0, 0, 2, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0], // 4
  [0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0], // 5
  [0, 2, 0, 0, 0, 0, 2, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 2, 0, 0, 0, 0, 2, 0], // 6
  [0, 2, 0, 0, 0, 0, 2, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 2, 0, 0, 0, 0, 2, 0], // 7
  [0, 2, 2, 2, 2, 2, 2, 0, 0, 2, 2, 2, 2, 0, 0, 2, 2, 2, 2, 0, 0, 2, 2, 2, 2, 2, 2, 0], // 8
  [0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0], // 9
  [0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0], // 10
  [0, 0, 0, 0, 0, 0, 2, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 2, 0, 0, 0, 0, 0, 0], // 11
  [0, 0, 0, 0, 0, 0, 2, 0, 0, 1, 0, 0, 0, 4, 4, 0, 0, 0, 1, 0, 0, 2, 0, 0, 0, 0, 0, 0], // 12 ghost door at 13,14
  [1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 0, 6, 6, 6, 6, 6, 6, 0, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1], // 13
  [5, 1, 1, 1, 1, 1, 2, 1, 1, 1, 0, 6, 6, 6, 6, 6, 6, 0, 1, 1, 1, 2, 1, 1, 1, 1, 1, 5], // 14 tunnels at 0,27
  [1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 0, 6, 6, 6, 6, 6, 6, 0, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1], // 15
  [0, 0, 0, 0, 0, 0, 2, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 2, 0, 0, 0, 0, 0, 0], // 16
  [0, 0, 0, 0, 0, 0, 2, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 2, 0, 0, 0, 0, 0, 0], // 17
  [0, 0, 0, 0, 0, 0, 2, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 2, 0, 0, 0, 0, 0, 0], // 18
  [1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1], // 19
  [0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0], // 20
  [0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 2, 0, 0, 2, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0], // 21
  [0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 2, 0, 0, 2, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0], // 22
  [0, 3, 2, 2, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 2, 2, 3, 0], // 23 power pellets
  [0, 0, 0, 2, 0, 0, 2, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 2, 0, 0, 2, 0, 0, 0], // 24
  [0, 0, 0, 2, 0, 0, 2, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 2, 0, 0, 2, 0, 0, 0], // 25
  [0, 2, 2, 2, 2, 2, 2, 0, 0, 2, 2, 2, 2, 0, 0, 2, 2, 2, 2, 0, 0, 2, 2, 2, 2, 2, 2, 0], // 26
  [0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0], // 27
  [0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0], // 28
  [0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0], // 29
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 30
];

// Maze B — alternate layout with different corridor structure
// Same ghost house position, different upper/lower corridor patterns
const MAZE_B_RAW = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,2,2,2,2,2,2,2,2,2,2,2,2,0,0,2,2,2,2,2,2,2,2,2,2,2,2,0],
  [0,2,0,0,2,0,0,0,2,0,0,0,2,0,0,2,0,0,0,2,0,0,0,2,0,0,2,0],
  [0,3,0,0,2,0,0,0,2,0,0,0,2,0,0,2,0,0,0,2,0,0,0,2,0,0,3,0],
  [0,2,0,0,2,0,0,0,2,0,0,0,2,0,0,2,0,0,0,2,0,0,0,2,0,0,2,0],
  [0,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,0],
  [0,2,0,0,2,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,2,0,0,2,0],
  [0,2,0,0,2,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,2,0,0,2,0],
  [0,2,2,2,2,0,0,2,2,2,2,2,2,0,0,2,2,2,2,2,2,0,0,2,2,2,2,0],
  [0,0,0,0,2,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,2,0,0,0,0],
  [0,0,0,0,2,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,2,0,0,0,0],
  [0,0,0,0,2,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,2,0,0,0,0],
  [0,0,0,0,2,0,0,1,0,0,0,0,4,4,4,4,0,0,1,0,0,0,0,2,0,0,0,0],
  [1,1,1,1,2,1,1,1,0,6,6,6,6,6,6,6,6,6,1,1,1,1,1,2,1,1,1,1],
  [5,1,1,1,2,1,1,1,0,6,6,6,6,6,6,6,6,6,1,1,1,1,1,2,1,1,1,5],
  [1,1,1,1,2,1,1,1,0,6,6,6,6,6,6,6,6,6,1,1,1,1,1,2,1,1,1,1],
  [0,0,0,0,2,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,2,0,0,0,0],
  [0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0],
  [0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0],
  [1,1,1,1,2,1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1,2,1,1,1,1],
  [0,2,2,2,2,2,2,2,2,2,2,2,2,0,0,2,2,2,2,2,2,2,2,2,2,2,2,0],
  [0,2,0,0,2,0,0,0,2,0,0,0,2,0,0,2,0,0,0,2,0,0,0,2,0,0,2,0],
  [0,2,0,0,2,0,0,0,2,0,0,0,2,0,0,2,0,0,0,2,0,0,0,2,0,0,2,0],
  [0,3,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,3,0],
  [0,0,0,2,0,0,2,0,0,2,0,0,0,0,0,0,0,0,2,0,0,2,0,0,2,0,0,0],
  [0,0,0,2,0,0,2,0,0,2,0,0,0,0,0,0,0,0,2,0,0,2,0,0,2,0,0,0],
  [0,2,2,2,0,0,2,2,2,2,2,2,2,0,0,2,2,2,2,2,2,2,0,0,2,2,2,0],
  [0,2,0,0,0,0,0,0,0,0,0,0,2,0,0,2,0,0,0,0,0,0,0,0,0,0,2,0],
  [0,2,0,0,0,0,0,0,0,0,0,0,2,0,0,2,0,0,0,0,0,0,0,0,0,0,2,0],
  [0,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

// Maze C — third variant, more open corridors
const MAZE_C_RAW = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,2,2,2,2,2,2,2,2,2,2,2,2,0,0,2,2,2,2,2,2,2,2,2,2,2,2,0],
  [0,2,0,0,0,0,2,0,0,0,2,0,2,0,0,2,0,2,0,0,0,2,0,0,0,0,2,0],
  [0,3,0,0,0,0,2,0,0,0,2,0,2,0,0,2,0,2,0,0,0,2,0,0,0,0,3,0],
  [0,2,0,0,0,0,2,0,0,0,2,0,2,0,0,2,0,2,0,0,0,2,0,0,0,0,2,0],
  [0,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,0],
  [0,2,0,0,2,0,0,0,0,0,2,0,0,0,0,0,0,2,0,0,0,0,0,0,2,0,2,0],
  [0,2,0,0,2,0,0,0,0,0,2,0,0,0,0,0,0,2,0,0,0,0,0,0,2,0,2,0],
  [0,2,2,2,2,2,2,0,0,2,2,2,2,0,0,2,2,2,2,0,0,2,2,2,2,2,2,0],
  [0,0,0,0,2,0,0,0,0,2,0,0,1,0,0,1,0,0,2,0,0,0,0,0,2,0,0,0],
  [0,0,0,0,2,0,0,0,0,2,0,0,1,0,0,1,0,0,2,0,0,0,0,0,2,0,0,0],
  [0,0,0,0,2,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,2,0,0,0],
  [0,0,0,0,2,0,0,1,0,0,0,0,4,4,4,4,0,0,0,0,1,0,0,0,2,0,0,0],
  [1,1,1,1,2,1,1,1,0,6,6,6,6,6,6,6,6,6,6,0,1,1,1,1,2,1,1,1],
  [5,1,1,1,2,1,1,1,0,6,6,6,6,6,6,6,6,6,6,0,1,1,1,1,2,1,1,5],
  [1,1,1,1,2,1,1,1,0,6,6,6,6,6,6,6,6,6,6,0,1,1,1,1,2,1,1,1],
  [0,0,0,0,2,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,2,0,0,0],
  [0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0],
  [0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0],
  [1,1,1,1,2,1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1,1,2,1,1,1],
  [0,2,2,2,2,2,2,2,2,2,2,2,2,0,0,2,2,2,2,2,2,2,2,2,2,2,2,0],
  [0,2,0,0,0,0,2,0,0,0,2,0,2,0,0,2,0,2,0,0,0,2,0,0,0,0,2,0],
  [0,2,0,0,0,0,2,0,0,0,2,0,2,0,0,2,0,2,0,0,0,2,0,0,0,0,2,0],
  [0,3,2,2,0,0,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,0,0,2,2,3,0],
  [0,0,0,2,0,0,2,0,0,2,0,0,0,0,0,0,0,0,2,0,0,2,0,0,2,0,0,0],
  [0,0,0,2,0,0,2,0,0,2,0,0,0,0,0,0,0,0,2,0,0,2,0,0,2,0,0,0],
  [0,2,2,2,2,2,2,0,0,2,2,2,2,0,0,2,2,2,2,0,0,2,2,2,2,2,2,0],
  [0,2,0,0,0,0,0,0,0,0,0,0,2,0,0,2,0,0,0,0,0,0,0,0,0,0,2,0],
  [0,2,0,0,0,0,0,0,0,0,0,0,2,0,0,2,0,0,0,0,0,0,0,0,0,0,2,0],
  [0,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

export const MAZES = [CLASSIC_RAW, MAZE_B_RAW, MAZE_C_RAW];

export class Maze {
  constructor(rawData) {
    this._orig = rawData;
    this._grid = rawData.map(row => [...row]);
    this._totalPellets = this._countPellets();
    this._eaten = 0;
  }

  reset() {
    this._grid = this._orig.map(row => [...row]);
    this._eaten = 0;
  }

  _countPellets() {
    let n = 0;
    for (const row of this._orig) for (const c of row) if (c === PELLET || c === POWER) n++;
    return n;
  }

  get(col, row) {
    if (row < 0 || row >= ROWS) return WALL;
    const c = ((col % COLS) + COLS) % COLS;
    return this._grid[row][c];
  }

  isWall(col, row) {
    const t = this.get(col, row);
    return t === WALL || t === GHOST_INT;
  }

  eat(col, row) {
    const c = ((col % COLS) + COLS) % COLS;
    if (row < 0 || row >= ROWS) return 0;
    const t = this._grid[row][c];
    if (t === PELLET || t === POWER) {
      const was = t;
      this._grid[row][c] = PATH;
      this._eaten++;
      return was;
    }
    return 0;
  }

  get remaining() { return this._totalPellets - this._eaten; }
  get total()     { return this._totalPellets; }

  // Check if Pac-Man at pixel position can move in a direction
  // px,py = center of pac-man in pixels (0,0 = top-left of maze)
  canMove(px, py, dir, r = 6) {
    const offsets = [[1,0],[0,1],[-1,0],[0,-1]]; // right down left up  (matches DIR enum)
    const [dx, dy] = offsets[dir];
    const nx = px + dx * (r + 1);
    const ny = py + dy * (r + 1);
    const col = Math.floor(nx / CELL);
    const row = Math.floor(ny / CELL);
    // Tunnel cells are always passable
    if (this.get(col, row) === TUNNEL) return true;
    return !this.isWall(col, row);
  }

  // Get tile coordinates from pixel position
  pixelToTile(px, py) {
    return { col: Math.floor(px / CELL), row: Math.floor(py / CELL) };
  }

  // Get pixel center of a tile
  tileCenter(col, row) {
    return { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 };
  }

  render(ctx, pulseT, offsetX = 0, offsetY = 0, scale = 1) {
    const s = scale;
    const ox = offsetX, oy = offsetY;

    // Black background for maze area
    ctx.fillStyle = '#000';
    ctx.fillRect(ox, oy, COLS * CELL * s, ROWS * CELL * s);

    // Draw walls with neon blue glow
    ctx.save();
    ctx.strokeStyle = '#00aaff';
    ctx.lineWidth = s * 2;
    ctx.shadowColor = '#00aaff';
    ctx.shadowBlur = s * 8;

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const t = this._grid[row][col];
        if (t === WALL) {
          const wx = ox + col * CELL * s;
          const wy = oy + row * CELL * s;
          const ws = CELL * s;

          // Fill wall with dark navy
          ctx.fillStyle = '#001a4d';
          ctx.fillRect(wx, wy, ws, ws);

          // Draw borders toward non-wall cells (create neon outline effect)
          const neighbors = [
            [col,   row-1, 0,0,ws,0],     // top border
            [col,   row+1, 0,ws,ws,ws],   // bottom border
            [col-1, row,   0,0,0,ws],     // left border
            [col+1, row,   ws,0,ws,ws],   // right border
          ];
          for (const [nc, nr, x1, y1, x2, y2] of neighbors) {
            const nc2 = ((nc % COLS) + COLS) % COLS;
            const nt = nr >= 0 && nr < ROWS ? this._grid[nr][nc2] : WALL;
            if (nt !== WALL) {
              ctx.beginPath();
              ctx.moveTo(wx + x1, wy + y1);
              ctx.lineTo(wx + x2, wy + y2);
              ctx.stroke();
            }
          }
        }
      }
    }
    ctx.restore();

    // Ghost house door (magenta bar)
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (this._grid[row][col] === GHOST_DOOR) {
          const dx = ox + col * CELL * s;
          const dy = oy + row * CELL * s + CELL * s * 0.4;
          ctx.fillStyle = '#ff88ff';
          ctx.fillRect(dx, dy, CELL * s, CELL * s * 0.2);
        }
      }
    }

    // Pellets
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = s * 3;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (this._grid[row][col] === PELLET) {
          const cx = ox + (col + 0.5) * CELL * s;
          const cy = oy + (row + 0.5) * CELL * s;
          ctx.beginPath();
          ctx.arc(cx, cy, s * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();

    // Power pellets (pulsing)
    const pulse = 0.85 + 0.15 * Math.sin(pulseT * 6);
    ctx.save();
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = s * 14 * pulse;
    ctx.fillStyle = '#FFD700';
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (this._grid[row][col] === POWER) {
          const cx = ox + (col + 0.5) * CELL * s;
          const cy = oy + (row + 0.5) * CELL * s;
          ctx.beginPath();
          ctx.arc(cx, cy, s * 5 * pulse, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }
}
