# Multiplayer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add online co-op and PvP multiplayer for up to 4 players using Socket.io over the existing Express server.

**Architecture:** Server-authoritative game loop running at 20 Hz. Clients send inputs each frame; server updates positions, HP, enemies, and bananas, then broadcasts state to all players. Solo mode is untouched.

**Tech Stack:** socket.io (server), socket.io-client (browser), existing Express + Three.js

---

## File Map

### New server-side files (`server/`)
- `server/room-manager.js` — in-memory room CRUD, player slots, cleanup
- `server/socket-handlers.js` — all Socket.io event handlers (lobby + game)
- `server/server-player.js` — ServerPlayer: position, movement, dash, attacks
- `server/server-enemy.js` — ServerEnemy: AI, movement, damage
- `server/server-game.js` — co-op ServerGame: tick loop, bananas, revive, shop
- `server/server-pvp.js` — PvPGame: rounds, timer, player-vs-player damage

### New client-side files (`src/`)
- `src/network.js` — Socket.io client wrapper, sends inputs, receives state
- `src/multiplayer-renderer.js` — syncs Three.js meshes to server state
- `src/multiplayer-hud.js` — portraits, shared pool, PvP score, spectator overlay

### Modified files
- `server.js` — attach Socket.io to http.createServer
- `package.json` — add socket.io + socket.io-client
- `src/menu.js` — enable Multiplayer button, add multiplayer/lobby screens
- `src/main.js` — add startMultiplayer(), multiplayer branch in render loop

---

## Task 1: Install Socket.io

**Files:**
- Modify: `package.json`

- [ ] **Install packages**

```bash
cd "/mnt/c/Users/ianst/code/monkey-mash"
npm install socket.io socket.io-client
```

- [ ] **Verify**

```bash
node -e "import('socket.io').then(m => console.log('ok', Object.keys(m)))"
```
Expected output: `ok [ 'Server', ... ]`

- [ ] **Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install socket.io and socket.io-client"
```

---

## Task 2: Attach Socket.io to Express Server

**Files:**
- Modify: `server.js`

- [ ] **Replace `app.listen` with `http.createServer` + Socket.io**

Open `server.js`. Replace the bottom section:

```js
// REMOVE this line:
app.listen(PORT, () => { ... });
```

Add these imports at the top of `server.js` (after existing imports):
```js
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
```

Replace `app.listen(...)` at the bottom with:
```js
const httpServer = createServer(app);
export const io = new SocketServer(httpServer, {
  transports: ['websocket', 'polling'],
});

import('./server/socket-handlers.js').then(({ handleSocket }) => {
  io.on('connection', socket => handleSocket(io, socket));
});

httpServer.listen(PORT, () => {
  console.log(`🐒 Monkey Mash running at http://localhost:${PORT}`);
  console.log(`   Password: ${GAME_PASSWORD}`);
});
```

- [ ] **Test server starts**

```bash
npm start
```
Expected: `🐒 Monkey Mash running at http://localhost:3000`

- [ ] **Commit**

```bash
git add server.js
git commit -m "feat: attach Socket.io to Express http server"
```

---

## Task 3: Room Manager

**Files:**
- Create: `server/room-manager.js`

- [ ] **Create the file**

```js
// server/room-manager.js
const rooms = new Map();
const matchmakingQueue = []; // [{ socketId, playerData }]

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function createRoom(hostSocketId, playerData, isPrivate = true) {
  let id = generateCode();
  while (rooms.has(id)) id = generateCode();
  const room = {
    id,
    isPrivate,
    mode: 'coop',
    difficulty: 'normal',
    phase: 'lobby',
    players: [{
      socketId: hostSocketId,
      isHost: true,
      ready: false,
      ...playerData,
    }],
    game: null,
    _cleanupTimer: null,
  };
  rooms.set(id, room);
  return room;
}

export function getRoom(id) {
  return rooms.get(id) || null;
}

export function getRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    if (room.players.some(p => p.socketId === socketId)) return room;
  }
  return null;
}

export function addPlayerToRoom(room, socketId, playerData) {
  if (room.players.length >= 4) return false;
  room.players.push({ socketId, isHost: false, ready: false, ...playerData });
  clearTimeout(room._cleanupTimer);
  room._cleanupTimer = null;
  return true;
}

export function removePlayerFromRoom(socketId) {
  const room = getRoomBySocket(socketId);
  if (!room) return null;
  room.players = room.players.filter(p => p.socketId !== socketId);
  if (room.players.length === 0) {
    scheduleCleanup(room);
  } else if (!room.players.some(p => p.isHost)) {
    room.players[0].isHost = true; // promote next player
  }
  return room;
}

export function scheduleCleanup(room) {
  room._cleanupTimer = setTimeout(() => rooms.delete(room.id), 30_000);
}

export function addToQueue(socketId, playerData) {
  matchmakingQueue.push({ socketId, playerData });
}

export function removeFromQueue(socketId) {
  const idx = matchmakingQueue.findIndex(e => e.socketId === socketId);
  if (idx !== -1) matchmakingQueue.splice(idx, 1);
}

export function tryMatchmake() {
  if (matchmakingQueue.length < 2) return null;
  const [a, b] = matchmakingQueue.splice(0, 2);
  const room = createRoom(a.socketId, a.playerData, false);
  addPlayerToRoom(room, b.socketId, b.playerData);
  return room;
}
```

- [ ] **Verify syntax**

```bash
node --input-type=module < server/room-manager.js
```
Expected: no output (no errors)

- [ ] **Commit**

```bash
git add server/room-manager.js
git commit -m "feat: add in-memory room manager"
```

---

## Task 4: Socket Handlers (Lobby)

**Files:**
- Create: `server/socket-handlers.js`

- [ ] **Create the file**

```js
// server/socket-handlers.js
import {
  createRoom, getRoom, getRoomBySocket, addPlayerToRoom,
  removePlayerFromRoom, addToQueue, removeFromQueue, tryMatchmake,
} from './room-manager.js';

function lobbyState(room) {
  return {
    id: room.id,
    mode: room.mode,
    difficulty: room.difficulty,
    players: room.players.map(p => ({
      socketId: p.socketId,
      name: p.name,
      playerClass: p.playerClass,
      colour: p.colour,
      hat: p.hat,
      ready: p.ready,
      isHost: p.isHost,
    })),
  };
}

function broadcastLobby(io, room) {
  io.to(room.id).emit('lobby-update', lobbyState(room));
}

export function handleSocket(io, socket) {
  // ── Lobby events ──────────────────────────────────────────────

  socket.on('create-room', (playerData) => {
    const room = createRoom(socket.id, playerData, true);
    socket.join(room.id);
    socket.emit('room-joined', { code: room.id });
    broadcastLobby(io, room);
  });

  socket.on('join-room', ({ code, ...playerData }) => {
    const room = getRoom(code.toUpperCase());
    if (!room) { socket.emit('join-error', 'Room not found'); return; }
    if (room.phase !== 'lobby') { socket.emit('join-error', 'Game already started'); return; }
    if (!addPlayerToRoom(room, socket.id, playerData)) {
      socket.emit('join-error', 'Room is full'); return;
    }
    socket.join(room.id);
    socket.emit('room-joined', { code: room.id });
    broadcastLobby(io, room);
  });

  socket.on('quick-play', (playerData) => {
    addToQueue(socket.id, playerData);
    const room = tryMatchmake();
    if (room) {
      for (const p of room.players) {
        const s = io.sockets.sockets.get(p.socketId);
        if (s) s.join(room.id);
      }
      io.to(room.id).emit('room-joined', { code: room.id });
      broadcastLobby(io, room);
    } else {
      socket.emit('queue-waiting');
    }
  });

  socket.on('set-ready', ({ ready }) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (player) player.ready = ready;
    broadcastLobby(io, room);
  });

  socket.on('update-customisation', ({ playerClass, colour, hat, name }) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (player) {
      if (playerClass) player.playerClass = playerClass;
      if (colour !== undefined) player.colour = colour;
      if (hat) player.hat = hat;
      if (name) player.name = name;
    }
    broadcastLobby(io, room);
  });

  socket.on('set-mode', ({ mode }) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player?.isHost) return;
    room.mode = mode;
    broadcastLobby(io, room);
  });

  socket.on('set-difficulty', ({ difficulty }) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player?.isHost) return;
    room.difficulty = difficulty;
    broadcastLobby(io, room);
  });

  socket.on('start-game', async () => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player?.isHost) return;
    if (room.players.length < 2) return;

    room.phase = 'game';
    io.to(room.id).emit('game-starting', { mode: room.mode, difficulty: room.difficulty });

    if (room.mode === 'coop') {
      const { ServerGame } = await import('./server-game.js');
      room.game = new ServerGame(io, room);
      room.game.start();
    } else {
      const { PvPGame } = await import('./server-pvp.js');
      room.game = new PvPGame(io, room);
      room.game.start();
    }
  });

  // ── In-game events ────────────────────────────────────────────

  socket.on('player-input', (input) => {
    const room = getRoomBySocket(socket.id);
    if (!room?.game) return;
    room.game.applyInput(socket.id, input);
  });

  socket.on('revive-start', () => {
    const room = getRoomBySocket(socket.id);
    if (!room?.game?.startRevive) return;
    room.game.startRevive(socket.id);
  });

  socket.on('buy-upgrade', ({ upgradeId }) => {
    const room = getRoomBySocket(socket.id);
    if (!room?.game?.buyUpgrade) return;
    room.game.buyUpgrade(socket.id, upgradeId);
  });

  socket.on('pvp-upgrade-chosen', ({ upgradeId }) => {
    const room = getRoomBySocket(socket.id);
    if (!room?.game?.chooseUpgrade) return;
    room.game.chooseUpgrade(socket.id, upgradeId);
  });

  // ── Disconnect ────────────────────────────────────────────────

  socket.on('disconnect', () => {
    removeFromQueue(socket.id);
    const room = removePlayerFromRoom(socket.id);
    if (!room) return;
    if (room.game) room.game.removePlayer(socket.id);
    if (room.players.length > 0) {
      broadcastLobby(io, room);
      io.to(room.id).emit('player-leave', { socketId: socket.id });
    }
  });
}
```

- [ ] **Test: open two browser tabs, check connection**

```bash
npm start
```
Open `http://localhost:3000` in two tabs, open browser console on each, check for WebSocket connection in the Network tab.

- [ ] **Commit**

```bash
git add server/socket-handlers.js
git commit -m "feat: add lobby socket handlers"
```

---

## Task 5: ServerPlayer

**Files:**
- Create: `server/server-player.js`

- [ ] **Create the file**

```js
// server/server-player.js
const SPEED      = 7;
const DASH_SPEED = 22;
const DASH_DUR   = 0.18;
const DASH_CD    = 1.0;
const IFRAMES    = 0.8;
const ARENA_HW   = 10.5; // half-width of room (22 / 2 - 0.5)
const ARENA_HD   = 8.5;  // half-depth (18 / 2 - 0.5)

export class ServerPlayer {
  constructor(socketId, playerData, spawnX = 0, spawnZ = 0) {
    this.socketId    = socketId;
    this.playerClass = playerData.playerClass || 'brawler';
    this.colour      = playerData.colour ?? 0x7B3F00;
    this.hat         = playerData.hat || 'none';
    this.name        = playerData.name || 'Player';

    this.x = spawnX; this.z = spawnZ;
    this.vx = 0;     this.vz = 0;
    this.aimAngle = 0;

    this.hp    = 100; this.maxHp = 100;
    this.isAlive = true;
    this.isDown  = false; // co-op: downed, can be revived
    this.iframes = 0;

    this.dashTimer = 0;
    this.dashCd    = 0;

    // Attack state
    this.atkCd      = 0;
    this.comboStep  = 0;
    this.comboReset = 0;
    this.rageCd     = 0;
    this.rageActive = false;
    this.rageTimer  = 0;

    // Upgrades & stats
    this.purchasedUpgradeIds = [];
    this.damageMult   = 1.0;
    this.speedMult    = 1.0;
    this.atkCdMult    = 1.0;
    this.dashCdMult   = 1.0;
    this.bonusMaxHp   = 0;

    // Co-op revive
    this.reviveProgress = 0;
    this.reviverId      = null;
  }

  applyInput(input, dt) {
    if (!this.isAlive || this.isDown) return;

    this.aimAngle = input.mouseAngle ?? this.aimAngle;

    // Dash
    if (input.space && this.dashCd <= 0 && this.dashTimer <= 0) {
      const keys = input.keys || [];
      let dx = 0, dz = 0;
      if (keys.includes('KeyW')) dz -= 1;
      if (keys.includes('KeyS')) dz += 1;
      if (keys.includes('KeyA')) dx -= 1;
      if (keys.includes('KeyD')) dx += 1;
      if (dx === 0 && dz === 0) {
        dx = Math.sin(this.aimAngle);
        dz = Math.cos(this.aimAngle);
      }
      const len = Math.sqrt(dx*dx + dz*dz) || 1;
      this.vx = (dx/len) * DASH_SPEED;
      this.vz = (dz/len) * DASH_SPEED;
      this.dashTimer = DASH_DUR;
      this.iframes   = DASH_DUR + 0.1;
    }

    // Movement
    if (this.dashTimer <= 0) {
      const keys = input.keys || [];
      let mx = 0, mz = 0;
      if (keys.includes('KeyW')) mz -= 1;
      if (keys.includes('KeyS')) mz += 1;
      if (keys.includes('KeyA')) mx -= 1;
      if (keys.includes('KeyD')) mx += 1;
      const len = Math.sqrt(mx*mx + mz*mz);
      const spd = SPEED * this.speedMult;
      if (len > 0) { this.vx = (mx/len)*spd; this.vz = (mz/len)*spd; }
      else { this.vx *= 0.1; this.vz *= 0.1; }
    }

    // Attack (returns true if attack fired)
    this._pendingAttack = input.lmb && this.atkCd <= 0;
    this._pendingSpecial = input.shift;
  }

  update(dt) {
    if (!this.isAlive) return;

    if (this.dashTimer > 0) { this.dashTimer -= dt; if (this.dashTimer <= 0) this.dashCd = DASH_CD * this.dashCdMult; }
    if (this.dashCd    > 0) this.dashCd    -= dt;
    if (this.iframes   > 0) this.iframes   -= dt;
    if (this.atkCd     > 0) this.atkCd     -= dt;
    if (this.rageCd    > 0) this.rageCd    -= dt;
    if (this.comboReset > 0) { this.comboReset -= dt; if (this.comboReset <= 0) this.comboStep = 0; }
    if (this.rageActive) { this.rageTimer -= dt; if (this.rageTimer <= 0) this.rageActive = false; }

    if (this.dashTimer > 0) { this.vx *= Math.pow(0.3, dt); this.vz *= Math.pow(0.3, dt); }

    this.x += this.vx * dt;
    this.z += this.vz * dt;

    // Clamp to arena
    this.x = Math.max(-ARENA_HW, Math.min(ARENA_HW, this.x));
    this.z = Math.max(-ARENA_HD, Math.min(ARENA_HD, this.z));
  }

  takeDamage(amount) {
    if (this.iframes > 0 || !this.isAlive || this.isDown) return 0;
    const dmg = this.rageActive ? amount * 0.8 : amount;
    this.hp = Math.max(0, this.hp - dmg);
    this.iframes = IFRAMES;
    if (this.hp <= 0) this.isAlive = false;
    return dmg;
  }

  fireComboAttack() {
    if (this.atkCd > 0 || !this.isAlive) return null;
    const COMBO_DMG  = [18, 28, 45];
    const COMBO_RNG  = [1.8, 1.8, 2.1];
    const COMBO_CD   = [0.30, 0.35, 0.55];
    const step = this.comboStep;
    const dmg  = COMBO_DMG[step] * this.damageMult * (this.rageActive ? 1.25 : 1);
    const range = COMBO_RNG[step];
    const cd    = COMBO_CD[step] * this.atkCdMult * (this.rageActive ? 0.7 : 1);
    this.atkCd      = cd;
    this.comboReset = 1.5;
    this.comboStep  = (this.comboStep + 1) % 3;
    return { dmg, range, aimAngle: this.aimAngle, arc: Math.PI * 0.65 };
  }

  useSpecial() {
    if (this.playerClass !== 'brawler' || this.rageCd > 0) return false;
    this.rageActive = true;
    this.rageTimer  = 3.0;
    this.rageCd     = 10.0;
    return true;
  }

  toState() {
    return {
      socketId:    this.socketId,
      playerClass: this.playerClass,
      colour:      this.colour,
      hat:         this.hat,
      name:        this.name,
      x: this.x, z: this.z,
      hp: this.hp, maxHp: this.maxHp + this.bonusMaxHp,
      isAlive:     this.isAlive,
      isDown:      this.isDown,
      dashing:     this.dashTimer > 0,
      rageActive:  this.rageActive,
      comboStep:   this.comboStep,
      aimAngle:    this.aimAngle,
      reviveProgress: this.reviveProgress,
    };
  }
}
```

- [ ] **Commit**

```bash
git add server/server-player.js
git commit -m "feat: add ServerPlayer with movement, dash, attack state"
```

---

## Task 6: ServerEnemy

**Files:**
- Create: `server/server-enemy.js`

- [ ] **Create the file**

```js
// server/server-enemy.js
let _nextId = 1;

const ENEMY_DEFS = {
  grunt:   { hp: 60,  speed: 2.0, damage: 10, hitRadius: 0.55, attackCd: 1.2 },
  bandit:  { hp: 45,  speed: 2.8, damage: 8,  hitRadius: 0.5,  attackCd: 1.0 },
  bomber:  { hp: 80,  speed: 1.6, damage: 18, hitRadius: 0.6,  attackCd: 2.0 },
  howler:  { hp: 100, speed: 1.8, damage: 12, hitRadius: 0.6,  attackCd: 1.5 },
};

export class ServerEnemy {
  constructor(type, x, z, hpMult = 1) {
    this.id   = _nextId++;
    this.type = type;
    this.x = x; this.z = z;
    this.vx = 0; this.vz = 0;
    const def = ENEMY_DEFS[type] || ENEMY_DEFS.grunt;
    this.hp       = Math.floor(def.hp * hpMult);
    this.maxHp    = this.hp;
    this.speed    = def.speed;
    this.damage   = def.damage;
    this.hitRadius = def.hitRadius;
    this._attackCd = 0;
    this.isDead   = false;
  }

  update(dt, players) {
    if (this.isDead) return;
    if (this._attackCd > 0) this._attackCd -= dt;

    // Find nearest alive player
    let target = null, nearestD = Infinity;
    for (const p of players) {
      if (!p.isAlive || p.isDown) continue;
      const dx = p.x - this.x, dz = p.z - this.z;
      const d = Math.sqrt(dx*dx + dz*dz);
      if (d < nearestD) { nearestD = d; target = p; }
    }
    if (!target) return;

    const dx = target.x - this.x, dz = target.z - this.z;
    const d  = Math.sqrt(dx*dx + dz*dz) || 1;

    if (d > this.hitRadius + 0.5) {
      // Chase
      this.vx = (dx/d) * this.speed;
      this.vz = (dz/d) * this.speed;
    } else {
      this.vx = 0; this.vz = 0;
      // Attack
      if (this._attackCd <= 0) {
        this._attackCd = 1.2;
        target.takeDamage(this.damage);
      }
    }

    this.x += this.vx * dt;
    this.z += this.vz * dt;
  }

  takeDamage(amount) {
    if (this.isDead) return;
    this.hp -= amount;
    if (this.hp <= 0) { this.hp = 0; this.isDead = true; }
  }

  toState() {
    return { id: this.id, type: this.type, x: this.x, z: this.z, hp: this.hp, maxHp: this.maxHp };
  }
}

export function spawnWave(roomNumber, playerCount, difficulty) {
  const hpMults = { easy: 0.65, normal: 1.0, hard: 1.45 };
  const hpMult  = (hpMults[difficulty] ?? 1.0) * (1 + (roomNumber - 1) * 0.25) * (1 + (playerCount - 1) * 0.3);
  const count   = Math.min(3 + roomNumber + playerCount, 12);
  const types   = ['grunt', 'bandit', 'bomber', 'howler'];
  const enemies = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const r     = 6 + Math.random() * 3;
    const type  = types[Math.min(Math.floor(roomNumber / 3), types.length - 1)];
    enemies.push(new ServerEnemy(type, Math.cos(angle) * r, Math.sin(angle) * r, hpMult));
  }
  return enemies;
}
```

- [ ] **Commit**

```bash
git add server/server-enemy.js
git commit -m "feat: add ServerEnemy with AI chase and attack"
```

---

## Task 7: Co-op ServerGame

**Files:**
- Create: `server/server-game.js`

- [ ] **Create the file**

```js
// server/server-game.js
import { ServerPlayer } from './server-player.js';
import { ServerEnemy, spawnWave } from './server-enemy.js';
import { UPGRADES } from '../src/upgrades.js';

const TICK_RATE = 20; // Hz
const TICK_MS   = 1000 / TICK_RATE;
const VACUUM_DURATION   = 1.4;
const TRANSITION_DURATION = 0.5;

export class ServerGame {
  constructor(io, room) {
    this.io   = io;
    this.room = room;
    this.players = {}; // socketId -> ServerPlayer

    const spawns = [[-2,0],[2,0],[-2,2],[2,2]];
    room.players.forEach((pd, i) => {
      const [sx, sz] = spawns[i] || [0, 0];
      this.players[pd.socketId] = new ServerPlayer(pd.socketId, pd, sx, sz);
    });

    this.enemies      = [];
    this.bananas      = []; // [{ id, x, z, collected }]
    this.sharedPool   = 0;
    this.roomNumber   = 1;
    this.phase        = 'fight'; // fight | vacuum | shop | transition
    this._vacuumTimer = 0;
    this._transTimer  = 0;
    this._tickInterval = null;
    this._bananaId    = 1;
    this._inputs      = {}; // socketId -> latest input
  }

  start() {
    this._spawnWave();
    this._tickInterval = setInterval(() => this._tick(), TICK_MS);
  }

  applyInput(socketId, input) {
    this._inputs[socketId] = input;
  }

  removePlayer(socketId) {
    delete this.players[socketId];
    delete this._inputs[socketId];
    if (Object.keys(this.players).length === 0) this._stop();
  }

  buyUpgrade(socketId, upgradeId) {
    if (this.phase !== 'shop') return;
    const upg = UPGRADES.find(u => u.id === upgradeId);
    if (!upg) return;
    if (this.sharedPool < upg.cost) return;
    this.sharedPool -= upg.cost;
    // Tell the buying client to apply the upgrade locally
    this.io.to(socketId).emit('upgrade-applied', { upgradeId, sharedPool: this.sharedPool });
    // Tell everyone else the pool changed
    this.io.to(this.room.id).emit('pool-update', { sharedPool: this.sharedPool });
  }

  startRevive(reviverId) {
    const rp = this.players[reviverId];
    if (!rp?.isAlive) return;
    for (const p of Object.values(this.players)) {
      if (!p.isDown) continue;
      const dx = p.x - rp.x, dz = p.z - rp.z;
      if (Math.sqrt(dx*dx + dz*dz) < 1.2) {
        p.reviverId = reviverId;
        break;
      }
    }
  }

  _tick() {
    const dt = TICK_MS / 1000;

    if (this.phase === 'fight') {
      // Apply inputs + update players
      for (const [sid, player] of Object.entries(this.players)) {
        const input = this._inputs[sid] || { keys: [] };
        player.applyInput(input, dt);
        player.update(dt);

        // Attack
        if (player._pendingAttack) {
          const atk = player.fireComboAttack();
          if (atk) this._resolveAttack(player, atk);
        }
        if (player._pendingSpecial) player.useSpecial();
      }

      // Revive tick
      this._tickRevive(dt);

      // Update enemies
      const alivePlayers = Object.values(this.players).filter(p => p.isAlive && !p.isDown);
      for (const e of this.enemies) e.update(dt, alivePlayers);

      // Check banana collection
      for (const b of this.bananas) {
        if (b.collected) continue;
        for (const p of Object.values(this.players)) {
          if (!p.isAlive || p.isDown) continue;
          const dx = p.x - b.x, dz = p.z - b.z;
          if (dx*dx + dz*dz < 0.81) { b.collected = true; this.sharedPool++; break; }
        }
      }

      // Check wave clear
      if (this.enemies.every(e => e.isDead)) {
        this._dropBananas();
        this.phase = 'vacuum';
        this._vacuumTimer = VACUUM_DURATION;
      }

      // Check all players dead
      if (Object.values(this.players).every(p => !p.isAlive)) {
        this.io.to(this.room.id).emit('game-over', { roomNumber: this.roomNumber });
        this._stop();
        return;
      }
    }

    if (this.phase === 'vacuum') {
      this._vacuumTimer -= dt;
      if (this._vacuumTimer <= 0) {
        this.phase = 'shop';
        this.io.to(this.room.id).emit('open-shop', { sharedPool: this.sharedPool });
      }
    }

    if (this.phase === 'transition') {
      this._transTimer -= dt;
      if (this._transTimer <= 0) {
        this.roomNumber++;
        this._spawnWave();
        this.phase = 'fight';
      }
    }

    this._broadcast();
  }

  advanceFromShop() {
    this.phase = 'transition';
    this._transTimer = TRANSITION_DURATION;
    this.bananas = [];
  }

  _resolveAttack(player, atk) {
    const { dmg, range, aimAngle, arc } = atk;
    for (const e of this.enemies) {
      if (e.isDead) continue;
      const dx = e.x - player.x, dz = e.z - player.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      if (dist > range + e.hitRadius) continue;
      let diff = Math.atan2(dx, dz) - aimAngle;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > arc / 2) continue;
      e.takeDamage(dmg);
      this.io.to(this.room.id).emit('enemy-hit', { id: e.id, dmg: Math.round(dmg) });
    }
  }

  _tickRevive(dt) {
    for (const p of Object.values(this.players)) {
      if (!p.isDown || !p.reviverId) { p.reviveProgress = 0; continue; }
      const rp = this.players[p.reviverId];
      if (!rp?.isAlive) { p.reviverId = null; p.reviveProgress = 0; continue; }
      const dx = rp.x - p.x, dz = rp.z - p.z;
      if (Math.sqrt(dx*dx + dz*dz) > 1.2) { p.reviverId = null; p.reviveProgress = 0; continue; }
      p.reviveProgress += dt / 3.0; // 3 seconds to revive
      if (p.reviveProgress >= 1.0) {
        p.isDown  = false;
        p.isAlive = true;
        p.hp      = Math.floor((p.maxHp + p.bonusMaxHp) * 0.4);
        p.reviveProgress = 0;
        p.reviverId = null;
        p.iframes = 1.0;
        this.io.to(this.room.id).emit('revive-complete', { socketId: p.socketId });
      }
    }
  }

  _dropBananas() {
    const count = 3 + this.roomNumber;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      this.bananas.push({ id: this._bananaId++, x: Math.cos(angle)*3, z: Math.sin(angle)*3, collected: false });
    }
  }

  _spawnWave() {
    this.enemies = spawnWave(this.roomNumber, Object.keys(this.players).length, this.room.difficulty);
    this.bananas = [];
  }

  _broadcast() {
    this.io.to(this.room.id).emit('game-state', {
      players:    Object.values(this.players).map(p => p.toState()),
      enemies:    this.enemies.map(e => e.toState()),
      bananas:    this.bananas,
      sharedPool: this.sharedPool,
      phase:      this.phase,
    });
  }

  _stop() {
    clearInterval(this._tickInterval);
    this._tickInterval = null;
    this.room.phase = 'lobby';
    this.room.game  = null;
  }
}
```

- [ ] **Commit**

```bash
git add server/server-game.js
git commit -m "feat: add co-op ServerGame with tick loop, revive, shop"
```

---

## Task 8: PvP ServerGame

**Files:**
- Create: `server/server-pvp.js`

- [ ] **Create the file**

```js
// server/server-pvp.js
import { ServerPlayer } from './server-player.js';
import { UPGRADES }     from '../src/upgrades.js';

const TICK_MS       = 1000 / 20;
const ROUND_TIME    = 90;
const WINS_TO_MATCH = 3;
const RESULT_PAUSE  = 3;

const SPAWNS_2 = [[-4, 0], [4, 0]];
const SPAWNS_4 = [[-4, -3], [4, -3], [-4, 3], [4, 3]];

export class PvPGame {
  constructor(io, room) {
    this.io   = io;
    this.room = room;
    this.players   = {};
    this.scores    = {}; // socketId -> wins
    this.round     = 0;
    this.phase     = 'round'; // round | result | upgrade | match-over
    this._roundTimer   = ROUND_TIME;
    this._resultTimer  = 0;
    this._tickInterval = null;
    this._inputs       = {};
    this._pendingUpgradeChoices = {}; // socketId -> chosen

    room.players.forEach(pd => {
      this.scores[pd.socketId] = 0;
    });
  }

  start() {
    this._startRound();
    this._tickInterval = setInterval(() => this._tick(), TICK_MS);
  }

  applyInput(socketId, input) { this._inputs[socketId] = input; }

  removePlayer(socketId) {
    delete this.players[socketId];
    delete this._inputs[socketId];
    if (Object.keys(this.players).length <= 1) this._stop();
  }

  chooseUpgrade(socketId, upgradeId) {
    if (this.phase !== 'upgrade') return;
    const upg = UPGRADES.find(u => u.id === upgradeId);
    if (!upg) return;
    this._pendingUpgradeChoices[socketId] = upgradeId;
    this.io.to(socketId).emit('upgrade-applied', { upgradeId, sharedPool: 0 });
    // Check if winner has chosen
    const winnerSid = this._lastRoundWinner;
    if (winnerSid && this._pendingUpgradeChoices[winnerSid]) {
      this._startRound();
    }
  }

  _startRound() {
    this.round++;
    this.phase = 'round';
    this._roundTimer = ROUND_TIME;
    this._pendingUpgradeChoices = {};
    this._lastRoundWinner = null;

    const spawns = this.room.players.length <= 2 ? SPAWNS_2 : SPAWNS_4;
    this.players = {};
    this.room.players.forEach((pd, i) => {
      const [sx, sz] = spawns[i] || [0, 0];
      const p = new ServerPlayer(pd.socketId, pd, sx, sz);
      this.players[pd.socketId] = p;
    });

    // Spawn pickups
    this._pickups = [];
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      this._pickups.push({ id: i, type: 'banana', x: Math.cos(angle)*4, z: Math.sin(angle)*4, collected: false });
    }

    this.io.to(this.room.id).emit('round-start', { round: this.round, scores: this.scores });
  }

  _tick() {
    const dt = TICK_MS / 1000;

    if (this.phase === 'round') {
      this._roundTimer -= dt;

      for (const [sid, player] of Object.entries(this.players)) {
        const input = this._inputs[sid] || { keys: [] };
        player.applyInput(input, dt);
        player.update(dt);

        // PvP attack — hits other players
        if (player._pendingAttack) {
          const atk = player.fireComboAttack();
          if (atk) this._resolvePvPAttack(player, atk);
        }
        if (player._pendingSpecial) player.useSpecial();
      }

      // Check pickups
      for (const pk of this._pickups) {
        if (pk.collected) continue;
        for (const p of Object.values(this.players)) {
          if (!p.isAlive) continue;
          const dx = p.x - pk.x, dz = p.z - pk.z;
          if (dx*dx + dz*dz < 0.81) {
            pk.collected = true;
            if (pk.type === 'banana') {/* cosmetic */}
            break;
          }
        }
      }

      // Check round end conditions
      const alive = Object.values(this.players).filter(p => p.isAlive);
      const timedOut = this._roundTimer <= 0;

      if (alive.length <= 1 || timedOut) {
        let winner = alive[0] || null;
        if (timedOut && alive.length > 1) {
          winner = alive.reduce((best, p) => (!best || p.hp > best.hp) ? p : best, null);
        }
        this._endRound(winner?.socketId || null);
      }
    }

    if (this.phase === 'result') {
      this._resultTimer -= dt;
      if (this._resultTimer <= 0) {
        // Check match winner
        const matchWinner = Object.entries(this.scores).find(([,w]) => w >= WINS_TO_MATCH);
        if (matchWinner) {
          this.phase = 'match-over';
          this.io.to(this.room.id).emit('match-end', { winnerId: matchWinner[0], scores: this.scores });
          this._stop();
          return;
        }
        // Open upgrade for round winner
        if (this._lastRoundWinner) {
          this.phase = 'upgrade';
          this.io.to(this._lastRoundWinner).emit('open-pvp-upgrade');
          this.io.to(this.room.id).except(this._lastRoundWinner).emit('waiting-for-upgrade', { scores: this.scores });
        } else {
          this._startRound(); // draw — no upgrade
        }
      }
    }

    this._broadcast();
  }

  _endRound(winnerSocketId) {
    this.phase = 'result';
    this._resultTimer = RESULT_PAUSE;
    this._lastRoundWinner = winnerSocketId;
    if (winnerSocketId) this.scores[winnerSocketId] = (this.scores[winnerSocketId] || 0) + 1;
    this.io.to(this.room.id).emit('round-end', { winnerId: winnerSocketId, scores: this.scores });
  }

  _resolvePvPAttack(attacker, atk) {
    const { dmg, range, aimAngle, arc } = atk;
    for (const target of Object.values(this.players)) {
      if (target.socketId === attacker.socketId || !target.isAlive) continue;
      const dx = target.x - attacker.x, dz = target.z - attacker.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      if (dist > range + 0.5) continue;
      let diff = Math.atan2(dx, dz) - aimAngle;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > arc / 2) continue;
      const dealt = target.takeDamage(dmg);
      if (dealt > 0) this.io.to(this.room.id).emit('enemy-hit', { id: target.socketId, dmg: Math.round(dealt) });
    }
  }

  _broadcast() {
    this.io.to(this.room.id).emit('game-state', {
      players:  Object.values(this.players).map(p => p.toState()),
      enemies:  [],
      bananas:  this._pickups || [],
      phase:    this.phase,
      roundTimer: Math.max(0, Math.ceil(this._roundTimer)),
      scores:   this.scores,
    });
  }

  _stop() {
    clearInterval(this._tickInterval);
    this._tickInterval = null;
    this.room.phase = 'lobby';
    this.room.game  = null;
  }
}
```

- [ ] **Commit**

```bash
git add server/server-pvp.js
git commit -m "feat: add PvP ServerGame with rounds, scoring, upgrade flow"
```

---

## Task 9: Client Network Module

**Files:**
- Create: `src/network.js`

- [ ] **Create the file**

```js
// src/network.js
import { io } from 'socket.io-client';

export class NetworkManager {
  constructor() {
    this.socket     = io();
    this.mySocketId = null;
    this.gameState  = null;
    this.roomCode   = null;

    // Callbacks set by caller
    this.onLobbyUpdate    = null;
    this.onRoomJoined     = null;
    this.onJoinError      = null;
    this.onQueueWaiting   = null;
    this.onGameStarting   = null;
    this.onGameState      = null;
    this.onOpenShop       = null;
    this.onUpgradeApplied = null;
    this.onPoolUpdate     = null;
    this.onReviveComplete = null;
    this.onEnemyHit       = null;
    this.onGameOver       = null;
    this.onRoundStart     = null;
    this.onRoundEnd       = null;
    this.onOpenPvpUpgrade = null;
    this.onWaitingUpgrade = null;
    this.onMatchEnd       = null;

    this.socket.on('connect', () => { this.mySocketId = this.socket.id; });
    this.socket.on('lobby-update',    d => this.onLobbyUpdate?.(d));
    this.socket.on('room-joined',     d => { this.roomCode = d.code; this.onRoomJoined?.(d); });
    this.socket.on('join-error',      d => this.onJoinError?.(d));
    this.socket.on('queue-waiting',   () => this.onQueueWaiting?.());
    this.socket.on('game-starting',   d => this.onGameStarting?.(d));
    this.socket.on('game-state',      d => { this.gameState = d; this.onGameState?.(d); });
    this.socket.on('open-shop',       d => this.onOpenShop?.(d));
    this.socket.on('upgrade-applied', d => this.onUpgradeApplied?.(d));
    this.socket.on('pool-update',     d => this.onPoolUpdate?.(d));
    this.socket.on('revive-complete', d => this.onReviveComplete?.(d));
    this.socket.on('enemy-hit',       d => this.onEnemyHit?.(d));
    this.socket.on('game-over',       d => this.onGameOver?.(d));
    this.socket.on('round-start',     d => this.onRoundStart?.(d));
    this.socket.on('round-end',       d => this.onRoundEnd?.(d));
    this.socket.on('open-pvp-upgrade',() => this.onOpenPvpUpgrade?.());
    this.socket.on('waiting-for-upgrade', d => this.onWaitingUpgrade?.(d));
    this.socket.on('match-end',       d => this.onMatchEnd?.(d));
  }

  // Lobby
  createRoom(playerData)          { this.socket.emit('create-room', playerData); }
  joinRoom(code, playerData)      { this.socket.emit('join-room', { code, ...playerData }); }
  quickPlay(playerData)           { this.socket.emit('quick-play', playerData); }
  setReady(ready)                 { this.socket.emit('set-ready', { ready }); }
  updateCustomisation(data)       { this.socket.emit('update-customisation', data); }
  setMode(mode)                   { this.socket.emit('set-mode', { mode }); }
  setDifficulty(difficulty)       { this.socket.emit('set-difficulty', { difficulty }); }
  startGame()                     { this.socket.emit('start-game'); }

  // In-game
  sendInput(input)                { this.socket.emit('player-input', input); }
  sendReviveStart()               { this.socket.emit('revive-start'); }
  buyUpgrade(upgradeId)           { this.socket.emit('buy-upgrade', { upgradeId }); }
  choosePvpUpgrade(upgradeId)     { this.socket.emit('pvp-upgrade-chosen', { upgradeId }); }

  destroy() { this.socket.disconnect(); }
}
```

- [ ] **Commit**

```bash
git add src/network.js
git commit -m "feat: add client NetworkManager wrapping Socket.io"
```

---

## Task 10: Multiplayer Renderer

**Files:**
- Create: `src/multiplayer-renderer.js`

- [ ] **Create the file**

```js
// src/multiplayer-renderer.js
import * as THREE from 'three';
import { buildMonkeyMesh } from './monkey-model.js';

export class MultiplayerRenderer {
  constructor(scene, mySocketId) {
    this.scene      = scene;
    this.mySocketId = mySocketId;
    this._players   = {}; // socketId -> { mesh, reviveRing }
    this._enemies   = {}; // id -> mesh
    this._bananas   = {}; // id -> mesh
  }

  applyState(state) {
    this._syncPlayers(state.players || []);
    this._syncEnemies(state.enemies || []);
    this._syncBananas(state.bananas || []);
  }

  getMyState(state) {
    return (state.players || []).find(p => p.socketId === this.mySocketId) || null;
  }

  _syncPlayers(players) {
    const seen = new Set();
    for (const p of players) {
      if (p.socketId === this.mySocketId) continue; // local player rendered separately
      seen.add(p.socketId);
      if (!this._players[p.socketId]) {
        const { group } = buildMonkeyMesh(p.colour, p.hat);
        // Revive ring
        const ringGeo = new THREE.RingGeometry(0.6, 0.72, 24);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x44ff44, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
        const ring    = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.02;
        ring.visible = false;
        group.add(ring);
        this.scene.add(group);
        this._players[p.socketId] = { mesh: group, ring };
      }
      const entry = this._players[p.socketId];
      entry.mesh.position.set(p.x, 0, p.z);
      entry.mesh.rotation.y = p.aimAngle ?? 0;

      // Grey out if downed/dead
      const grey = p.isDown || !p.isAlive;
      entry.mesh.traverse(c => {
        if (c.isMesh && c.material?.color) {
          c.material.color.setHex(grey ? 0x666666 : (c.material._baseColor ?? c.material.color.getHex()));
          if (!c.material._baseColor && !grey) c.material._baseColor = c.material.color.getHex();
        }
      });

      // Revive ring
      entry.ring.visible = p.isDown && p.reviveProgress > 0;
      if (entry.ring.visible) {
        entry.ring.scale.setScalar(p.reviveProgress);
      }
    }
    // Remove departed
    for (const id of Object.keys(this._players)) {
      if (!seen.has(id)) { this.scene.remove(this._players[id].mesh); delete this._players[id]; }
    }
  }

  _syncEnemies(enemies) {
    const seen = new Set();
    for (const e of enemies) {
      seen.add(e.id);
      if (!this._enemies[e.id]) {
        const geo  = new THREE.SphereGeometry(0.4, 8, 6);
        const mat  = new THREE.MeshLambertMaterial({ color: 0xcc3300 });
        const mesh = new THREE.Mesh(geo, mat);
        this.scene.add(mesh);
        this._enemies[e.id] = mesh;
      }
      this._enemies[e.id].position.set(e.x, 0.4, e.z);
    }
    for (const id of Object.keys(this._enemies)) {
      if (!seen.has(+id)) { this.scene.remove(this._enemies[id]); delete this._enemies[id]; }
    }
  }

  _syncBananas(bananas) {
    const seen = new Set();
    for (const b of bananas) {
      if (b.collected) continue;
      seen.add(b.id);
      if (!this._bananas[b.id]) {
        const geo  = new THREE.SphereGeometry(0.2, 7, 5);
        const mat  = new THREE.MeshLambertMaterial({ color: 0xffe135 });
        const mesh = new THREE.Mesh(geo, mat);
        this.scene.add(mesh);
        this._bananas[b.id] = mesh;
      }
      this._bananas[b.id].position.set(b.x, 0.3 + Math.sin(Date.now()/400 + b.id) * 0.1, b.z);
    }
    for (const id of Object.keys(this._bananas)) {
      if (!seen.has(+id)) { this.scene.remove(this._bananas[id]); delete this._bananas[id]; }
    }
  }

  destroy() {
    for (const { mesh } of Object.values(this._players)) this.scene.remove(mesh);
    for (const mesh of Object.values(this._enemies))  this.scene.remove(mesh);
    for (const mesh of Object.values(this._bananas))  this.scene.remove(mesh);
    this._players = {}; this._enemies = {}; this._bananas = {};
  }
}
```

- [ ] **Commit**

```bash
git add src/multiplayer-renderer.js
git commit -m "feat: add MultiplayerRenderer syncing Three.js meshes from server state"
```

---

## Task 11: Multiplayer HUD

**Files:**
- Create: `src/multiplayer-hud.js`

- [ ] **Create the file**

```js
// src/multiplayer-hud.js
export class MultiplayerHUD {
  constructor(mode) {
    this.mode = mode; // 'coop' | 'pvp'
    this._el = document.createElement('div');
    this._el.id = 'mp-hud';
    this._el.style.cssText = `
      position: fixed; top: 12px; left: 12px; z-index: 30;
      display: flex; flex-direction: column; gap: 6px;
      pointer-events: none;
    `;
    document.body.appendChild(this._el);

    if (mode === 'pvp') {
      this._scoreEl = document.createElement('div');
      this._scoreEl.style.cssText = `
        position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
        background: rgba(0,0,0,0.75); border: 1px solid #44cc44;
        border-radius: 8px; padding: 6px 18px;
        font-family: 'Press Start 2P', monospace; font-size: 10px; color: #88ff44;
        z-index: 30; pointer-events: none;
      `;
      document.body.appendChild(this._scoreEl);

      this._timerEl = document.createElement('div');
      this._timerEl.style.cssText = `
        position: fixed; top: 48px; left: 50%; transform: translateX(-50%);
        font-family: 'Press Start 2P', monospace; font-size: 9px; color: #ffcc44;
        z-index: 30; pointer-events: none;
      `;
      document.body.appendChild(this._timerEl);
    }
  }

  update(state, mySocketId) {
    const players = state.players || [];

    // Portrait rows
    this._el.innerHTML = players.map(p => {
      const hpPct = Math.max(0, (p.hp / (p.maxHp || 100)) * 100).toFixed(0);
      const isMe  = p.socketId === mySocketId;
      const col   = isMe ? '#88ff44' : '#aaaaaa';
      return `
        <div style="display:flex;align-items:center;gap:6px;background:rgba(0,0,0,0.65);
          border:1px solid ${col};border-radius:6px;padding:4px 8px;min-width:140px">
          <span style="font-size:14px">${{ brawler:'🥊', slinger:'🍌', trickster:'🎭' }[p.playerClass] || '🐒'}</span>
          <div style="flex:1">
            <div style="font-family:'Press Start 2P',monospace;font-size:7px;color:${col};margin-bottom:2px">
              ${isMe ? 'YOU' : p.name || 'Player'}${p.isDown ? ' 💀' : ''}
            </div>
            <div style="background:#333;border-radius:3px;height:5px;width:100px">
              <div style="background:${hpPct > 50 ? '#44cc44' : hpPct > 25 ? '#ffcc00' : '#ff4444'};
                height:100%;width:${hpPct}%;border-radius:3px;transition:width 0.1s"></div>
            </div>
          </div>
          ${this.mode === 'pvp' ? `<span style="font-family:'Press Start 2P',monospace;font-size:8px;color:#ffcc44">
            ${state.scores?.[p.socketId] || 0}W</span>` : ''}
        </div>
      `;
    }).join('');

    // PvP score + timer
    if (this.mode === 'pvp') {
      const entries = Object.entries(state.scores || {});
      this._scoreEl.textContent = entries.map(([sid, w]) => {
        const p = players.find(pl => pl.socketId === sid);
        return `${p?.name || 'P'}: ${w}`;
      }).join('  ·  ');
      if (this._timerEl && state.roundTimer !== undefined) {
        this._timerEl.textContent = `⏱ ${state.roundTimer}s`;
      }
    }
  }

  updatePool(pool) {
    // Called in co-op when shared pool changes
    const el = document.getElementById('banana-count');
    if (el) el.textContent = `🍌 ${pool} (shared)`;
  }

  destroy() {
    this._el.remove();
    this._scoreEl?.remove();
    this._timerEl?.remove();
  }
}
```

- [ ] **Commit**

```bash
git add src/multiplayer-hud.js
git commit -m "feat: add MultiplayerHUD with portraits, PvP score, timer"
```

---

## Task 12: Multiplayer Menu Screens

**Files:**
- Modify: `src/menu.js`

- [ ] **Add `onMultiplayer` callback to Menu constructor**

In `src/menu.js`, change the constructor signature:

```js
constructor(onPlay, onTutorial, onMultiplayer) {
  this.onPlay        = onPlay;
  this.onTutorial    = onTutorial;
  this.onMultiplayer = onMultiplayer;
  // ... rest unchanged
```

- [ ] **Enable the Two Player button in `_showHome()`**

Replace the disabled Two Player button:
```js
// REMOVE:
<button class="home-btn disabled-btn" disabled>
  Two Player
  <span class="coming-soon">Coming Soon</span>
</button>

// ADD:
<button class="home-btn" id="btn-multiplayer">Multiplayer</button>
```

Wire it after the solo button listener:
```js
this._overlay.querySelector('#btn-multiplayer')?.addEventListener('click', () => {
  if (this.onMultiplayer) {
    this._overlay.remove();
    this.onMultiplayer();
  }
});
```

- [ ] **Commit**

```bash
git add src/menu.js
git commit -m "feat: enable Multiplayer button in main menu"
```

---

## Task 13: Multiplayer Lobby UI

**Files:**
- Modify: `src/menu.js` — add `_showMultiplayer()` and `_showLobby()` methods

- [ ] **Add `_showMultiplayer()` method** (add before the closing `}` of the Menu class)

```js
_showMultiplayer() {
  this._overlay.innerHTML = `
    <div class="menu-screen home-centre" style="gap:20px">
      <div class="menu-title" style="font-size:22px">MULTIPLAYER</div>
      <div class="home-btn-group">
        <button class="home-btn primary" id="btn-quick-play">⚡ Quick Play</button>
        <button class="home-btn" id="btn-create-room">🏠 Create Room</button>
        <div style="display:flex;gap:8px;width:100%">
          <input id="mp-code-input" placeholder="ROOM CODE" maxlength="5"
            style="flex:1;background:#111a0e;border:1px solid #335522;border-radius:6px;
            color:#ccffaa;font-family:'Press Start 2P',monospace;font-size:10px;padding:10px 12px;
            text-transform:uppercase;outline:none" />
          <button class="home-btn" id="btn-join-room" style="width:auto;padding:10px 16px">Join</button>
        </div>
        <button class="home-btn" id="btn-mp-back" style="background:transparent;border-color:#335522;color:#557744">← Back</button>
      </div>
      <div id="mp-error" style="font-family:'Press Start 2P',monospace;font-size:8px;color:#ff4444;display:none"></div>
      <div id="mp-status" style="font-family:'Press Start 2P',monospace;font-size:8px;color:#88ff44;display:none"></div>
    </div>
  `;

  const playerData = () => ({
    playerClass: this._playerClass,
    colour: PLAYER_COLORS[this._colorIdx]?.value ?? 0x7B3F00,
    hat: this._hat,
    name: 'Player',
  });

  this._overlay.querySelector('#btn-quick-play').addEventListener('click', () => {
    this._net.quickPlay(playerData());
    document.getElementById('mp-status').textContent = 'Searching for players...';
    document.getElementById('mp-status').style.display = 'block';
  });

  this._overlay.querySelector('#btn-create-room').addEventListener('click', () => {
    this._net.createRoom(playerData());
  });

  this._overlay.querySelector('#btn-join-room').addEventListener('click', () => {
    const code = document.getElementById('mp-code-input').value.trim().toUpperCase();
    if (code.length !== 5) { document.getElementById('mp-error').textContent = 'Enter a 5-letter code'; document.getElementById('mp-error').style.display = 'block'; return; }
    this._net.joinRoom(code, playerData());
  });

  this._overlay.querySelector('#btn-mp-back').addEventListener('click', () => this._showHome());
}
```

- [ ] **Add `_showLobby(lobbyData)` method**

```js
_showLobby(lobbyData) {
  const me = lobbyData.players.find(p => p.socketId === this._net.mySocketId);
  const isHost = me?.isHost;

  this._overlay.innerHTML = `
    <div class="menu-screen home-centre" style="gap:16px;max-width:520px;width:100%">
      <div style="font-family:'Press Start 2P',monospace;font-size:9px;color:#557744">
        Room: <span style="color:#88ff44">${lobbyData.id}</span>
        &nbsp;·&nbsp; ${lobbyData.mode === 'coop' ? '🤝 Co-op' : '⚔️ PvP'}
      </div>

      <div id="lobby-player-list" style="display:flex;flex-direction:column;gap:8px;width:100%"></div>

      <div id="lobby-customiser" style="display:none;width:100%"></div>

      ${isHost ? `
        <div style="display:flex;gap:8px;align-items:center">
          <select id="lobby-mode" style="background:#111;color:#ccffaa;border:1px solid #335522;border-radius:6px;
            font-family:'Press Start 2P',monospace;font-size:8px;padding:6px 10px">
            <option value="coop" ${lobbyData.mode==='coop'?'selected':''}>Co-op</option>
            <option value="pvp"  ${lobbyData.mode==='pvp' ?'selected':''}>PvP</option>
          </select>
          <select id="lobby-diff" style="background:#111;color:#ccffaa;border:1px solid #335522;border-radius:6px;
            font-family:'Press Start 2P',monospace;font-size:8px;padding:6px 10px">
            <option value="easy"   ${lobbyData.difficulty==='easy'  ?'selected':''}>Easy</option>
            <option value="normal" ${lobbyData.difficulty==='normal'?'selected':''}>Normal</option>
            <option value="hard"   ${lobbyData.difficulty==='hard'  ?'selected':''}>Hard</option>
          </select>
        </div>
        <button class="home-btn primary" id="btn-lobby-start"
          style="opacity:${lobbyData.players.length>=2 && lobbyData.players.every(p=>p.ready||p.isHost)?1:0.45}">
          Start Game
        </button>
      ` : `
        <button class="home-btn primary" id="btn-lobby-ready">
          ${me?.ready ? '✓ Ready' : 'Ready Up'}
        </button>
      `}
      <button class="home-btn" id="btn-lobby-leave" style="background:transparent;border-color:#335522;color:#557744">← Leave</button>
    </div>
  `;

  // Render player rows
  const renderPlayers = (players) => {
    document.getElementById('lobby-player-list').innerHTML = players.map(p => `
      <div class="lobby-row${p.socketId === this._net.mySocketId ? ' mine' : ''}"
           data-sid="${p.socketId}"
           style="display:flex;align-items:center;gap:10px;background:rgba(0,0,0,0.6);
           border:1px solid ${p.socketId===this._net.mySocketId?'#44cc44':'#335522'};
           border-radius:8px;padding:8px 12px;cursor:${p.socketId===this._net.mySocketId?'pointer':'default'}">
        <span style="font-size:18px">${{ brawler:'🥊', slinger:'🍌', trickster:'🎭' }[p.playerClass]||'🐒'}</span>
        <div style="flex:1">
          <div style="font-family:'Press Start 2P',monospace;font-size:8px;color:#ccffaa">
            ${p.name || 'Player'}${p.isHost?' 👑':''}
          </div>
          <div style="font-family:'Press Start 2P',monospace;font-size:7px;color:#557744">
            ${p.playerClass} · ${p.hat}
          </div>
        </div>
        <div style="font-family:'Press Start 2P',monospace;font-size:7px;color:${p.ready?'#44ff44':'#557744'}">
          ${p.ready ? '✓ Ready' : 'waiting'}
        </div>
      </div>
    `).join('');

    // Click own row to open customiser
    document.querySelectorAll('.lobby-row.mine').forEach(row => {
      row.addEventListener('click', () => this._toggleLobbyCustomiser());
    });
  };

  renderPlayers(lobbyData.players);

  // Host controls
  if (isHost) {
    document.getElementById('lobby-mode')?.addEventListener('change', e => this._net.setMode(e.target.value));
    document.getElementById('lobby-diff')?.addEventListener('change', e => this._net.setDifficulty(e.target.value));
    document.getElementById('btn-lobby-start')?.addEventListener('click', () => this._net.startGame());
  } else {
    document.getElementById('btn-lobby-ready')?.addEventListener('click', () => {
      this._net.setReady(!me?.ready);
    });
  }

  document.getElementById('btn-lobby-leave')?.addEventListener('click', () => {
    this._net.destroy();
    this._net = null;
    this._showHome();
  });

  // Update when lobby state changes
  this._net.onLobbyUpdate = (data) => {
    renderPlayers(data.players);
    // Update start button
    const canStart = data.players.length >= 2;
    const startBtn = document.getElementById('btn-lobby-start');
    if (startBtn) startBtn.style.opacity = canStart ? '1' : '0.45';
  };
}

_toggleLobbyCustomiser() {
  const el = document.getElementById('lobby-customiser');
  if (!el) return;
  if (el.style.display !== 'none') { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.innerHTML = `
    <div style="background:rgba(0,0,0,0.5);border:1px solid #335522;border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:10px">
      <div style="font-family:'Press Start 2P',monospace;font-size:8px;color:#88ff44">Your Class</div>
      <div style="display:flex;gap:8px">
        ${[{id:'brawler',emoji:'🥊'},{id:'slinger',emoji:'🍌'},{id:'trickster',emoji:'🎭'}].map(c=>`
          <div class="go-class-card${this._playerClass===c.id?' selected':''}" data-id="${c.id}"
            style="cursor:pointer">${c.emoji} ${c.id}</div>
        `).join('')}
      </div>
    </div>
  `;
  el.querySelectorAll('.go-class-card').forEach(card => {
    card.addEventListener('click', () => {
      this._playerClass = card.dataset.id;
      this._net.updateCustomisation({ playerClass: this._playerClass });
      this._toggleLobbyCustomiser();
    });
  });
}
```

- [ ] **Commit**

```bash
git add src/menu.js
git commit -m "feat: add multiplayer menu, lobby UI with player list and customiser"
```

---

## Task 14: Wire Multiplayer into main.js

**Files:**
- Modify: `src/main.js`

- [ ] **Import NetworkManager, MultiplayerRenderer, MultiplayerHUD**

At the top of `src/main.js`, add:
```js
import { NetworkManager }       from './network.js';
import { MultiplayerRenderer }  from './multiplayer-renderer.js';
import { MultiplayerHUD }       from './multiplayer-hud.js';
import { generateOffers }       from './upgrades.js';
```

- [ ] **Add multiplayer state variables** (after `let tutorial = null;`)

```js
let net    = null;  // NetworkManager
let mpRend = null;  // MultiplayerRenderer
let mpHud  = null;  // MultiplayerHUD
let mpMode = null;  // 'coop' | 'pvp'
```

- [ ] **Add `startMultiplayer()` function** (after `startTutorial()`)

```js
function startMultiplayer(mode) {
  mpMode = mode;
  if (game)   { game.isOver = true; game = null; }
  if (tutorial) { tutorial.isOver = true; tutorial = null; }
  scene.clear();
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  scene.add(sun);
  document.getElementById('hud').style.display = 'block';
  if (scoreHudEl)  scoreHudEl.style.display = 'none';
  if (roomNumEl)   roomNumEl.style.display  = 'none';
  if (bossHud)     bossHud.style.display    = 'none';

  // Build arena floor (flat plane so players have something to walk on)
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 18),
    new THREE.MeshLambertMaterial({ color: 0x2a4a2a })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  mpRend = new MultiplayerRenderer(scene, net.mySocketId);
  mpHud  = new MultiplayerHUD(mode);
}

function stopMultiplayer() {
  mpRend?.destroy(); mpRend = null;
  mpHud?.destroy();  mpHud  = null;
  mpMode = null;
  document.getElementById('hud').style.display = 'none';
  if (scoreHudEl) scoreHudEl.style.display = '';
  if (roomNumEl)  roomNumEl.style.display  = '';
}
```

- [ ] **Add multiplayer branch to render loop** (add after `if (tutorial) { ... return; }`)

```js
  if (net && mpRend) {
    const state = net.gameState;
    if (state) {
      mpRend.applyState(state);
      mpHud.update(state, net.mySocketId);
      // Update local player HP bar from server state
      const me = mpRend.getMyState(state);
      if (me && hpFill) hpFill.style.width = ((me.hp / (me.maxHp || 100)) * 100).toFixed(1) + '%';
      if (me?.isDown) {
        // Show revive prompt if near downed ally
      }
    }
    // Send inputs every frame
    const keys = [];
    ['KeyW','KeyS','KeyA','KeyD'].forEach(k => { if (input.isDown(k)) keys.push(k); });
    const mouseAngle = Math.atan2(mouseNDC.x, -mouseNDC.y); // approximate
    net.sendInput({
      keys,
      mouseAngle,
      lmb:   input.isMouseDown(0),
      shift: input.isDown('ShiftLeft') || input.isDown('ShiftRight'),
      space: input.isDown('Space'),
    });
    updateDmgNums(dt, camera);
    renderer.render(scene, camera);
    return;
  }
```

- [ ] **Wire Menu's `onMultiplayer` callback** — update the Menu call at the bottom of `main.js`:

```js
new Menu(
  (config) => startGame(config),
  () => startTutorial(),
  () => {
    // User clicked Multiplayer — create NetworkManager and wire events
    net = new NetworkManager();

    net.onRoomJoined = ({ code }) => {
      // Lobby is shown by menu.js; give net reference to menu
    };

    net.onGameStarting = ({ mode, difficulty }) => {
      startMultiplayer(mode);
    };

    net.onGameState = (state) => {
      // Handled in render loop via net.gameState
    };

    net.onOpenShop = ({ sharedPool }) => {
      // Build co-op shared shop overlay
      const offers = generateOffers(sharedPool, 1, 'brawler', false, false, []);
      _buildCoopShopOverlay(offers, sharedPool);
    };

    net.onUpgradeApplied = ({ upgradeId }) => {
      const upg = UPGRADES.find(u => u.id === upgradeId);
      if (upg && game?.player) upg.apply(game.player); // fallback — MP uses server stats
    };

    net.onGameOver = () => {
      stopMultiplayer();
      gameOverEl.style.display = 'flex';
    };

    net.onMatchEnd = ({ winnerId, scores }) => {
      _showMatchEndScreen(winnerId, scores);
    };

    net.onRoundEnd = ({ winnerId, scores }) => {
      // Brief overlay showing who won the round
    };

    net.onOpenPvpUpgrade = () => {
      const offers = generateOffers(99, 1, 'brawler', false, false, []);
      _buildPvpUpgradeOverlay(offers.slice(0, 3));
    };

    // Show the multiplayer menu screen inside the menu overlay
    // (Menu._showMultiplayer needs net reference — pass it)
    // Re-instantiate Menu with multiplayer screen
    document.getElementById('menu-overlay')?.remove();
    const m = new Menu(
      (config) => startGame(config),
      () => startTutorial(),
      null // prevent recursion
    );
    m._net = net;
    m._showMultiplayer();
    m._net.onRoomJoined = ({ code }) => m._showLobby({ id: code, mode: 'coop', difficulty: 'normal', players: [] });
    m._net.onLobbyUpdate = (data) => m._showLobby(data);
  }
);
```

- [ ] **Add `_buildCoopShopOverlay` helper** (inside main.js, before `loop()`)

```js
function _buildCoopShopOverlay(offers, sharedPool) {
  const existing = document.getElementById('coop-shop-overlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'coop-shop-overlay';
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.75);
    display:flex;align-items:center;justify-content:center;z-index:40`;
  overlay.innerHTML = `
    <div style="background:#0b1608;border:2px solid #44cc22;border-radius:12px;padding:24px;max-width:500px;width:90%">
      <div style="font-family:'Press Start 2P',monospace;font-size:12px;color:#88ff44;margin-bottom:6px">Shop</div>
      <div style="font-family:'Press Start 2P',monospace;font-size:8px;color:#557744;margin-bottom:16px">
        Shared Pool: 🍌 <span id="coop-pool">${sharedPool}</span>
      </div>
      <div id="coop-offers" style="display:flex;flex-direction:column;gap:8px"></div>
      <button id="coop-shop-done" class="home-btn" style="margin-top:16px;width:100%">Continue →</button>
    </div>
  `;
  document.body.appendChild(overlay);
  const offerEl = overlay.querySelector('#coop-offers');
  for (const u of offers) {
    const btn = document.createElement('button');
    btn.className = 'home-btn';
    btn.style.cssText = 'width:100%;text-align:left;padding:10px 14px;font-size:8px';
    btn.innerHTML = `${u.icon} ${u.label} <span style="color:#ffcc44">🍌${u.cost}</span> — ${u.desc}`;
    btn.addEventListener('click', () => {
      net.buyUpgrade(u.id);
      overlay.remove();
    });
    offerEl.appendChild(btn);
  }
  overlay.querySelector('#coop-shop-done').addEventListener('click', () => overlay.remove());
  net.onPoolUpdate = ({ sharedPool: p }) => {
    const el = document.getElementById('coop-pool');
    if (el) el.textContent = p;
  };
}

function _buildPvpUpgradeOverlay(offers) {
  const overlay = document.createElement('div');
  overlay.id = 'pvp-upgrade-overlay';
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.8);
    display:flex;align-items:center;justify-content:center;z-index:40`;
  overlay.innerHTML = `
    <div style="background:#0b1608;border:2px solid #ffcc44;border-radius:12px;padding:24px;max-width:480px;width:90%">
      <div style="font-family:'Press Start 2P',monospace;font-size:11px;color:#ffcc44;margin-bottom:16px">🏆 Round Win! Choose Upgrade</div>
      <div id="pvp-offers" style="display:flex;flex-direction:column;gap:8px"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  const offerEl = overlay.querySelector('#pvp-offers');
  for (const u of offers) {
    const btn = document.createElement('button');
    btn.className = 'home-btn';
    btn.style.cssText = 'width:100%;text-align:left;padding:10px 14px;font-size:8px';
    btn.innerHTML = `${u.icon} ${u.label} — ${u.desc}`;
    btn.addEventListener('click', () => { net.choosePvpUpgrade(u.id); overlay.remove(); });
    offerEl.appendChild(btn);
  }
}

function _showMatchEndScreen(winnerId, scores) {
  stopMultiplayer();
  const overlay = document.createElement('div');
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.85);
    display:flex;align-items:center;justify-content:center;z-index:50`;
  const winnerName = 'Player'; // placeholder — get from last known state
  overlay.innerHTML = `
    <div style="background:#0b1608;border:2px solid #ffcc44;border-radius:12px;padding:32px;text-align:center">
      <div style="font-family:'Press Start 2P',monospace;font-size:16px;color:#ffcc44;margin-bottom:12px">🏆 Match Over!</div>
      <div style="font-family:'Press Start 2P',monospace;font-size:10px;color:#88ff44;margin-bottom:24px">
        ${winnerName} wins!
      </div>
      <div style="display:flex;gap:12px;justify-content:center">
        <button class="home-btn primary" id="btn-rematch">Rematch</button>
        <button class="home-btn" id="btn-back-lobby">Main Menu</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#btn-rematch').addEventListener('click', () => {
    overlay.remove();
    net.startGame();
  });
  overlay.querySelector('#btn-back-lobby').addEventListener('click', () => {
    overlay.remove();
    net?.destroy(); net = null;
    new Menu(cfg => startGame(cfg), () => startTutorial(), () => {});
  });
}
```

- [ ] **Commit**

```bash
git add src/main.js
git commit -m "feat: wire multiplayer into main loop, add shop/upgrade/match-end overlays"
```

---

## Task 15: Spectator Camera (PvP)

**Files:**
- Modify: `src/main.js`

- [ ] **Track spectator mode and pan camera with mouse**

Add after the `let mpMode = null;` line:
```js
let _spectating = false;
let _spectatorTarget = new THREE.Vector3(0, 26, 1);
```

In `net.onRoundEnd` handler, check if local player is dead:
```js
net.onRoundEnd = ({ winnerId, scores }) => {
  const state = net.gameState;
  const me = state?.players?.find(p => p.socketId === net.mySocketId);
  _spectating = me && !me.isAlive;
};
```

In the multiplayer render loop branch, add spectator camera pan:
```js
if (_spectating) {
  // Smoothly pan camera with mouse
  _spectatorTarget.x = THREE.MathUtils.lerp(_spectatorTarget.x, mouseNDC.x * 8, 0.04);
  _spectatorTarget.z = THREE.MathUtils.lerp(_spectatorTarget.z, mouseNDC.y * -6, 0.04);
  camera.position.x  = THREE.MathUtils.lerp(camera.position.x, _spectatorTarget.x, 0.1);
  camera.position.z  = THREE.MathUtils.lerp(camera.position.z, _spectatorTarget.z + 1, 0.1);
  camera.lookAt(_spectatorTarget.x, 0, _spectatorTarget.z);
}
```

Reset spectator on round start:
```js
net.onRoundStart = () => { _spectating = false; camera.position.set(0, 26, 1); camera.lookAt(0, 0, 0); };
```

- [ ] **Commit**

```bash
git add src/main.js
git commit -m "feat: add spectator camera for PvP eliminated players"
```

---

## Task 16: Push and Test on Render

- [ ] **Push feature branch**

```bash
cd "/mnt/c/Users/ianst/code/monkey-mash"
git push -u origin feature/multiplayer
```

- [ ] **On Render dashboard** — trigger a manual deploy of the `feature/multiplayer` branch

- [ ] **Manual test checklist**
  - Open two browser tabs on the deployed URL
  - Log in on both
  - Click Multiplayer → Create Room on tab 1, note the code
  - Click Multiplayer → Join Room on tab 2, enter the code
  - Both tabs show in the lobby list
  - Click Ready on tab 2; host clicks Start Game
  - Both tabs transition to the game arena
  - Moving in tab 1 shows movement in tab 2
  - Attacking enemies deals damage on both screens
  - Collecting a banana updates the shared pool on both screens
  - When all enemies die, shop opens on both screens
  - Create a room in PvP mode, start, verify round timer appears and player-vs-player damage works

- [ ] **Commit any fixes found during testing, then merge**

```bash
git checkout main
git merge feature/multiplayer
git push
```
