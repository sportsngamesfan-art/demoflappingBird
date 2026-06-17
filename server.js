const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://owqqfjyisewemtxjgexq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cXFmanlpc2V3ZW10eGpnZXhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NjUwNTUsImV4cCI6MjA4OTI0MTA1NX0.Nflzdg6Lt7gwz4WU4Mi_-4XLnJDUgns9Ip2Ji4I8tfM';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const LEVELS = {
  easy:   { pipeSpeed: 2.5, pipeGap: 200, pipeInterval: 2200 },
  medium: { pipeSpeed: 3.5, pipeGap: 160, pipeInterval: 1800 },
  hard:   { pipeSpeed: 5.0, pipeGap: 115, pipeInterval: 1400 },
};

const GRAVITY       = 0.45;
const FLAP_FORCE    = -8.5;
const BIRD_RADIUS   = 18;
const CANVAS_W      = 800;
const CANVAS_H      = 600;
const PIPE_WIDTH    = 60;
const PLAYER_COLORS = [0xFFD700, 0xFF4455, 0x44AAFF, 0x44DD66, 0xBB44FF, 0xFF8822];

const rooms = new Map();

function genCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function createPlayer(name, colorIndex) {
  return { name, colorIndex, color: PLAYER_COLORS[colorIndex % 6], x: 150, y: CANVAS_H / 2, vy: 0, alive: true, score: 0 };
}

function serializePlayers(players) {
  const out = {};
  for (const id in players) {
    const p = players[id];
    out[id] = { name: p.name, color: p.color, colorIndex: p.colorIndex, x: p.x, y: p.y, vy: p.vy, alive: p.alive, score: p.score };
  }
  return out;
}

function startGame(room, io) {
  const cfg = LEVELS[room.level] || LEVELS.medium;
  room.gameRunning = true;
  room.pipes = [];

  let i = 0;
  for (const id in room.players) {
    const p = room.players[id];
    p.x = 150; p.y = CANVAS_H / 2; p.vy = 0; p.alive = true; p.score = 0;
    p.colorIndex = i; p.color = PLAYER_COLORS[i % 6]; i++;
  }

  // First pipe after 1.5s
  let spawnX = CANVAS_W + 80;
  const spawnPipe = () => {
    if (!room.gameRunning) return;
    const gapY = 100 + Math.random() * (CANVAS_H - 200 - cfg.pipeGap);
    room.pipes.push({ x: spawnX, gapY, gap: cfg.pipeGap, passed: new Set() });
  };
  setTimeout(spawnPipe, 1500);
  room.pipeTimer = setInterval(spawnPipe, cfg.pipeInterval);

  room.gameLoop = setInterval(() => updateGame(room, cfg, io), 1000 / 30);

  io.to(room.code).emit('game_start', {
    level: room.level,
    config: cfg,
    players: serializePlayers(room.players),
  });
}

function updateGame(room, cfg, io) {
  for (const pipe of room.pipes) pipe.x -= cfg.pipeSpeed;
  room.pipes = room.pipes.filter(p => p.x > -PIPE_WIDTH - 20);

  for (const id in room.players) {
    const p = room.players[id];
    if (!p.alive) continue;

    p.vy += GRAVITY;
    p.y  += p.vy;

    if (p.y >= CANVAS_H - BIRD_RADIUS || p.y <= BIRD_RADIUS) {
      p.alive = false;
      io.to(room.code).emit('player_died', { id, score: p.score });
      continue;
    }

    for (const pipe of room.pipes) {
      const inX = p.x + BIRD_RADIUS > pipe.x && p.x - BIRD_RADIUS < pipe.x + PIPE_WIDTH;
      const inY = p.y - BIRD_RADIUS < pipe.gapY || p.y + BIRD_RADIUS > pipe.gapY + pipe.gap;
      if (inX && inY) {
        p.alive = false;
        io.to(room.code).emit('player_died', { id, score: p.score });
        break;
      }
      if (!pipe.passed.has(id) && pipe.x + PIPE_WIDTH < p.x) {
        pipe.passed.add(id);
        p.score++;
      }
    }
  }

  io.to(room.code).emit('game_state', {
    pipes: room.pipes.map(p => ({ x: p.x, gapY: p.gapY, gap: p.gap })),
    players: serializePlayers(room.players),
  });

  if (Object.values(room.players).every(p => !p.alive)) {
    endGame(room, io);
  }
}

async function endGame(room, io) {
  clearInterval(room.gameLoop);
  clearInterval(room.pipeTimer);
  room.gameRunning = false;

  const results = Object.values(room.players)
    .map(p => ({ name: p.name, score: p.score, color: p.color }))
    .sort((a, b) => b.score - a.score);

  await Promise.all(
    results.filter(r => r.score > 0).map(r =>
      supabase.from('leaderboard').insert({ player_name: r.name, score: r.score, level: room.level })
    )
  );

  io.to(room.code).emit('game_over', { results });
}

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

app.use(express.json());

app.get('/api/leaderboard', async (req, res) => {
  const { data, error } = await supabase
    .from('leaderboard').select('*').order('score', { ascending: false }).limit(15);
  res.json(error ? [] : data);
});

io.on('connection', socket => {
  socket.on('create_room', ({ name, level }) => {
    let code = genCode();
    while (rooms.has(code)) code = genCode();
    const room = { code, host: socket.id, level: level || 'medium', players: {}, pipes: [], gameRunning: false, gameLoop: null, pipeTimer: null };
    room.players[socket.id] = createPlayer(name, 0);
    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    socket.emit('room_created', { code, isHost: true, players: serializePlayers(room.players) });
  });

  socket.on('join_room', ({ name, code }) => {
    const room = rooms.get(code.toUpperCase());
    if (!room)                                   return socket.emit('join_error', 'Room not found');
    if (room.gameRunning)                        return socket.emit('join_error', 'Game already in progress');
    if (Object.keys(room.players).length >= 6)   return socket.emit('join_error', 'Room is full (max 6)');

    const colorIndex = Object.keys(room.players).length;
    room.players[socket.id] = createPlayer(name, colorIndex);
    socket.join(room.code);
    socket.data.roomCode = room.code;

    socket.emit('room_joined', { code: room.code, isHost: false, players: serializePlayers(room.players) });
    socket.to(room.code).emit('lobby_update', { players: serializePlayers(room.players) });
  });

  socket.on('start_game', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.host !== socket.id || room.gameRunning) return;
    startGame(room, io);
  });

  socket.on('change_level', ({ level }) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.host !== socket.id) return;
    room.level = level;
    io.to(room.code).emit('level_changed', { level });
  });

  socket.on('flap', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || !room.gameRunning) return;
    const p = room.players[socket.id];
    if (p && p.alive) p.vy = FLAP_FORCE;
  });

  socket.on('play_again', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.host !== socket.id || room.gameRunning) return;
    startGame(room, io);
  });

  socket.on('disconnect', () => {
    const room = rooms.get(socket.data?.roomCode);
    if (!room) return;
    delete room.players[socket.id];
    if (Object.keys(room.players).length === 0) {
      clearInterval(room.gameLoop);
      clearInterval(room.pipeTimer);
      rooms.delete(room.code);
    } else {
      if (room.host === socket.id) room.host = Object.keys(room.players)[0];
      io.to(room.code).emit('lobby_update', { players: serializePlayers(room.players) });
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🎮 Flappy Bird server on :${PORT}`));
