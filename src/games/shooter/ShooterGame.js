const GAME_W = 800, GAME_H = 380, GROUND_Y = 310;

export class ShooterGame {
  constructor(canvas, onInput, myId) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onInput = onInput;
    this.myId = myId;
    this.state = null;
    this.raf = null;
    this.scale = 1; this.offX = 0; this.offY = 0;
    this.input = { left: false, right: false, jump: false, shoot: false };
    this._keydown = this._onKey.bind(this, true);
    this._keyup = this._onKey.bind(this, false);
    window.addEventListener('keydown', this._keydown);
    window.addEventListener('keyup', this._keyup);
    this._resize = this._onResize.bind(this);
    window.addEventListener('resize', this._resize);
    this._onResize();
    this._bindTouch();
  }

  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.scale = Math.min(w / GAME_W, h / GAME_H);
    this.offX = (w - GAME_W * this.scale) / 2;
    this.offY = (h - GAME_H * this.scale) / 2;
    this.canvas.width = w;
    this.canvas.height = h;
  }

  _onKey(down, e) {
    const prev = { ...this.input };
    if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') this.input.left  = down;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.input.right = down;
    if ((e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') && down) {
      e.preventDefault();
      this.input.jump = true;
    }
    if (!down && (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ')) {
      this.input.jump = false;
    }
    if (e.key === 'z' || e.key === 'Z' || e.key === 'Control') this.input.shoot = down;
    if (JSON.stringify(prev) !== JSON.stringify(this.input)) this.onInput({ ...this.input });
  }

  _bindTouch() {
    const btns = document.querySelectorAll('.sh-touch-btn');
    btns.forEach(btn => {
      const action = btn.dataset.action;
      const set = (v) => {
        const prev = { ...this.input };
        this.input[action] = v;
        if (JSON.stringify(prev) !== JSON.stringify(this.input)) this.onInput({ ...this.input });
      };
      btn.addEventListener('touchstart', e => { e.preventDefault(); set(true); }, { passive: false });
      btn.addEventListener('touchend',   e => { e.preventDefault(); set(false); }, { passive: false });
      btn.addEventListener('mousedown', () => set(true));
      btn.addEventListener('mouseup',   () => set(false));
    });
  }

  start() {
    const loop = () => { this._render(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }

  updateState(state) { this.state = state; }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this._keydown);
    window.removeEventListener('keyup', this._keyup);
    window.removeEventListener('resize', this._resize);
  }

  _gx(x) { return this.offX + x * this.scale; }
  _gy(y) { return this.offY + y * this.scale; }
  _gs(v) { return v * this.scale; }

  _render() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!this.state) {
      ctx.fillStyle = '#0f0c29';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const { cameraX = 0 } = this.state;

    // Sky gradient
    const sky = ctx.createLinearGradient(0, this._gy(0), 0, this._gy(GAME_H));
    sky.addColorStop(0, '#0f0c29');
    sky.addColorStop(1, '#302b63');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Stars (deterministic)
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    const starSeed = 42;
    for (let i = 0; i < 60; i++) {
      const sx = ((starSeed * (i * 7919 + 1)) % GAME_W);
      const sy = ((starSeed * (i * 6271 + 3)) % (GAME_H * 0.6));
      const px = ((sx - cameraX * 0.05) % GAME_W + GAME_W) % GAME_W;
      ctx.beginPath();
      ctx.arc(this._gx(px), this._gy(sy), this._gs(1), 0, Math.PI * 2);
      ctx.fill();
    }

    // Parallax mountains
    ctx.fillStyle = '#1a1560';
    for (let i = 0; i < 8; i++) {
      const mx = ((i * 130 - cameraX * 0.15) % (GAME_W + 130) + GAME_W + 130) % (GAME_W + 130) - 130;
      const mh = 80 + (i % 3) * 40;
      ctx.beginPath();
      ctx.moveTo(this._gx(mx), this._gy(GROUND_Y - 20));
      ctx.lineTo(this._gx(mx + 65), this._gy(GROUND_Y - 20 - mh));
      ctx.lineTo(this._gx(mx + 130), this._gy(GROUND_Y - 20));
      ctx.fill();
    }

    // Parallax buildings
    ctx.fillStyle = '#241f5e';
    for (let i = 0; i < 6; i++) {
      const bx = ((i * 150 - cameraX * 0.35) % (GAME_W + 150) + GAME_W + 150) % (GAME_W + 150) - 150;
      const bh = 60 + (i % 4) * 30;
      const bw = 60 + (i % 3) * 20;
      ctx.fillRect(this._gx(bx), this._gy(GROUND_Y - bh), this._gs(bw), this._gs(bh));
      // lit windows
      ctx.fillStyle = 'rgba(255,255,180,0.5)';
      for (let wy = 0; wy < Math.floor(bh / 20) - 1; wy++) {
        for (let wx = 0; wx < Math.floor(bw / 18) - 1; wx++) {
          if ((i + wy + wx) % 3 !== 0) {
            ctx.fillRect(this._gx(bx + 8 + wx * 18), this._gy(GROUND_Y - bh + 10 + wy * 20), this._gs(8), this._gs(10));
          }
        }
      }
      ctx.fillStyle = '#241f5e';
    }

    // Ground
    ctx.fillStyle = '#3d2b1f';
    ctx.fillRect(0, this._gy(GROUND_Y), canvas.width, this._gs(GAME_H - GROUND_Y));
    ctx.fillStyle = '#5DBB3F';
    ctx.fillRect(0, this._gy(GROUND_Y), canvas.width, this._gs(8));

    // Platforms
    (this.state.platforms || []).forEach(p => {
      const sx = p.x - cameraX;
      if (sx + p.w < -10 || sx > GAME_W + 10) return;
      ctx.fillStyle = '#5a3e28';
      ctx.fillRect(this._gx(sx), this._gy(p.y - p.h), this._gs(p.w), this._gs(p.h));
      ctx.fillStyle = '#7a5c3a';
      ctx.fillRect(this._gx(sx), this._gy(p.y - p.h), this._gs(p.w), this._gs(4));
    });

    // Enemies
    (this.state.enemies || []).forEach(en => {
      const sx = en.x - cameraX;
      if (sx < -60 || sx > GAME_W + 60) return;
      if (en.type === 'walker') this._drawWalker(ctx, sx, en.y, en.facingRight, en.health);
      else this._drawFlyer(ctx, sx, en.y, en.facingRight, en.health);
    });

    // Bullets
    (this.state.bullets || []).forEach(b => {
      const sx = b.x - cameraX;
      if (sx < -10 || sx > GAME_W + 10) return;
      ctx.shadowColor = b.fromPlayer ? '#FFD700' : '#FF4455';
      ctx.shadowBlur = this._gs(8);
      ctx.fillStyle = b.fromPlayer ? '#FFD700' : '#FF4455';
      ctx.beginPath();
      ctx.arc(this._gx(sx), this._gy(b.y), this._gs(5), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Players
    const players = this.state.players || {};
    Object.values(players).forEach(p => {
      const sx = p.x - cameraX;
      if (sx < -40 || sx > GAME_W + 40) return;
      this._drawPlayer(ctx, sx, p, p.id === this.myId);
    });

    // HUD
    this._drawHUD(ctx);
  }

  _drawPlayer(ctx, sx, p, isMe) {
    const { _gx: gx, _gy: gy, _gs: gs } = this;
    const gxb = gx.bind(this), gyb = gy.bind(this), gsb = gs.bind(this);
    const PW = 26, PH = 38;
    const footY = GAME_H - p.y;

    if (p.iFrames && Math.floor(Date.now() / 100) % 2 === 0) return;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(gxb(sx), gyb(footY + 2), gsb(12), gsb(4), 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs (animated when moving)
    const legAnim = p.onGround && (p.vx !== 0) ? Math.sin(Date.now() / 120) * 6 : 0;
    ctx.fillStyle = '#333';
    ctx.fillRect(gxb(sx - 8), gyb(footY - 12), gsb(6), gsb(12));
    ctx.fillRect(gxb(sx + 2), gyb(footY - 12 + legAnim), gsb(6), gsb(12));

    // Body
    ctx.fillStyle = p.color || '#FFD700';
    ctx.fillRect(gxb(sx - PW/2), gyb(footY - PH + 10), gsb(PW), gsb(PH - 16));

    // Head
    ctx.fillStyle = p.color || '#FFD700';
    ctx.fillRect(gxb(sx - 9), gyb(footY - PH), gsb(18), gsb(16));
    // Helmet stripe
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(gxb(sx - 9), gyb(footY - PH + 4), gsb(18), gsb(4));

    // Eye
    ctx.fillStyle = '#fff';
    const eyeX = p.facingRight ? sx + 4 : sx - 4;
    ctx.beginPath();
    ctx.arc(gxb(eyeX), gyb(footY - PH + 9), gsb(3), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(gxb(eyeX + (p.facingRight ? 1 : -1)), gyb(footY - PH + 9), gsb(1.5), 0, Math.PI * 2);
    ctx.fill();

    // Gun
    ctx.fillStyle = '#555';
    const gunDir = p.facingRight ? 1 : -1;
    ctx.fillRect(gxb(sx + gunDir * 6), gyb(footY - PH + 16), gsb(14 * gunDir), gsb(4));

    // Health hearts
    for (let i = 0; i < 3; i++) {
      ctx.font = gsb(11) + 'px serif';
      ctx.fillText(i < p.health ? '❤️' : '🖤', gxb(sx - 17 + i * 12), gyb(footY - PH - 4));
    }

    // Arrow for my player
    if (isMe) {
      ctx.fillStyle = '#FFD700';
      ctx.font = gsb(14) + 'px serif';
      ctx.textAlign = 'center';
      ctx.fillText('▼', gxb(sx), gyb(footY - PH - 14));
      ctx.textAlign = 'left';
    }
  }

  _drawWalker(ctx, sx, y, facingRight, health) {
    const { _gx: gx, _gy: gy, _gs: gs } = this;
    const gxb = gx.bind(this), gyb = gy.bind(this), gsb = gs.bind(this);
    const footY = GAME_H - y;

    ctx.fillStyle = '#333';
    ctx.fillRect(gxb(sx - 7), gyb(footY - 10), gsb(5), gsb(10));
    ctx.fillRect(gxb(sx + 2), gyb(footY - 10), gsb(5), gsb(10));

    ctx.fillStyle = '#CC2222';
    ctx.fillRect(gxb(sx - 13), gyb(footY - 34), gsb(26), gsb(24));

    // Eye
    ctx.fillStyle = '#FFD700';
    const eyeX = facingRight ? sx + 5 : sx - 5;
    ctx.beginPath();
    ctx.arc(gxb(eyeX), gyb(footY - 22), gsb(4), 0, Math.PI * 2);
    ctx.fill();

    // Gun
    ctx.fillStyle = '#888';
    const gd = facingRight ? 1 : -1;
    ctx.fillRect(gxb(sx + gd * 7), gyb(footY - 26), gsb(12 * gd), gsb(4));

    // Health
    const hPct = health / 3;
    ctx.fillStyle = '#400';
    ctx.fillRect(gxb(sx - 13), gyb(footY - 38), gsb(26), gsb(4));
    ctx.fillStyle = '#F44';
    ctx.fillRect(gxb(sx - 13), gyb(footY - 38), gsb(26 * hPct), gsb(4));
  }

  _drawFlyer(ctx, sx, y, facingRight, health) {
    const { _gx: gx, _gy: gy, _gs: gs } = this;
    const gxb = gx.bind(this), gyb = gy.bind(this), gsb = gs.bind(this);
    const cy = GAME_H - y;

    ctx.save();
    ctx.translate(gxb(sx), gyb(cy));
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = 'rgba(160,80,200,0.9)';
    ctx.fillRect(-gsb(12), -gsb(12), gsb(24), gsb(24));
    ctx.restore();

    // Wings
    ctx.fillStyle = 'rgba(160,80,200,0.4)';
    ctx.fillRect(gxb(sx - 28), gyb(cy - 6), gsb(20), gsb(8));
    ctx.fillRect(gxb(sx + 8),  gyb(cy - 6), gsb(20), gsb(8));

    // Eye
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(gxb(sx), gyb(cy), gsb(4), 0, Math.PI * 2);
    ctx.fill();

    // Health bar
    const hPct = health / 2;
    ctx.fillStyle = '#300';
    ctx.fillRect(gxb(sx - 13), gyb(cy - 22), gsb(26), gsb(4));
    ctx.fillStyle = '#A44';
    ctx.fillRect(gxb(sx - 13), gyb(cy - 22), gsb(26 * hPct), gsb(4));
  }

  _drawHUD(ctx) {
    const { canvas } = this;
    if (!this.state) return;
    const { players = {}, wave = 1 } = this.state;

    // Wave counter
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(canvas.width / 2 - 60, 8, 120, 30);
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 16px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Wave ${wave}`, canvas.width / 2, 28);
    ctx.textAlign = 'left';

    // Player scores
    let yi = 8;
    Object.values(players).forEach(p => {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(8, yi, 160, 28);
      ctx.fillStyle = p.color || '#FFD700';
      ctx.font = 'bold 13px Nunito, sans-serif';
      ctx.fillText(`${p.name}: ${p.score || 0} pts`, 14, yi + 18);
      yi += 34;
    });
  }
}
