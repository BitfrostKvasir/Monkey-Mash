// server/server-pvp.js
import { ServerPlayer } from './server-player.js';

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
    this.scores    = {};
    this.round     = 0;
    this.phase     = 'round';
    this._roundTimer   = ROUND_TIME;
    this._resultTimer  = 0;
    this._tickInterval = null;
    this._inputs       = {};
    this._pendingUpgradeChoices = {};
    this._lastRoundWinner = null;
    this._pickups = [];
    this.pausedBy = null;

    room.players.forEach(pd => {
      this.scores[pd.socketId] = 0;
    });
  }

  pause(socketId) {
    if (this.pausedBy) return;
    this.pausedBy = socketId;
    this.io.to(this.room.id).emit('game-paused', { by: socketId });
  }

  resume(socketId) {
    if (this.pausedBy !== socketId) return;
    this.pausedBy = null;
    this.io.to(this.room.id).emit('game-resumed');
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
    this._pendingUpgradeChoices[socketId] = upgradeId;
    import('../src/upgrades.js').then(({ UPGRADES }) => {
      const upg = UPGRADES.find(u => u.id === upgradeId);
      if (!upg) return;
      this.io.to(socketId).emit('upgrade-applied', { upgradeId, sharedPool: 0 });
      const winnerSid = this._lastRoundWinner;
      if (winnerSid && this._pendingUpgradeChoices[winnerSid]) {
        this._startRound();
      }
    });
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

    this._pickups = [];
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      this._pickups.push({ id: i, type: 'banana', x: Math.cos(angle)*4, z: Math.sin(angle)*4, collected: false });
    }

    this.io.to(this.room.id).emit('round-start', { round: this.round, scores: this.scores });
  }

  _tick() {
    if (this.pausedBy) return;
    const dt = TICK_MS / 1000;

    if (this.phase === 'round') {
      this._roundTimer -= dt;

      for (const [sid, player] of Object.entries(this.players)) {
        const input = this._inputs[sid] || { keys: [] };
        player.applyInput(input, dt);
        player.update(dt);

        if (player._pendingAttack) {
          const atk = player.fireComboAttack();
          if (atk) this._resolvePvPAttack(player, atk);
        }
        if (player._pendingSpecial) player.useSpecial();
      }

      for (const pk of this._pickups) {
        if (pk.collected) continue;
        for (const p of Object.values(this.players)) {
          if (!p.isAlive) continue;
          const dx = p.x - pk.x, dz = p.z - pk.z;
          if (dx*dx + dz*dz < 0.81) { pk.collected = true; break; }
        }
      }

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
        const matchWinner = Object.entries(this.scores).find(([,w]) => w >= WINS_TO_MATCH);
        if (matchWinner) {
          this.phase = 'match-over';
          this.io.to(this.room.id).emit('match-end', { winnerId: matchWinner[0], scores: this.scores });
          this._stop();
          return;
        }
        if (this._lastRoundWinner) {
          this.phase = 'upgrade';
          this.io.to(this._lastRoundWinner).emit('open-pvp-upgrade');
          this.io.to(this.room.id).except(this._lastRoundWinner).emit('waiting-for-upgrade', { scores: this.scores });
        } else {
          this._startRound();
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
      players:    Object.values(this.players).map(p => p.toState()),
      enemies:    [],
      bananas:    this._pickups || [],
      phase:      this.phase,
      roundTimer: Math.max(0, Math.ceil(this._roundTimer)),
      scores:     this.scores,
    });
  }

  _stop() {
    clearInterval(this._tickInterval);
    this._tickInterval = null;
    this.room.phase = 'lobby';
    this.room.game  = null;
  }
}
