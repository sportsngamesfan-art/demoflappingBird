import * as THREE from 'three';

const CARDS = [
  { icon: '🐦', title: 'Flappy Bird', tag: 'MULTIPLAYER', color: 0xFFD700, screenId: 'screen-landing' },
  { icon: '⚡', title: 'Reaction Tap', tag: 'ARCADE',       color: 0xFF4455, screenId: 'screen-reaction-landing' },
  { icon: '🔫', title: 'Shooter',     tag: 'CO-OP',         color: 0x44AAFF, screenId: 'screen-shooter-landing' },
  { icon: '👻', title: 'Pac-Man',     tag: 'ARCADE',        color: 0xBB44FF, screenId: 'screen-pacman-landing' },
];

let _scene, _camera, _renderer, _raf, _cardMeshes = [], _navigateFn;

function makeCardTexture(card) {
  const W = 300, H = 380;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const hex = '#' + card.color.toString(16).padStart(6, '0');
  ctx.fillStyle = 'rgba(20,20,40,0.95)';
  ctx.roundRect(0, 0, W, H, 24);
  ctx.fill();

  // Glow border
  ctx.strokeStyle = hex;
  ctx.lineWidth = 3;
  ctx.shadowColor = hex;
  ctx.shadowBlur = 18;
  ctx.roundRect(2, 2, W - 4, H - 4, 22);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Icon
  ctx.font = '72px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(card.icon, W / 2, H * 0.32);

  // Title
  ctx.fillStyle = hex;
  ctx.font = "bold 28px 'Fredoka One', cursive, sans-serif";
  ctx.shadowColor = hex;
  ctx.shadowBlur = 10;
  ctx.fillText(card.title, W / 2, H * 0.58);
  ctx.shadowBlur = 0;

  // Tag pill
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  const tagW = 140, tagH = 30, tagX = (W - tagW) / 2, tagY = H * 0.72;
  ctx.beginPath();
  ctx.roundRect(tagX, tagY, tagW, tagH, 8);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = "bold 13px 'Nunito', sans-serif";
  ctx.fillText(card.tag, W / 2, tagY + tagH / 2);

  return new THREE.CanvasTexture(canvas);
}

export function initLobby3D(canvasEl, navigateFn) {
  _navigateFn = navigateFn;

  _scene = new THREE.Scene();
  _scene.background = new THREE.Color(0x080818);
  _scene.fog = new THREE.FogExp2(0x080818, 0.04);

  _camera = new THREE.PerspectiveCamera(55, canvasEl.clientWidth / canvasEl.clientHeight, 0.1, 200);
  _camera.position.set(0, 0, 8);

  _renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
  _renderer.setSize(canvasEl.clientWidth, canvasEl.clientHeight);
  _renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  // Stars
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(600);
  for (let i = 0; i < 600; i++) starPos[i] = (Math.random() - 0.5) * 80;
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  _scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.08 })));

  // Ambient + point light
  _scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const pt = new THREE.PointLight(0xffffff, 1.2, 30);
  pt.position.set(0, 3, 6);
  _scene.add(pt);

  // Cards arranged in an arc
  _cardMeshes = CARDS.map((card, i) => {
    const geo = new THREE.PlaneGeometry(1.8, 2.3);
    const mat = new THREE.MeshStandardMaterial({ map: makeCardTexture(card), transparent: true });
    const mesh = new THREE.Mesh(geo, mat);

    const angle = (i - (CARDS.length - 1) / 2) * 0.52;
    mesh.position.set(Math.sin(angle) * 4.5, 0, Math.cos(angle) * 1.5 - 1);
    mesh.rotation.y = -angle * 0.6;
    mesh.userData = { card, baseY: mesh.position.y, baseRotY: mesh.rotation.y, phase: i * 1.1 };
    _scene.add(mesh);
    return mesh;
  });

  // Raycaster for click
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  canvasEl.addEventListener('click', e => {
    const rect = canvasEl.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, _camera);
    const hits = raycaster.intersectObjects(_cardMeshes);
    if (hits.length) _navigateFn(hits[0].object.userData.card.screenId);
  });

  // Hover cursor
  canvasEl.addEventListener('mousemove', e => {
    const rect = canvasEl.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, _camera);
    canvasEl.style.cursor = raycaster.intersectObjects(_cardMeshes).length ? 'pointer' : 'default';
  });

  window.addEventListener('resize', () => {
    _camera.aspect = canvasEl.clientWidth / canvasEl.clientHeight;
    _camera.updateProjectionMatrix();
    _renderer.setSize(canvasEl.clientWidth, canvasEl.clientHeight);
  });

  _animate();
}

function _animate() {
  _raf = requestAnimationFrame(_animate);
  const t = performance.now() / 1000;

  // Camera gentle drift
  _camera.position.x = Math.sin(t * 0.15) * 0.4;
  _camera.position.y = Math.sin(t * 0.1) * 0.2;
  _camera.lookAt(0, 0, 0);

  // Card bob
  _cardMeshes.forEach(m => {
    m.position.y = m.userData.baseY + Math.sin(t * 0.9 + m.userData.phase) * 0.12;
    m.rotation.y = m.userData.baseRotY + Math.sin(t * 0.5 + m.userData.phase) * 0.04;
  });

  _renderer.render(_scene, _camera);
}

export function destroyLobby3D() {
  if (_raf) cancelAnimationFrame(_raf);
  if (_renderer) _renderer.dispose();
  _scene = _camera = _renderer = null;
  _cardMeshes = [];
}
