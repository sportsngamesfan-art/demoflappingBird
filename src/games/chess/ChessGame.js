// Chess engine + canvas renderer
// Two-player local (hot-seat) chess

const FILES = 'abcdefgh';

// Piece encoding: uppercase = white, lowercase = black
// K/k=king, Q/q=queen, R/r=rook, B/b=bishop, N/n=knight, P/p=pawn

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const PIECE_UNICODE = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

function pieceColor(p) { return p === p.toUpperCase() ? 'w' : 'b'; }
function isWhite(p) { return p && p === p.toUpperCase(); }
function isBlack(p) { return p && p !== p.toUpperCase(); }
function opponent(color) { return color === 'w' ? 'b' : 'w'; }

function parseFen(fen) {
  const [ranks, turn, castling, ep] = fen.split(' ');
  const board = [];
  for (const rank of ranks.split('/')) {
    const row = [];
    for (const c of rank) {
      if (/\d/.test(c)) { for (let i = 0; i < +c; i++) row.push(null); }
      else row.push(c);
    }
    board.push(row);
  }
  return {
    board,               // [row0..row7][col0..col7], row0 = rank 8
    turn,
    castling,
    ep: ep === '-' ? null : ep,
  };
}

function cloneState(s) {
  return {
    board: s.board.map(r => [...r]),
    turn: s.turn,
    castling: s.castling,
    ep: s.ep,
  };
}

function rc(algebraic) {
  const col = FILES.indexOf(algebraic[0]);
  const row = 8 - parseInt(algebraic[1]);
  return [row, col];
}

function toAlg(row, col) { return FILES[col] + (8 - row); }

// Generate pseudo-legal moves for a piece at [r,c]
function pseudoMoves(state, r, c) {
  const { board, castling, ep } = state;
  const piece = board[r][c];
  if (!piece) return [];
  const color = pieceColor(piece);
  const type = piece.toUpperCase();
  const moves = [];

  const add = (tr, tc) => {
    if (tr < 0 || tr > 7 || tc < 0 || tc > 7) return false;
    const target = board[tr][tc];
    if (target && pieceColor(target) === color) return false;
    moves.push([tr, tc]);
    return !target; // can continue sliding if empty
  };

  const slide = (drs, dcs) => {
    for (let i = 0; i < drs.length; i++) {
      let tr = r + drs[i], tc = c + dcs[i];
      while (tr >= 0 && tr <= 7 && tc >= 0 && tc <= 7) {
        const target = board[tr][tc];
        if (target) {
          if (pieceColor(target) !== color) moves.push([tr, tc]);
          break;
        }
        moves.push([tr, tc]);
        tr += drs[i]; tc += dcs[i];
      }
    }
  };

  if (type === 'P') {
    const dir = color === 'w' ? -1 : 1;
    const startRow = color === 'w' ? 6 : 1;
    // Forward
    if (!board[r + dir]?.[c]) {
      moves.push([r + dir, c]);
      if (r === startRow && !board[r + 2 * dir]?.[c]) moves.push([r + 2 * dir, c]);
    }
    // Captures
    for (const dc of [-1, 1]) {
      const tc = c + dc, tr = r + dir;
      if (tc < 0 || tc > 7) continue;
      if (board[tr][tc] && pieceColor(board[tr][tc]) !== color) moves.push([tr, tc]);
      // En passant
      if (ep) {
        const [epr, epc] = rc(ep);
        if (tr === epr && tc === epc) moves.push([tr, tc]);
      }
    }
  } else if (type === 'N') {
    for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]])
      add(r + dr, c + dc);
  } else if (type === 'B') {
    slide([-1,-1,1,1], [-1,1,-1,1]);
  } else if (type === 'R') {
    slide([-1,1,0,0], [0,0,-1,1]);
  } else if (type === 'Q') {
    slide([-1,-1,1,1,-1,1,0,0], [-1,1,-1,1,0,0,-1,1]);
  } else if (type === 'K') {
    for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]])
      add(r + dr, c + dc);
    // Castling
    const row = color === 'w' ? 7 : 0;
    if (r === row) {
      if (color === 'w' && castling.includes('K') &&
          !board[row][5] && !board[row][6]) moves.push([row, 6]);
      if (color === 'w' && castling.includes('Q') &&
          !board[row][1] && !board[row][2] && !board[row][3]) moves.push([row, 2]);
      if (color === 'b' && castling.includes('k') &&
          !board[row][5] && !board[row][6]) moves.push([row, 6]);
      if (color === 'b' && castling.includes('q') &&
          !board[row][1] && !board[row][2] && !board[row][3]) moves.push([row, 2]);
    }
  }
  return moves;
}

function isSquareAttacked(state, row, col, byColor) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || pieceColor(p) !== byColor) continue;
      const ms = pseudoMoves(state, r, c);
      if (ms.some(([mr, mc]) => mr === row && mc === col)) return true;
    }
  }
  return false;
}

function findKing(board, color) {
  const king = color === 'w' ? 'K' : 'k';
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c] === king) return [r, c];
  return null;
}

function isInCheck(state, color) {
  const kpos = findKing(state.board, color);
  if (!kpos) return false;
  return isSquareAttacked(state, kpos[0], kpos[1], opponent(color));
}

function applyMove(state, from, to, promo = null) {
  const s = cloneState(state);
  const [fr, fc] = from, [tr, tc] = to;
  const piece = s.board[fr][fc];
  const color = pieceColor(piece);
  const type = piece.toUpperCase();

  // En passant capture
  if (type === 'P' && s.ep) {
    const [epr, epc] = rc(s.ep);
    if (tr === epr && tc === epc) {
      const capRow = color === 'w' ? tr + 1 : tr - 1;
      s.board[capRow][tc] = null;
    }
  }

  // Set new ep
  s.ep = null;
  if (type === 'P' && Math.abs(tr - fr) === 2) {
    s.ep = toAlg((fr + tr) / 2, fc);
  }

  // Castling rook move
  if (type === 'K') {
    const backRow = color === 'w' ? 7 : 0;
    if (fc === 4 && tc === 6) { s.board[backRow][5] = s.board[backRow][7]; s.board[backRow][7] = null; }
    if (fc === 4 && tc === 2) { s.board[backRow][3] = s.board[backRow][0]; s.board[backRow][0] = null; }
    // Strip castling rights
    s.castling = s.castling.replace(color === 'w' ? /[KQ]/g : /[kq]/g, '');
    if (!s.castling) s.castling = '-';
  }
  if (type === 'R') {
    if (fr === 7 && fc === 7) s.castling = s.castling.replace('K', '');
    if (fr === 7 && fc === 0) s.castling = s.castling.replace('Q', '');
    if (fr === 0 && fc === 7) s.castling = s.castling.replace('k', '');
    if (fr === 0 && fc === 0) s.castling = s.castling.replace('q', '');
    if (!s.castling) s.castling = '-';
  }

  s.board[tr][tc] = promo ? (color === 'w' ? promo.toUpperCase() : promo.toLowerCase()) : piece;
  s.board[fr][fc] = null;

  // Pawn promotion (auto-queen if not specified)
  if (type === 'P' && (tr === 0 || tr === 7)) {
    s.board[tr][tc] = color === 'w' ? 'Q' : 'q';
  }

  s.turn = opponent(color);
  return s;
}

function legalMoves(state, r, c) {
  const piece = state.board[r][c];
  if (!piece) return [];
  const color = pieceColor(piece);
  const pseudo = pseudoMoves(state, r, c);
  const legal = [];
  for (const [tr, tc] of pseudo) {
    // Castling: check that king doesn't pass through check
    if (piece.toUpperCase() === 'K' && Math.abs(tc - c) === 2) {
      const step = tc > c ? 1 : -1;
      let ok = true;
      for (let col = c; col !== tc + step; col += step) {
        const ns = cloneState(state);
        ns.board[r][col] = ns.board[r][c];
        ns.board[r][c] = null;
        if (isSquareAttacked(ns, r, col, opponent(color))) { ok = false; break; }
      }
      if (!ok) continue;
    }
    const next = applyMove(state, [r, c], [tr, tc]);
    if (!isInCheck(next, color)) legal.push([tr, tc]);
  }
  return legal;
}

function hasAnyLegalMove(state) {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (p && pieceColor(p) === state.turn && legalMoves(state, r, c).length > 0) return true;
    }
  return false;
}

export class ChessGame {
  constructor(canvas, { player1, player2 }, onEnd) {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._players = { w: player1, b: player2 };
    this._onEnd = onEnd;
    this._state = parseFen(INITIAL_FEN);
    this._selected = null; // [r, c]
    this._legalDest = [];
    this._moveCount = 0;
    this._ended = false;
    this._statusMsg = '';

    this._onClick = this._handleClick.bind(this);
  }

  start() {
    this._resize();
    this._canvas.addEventListener('pointerdown', this._onClick);
    this._statusMsg = `${this._players.w}'s turn (White)`;
    this._render();
  }

  destroy() {
    this._ended = true;
    this._canvas.removeEventListener('pointerdown', this._onClick);
  }

  pause() { this._paused = true; }
  resume() { this._paused = false; this._render(); }

  _resize() {
    const size = Math.min(this._canvas.parentElement?.clientWidth || 480, 480);
    this._canvas.width = size;
    this._canvas.height = size;
    this._cell = size / 8;
  }

  _handleClick(e) {
    if (this._ended || this._paused) return;
    const rect = this._canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const col = Math.floor(x / this._cell);
    const row = Math.floor(y / this._cell);

    if (this._selected) {
      const [sr, sc] = this._selected;
      const isLegal = this._legalDest.some(([r, c]) => r === row && c === col);
      if (isLegal) {
        this._state = applyMove(this._state, [sr, sc], [row, col]);
        this._moveCount++;
        this._selected = null;
        this._legalDest = [];
        this._checkGameEnd();
        this._render();
        return;
      }
    }

    // Select a piece of the current player
    const piece = this._state.board[row]?.[col];
    if (piece && pieceColor(piece) === this._state.turn) {
      this._selected = [row, col];
      this._legalDest = legalMoves(this._state, row, col);
    } else {
      this._selected = null;
      this._legalDest = [];
    }
    this._render();
  }

  _checkGameEnd() {
    const { turn } = this._state;
    const inCheck = isInCheck(this._state, turn);
    const anyMove = hasAnyLegalMove(this._state);

    if (!anyMove) {
      this._ended = true;
      this._canvas.removeEventListener('click', this._onClick);
      if (inCheck) {
        const winner = opponent(turn);
        const winnerName = this._players[winner];
        this._statusMsg = `Checkmate! ${winnerName} wins!`;
        this._render();
        setTimeout(() => this._onEnd({ winner, reason: 'checkmate', moves: this._moveCount }), 1200);
      } else {
        this._statusMsg = 'Stalemate — Draw!';
        this._render();
        setTimeout(() => this._onEnd({ winner: 'draw', reason: 'stalemate', moves: this._moveCount }), 1200);
      }
      return;
    }

    if (inCheck) {
      this._statusMsg = `Check! ${this._players[turn]}'s turn`;
    } else {
      const colorName = turn === 'w' ? 'White' : 'Black';
      this._statusMsg = `${this._players[turn]}'s turn (${colorName})`;
    }
  }

  _render() {
    const ctx = this._ctx;
    const cell = this._cell;
    const W = this._canvas.width;

    // Board squares
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const light = (r + c) % 2 === 0;
        ctx.fillStyle = light ? '#f0d9b5' : '#b58863';
        ctx.fillRect(c * cell, r * cell, cell, cell);

        // Highlight selected
        if (this._selected && this._selected[0] === r && this._selected[1] === c) {
          ctx.fillStyle = 'rgba(20,85,30,0.5)';
          ctx.fillRect(c * cell, r * cell, cell, cell);
        }

        // Highlight legal destinations
        if (this._legalDest.some(([lr, lc]) => lr === r && lc === c)) {
          const target = this._state.board[r][c];
          if (target) {
            ctx.strokeStyle = 'rgba(20,85,30,0.8)';
            ctx.lineWidth = 3;
            ctx.strokeRect(c * cell + 1.5, r * cell + 1.5, cell - 3, cell - 3);
          } else {
            ctx.fillStyle = 'rgba(20,85,30,0.3)';
            ctx.beginPath();
            ctx.arc(c * cell + cell / 2, r * cell + cell / 2, cell * 0.15, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // Pieces
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${cell * 0.72}px serif`;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this._state.board[r][c];
        if (!piece) continue;
        const sym = PIECE_UNICODE[piece];
        // Shadow for depth
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillText(sym, c * cell + cell / 2 + 1.5, r * cell + cell / 2 + 2);
        ctx.fillStyle = isWhite(piece) ? '#fff' : '#1a1a1a';
        ctx.fillText(sym, c * cell + cell / 2, r * cell + cell / 2);
      }
    }

    // Status bar at bottom (drawn outside board via canvas overlay — use CSS label instead)
    // We'll update a DOM element; store the message for the caller to read
    const statusEl = document.getElementById('chess-status');
    if (statusEl) statusEl.textContent = this._statusMsg;
  }
}
