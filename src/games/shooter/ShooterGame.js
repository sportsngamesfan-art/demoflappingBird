const GAME_W = 800, GAME_H = 380, GROUND_Y = 310;

export class ShooterGame {
  constructor(canvas, onInput, myId) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.onInput = onInput;
    this.myId   = myId;
    this.state  = null;
    this.raf    = null;
    this.scale  = 1; this.offX = 0; this.offY = 0;
    this.input  = { left: false, right: false, jump: false, shoot: false };
    this._kd = this._onKey.bind(this, true);
    this._ku = this._onKey.bind(this, false);
    this._rs = this._onResize.bind(this);
    window.addEventListener('keydown', this._kd);
    window.addEventListener('keyup',   this._ku);
    window.addEventListener('resize',  this._rs);
    this._onResize();
    this._bindTouch();
  }

  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.scale = Math.min(w / GAME_W, h / GAME_H);
    this.offX  = (w - GAME_W * this.scale) / 2;
    this.offY  = (h - GAME_H * this.scale) / 2;
    this.canvas.width  = w;
    this.canvas.height = h;
  }

  _onKey(down, e) {
    const snap = JSON.stringify(this.input);
    if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') this.input.left  = down;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.input.right = down;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') {
      if (down) e.preventDefault();
      this.input.jump = down;
    }
    if (e.key === 'z' || e.key === 'Z' || e.key === 'Control') this.input.shoot = down;
    if (JSON.stringify(this.input) !== snap) this.onInput({ ...this.input });
  }

  _bindTouch() {
    document.querySelectorAll('.sh-touch-btn').forEach(btn => {
      const action = btn.dataset.action;
      const set = v => {
        const snap = JSON.stringify(this.input);
        this.input[action] = v;
        if (JSON.stringify(this.input) !== snap) this.onInput({ ...this.input });
      };
      btn.addEventListener('touchstart', e => { e.preventDefault(); set(true);  }, { passive: false });
      btn.addEventListener('touchend',   e => { e.preventDefault(); set(false); }, { passive: false });
      btn.addEventListener('mousedown',  () => set(true));
      btn.addEventListener('mouseup',    () => set(false));
    });
  }

  start()          { const loop = () => { this._render(); this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop); }
  updateState(s)   { this.state = s; }
  destroy()        { cancelAnimationFrame(this.raf); window.removeEventListener('keydown', this._kd); window.removeEventListener('keyup', this._ku); window.removeEventListener('resize', this._rs); }

  // sx = world_x - cameraX (already screen-space x offset from left of game viewport)
  gx(sx) { return this.offX + sx * this.scale; }
  // y = canvas y-down coordinate (same in game space and screen space)
  gy(y)  { return this.offY + y  * this.scale; }
  gs(v)  { return v * this.scale; }

  _render() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!this.state) return;

    const cam = this.state.cameraX || 0;

    // Sky
    const sky = ctx.createLinearGradient(0, this.gy(0), 0, this.gy(GAME_H));
    sky.addColorStop(0, '#0d0b2e');
    sky.addColorStop(1, '#1e1a5e');
    ctx.fillStyle = sky;
    ctx.fillRect(this.offX, this.gy(0), this.gs(GAME_W), this.gs(GAME_H));

    // Stars
    const SX = [42,128,230,350,470,560,680,750,90,200,310,420,530,640,720,780,55,165,285,395,505,615,710,795];
    const SY = [15,40,8,55,22,48,10,38,70,85,62,90,75,95,60,80,120,135,110,145,125,140,115,130];
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    SX.forEach((bx, i) => {
      const sx = ((bx - cam * 0.04) % GAME_W + GAME_W) % GAME_W;
      ctx.beginPath(); ctx.arc(this.gx(sx), this.gy(SY[i]), this.gs(1.2), 0, Math.PI * 2); ctx.fill();
    });

    // Mountains (parallax 0.12)
    ctx.fillStyle = '#16134a';
    for (let i = 0; i < 7; i++) {
      const mx = ((i * 140 - cam * 0.12) % (GAME_W + 140) + GAME_W + 140) % (GAME_W + 140) - 140;
      const mh = 70 + (i % 3) * 45;
      ctx.beginPath();
      ctx.moveTo(this.gx(mx),       this.gy(GROUND_Y - 10));
      ctx.lineTo(this.gx(mx + 70),  this.gy(GROUND_Y - 10 - mh));
      ctx.lineTo(this.gx(mx + 140), this.gy(GROUND_Y - 10));
      ctx.closePath(); ctx.fill();
    }

    // Buildings (parallax 0.30)
    for (let i = 0; i < 5; i++) {
      const bx = ((i * 170 - cam * 0.30) % (GAME_W + 170) + GAME_W + 170) % (GAME_W + 170) - 170;
      const bw = 65 + (i % 3) * 22, bh = 55 + (i % 4) * 28;
      ctx.fillStyle = '#1c1850';
      ctx.fillRect(this.gx(bx), this.gy(GROUND_Y - bh), this.gs(bw), this.gs(bh));
      const cols = Math.max(1, Math.floor(bw / 16) - 1), rows = Math.max(1, Math.floor(bh / 18) - 1);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (i + r + c) % 3 !== 0 ? 'rgba(255,255,180,0.45)' : 'transparent';
        ctx.fillRect(this.gx(bx + 6 + c * 16), this.gy(GROUND_Y - bh + 8 + r * 18), this.gs(8), this.gs(9));
      }
    }

    // Ground
    ctx.fillStyle = '#2d1f10';
    ctx.fillRect(this.gx(-50), this.gy(GROUND_Y), this.gs(GAME_W + 100), this.gs(GAME_H - GROUND_Y + 10));
    ctx.fillStyle = '#4a9e35';
    ctx.fillRect(this.gx(-50), this.gy(GROUND_Y), this.gs(GAME_W + 100), this.gs(7));

    // Platforms
    (this.state.platforms || []).forEach(p => {
      const sx = p.x - cam;
      if (sx + p.w < -20 || sx > GAME_W + 20) return;
      ctx.fillStyle = '#4a2e14';
      ctx.fillRect(this.gx(sx), this.gy(p.y), this.gs(p.w), this.gs(p.h));
      ctx.fillStyle = '#6b4420';
      ctx.fillRect(this.gx(sx), this.gy(p.y), this.gs(p.w), this.gs(5));
    });

    // Enemies
    (this.state.enemies || []).forEach(en => {
      const sx = en.x - cam;
      if (sx < -70 || sx > GAME_W + 70) return;
      if (en.type === 'walker') this._drawWalker(sx, en);
      else                      this._drawFlyer(sx, en);
    });

    // Bullets
    (this.state.bullets || []).forEach(b => {
      const sx = b.x - cam;
      if (sx < -15 || sx > GAME_W + 15) return;
      const col = b.fromPlayer ? '#FFD700' : '#FF4455';
      ctx.shadowColor = col; ctx.shadowBlur = this.gs(10);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(this.gx(sx), this.gy(b.y), this.gs(4), 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Players
    Object.values(this.state.players || {}).forEach(p => {
      const sx = p.x - cam;
      if (sx < -50 || sx > GAME_W + 50) return;
      this._drawPlayer(sx, p, p.id === this.myId);
    });

    this._drawHUD();
  }

  _drawPlayer(sx, p, isMe) {
    if (p.iFrames > 0 && Math.floor(Date.now() / 80) % 2 === 0) return;
    const c = this.ctx;
    const gx = x => this.offX + x * this.scale;
    const gy = y => this.offY + y * this.scale;
    const gs = v => v * this.scale;
    const fy = p.y; // feet canvas-Y

    // Shadow
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.beginPath(); c.ellipse(gx(sx), gy(fy + 2), gs(13), gs(4), 0, 0, Math.PI * 2); c.fill();

    // Boots
    c.fillStyle = '#111';
    c.fillRect(gx(sx - 10), gy(fy - 5),  gs(9),  gs(5));
    c.fillRect(gx(sx + 1),  gy(fy - 5),  gs(9),  gs(5));

    // Legs (animated when running)
    const swing = (p.onGround && p.vx !== 0) ? Math.sin(Date.now() / 100) * 4 : 0;
    c.fillStyle = '#2c2c3c';
    c.fillRect(gx(sx - 9),           gy(fy - 16),         gs(7), gs(11));
    c.fillRect(gx(sx + 2),           gy(fy - 16 + swing), gs(7), gs(11));

    // Torso
    c.fillStyle = p.color;
    c.fillRect(gx(sx - 11), gy(fy - 32), gs(22), gs(16));

    // Belt
    c.fillStyle = 'rgba(0,0,0,0.45)';
    c.fillRect(gx(sx - 11), gy(fy - 17), gs(22), gs(4));

    // Arms
    c.fillStyle = p.color;
    c.fillRect(gx(sx - 15), gy(fy - 32), gs(6),  gs(10));
    c.fillRect(gx(sx + 9),  gy(fy - 32), gs(6),  gs(10));

    // Neck
    c.fillStyle = p.color;
    c.fillRect(gx(sx - 4), gy(fy - 36), gs(8), gs(5));

    // Head (circle)
    c.fillStyle = p.color;
    c.beginPath(); c.arc(gx(sx), gy(fy - 43), gs(10), 0, Math.PI * 2); c.fill();

    // Helmet band
    c.fillStyle = 'rgba(0,0,0,0.5)';
    c.fillRect(gx(sx - 10), gy(fy - 46), gs(20), gs(5));

    // Eye
    const ex = p.facingRight ? sx + 4 : sx - 4;
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(gx(ex), gy(fy - 41), gs(3.5), 0, Math.PI * 2); c.fill();
    c.fillStyle = '#111';
    c.beginPath(); c.arc(gx(ex + (p.facingRight ? 1 : -1)), gy(fy - 41), gs(2), 0, Math.PI * 2); c.fill();

    // Gun
    const gdir = p.facingRight ? 1 : -1;
    c.fillStyle = '#444';
    c.fillRect(gx(sx + gdir * 9),  gy(fy - 30), gs(18 * gdir), gs(6));
    c.fillStyle = '#666';
    c.fillRect(gx(sx + gdir * 9),  gy(fy - 29), gs(5 * gdir),  gs(4));

    // Health bar (above head)
    const bw = 32;
    c.fillStyle = 'rgba(0,0,0,0.55)';
    c.fillRect(gx(sx - bw/2), gy(fy - 58), gs(bw), gs(5));
    c.fillStyle = p.health > 1 ? '#44cc66' : '#ff4455';
    c.fillRect(gx(sx - bw/2), gy(fy - 58), gs(bw * p.health / 3), gs(5));

    // "You" arrow
    if (isMe) {
      c.fillStyle = '#FFD700';
      c.beginPath();
      c.moveTo(gx(sx),      gy(fy - 64));
      c.lineTo(gx(sx - 6),  gy(fy - 72));
      c.lineTo(gx(sx + 6),  gy(fy - 72));
      c.closePath(); c.fill();
    }
  }

  _drawWalker(sx, en) {
    const c = this.ctx;
    const gx = x => this.offX + x * this.scale;
    const gy = y => this.offY + y * this.scale;
    const gs = v => v * this.scale;
    const fy = en.y; // feet Y

    // Legs
    c.fillStyle = '#111';
    c.fillRect(gx(sx - 9), gy(fy - 12), gs(7), gs(12));
    c.fillRect(gx(sx + 2), gy(fy - 12), gs(7), gs(12));

    // Body (red robot box)
    c.fillStyle = '#7a1515';
    c.fillRect(gx(sx - 13), gy(fy - 36), gs(26), gs(24));
    // highlight edges
    c.fillStyle = '#b52020';
    c.fillRect(gx(sx - 13), gy(fy - 36), gs(26), gs(4));
    c.fillRect(gx(sx - 13), gy(fy - 36), gs(4),  gs(24));
    // shadow edge
    c.fillStyle = '#500e0e';
    c.fillRect(gx(sx + 9),  gy(fy - 36), gs(4),  gs(24));
    c.fillRect(gx(sx - 13), gy(fy - 16), gs(26), gs(4));

    // Visor (yellow glow slit)
    const vx = en.facingRight ? sx + 2 : sx - 12;
    c.fillStyle = '#FFD700';
    c.fillRect(gx(vx), gy(fy - 27), gs(11), gs(4));
    c.shadowColor = '#FFD700'; c.shadowBlur = gs(6);
    c.fillRect(gx(vx), gy(fy - 27), gs(11), gs(4));
    c.shadowBlur = 0;

    // Gun barrel
    c.fillStyle = '#555';
    const gdir = en.facingRight ? 1 : -1;
    c.fillRect(gx(sx + gdir * 13), gy(fy - 29), gs(16 * gdir), gs(6));

    // Health bar
    const bw = 26;
    c.fillStyle = 'rgba(0,0,0,0.55)';
    c.fillRect(gx(sx - bw/2), gy(fy - 42), gs(bw), gs(5));
    c.fillStyle = '#cc2222';
    c.fillRect(gx(sx - bw/2), gy(fy - 42), gs(bw * Math.max(0, en.health) / 3), gs(5));
  }

  _drawFlyer(sx, en) {
    const c = this.ctx;
    const gx = x => this.offX + x * this.scale;
    const gy = y => this.offY + y * this.scale;
    const gs = v => v * this.scale;
    const cy = en.y; // center Y

    // Wing glow ellipses
    c.fillStyle = 'rgba(130,40,200,0.35)';
    c.beginPath(); c.ellipse(gx(sx - 26), gy(cy), gs(20), gs(8), 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(gx(sx + 26), gy(cy), gs(20), gs(8), 0, 0, Math.PI * 2); c.fill();

    // Wing rectangles
    c.fillStyle = 'rgba(160,60,240,0.6)';
    c.fillRect(gx(sx - 44), gy(cy - 5), gs(30), gs(10));
    c.fillRect(gx(sx + 14), gy(cy - 5), gs(30), gs(10));

    // Diamond body
    c.fillStyle = '#6b21a8';
    c.beginPath();
    c.moveTo(gx(sx),       gy(cy - 17));
    c.lineTo(gx(sx + 15),  gy(cy));
    c.lineTo(gx(sx),       gy(cy + 17));
    c.lineTo(gx(sx - 15),  gy(cy));
    c.closePath(); c.fill();

    // Diamond highlight (top-right facet)
    c.fillStyle = '#a855f7';
    c.beginPath();
    c.moveTo(gx(sx),       gy(cy - 17));
    c.lineTo(gx(sx + 15),  gy(cy));
    c.lineTo(gx(sx + 5),   gy(cy - 6));
    c.closePath(); c.fill();

    // Scanner eye
    c.shadowColor = '#FFD700'; c.shadowBlur = gs(14);
    c.fillStyle   = '#FFD700';
    c.beginPath(); c.arc(gx(sx), gy(cy), gs(5), 0, Math.PI * 2); c.fill();
    c.shadowBlur  = 0;
    c.fillStyle   = '#111';
    c.beginPath(); c.arc(gx(sx + (en.facingRight ? 2 : -2)), gy(cy), gs(2.5), 0, Math.PI * 2); c.fill();

    // Health bar
    const bw = 30;
    c.fillStyle = 'rgba(0,0,0,0.55)';
    c.fillRect(gx(sx - bw/2), gy(cy - 26), gs(bw), gs(5));
    c.fillStyle = '#a855f7';
    c.fillRect(gx(sx - bw/2), gy(cy - 26), gs(bw * Math.max(0, en.health) / 2), gs(5));
  }

  _drawHUD() {
    const c = this.ctx, { canvas, state } = this;
    if (!state) return;
    const { players = {}, wave = 1 } = state;

    const fs = Math.round(this.gs(15));
    c.font = `bold ${fs}px Nunito, sans-serif`;
    c.textAlign = 'center';
    const wt = `Wave ${wave}`;
    const tw = c.measureText(wt).width;
    c.fillStyle = 'rgba(0,0,0,0.6)';
    c.fillRect(canvas.width / 2 - tw / 2 - 12, 8, tw + 24, 32);
    c.fillStyle = '#FFD700';
    c.fillText(wt, canvas.width / 2, 30);
    c.textAlign = 'left';

    const fs2 = Math.round(this.gs(13));
    c.font = `bold ${fs2}px Nunito, sans-serif`;
    let yi = 10;
    Object.values(players).forEach(p => {
      const txt = `${p.name}  ${p.score} pts`;
      const tw2 = c.measureText(txt).width;
      c.fillStyle = 'rgba(0,0,0,0.55)';
      c.fillRect(10, yi, tw2 + 18, 28);
      c.fillStyle = p.color;
      c.fillText(txt, 19, yi + 19);
      yi += 34;
    });
  }
}
