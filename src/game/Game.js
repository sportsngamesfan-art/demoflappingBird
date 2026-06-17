import * as THREE from 'three';

const CANVAS_W = 800;
const CANVAS_H = 600;
const PIPE_W   = 64;

// ─── Bird mesh factory ────────────────────────────────────────────────────────
function makeBird(color) {
  const group = new THREE.Group();

  // Body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(36, 30, 28),
    new THREE.MeshLambertMaterial({ color })
  );
  group.add(body);

  // Belly
  const belly = new THREE.Mesh(
    new THREE.BoxGeometry(26, 22, 30),
    new THREE.MeshLambertMaterial({ color: 0xFFF8DC })
  );
  belly.position.set(2, -2, 0);
  group.add(belly);

  // Eye white
  const eyeWhite = new THREE.Mesh(
    new THREE.SphereGeometry(7, 8, 8),
    new THREE.MeshLambertMaterial({ color: 0xFFFFFF })
  );
  eyeWhite.position.set(14, 6, 10);
  group.add(eyeWhite);

  // Pupil
  const pupil = new THREE.Mesh(
    new THREE.SphereGeometry(4, 8, 8),
    new THREE.MeshLambertMaterial({ color: 0x111111 })
  );
  pupil.position.set(17, 6, 12);
  group.add(pupil);

  // Beak
  const beak = new THREE.Mesh(
    new THREE.BoxGeometry(12, 8, 10),
    new THREE.MeshLambertMaterial({ color: 0xFF8C00 })
  );
  beak.position.set(20, -1, 0);
  group.add(beak);

  // Wing
  const wing = new THREE.Mesh(
    new THREE.BoxGeometry(18, 8, 6),
    new THREE.MeshLambertMaterial({ color: darken(color, 0.75) })
  );
  wing.position.set(-4, 2, -14);
  group.add(wing);
  group.userData.wing = wing;

  return group;
}

function darken(hex, factor) {
  const r = Math.floor(((hex >> 16) & 0xFF) * factor);
  const g = Math.floor(((hex >> 8) & 0xFF) * factor);
  const b = Math.floor((hex & 0xFF) * factor);
  return (r << 16) | (g << 8) | b;
}

// ─── Pipe mesh factory ────────────────────────────────────────────────────────
function makePipePair(scene) {
  const mat    = new THREE.MeshLambertMaterial({ color: 0x3CB043 });
  const capMat = new THREE.MeshLambertMaterial({ color: 0x2E8B57 });

  function makePipe(height) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(PIPE_W, height, 46), mat);
    group.add(body);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(PIPE_W + 10, 20, 52), capMat);
    cap.position.y = height / 2 - 10;
    group.add(cap);
    return group;
  }

  const top    = makePipe(1);
  const bottom = makePipe(1);
  scene.add(top);
  scene.add(bottom);
  return { top, bottom };
}

// ─── Background ───────────────────────────────────────────────────────────────
function buildBackground(scene) {
  // Sky gradient plane
  const skyGeo = new THREE.PlaneGeometry(CANVAS_W * 2, CANVAS_H * 2);
  const skyMat = new THREE.MeshBasicMaterial({ color: 0x87CEEB });
  const sky    = new THREE.Mesh(skyGeo, skyMat);
  sky.position.set(CANVAS_W / 2, CANVAS_H / 2, -80);
  scene.add(sky);

  // Ground
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(CANVAS_W * 2, 40, 60),
    new THREE.MeshLambertMaterial({ color: 0x8B6914 })
  );
  ground.position.set(CANVAS_W / 2, -10, -20);
  scene.add(ground);

  const grass = new THREE.Mesh(
    new THREE.BoxGeometry(CANVAS_W * 2, 14, 62),
    new THREE.MeshLambertMaterial({ color: 0x5DBB3F })
  );
  grass.position.set(CANVAS_W / 2, 14, -20);
  scene.add(grass);

  // Clouds
  const clouds = [];
  for (let i = 0; i < 7; i++) {
    const cloud = makeCloud();
    cloud.position.set(
      Math.random() * CANVAS_W,
      CANVAS_H * 0.55 + Math.random() * CANVAS_H * 0.35,
      -40 - Math.random() * 30
    );
    scene.add(cloud);
    clouds.push({ mesh: cloud, speed: 0.2 + Math.random() * 0.3 });
  }
  return clouds;
}

function makeCloud() {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
  [[0,0,0,50,28,30],[30,8,0,40,24,28],[-28,6,0,38,22,26],[18,-8,0,34,20,24]].forEach(([x,y,z,w,h,d]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
    m.position.set(x,y,z);
    group.add(m);
  });
  return group;
}

// ─── FlappyGame class ─────────────────────────────────────────────────────────
export class FlappyGame {
  constructor(canvas, onFlap, initialPlayers) {
    this.canvas  = canvas;
    this.onFlap  = onFlap;
    this.birds   = {};      // id -> { mesh, targetY, vy, alive }
    this.pipeMeshes = {};   // index -> { top, bottom }
    this.pipeData   = [];
    this.clouds  = [];
    this.animId  = null;
    this.destroyed = false;

    this._initRenderer();
    this._initScene();
    this._initPlayers(initialPlayers);
    this._bindInput();
  }

  _initRenderer() {
    const { canvas } = this;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = false;
    this._resize();
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
  }

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);

    const aspect = w / h;
    const gameAspect = CANVAS_W / CANVAS_H;
    let left, right, top, bottom;

    if (aspect > gameAspect) {
      const extra = (aspect * CANVAS_H - CANVAS_W) / 2;
      left = -extra; right = CANVAS_W + extra; top = CANVAS_H; bottom = 0;
    } else {
      const extra = (CANVAS_W / aspect - CANVAS_H) / 2;
      left = 0; right = CANVAS_W; top = CANVAS_H + extra; bottom = -extra;
    }

    if (this.camera) {
      this.camera.left = left; this.camera.right = right;
      this.camera.top  = top;  this.camera.bottom = bottom;
      this.camera.updateProjectionMatrix();
    } else {
      this._camParams = { left, right, top, bottom };
    }
  }

  _initScene() {
    const { left, right, top, bottom } = this._camParams || { left: 0, right: CANVAS_W, top: CANVAS_H, bottom: 0 };
    this.camera = new THREE.OrthographicCamera(left, right, top, bottom, -1000, 1000);
    this.camera.position.set(0, 0, 500);
    this.camera.lookAt(0, 0, 0);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(300, 600, 400);
    this.scene.add(dirLight);

    this.clouds = buildBackground(this.scene);
  }

  _initPlayers(players) {
    for (const id in players) {
      const p = players[id];
      const mesh = makeBird(p.color);
      mesh.position.set(p.x, CANVAS_H - p.y, 0);
      this.scene.add(mesh);
      this.birds[id] = {
        mesh,
        targetX: p.x,
        targetY: p.y,
        alive: p.alive,
        vy: 0,
      };
    }
  }

  _bindInput() {
    this._onKey = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        this.onFlap();
      }
    };
    this._onClick = () => this.onFlap();
    window.addEventListener('keydown', this._onKey);
    this.canvas.addEventListener('click', this._onClick);
    this.canvas.addEventListener('touchstart', this._onClick, { passive: true });
  }

  start() {
    this._loop();
  }

  _loop() {
    if (this.destroyed) return;
    this.animId = requestAnimationFrame(() => this._loop());

    const now = performance.now() * 0.001;

    // Animate clouds
    for (const c of this.clouds) {
      c.mesh.position.x -= c.speed;
      if (c.mesh.position.x < -100) c.mesh.position.x = CANVAS_W + 100;
    }

    // Animate birds
    for (const id in this.birds) {
      const b = this.birds[id];
      // Lerp toward server position
      b.mesh.position.y += ((CANVAS_H - b.targetY) - b.mesh.position.y) * 0.25;
      b.mesh.position.x += (b.targetX - b.mesh.position.x) * 0.25;

      // Tilt based on velocity
      const tilt = Math.max(-0.8, Math.min(0.5, b.vy * 0.04));
      b.mesh.rotation.z = -tilt;

      // Wing flap
      if (b.alive && b.mesh.userData.wing) {
        b.mesh.userData.wing.rotation.x = Math.sin(now * 10) * 0.3;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  updateState(pipes, players) {
    // Update birds
    for (const id in players) {
      const p = players[id];
      if (!this.birds[id]) {
        // Late-join: add bird
        const mesh = makeBird(p.color);
        mesh.position.set(p.x, CANVAS_H - p.y, 0);
        this.scene.add(mesh);
        this.birds[id] = { mesh, targetX: p.x, targetY: p.y, alive: p.alive, vy: p.vy || 0 };
      } else {
        this.birds[id].targetX = p.x;
        this.birds[id].targetY = p.y;
        this.birds[id].alive   = p.alive;
        this.birds[id].vy      = p.vy || 0;
        if (!p.alive) {
          this.birds[id].mesh.rotation.z = Math.PI / 2;
        }
      }
    }

    // Update pipes
    this.pipeData = pipes;

    // Remove stale pipe meshes
    const neededCount = pipes.length;
    const existingKeys = Object.keys(this.pipeMeshes).map(Number);
    for (const k of existingKeys) {
      if (k >= neededCount) {
        this.scene.remove(this.pipeMeshes[k].top);
        this.scene.remove(this.pipeMeshes[k].bottom);
        delete this.pipeMeshes[k];
      }
    }

    // Create or update pipe meshes
    for (let i = 0; i < pipes.length; i++) {
      const pipe = pipes[i];
      const topHeight    = pipe.gapY;
      const bottomHeight = CANVAS_H - (pipe.gapY + pipe.gap);

      if (!this.pipeMeshes[i]) {
        this.pipeMeshes[i] = makePipePair(this.scene);
      }

      const { top, bottom } = this.pipeMeshes[i];

      // Top pipe (hangs from top)
      if (topHeight > 0) {
        top.visible = true;
        // Rebuild geometry if height changed (simple approach: scale)
        top.scale.y = topHeight;
        top.position.set(pipe.x + PIPE_W / 2, CANVAS_H - topHeight / 2, 0);
      } else {
        top.visible = false;
      }

      // Bottom pipe
      if (bottomHeight > 0) {
        bottom.visible = true;
        bottom.scale.y = bottomHeight;
        bottom.position.set(pipe.x + PIPE_W / 2, bottomHeight / 2, 0);
      } else {
        bottom.visible = false;
      }
    }
  }

  onPlayerDied(id) {
    if (this.birds[id]) {
      this.birds[id].alive = false;
      this.birds[id].mesh.rotation.z = Math.PI / 2;
    }
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.animId);
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('resize', this._onResize);
    this.canvas.removeEventListener('click', this._onClick);
    this.canvas.removeEventListener('touchstart', this._onClick);
    this.renderer.dispose();

    // Cleanup Three.js objects
    this.scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
  }
}
