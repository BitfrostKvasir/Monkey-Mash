// server/server-enemy.js
let _nextId = 1;

const ENEMY_DEFS = {
  grunt:      { hp: 60,  speed: 2.0, damage: 10, hitRadius: 0.55, attackCd: 1.2 },
  bandit:     { hp: 45,  speed: 2.8, damage: 8,  hitRadius: 0.5,  attackCd: 1.0 },
  bomber:     { hp: 80,  speed: 1.6, damage: 18, hitRadius: 0.6,  attackCd: 2.0 },
  strangler:  { hp: 110, speed: 1.4, damage: 12, hitRadius: 0.65, attackCd: 1.8 },
  howler:     { hp: 100, speed: 1.8, damage: 12, hitRadius: 0.6,  attackCd: 1.5 },
  thunder:    { hp: 75,  speed: 2.2, damage: 20, hitRadius: 0.55, attackCd: 2.5 },
  bananaKing: { hp: 600, speed: 1.8, damage: 22, hitRadius: 1.2,  attackCd: 1.0 },
  labApe:     { hp: 900, speed: 2.2, damage: 18, hitRadius: 1.1,  attackCd: 1.0 },
};

export class ServerEnemy {
  constructor(type, x, z, hpMult = 1) {
    this.id   = _nextId++;
    this.type = type;
    this.x = x; this.z = z;
    this.vx = 0; this.vz = 0;
    const def = ENEMY_DEFS[type] || ENEMY_DEFS.grunt;
    this.hp        = Math.floor(def.hp * hpMult);
    this.maxHp     = this.hp;
    this.speed     = def.speed;
    this.damage    = def.damage;
    this.hitRadius = def.hitRadius;
    this._attackCd  = 0;
    this._specialCd = 0;
    this._charging  = false;
    this._chargeTimer = 0;
    this._chargeDx  = 0;
    this._chargeDz  = 0;
    this.isDead = false;
  }

  update(dt, players) {
    if (this.isDead) return;
    if (this._attackCd  > 0) this._attackCd  -= dt;
    if (this._specialCd > 0) this._specialCd -= dt;

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

    if (this.type === 'bananaKing' || this.type === 'labApe') {
      this._updateBoss(dt, target, dx, dz, d, players);
      return;
    }

    // Thunder: ranged AoE attack from range
    if (this.type === 'thunder') {
      if (d < 7) {
        // Stand still and fire
        this.vx = 0; this.vz = 0;
        if (this._attackCd <= 0) {
          this._attackCd = 2.5;
          // Hit all players within 2.5 units of target
          for (const p of players) {
            if (!p.isAlive || p.isDown) continue;
            const pdx = p.x - target.x, pdz = p.z - target.z;
            if (Math.sqrt(pdx*pdx + pdz*pdz) < 2.5) p.takeDamage(this.damage);
          }
        }
      } else {
        this.vx = (dx/d) * this.speed;
        this.vz = (dz/d) * this.speed;
        this.x += this.vx * dt;
        this.z += this.vz * dt;
      }
      return;
    }

    // Standard melee approach + attack
    const def = ENEMY_DEFS[this.type] || ENEMY_DEFS.grunt;
    if (d > this.hitRadius + 0.5) {
      this.vx = (dx/d) * this.speed;
      this.vz = (dz/d) * this.speed;
    } else {
      this.vx = 0; this.vz = 0;
      if (this._attackCd <= 0) {
        this._attackCd = def.attackCd;
        target.takeDamage(this.damage);
      }
    }

    this.x += this.vx * dt;
    this.z += this.vz * dt;
  }

  _updateBoss(dt, target, dx, dz, d, players) {
    const def = ENEMY_DEFS[this.type];

    // Charge attack every 6 seconds
    if (!this._charging && this._specialCd <= 0 && d < 9) {
      this._specialCd   = 6.0;
      this._charging    = true;
      this._chargeTimer = 0.65;
      this._chargeDx    = dx / d;
      this._chargeDz    = dz / d;
    }

    if (this._charging) {
      this._chargeTimer -= dt;
      const spd = this.type === 'bananaKing' ? 12 : 10;
      this.vx = this._chargeDx * spd;
      this.vz = this._chargeDz * spd;
      this.x += this.vx * dt;
      this.z += this.vz * dt;
      // Damage anyone touched during charge
      if (this._attackCd <= 0) {
        for (const p of players) {
          if (!p.isAlive || p.isDown) continue;
          const pdx = p.x - this.x, pdz = p.z - this.z;
          if (Math.sqrt(pdx*pdx + pdz*pdz) < this.hitRadius + 0.5) {
            p.takeDamage(this.damage * 1.8);
            this._attackCd = 0.3;
          }
        }
      }
      if (this._chargeTimer <= 0) this._charging = false;
      return;
    }

    // Normal movement + AoE/melee
    if (d > this.hitRadius + 0.5) {
      this.vx = (dx/d) * this.speed;
      this.vz = (dz/d) * this.speed;
    } else {
      this.vx = 0; this.vz = 0;
      if (this._attackCd <= 0) {
        this._attackCd = def.attackCd;
        if (this.type === 'labApe') {
          // AoE slam
          for (const p of players) {
            if (!p.isAlive || p.isDown) continue;
            const pdx = p.x - this.x, pdz = p.z - this.z;
            if (Math.sqrt(pdx*pdx + pdz*pdz) < 2.8) p.takeDamage(this.damage);
          }
        } else {
          target.takeDamage(this.damage);
        }
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

// Multiplayer is inherently harder — slightly higher base HP
const MP_BASE_MULT = 1.2;

export function isBossRoom(roomNumber) {
  return roomNumber === 8 || roomNumber === 16;
}

export function spawnWave(roomNumber, playerCount, difficulty) {
  const expFactors = { easy: 1.0, normal: 1.12, hard: 1.20 };
  const hpMults    = { easy: 0.65, normal: 1.0, hard: 1.45 };
  const excessRooms = Math.max(0, roomNumber - 20);
  const baseHpMult = (hpMults[difficulty] ?? 1.0)
    * MP_BASE_MULT
    * (1 + (roomNumber - 1) * 0.25)
    * Math.pow(expFactors[difficulty] ?? 1.12, excessRooms)
    * (1 + (playerCount - 1) * 0.3);
  const speedMult = difficulty === 'easy' ? 1 : 1 + excessRooms * 0.04;

  // Boss rooms
  if (roomNumber === 8) {
    const boss = new ServerEnemy('bananaKing', 0, -3, baseHpMult);
    return [boss];
  }
  if (roomNumber === 16) {
    const boss = new ServerEnemy('labApe', 0, -3, baseHpMult);
    return [boss];
  }

  // Pool-based enemy unlocking — matches solo room.js exactly
  const pool = ['grunt'];
  if (roomNumber >= 3)  { pool.push('bandit'); pool.push('bandit'); }
  if (roomNumber >= 5)  pool.push('bomber');
  if (roomNumber >= 7)  pool.push('strangler');
  if (roomNumber >= 11) { pool.push('howler'); pool.push('howler'); }
  if (roomNumber >= 18) { pool.push('thunder'); pool.push('thunder'); }

  const count = Math.min(3 + Math.floor(roomNumber * 1.2) + excessRooms, 18)
    + Math.max(0, playerCount - 1); // extra enemy per extra player

  const enemies = [];
  const hw = 8.5, hd = 7.0;
  for (let i = 0; i < count; i++) {
    let x, z, tries = 0;
    do {
      const angle = Math.random() * Math.PI * 2;
      const r = 5 + Math.random() * 4;
      x = Math.cos(angle) * r;
      z = Math.sin(angle) * r;
      tries++;
    } while (Math.sqrt(x*x + z*z) < 4 && tries < 20);
    x = Math.max(-hw, Math.min(hw, x));
    z = Math.max(-hd, Math.min(hd, z));

    const type = pool[Math.floor(Math.random() * pool.length)];
    const e = new ServerEnemy(type, x, z, baseHpMult);
    if (speedMult > 1) e.speed *= speedMult;
    enemies.push(e);
  }
  return enemies;
}
