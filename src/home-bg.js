export function initHomeBg() {
  const canvas = document.getElementById('home-bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  const stars = Array.from({ length: 80 }, () => ({
    x: Math.random(), y: Math.random(),
    r: Math.random() * 1.5 + 0.3,
    a: Math.random(),
    da: (Math.random() - 0.5) * 0.006,
  }));

  const orbs = [240, 270, 300, 210, 260].map(hue => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    r: 90 + Math.random() * 110,
    vx: (Math.random() - 0.5) * 0.14,
    vy: (Math.random() - 0.5) * 0.11,
    hue,
  }));

  function draw() {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    stars.forEach(s => {
      s.a = Math.max(0.05, Math.min(1, s.a + s.da));
      if (s.a <= 0.05 || s.a >= 1) s.da *= -1;
      ctx.globalAlpha = s.a * 0.75;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      ctx.fill();
    });

    orbs.forEach(o => {
      o.x += o.vx; o.y += o.vy;
      if (o.x < -o.r) o.x = W + o.r;
      if (o.x > W + o.r) o.x = -o.r;
      if (o.y < -o.r) o.y = H + o.r;
      if (o.y > H + o.r) o.y = -o.r;
      const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
      g.addColorStop(0, `hsla(${o.hue},80%,65%,0.11)`);
      g.addColorStop(1, `hsla(${o.hue},80%,65%,0)`);
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.globalAlpha = 1;
    requestAnimationFrame(draw);
  }
  draw();
}
