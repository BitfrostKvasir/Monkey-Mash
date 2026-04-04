// server/server-game.js
import { ServerPlayer } from './server-player.js';
import { ServerEnemy, spawnWave } from './server-enemy.js';

const TICK_RATE = 20;
const TICK_MS   = 1000 / TICK_RATE;
const VACUUM_DURATION    = 1.4;
const TRANSITION_DURATION = 0.5;

export class ServerGame {
  constructor(io, room) {
    this.io   = io;
    this.room = room;
    this.players = {};

    const spawns = [[-2,0],[2,0],[-2,2],[2,2]];
    room.players.forEach((pd, i) => {
      const [sx, sz] = spawns[i] || [0, 0];
      this.players[pd.socketId] = new ServerPlayer(pd.socketId, pd, sx, sz);
    });

    this.enemies      = [];
    this.bananas      = [];
    this.sharedPool   = 0;
    this.roomNumber   = 1;
    this.phase        = 'fight';
    this._vacuumTimer = 0;
    this._transTimer  = 0;
    this._tickInterval = null;
    this._bananaId    = 1;
    this._inputs        = {};
    this.pausedBy       = null;
    this._shopReadySet  = new Set();
  }

  pause(socketId) {
    if (this.pausedBy) return; // already paused
    this.pausedBy = socketId;
    this.io.to(this.room.id).emit('game-paused', { by: socketId });
  }

  resume(socketId) {
    if (this.pausedBy !== socketId) return; // only pauser can resume
    this.pausedBy = null;
    this.io.to(this.room.id).emit('game-resumed');
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
    // Lazy import upgrades to avoid bundling issues
    import('../src/upgrades.js').then(({ UPGRADES }) => {
      const upg = UPGRADES.find(u => u.id === upgradeId);
      if (!upg) return;
      if (this.sharedPool < upg.cost) return;
      this.sharedPool -= upg.cost;
      this.io.to(socketId).emit('upgrade-applied', { upgradeId, sharedPool: this.sharedPool });
      this.io.to(this.room.id).emit('pool-update', { sharedPool: this.sharedPool });
    });
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
    if (this.pausedBy) return; // freeze everything while paused
    const dt = TICK_MS / 1000;

    if (this.phase === 'fight') {
      for (const [sid, player] of Object.entries(this.players)) {
        const input = this._inputs[sid] || { keys: [] };
        player.applyInput(input, dt);
        player.update(dt);

        if (player._pendingAttack) {
          const atk = player.fireComboAttack();
          if (atk) this._resolveAttack(player, atk);
        }
        if (player._pendingSpecial) player.useSpecial();
      }

      this._tickRevive(dt);

      const alivePlayers = Object.values(this.players).filter(p => p.isAlive && !p.isDown);
      for (const e of this.enemies) e.update(dt, alivePlayers);

      for (const b of this.bananas) {
        if (b.collected) continue;
        for (const p of Object.values(this.players)) {
          if (!p.isAlive || p.isDown) continue;
          const dx = p.x - b.x, dz = p.z - b.z;
          if (dx*dx + dz*dz < 0.81) { b.collected = true; this.sharedPool++; break; }
        }
      }

      if (this.enemies.every(e => e.isDead)) {
        this._dropBananas();
        this.phase = 'vacuum';
        this._vacuumTimer = VACUUM_DURATION;
      }

      if (Object.values(this.players).every(p => !p.isAlive)) {
        this.io.to(this.room.id).emit('game-over', { roomNumber: this.roomNumber });
        this._stop();
        return;
      }
    }

    if (this.phase === 'vacuum') {
      this._vacuumTimer -= dt;
      if (this._vacuumTimer <= 0) {
        // Auto-collect all remaining bananas
        for (const b of this.bananas) {
          if (!b.collected) { b.collected = true; this.sharedPool++; }
        }
        this.phase = 'shop';
        this._shopReadySet = new Set();
        this.io.to(this.room.id).emit('open-shop', { sharedPool: this.sharedPool, roomNumber: this.roomNumber });
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

  shopReady(socketId) {
    if (this.phase !== 'shop') return;
    this._shopReadySet.add(socketId);
    const total = Object.keys(this.players).length;
    const readyCount = this._shopReadySet.size;
    this.io.to(this.room.id).emit('shop-ready-update', {
      readyCount,
      total,
      readyIds: [...this._shopReadySet],
    });
    if (readyCount >= total) {
      this.advanceFromShop();
    }
  }

  advanceFromShop() {
    this.phase = 'transition';
    this._transTimer = TRANSITION_DURATION;
    this.bananas = [];
    this._shopReadySet = new Set();
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
      p.reviveProgress += dt / 3.0;
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
