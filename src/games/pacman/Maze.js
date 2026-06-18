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

  // Returns true if the tile one step in `dir` from Pac-Man's tile is passable.
  canMove(px, py, dir) {
    const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
    const col = Math.floor(px / CELL);  // was Math.round(…-0.5) — wrong at tile boundaries
    const row = Math.floor(py / CELL);
    const nc = col + DX[dir];
    const nr = row + DY[dir];
    const t = this.get(nc, nr);
    if (t === TUNNEL) return true;
    return !this.isWall(nc, nr);
  }

  // Get tile coordinates from pixel position
  pixelToTile(px, py) {
    return { col: Math.floor(px / CELL), row: Math.floor(py / CELL) };
  }

  // Get pixel center of a tile
  tileCenter(col, row) {
    return { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 };
  }

  _buildWallCache(scale, theme) {
    const s = scale;
    const w = Math.ceil(COLS * CELL * s);
    const h = Math.ceil(ROWS * CELL * s);
    const oc = document.createElement('canvas');
    oc.width = w; oc.height = h;
    const c = oc.getContext('2d');

    c.fillStyle = theme.bg;
    c.fillRect(0, 0, w, h);

    c.fillStyle = theme.wallFill;
    for (let row = 0; row < ROWS; row++)
      for (let col = 0; col < COLS; col++)
        if (this._orig[row][col] === WALL)
          c.fillRect(col * CELL * s, row * CELL * s, CELL * s, CELL * s);

    c.strokeStyle = theme.wallGlow;
    c.lineWidth = Math.max(1, s * 1.5);
    c.shadowColor = theme.wallGlow;
    c.shadowBlur = s * 6;
    c.beginPath();
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (this._orig[row][col] !== WALL) continue;
        const wx = col * CELL * s, wy = row * CELL * s, ws = CELL * s;
        const nb = [
          [col, row-1, wx,    wy,    wx+ws, wy   ],
          [col, row+1, wx,    wy+ws, wx+ws, wy+ws],
          [col-1, row, wx,    wy,    wx,    wy+ws],
          [col+1, row, wx+ws, wy,    wx+ws, wy+ws],
        ];
        for (const [nc, nr, x1, y1, x2, y2] of nb) {
          const nc2 = ((nc % COLS) + COLS) % COLS;
          const nt = nr >= 0 && nr < ROWS ? this._orig[nr][nc2] : WALL;
          if (nt !== WALL) { c.moveTo(x1, y1); c.lineTo(x2, y2); }
        }
      }
    }
    c.stroke();

    c.shadowBlur = 0;
    for (let row = 0; row < ROWS; row++)
      for (let col = 0; col < COLS; col++)
        if (this._orig[row][col] === GHOST_DOOR) {
          c.fillStyle = theme.door || '#ff88ff';
          c.fillRect(col*CELL*s, row*CELL*s + CELL*s*0.4, CELL*s, CELL*s*0.2);
        }

    this._wallCache = oc;
    this._wallCacheScale = scale;
    this._wallCacheTheme = theme;
  }

  render(ctx, pulseT, offsetX = 0, offsetY = 0, scale = 1, theme) {
    const s = scale;
    const ox = offsetX, oy = offsetY;

    if (!this._wallCache || this._wallCacheScale !== scale || this._wallCacheTheme !== theme)
      this._buildWallCache(scale, theme);
    ctx.drawImage(this._wallCache, ox, oy);

    // Outer border matching wall glow
    ctx.save();
    ctx.strokeStyle = theme.wallGlow;
    ctx.lineWidth = Math.max(2, s * 2.5);
    ctx.shadowColor = theme.wallGlow;
    ctx.shadowBlur = s * 10;
    ctx.strokeRect(ox + 1, oy + 1, COLS * CELL * s - 2, ROWS * CELL * s - 2);
    ctx.restore();

    // Pellets
    ctx.fillStyle = theme.pellet;
    ctx.beginPath();
    for (let row = 0; row < ROWS; row++)
      for (let col = 0; col < COLS; col++)
        if (this._grid[row][col] === PELLET) {
          ctx.moveTo(ox+(col+0.5)*CELL*s+s*2.5, oy+(row+0.5)*CELL*s);
          ctx.arc(ox+(col+0.5)*CELL*s, oy+(row+0.5)*CELL*s, s*2.5, 0, Math.PI*2);
        }
    ctx.fill();

    // Power pellets
    const pulse = 0.85 + 0.15 * Math.sin(pulseT * 6);
    ctx.save();
    ctx.shadowColor = theme.powerGlow;
    ctx.shadowBlur = s * 10;
    ctx.fillStyle = theme.powerGlow;
    ctx.beginPath();
    for (let row = 0; row < ROWS; row++)
      for (let col = 0; col < COLS; col++)
        if (this._grid[row][col] === POWER) {
          const cx = ox+(col+0.5)*CELL*s, cy = oy+(row+0.5)*CELL*s;
          ctx.moveTo(cx+s*5*pulse, cy);
          ctx.arc(cx, cy, s*5*pulse, 0, Math.PI*2);
        }
    ctx.fill();
    ctx.restore();
  }
}
