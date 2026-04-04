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
      this.vx = (dx/d) * this.speed;
      this.vz = (dz/d) * this.speed;
    } else {
      this.vx = 0; this.vz = 0;
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
  const excessRooms = Math.max(0, roomNumber - 20);
  const hpMult = (hpMults[difficulty] ?? 1.0)
    * (1 + (roomNumber - 1) * 0.25)
    * Math.pow(1.12, excessRooms)
    * (1 + (playerCount - 1) * 0.3);
  const speedMult = 1 + excessRooms * 0.04;
  const count = Math.min(3 + roomNumber + playerCount + excessRooms, 16);
  const types = ['grunt', 'bandit', 'bomber', 'howler'];
  const enemies = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const r     = 6 + Math.random() * 3;
    const type  = types[Math.min(Math.floor(roomNumber / 3), types.length - 1)];
    const e = new ServerEnemy(type, Math.cos(angle) * r, Math.sin(angle) * r, hpMult);
    if (speedMult > 1) e.speed *= speedMult;
    enemies.push(e);
  }
  return enemies;
}
