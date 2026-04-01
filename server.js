const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
//  HIGHSCORE DATABASE
// ============================================================
const db = new Database(path.join(__dirname, 'highscores.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    score INTEGER NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    mode TEXT NOT NULL DEFAULT 'solo',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const insertScore = db.prepare('INSERT INTO scores (name, score, level, mode) VALUES (?, ?, ?, ?)');
const getTopScores = db.prepare('SELECT name, score, level, mode, created_at FROM scores ORDER BY score DESC LIMIT ?');
const getTopByMode = db.prepare('SELECT name, score, level, created_at FROM scores WHERE mode = ? ORDER BY score DESC LIMIT ?');
const getPlayerBest = db.prepare('SELECT MAX(score) as best FROM scores WHERE name = ?');
const getStats = db.prepare(`SELECT COUNT(*) as totalGames, MAX(score) as highestScore, ROUND(AVG(score),0) as avgScore, MAX(level) as highestLevel FROM scores`);

app.post('/api/scores', (req, res) => {
  const { name, score, level, mode } = req.body;
  if (!name || typeof score !== 'number' || score < 0) return res.status(400).json({ error: 'Invalid' });
  const cn = String(name).slice(0, 16).replace(/[<>]/g, '');
  const cs = Math.min(Math.floor(score), 99999);
  const cl = Math.min(Math.floor(level || 1), 999);
  const cm = mode === 'multi' ? 'multi' : 'solo';
  try {
    insertScore.run(cn, cs, cl, cm);
    const best = getPlayerBest.get(cn);
    const rank = db.prepare('SELECT COUNT(*) as rank FROM scores WHERE score > ?').get(cs);
    res.json({ success: true, personalBest: best.best, rank: rank.rank + 1, isNewBest: cs >= best.best });
  } catch (e) { res.status(500).json({ error: 'DB error' }); }
});

app.get('/api/scores', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  const mode = req.query.mode;
  try {
    res.json(mode && (mode === 'solo' || mode === 'multi') ? getTopByMode.all(mode, limit) : getTopScores.all(limit));
  } catch (e) { res.status(500).json({ error: 'DB error' }); }
});

app.get('/api/stats', (req, res) => {
  try { res.json(getStats.get() || {}); } catch (e) { res.status(500).json({ error: 'DB error' }); }
});

// ============================================================
//  MULTIPLAYER ROOMS
// ============================================================
const rooms = new Map();

function genCode() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let r = '';
  for (let i = 0; i < 5; i++) r += c[Math.floor(Math.random() * c.length)];
  return r;
}

function spawnEggs(W, H, count) {
  const eggs = [];
  for (let i = 0; i < count; i++) {
    eggs.push({
      id: i,
      x: 60 + Math.random() * (W - 120),
      y: 60 + Math.random() * (H - 120),
      color: Math.floor(Math.random() * 10),
      active: true,
    });
  }
  return eggs;
}

io.on('connection', (socket) => {

  // ---- CLASSIC MULTIPLAYER (score race) ----
  socket.on('create-room', (playerName) => {
    const code = genCode();
    rooms.set(code, {
      code,
      mode: 'classic', // will be set to 'versus' if chosen
      players: [{ id: socket.id, name: playerName, ready: false, role: null }],
      state: 'waiting',
      roundData: null,
    });
    socket.join(code);
    socket.roomCode = code;
    socket.emit('room-created', { code, playerIndex: 0 });
  });

  socket.on('join-room', ({ code, playerName }) => {
    const room = rooms.get(code);
    if (!room) { socket.emit('room-error', 'Room does not exist!'); return; }
    if (room.players.length >= 2) { socket.emit('room-error', 'Room is full!'); return; }
    if (room.state !== 'waiting') { socket.emit('room-error', 'Game already started!'); return; }
    room.players.push({ id: socket.id, name: playerName, ready: false, role: null });
    socket.join(code);
    socket.roomCode = code;
    socket.emit('room-joined', { code, playerIndex: 1, opponent: room.players[0].name });
    io.to(room.players[0].id).emit('opponent-joined', playerName);
  });

  // ---- SET GAME MODE ----
  socket.on('set-mode', (mode) => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;
    room.mode = mode; // 'classic' or 'versus'
    io.to(socket.roomCode).emit('mode-set', mode);
  });

  // ---- READY ----
  socket.on('player-ready', () => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;
    const p = room.players.find(x => x.id === socket.id);
    if (p) p.ready = true;

    if (room.players.length === 2 && room.players.every(x => x.ready)) {
      room.state = 'playing';

      if (room.mode === 'versus') {
        // Assign roles: player 0 = bunny, player 1 = chicken (round 1)
        room.players[0].role = 'bunny';
        room.players[1].role = 'chicken';
        room.roundData = {
          round: 1,
          maxRounds: 5,
          scores: [0, 0], // bunny wins per player
          roundTime: 60, // seconds per round
          // Shared map eggs
          mapW: 1200,
          mapH: 800,
          eggs: spawnEggs(1200, 800, 15),
          bunnyLives: 3,
          eggsCollected: 0,
          eggsToWin: 10,
        };

        io.to(socket.roomCode).emit('versus-start', {
          round: 1,
          maxRounds: 5,
          roundTime: 60,
          players: room.players.map(p => ({ name: p.name, role: p.role })),
          eggs: room.roundData.eggs,
          mapW: room.roundData.mapW,
          mapH: room.roundData.mapH,
          eggsToWin: room.roundData.eggsToWin,
        });
      } else {
        io.to(socket.roomCode).emit('game-start', {
          seed: Math.floor(Math.random() * 1000000),
          players: room.players.map(p => ({ name: p.name })),
        });
      }
    }
  });

  // ---- VERSUS: real-time position sync (30fps) ----
  socket.on('vs-move', (data) => {
    // data: { x, y, dir, shieldActive }
    socket.to(socket.roomCode).volatile.emit('vs-opponent-move', data);
  });

  // ---- VERSUS: bunny collected egg ----
  socket.on('vs-egg-collected', (eggId) => {
    const room = rooms.get(socket.roomCode);
    if (!room || !room.roundData) return;
    const egg = room.roundData.eggs.find(e => e.id === eggId);
    if (egg && egg.active) {
      egg.active = false;
      room.roundData.eggsCollected++;
      io.to(socket.roomCode).emit('vs-egg-gone', eggId);

      // Check win
      if (room.roundData.eggsCollected >= room.roundData.eggsToWin) {
        endVersusRound(room, 'bunny');
      }

      // Spawn replacement egg after delay
      setTimeout(() => {
        if (!room.roundData) return;
        const newEgg = {
          id: room.roundData.eggs.length,
          x: 60 + Math.random() * (room.roundData.mapW - 120),
          y: 60 + Math.random() * (room.roundData.mapH - 120),
          color: Math.floor(Math.random() * 10),
          active: true,
        };
        room.roundData.eggs.push(newEgg);
        io.to(room.code).emit('vs-egg-spawn', newEgg);
      }, 3000);
    }
  });

  // ---- VERSUS: chicken caught bunny ----
  socket.on('vs-bunny-hit', () => {
    const room = rooms.get(socket.roomCode);
    if (!room || !room.roundData) return;
    room.roundData.bunnyLives--;
    io.to(socket.roomCode).emit('vs-bunny-damage', room.roundData.bunnyLives);
    if (room.roundData.bunnyLives <= 0) {
      endVersusRound(room, 'chicken');
    }
  });

  // ---- VERSUS: chicken placed trap ----
  socket.on('vs-place-trap', (pos) => {
    socket.to(socket.roomCode).emit('vs-trap-placed', pos);
  });

  // ---- VERSUS: chicken summoned minions ----
  socket.on('vs-summon-minions', (pos) => {
    io.to(socket.roomCode).emit('vs-minions-spawned', pos);
  });

  // ---- VERSUS: bunny threw egg at chicken ----
  socket.on('vs-throw-egg', (data) => {
    socket.to(socket.roomCode).emit('vs-egg-thrown', data);
  });

  // ---- VERSUS: carrot collected (shield) ----
  socket.on('vs-carrot-collected', () => {
    io.to(socket.roomCode).emit('vs-shield-active');
  });

  // ---- VERSUS: round timer expired ----
  socket.on('vs-time-up', () => {
    const room = rooms.get(socket.roomCode);
    if (!room || !room.roundData) return;
    // If time runs out, chicken wins (bunny didn't collect enough)
    endVersusRound(room, 'chicken');
  });

  // ---- CLASSIC ----
  socket.on('game-update', (data) => { socket.to(socket.roomCode).emit('opponent-update', data); });
  socket.on('game-over', (data) => { socket.to(socket.roomCode).emit('opponent-game-over', data); });
  socket.on('leave-room', () => { handleLeave(socket); });
  socket.on('disconnect', () => { handleLeave(socket); });
});

function endVersusRound(room, winner) {
  if (!room.roundData) return;
  const rd = room.roundData;

  // Find which player index won
  const winnerIdx = room.players.findIndex(p => p.role === winner);
  if (winnerIdx >= 0) rd.scores[winnerIdx]++;

  const p0wins = rd.scores[0];
  const p1wins = rd.scores[1];
  const roundsPlayed = rd.round;
  const neededToWin = 3; // best of 5

  // Check if match is over
  if (p0wins >= neededToWin || p1wins >= neededToWin || roundsPlayed >= rd.maxRounds) {
    // Tiebreaker: if 2-2 after 4 rounds, round 5 is harder
    let matchWinner = p0wins > p1wins ? 0 : p1wins > p0wins ? 1 : -1;

    io.to(room.code).emit('vs-match-over', {
      scores: rd.scores,
      winner: matchWinner,
      players: room.players.map(p => p.name),
    });

    room.state = 'waiting';
    room.players.forEach(p => { p.ready = false; p.role = null; });
    room.roundData = null;
    return;
  }

  // Swap roles for next round
  room.players.forEach(p => {
    p.role = p.role === 'bunny' ? 'chicken' : 'bunny';
  });

  rd.round++;
  rd.eggsCollected = 0;
  rd.bunnyLives = 3;
  rd.eggs = spawnEggs(rd.mapW, rd.mapH, 15);

  // Tiebreaker round (round 5): harder for both
  const isTiebreaker = rd.round === 5 && rd.scores[0] === rd.scores[1];

  io.to(room.code).emit('vs-next-round', {
    round: rd.round,
    scores: rd.scores,
    players: room.players.map(p => ({ name: p.name, role: p.role })),
    eggs: rd.eggs,
    roundTime: isTiebreaker ? 45 : 60, // shorter tiebreaker
    eggsToWin: isTiebreaker ? 12 : 10, // more eggs needed in tiebreaker
    isTiebreaker,
  });
}

function handleLeave(socket) {
  const code = socket.roomCode;
  if (!code) return;
  const room = rooms.get(code);
  if (!room) return;
  room.players = room.players.filter(p => p.id !== socket.id);
  socket.leave(code);
  socket.roomCode = null;
  if (room.players.length === 0) {
    rooms.delete(code);
  } else {
    room.state = 'waiting';
    room.roundData = null;
    room.players.forEach(p => { p.ready = false; p.role = null; });
    io.to(code).emit('opponent-left');
  }
}

// ============================================================
//  ADMIN PANEL
// ============================================================
const ADMIN_KEY = process.env.ADMIN_KEY || 'zecadmin';

function adminAuth(req, res, next) {
  const key = req.query.key || req.headers['x-admin-key'];
  if (key !== ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// Serve admin HTML (no auth here — HTML handles login)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Overview / summary
app.get('/api/admin/overview', adminAuth, (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT
        COUNT(*)                                                AS totalGames,
        COUNT(DISTINCT LOWER(name))                            AS uniquePlayers,
        MAX(score)                                             AS highestScore,
        ROUND(AVG(score), 1)                                   AS avgScore,
        MAX(level)                                             AS highestLevel,
        SUM(CASE WHEN mode='solo'  THEN 1 ELSE 0 END)         AS soloGames,
        SUM(CASE WHEN mode='multi' THEN 1 ELSE 0 END)         AS multiGames
      FROM scores
    `).get();
    const today = db.prepare(`
      SELECT COUNT(*) AS todayGames
      FROM scores WHERE DATE(created_at) = DATE('now')
    `).get();
    res.json({
      ...stats, ...today,
      onlinePlayers: io.engine.clientsCount,
      activeRooms:   rooms.size,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Daily breakdown — last 14 days
app.get('/api/admin/daily', adminAuth, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT
        DATE(created_at)             AS day,
        COUNT(*)                     AS games,
        COUNT(DISTINCT LOWER(name))  AS players,
        MAX(score)                   AS topScore,
        ROUND(AVG(score), 0)         AS avgScore
      FROM scores
      WHERE created_at >= DATE('now', '-13 days')
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `).all();
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Recent games
app.get('/api/admin/recent', adminAuth, (req, res) => {
  const lim = Math.min(parseInt(req.query.limit) || 50, 200);
  try {
    res.json(db.prepare(`
      SELECT id, name, score, level, mode, created_at
      FROM scores ORDER BY created_at DESC LIMIT ?
    `).all(lim));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Top players (best score per player)
app.get('/api/admin/top', adminAuth, (req, res) => {
  const lim = Math.min(parseInt(req.query.limit) || 25, 100);
  try {
    res.json(db.prepare(`
      SELECT
        name,
        MAX(score)      AS bestScore,
        COUNT(*)        AS games,
        MAX(level)      AS bestLevel,
        MAX(created_at) AS lastPlayed
      FROM scores
      GROUP BY LOWER(name)
      ORDER BY bestScore DESC
      LIMIT ?
    `).all(lim));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Player search
app.get('/api/admin/player/:name', adminAuth, (req, res) => {
  const n = req.params.name;
  try {
    const playerStats = db.prepare(`
      SELECT
        COUNT(*)        AS totalGames,
        MAX(score)      AS bestScore,
        ROUND(AVG(score),1) AS avgScore,
        MAX(level)      AS bestLevel,
        MIN(created_at) AS firstGame,
        MAX(created_at) AS lastGame
      FROM scores WHERE LOWER(name) = LOWER(?)
    `).get(n);
    const games = db.prepare(`
      SELECT id, score, level, mode, created_at
      FROM scores WHERE LOWER(name) = LOWER(?)
      ORDER BY created_at DESC LIMIT 50
    `).all(n);
    res.json({ name: n, stats: playerStats, games });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Live room status
app.get('/api/admin/live', adminAuth, (req, res) => {
  const roomList = [];
  rooms.forEach((room, code) => {
    roomList.push({
      code,
      mode:    room.mode,
      state:   room.state,
      players: room.players.map(p => p.name),
    });
  });
  res.json({ onlinePlayers: io.engine.clientsCount, activeRooms: rooms.size, rooms: roomList });
});

// Delete a score entry (with confirmation)
app.delete('/api/admin/score/:id', adminAuth, (req, res) => {
  try {
    db.prepare('DELETE FROM scores WHERE id = ?').run(parseInt(req.params.id));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
const PORT = process.env.PORT || 3333;
server.listen(PORT, () => {
  console.log(`🐰 Bunny Egg Hunt server running on http://localhost:${PORT}`);
  console.log(`🔐 Admin panel: http://localhost:${PORT}/admin  (key: ${ADMIN_KEY})`);
});
