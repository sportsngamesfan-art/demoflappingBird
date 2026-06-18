// Canvas 2D renderer for Flappy Bird — coordinates match host physics exactly
const CANVAS_W = 800;
const CANVAS_H = 600;
const PIPE_W   = 60;
const GROUND_H = 40;

// Clouds drift left, wrap around
const CLOUDS = [
  { x: 120, y: 80,  w: 90,  h: 38 },
  { x: 340, y: 55,  w: 110, h: 42 },
  { x: 560, y: 95,  w: 80,  h: 32 },
  { x: 700, y: 65,  w: 100, h: 36 },
];

export class FlappyGame {
  constructor(canvas, onFlap, players) {
    this._canvas  = canvas;
    this._ctx     = canvas.getContext('2d');
    this._onFlap  = onFlap;
    this._pipes   = [];
    this._players = { ...players };
    this._raf     = null;
    this._t       = 0;  // seconds, for animations

    this._scale  = 1;
    this._offX   = 0;
    this._offY   = 0;

    this._onKey    = e => { if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); onFlap(); } };
    this._onClick  = () => onFlap();
    this._onResize = () => this._resize();

    window.addEventListener('keydown', this._onKey);
    canvas.addEventListener('click',      this._onClick);
    canvas.addEventListener('touchstart', this._onClick, { passive: true });
    window.addEventListener('resize',     this._onResize);

    this._resize();
  }

  _resize() {
    const W = window.innerWidth, H = window.innerHeight;
    this._canvas.width  = W;
    this._canvas.height = H;
    this._scale = Math.min(W / CANVAS_W, H / CANVAS_H);
    this._offX  = (W - CANVAS_W * this._scale) / 2;
    this._offY  = (H - CANVAS_H * this._scale) / 2;
  }

  start() {
    let last = performance.now();
    const loop = ts => {
      const dt = Math.min((ts - last) / 1000, 0.05);
      last = ts;
      this._t += dt;
      this._render();
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  destroy() {
    if (this._raf) cancelAnimationFrame(this._raf);
    window.removeEventListener('keydown',  this._onKey);
    window.removeEventListener('resize',   this._onResize);
    this._canvas.removeEventListener('click',      this._onClick);
    this._canvas.removeEventListener('touchstart', this._onClick);
  }

  updateState(pipes, players) {
    this._pipes   = pipes;
    this._players = players;
  }

  onPlayerDied(id) {
    if (this._players[id]) this._players[id].alive = false;
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  _render() {
    const ctx = this._ctx;
    const W = this._canvas.width, H = this._canvas.height;

    // Fill entire canvas with sky gradient (covers letterbox areas outside game rect)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, '#5BA3D9');
    skyGrad.addColorStop(1, '#A8D8F0');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // Apply scale + centering transform
    ctx.save();
    ctx.setTransform(this._scale, 0, 0, this._scale, this._offX, this._offY);

    this._drawBackground(ctx);
    this._drawPipes(ctx);
    this._drawGround(ctx);
    this._drawBirds(ctx);

    ctx.restore();
  }

  _drawBackground(ctx) {
    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0,   '#5BA3D9');
    grad.addColorStop(1,   '#A8D8F0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Drifting clouds
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    const speed = 18; // px/s
    CLOUDS.forEach(c => {
      const x = ((c.x - this._t * speed) % (CANVAS_W + 150) + CANVAS_W + 150) % (CANVAS_W + 150) - 150;
      ctx.beginPath();
      ctx.ellipse(x,           c.y,       c.w * 0.55, c.h * 0.55, 0, 0, Math.PI * 2);
      ctx.ellipse(x + c.w * 0.3, c.y - 10, c.w * 0.38, c.h * 0.45, 0, 0, Math.PI * 2);
      ctx.ellipse(x + c.w * 0.6, c.y,       c.w * 0.42, c.h * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  _drawPipes(ctx) {
    this._pipes.forEach(pipe => {
      const x    = pipe.x;
      const topH = pipe.gapY;                          // top pipe height
      const botY = pipe.gapY + pipe.gap;               // bottom pipe top Y
      const botH = CANVAS_H - GROUND_H - botY;        // bottom pipe height

      // ── Top pipe ──────────────────────────────────────────
      // Body
      ctx.fillStyle = '#4CAF50';
      ctx.fillRect(x, 0, PIPE_W, topH - 14);
      // Cap (slightly wider, darker)
      ctx.fillStyle = '#388E3C';
      ctx.fillRect(x - 4, topH - 14, PIPE_W + 8, 14);
      // Shine
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(x + 4, 0, 8, topH - 14);

      // ── Bottom pipe ───────────────────────────────────────
      // Cap first (at top of bottom pipe)
      ctx.fillStyle = '#388E3C';
      ctx.fillRect(x - 4, botY, PIPE_W + 8, 14);
      // Body
      ctx.fillStyle = '#4CAF50';
      ctx.fillRect(x, botY + 14, PIPE_W, botH);
      // Shine
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(x + 4, botY + 14, 8, botH);
    });
  }

  _drawGround(ctx) {
    // Brown dirt
    ctx.fillStyle = '#8B5E3C';
    ctx.fillRect(0, CANVAS_H - GROUND_H, CANVAS_W, GROUND_H);
    // Green grass strip
    ctx.fillStyle = '#5DBB3F';
    ctx.fillRect(0, CANVAS_H - GROUND_H, CANVAS_W, 8);
  }

  _drawBirds(ctx) {
    Object.values(this._players).forEach(p => {
      const tilt = p.alive
        ? Math.max(-0.5, Math.min(0.8, (p.vy ?? 0) * 0.06))
        : Math.PI / 2;
      const alpha = p.alive ? 1 : 0.5;

      // Rotated badge (tilts with bird velocity)
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(tilt);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath();
      ctx.arc(0, 0, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Emoji drawn upright at bird position (no rotation — avoids browser emoji transform bugs)
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '26px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.emoji || '🐦', p.x, p.y);
      ctx.restore();

      // Player name label
      ctx.save();
      ctx.globalAlpha = p.alive ? 0.85 : 0.4;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, p.x, p.y - 22);
      ctx.restore();
    });
  }
}
