// server/server-player.js
const SPEED      = 7;
const DASH_SPEED = 22;
const DASH_DUR   = 0.18;
const DASH_CD    = 1.0;
const IFRAMES    = 0.8;
const ARENA_HW   = 10.5;
const ARENA_HD   = 8.5;

// Per-class attack config (matches solo player classes)
const CLASS_ATK = {
  brawler:   { cd: 0.45, dmg: 25,  range: 1.8, arc: Math.PI * 0.65 },
  trickster: { cd: 0.50, dmg: 30,  range: 1.6, arc: Math.PI * 0.80 },
  slinger:   { cd: 0.35, dmg: 22,  projSpeed: 14, projRadius: 0.45, projLife: 2.5 },
};

const CLASS_SPECIAL_CD = { brawler: 10.0, slinger: 7.0, trickster: 8.0 };
const CLASS_SPECIAL_DUR = { brawler: 3.0,  slinger: 1.5, trickster: 0   };

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
    this.isDown  = false;
    this.iframes = 0;

    this.dashTimer = 0;
    this.dashCd    = 0;

    this.atkCd       = 0;
    this.specialCd   = 0;
    this.specialActive = false;
    this.specialTimer  = 0;

    this.purchasedUpgradeIds = [];
    this.damageMult   = 1.0;
    this.speedMult    = 1.0;
    this.atkCdMult    = 1.0;
    this.dashCdMult   = 1.0;
    this.bonusMaxHp   = 0;

    this.reviveProgress = 0;
    this.reviverId      = null;

    this._pendingAttack  = false;
    this._pendingSpecial = false;

    // Slinger: server-side projectiles
    this._projectiles = []; // { x, z, vx, vz, dmg, hitRadius, life, done }
    this._volleyQueue = []; // { timer, dx, dz } for staggered volley shots
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

    // Movement (slinger slows during volley)
    if (this.dashTimer <= 0) {
      const keys = input.keys || [];
      let mx = 0, mz = 0;
      if (keys.includes('KeyW')) mz -= 1;
      if (keys.includes('KeyS')) mz += 1;
      if (keys.includes('KeyA')) mx -= 1;
      if (keys.includes('KeyD')) mx += 1;
      const len = Math.sqrt(mx*mx + mz*mz);
      const slingerSlow = this.playerClass === 'slinger' && this.specialActive;
      const spd = SPEED * this.speedMult * (slingerSlow ? 0.4 : 1);
      if (len > 0) { this.vx = (mx/len)*spd; this.vz = (mz/len)*spd; }
      else { this.vx *= 0.1; this.vz *= 0.1; }
    }

    this._pendingAttack  = input.lmb && this.atkCd <= 0;
    this._pendingSpecial = input.shift && this.specialCd <= 0;
  }

  update(dt) {
    if (!this.isAlive) return;

    if (this.dashTimer > 0) { this.dashTimer -= dt; if (this.dashTimer <= 0) this.dashCd = DASH_CD * this.dashCdMult; }
    if (this.dashCd    > 0) this.dashCd    -= dt;
    if (this.iframes   > 0) this.iframes   -= dt;
    if (this.atkCd     > 0) this.atkCd     -= dt;
    if (this.specialCd > 0) this.specialCd -= dt;
    if (this.specialTimer > 0) {
      this.specialTimer -= dt;
      if (this.specialTimer <= 0) this.specialActive = false;
    }

    if (this.dashTimer > 0) { this.vx *= Math.pow(0.3, dt); this.vz *= Math.pow(0.3, dt); }

    this.x += this.vx * dt;
    this.z += this.vz * dt;

    this.x = Math.max(-ARENA_HW, Math.min(ARENA_HW, this.x));
    this.z = Math.max(-ARENA_HD, Math.min(ARENA_HD, this.z));
  }

  takeDamage(amount) {
    if (this.iframes > 0 || !this.isAlive || this.isDown) return 0;
    // Brawler rage reduces damage taken
    const dmg = (this.playerClass === 'brawler' && this.specialActive) ? amount * 0.8 : amount;
    this.hp = Math.max(0, this.hp - dmg);
    this.iframes = IFRAMES;
    if (this.hp <= 0) this.isAlive = false;
    return dmg;
  }

  // Returns a melee attack descriptor or null (slinger fires projectile as side effect)
  fireAttack() {
    if (this.atkCd > 0 || !this.isAlive) return null;
    const cls = CLASS_ATK[this.playerClass] || CLASS_ATK.brawler;
    this.atkCd = cls.cd * this.atkCdMult;

    if (this.playerClass === 'slinger') {
      this._spawnProjectile(Math.sin(this.aimAngle), Math.cos(this.aimAngle));
      return null; // no melee — projectile handles hit
    }

    const rageMult = (this.playerClass === 'brawler' && this.specialActive) ? 1.25 : 1;
    return { dmg: cls.dmg * this.damageMult * rageMult, range: cls.range, aimAngle: this.aimAngle, arc: cls.arc };
  }

  _spawnProjectile(dx, dz) {
    const cls = CLASS_ATK.slinger;
    const len = Math.sqrt(dx*dx + dz*dz) || 1;
    this._projectiles.push({
      x:    this.x + (dx/len) * 0.6,
      z:    this.z + (dz/len) * 0.6,
      vx:   (dx/len) * cls.projSpeed,
      vz:   (dz/len) * cls.projSpeed,
      dmg:  cls.dmg * this.damageMult,
      hitRadius: cls.projRadius,
      life: cls.projLife,
      done: false,
    });
  }

  // Called each tick for slinger; returns [{enemy, dmg}] hits to resolve
  updateProjectiles(dt, enemies) {
    const hits = [];

    // Staggered volley shots
    for (let i = this._volleyQueue.length - 1; i >= 0; i--) {
      this._volleyQueue[i].timer -= dt;
      if (this._volleyQueue[i].timer <= 0) {
        const { dx, dz } = this._volleyQueue[i];
        this._spawnProjectile(dx, dz);
        this._volleyQueue.splice(i, 1);
      }
    }

    for (let i = this._projectiles.length - 1; i >= 0; i--) {
      const proj = this._projectiles[i];
      if (proj.done) { this._projectiles.splice(i, 1); continue; }
      proj.life -= dt;
      if (proj.life <= 0) { this._projectiles.splice(i, 1); continue; }

      proj.x += proj.vx * dt;
      proj.z += proj.vz * dt;

      for (const e of enemies) {
        if (e.isDead) continue;
        const dx = e.x - proj.x, dz = e.z - proj.z;
        const totalR = proj.hitRadius + e.hitRadius;
        if (dx*dx + dz*dz < totalR * totalR) {
          hits.push({ enemy: e, dmg: proj.dmg });
          proj.done = true;
          this._projectiles.splice(i, 1);
          break;
        }
      }
    }
    return hits;
  }

  useSpecial() {
    if (this.specialCd > 0 || !this.isAlive) return false;
    this.specialCd = CLASS_SPECIAL_CD[this.playerClass] || 10.0;

    switch (this.playerClass) {
      case 'brawler':
        this.specialActive = true;
        this.specialTimer  = CLASS_SPECIAL_DUR.brawler;
        return true;

      case 'slinger': {
        // Rapid volley: 5 spread shots with movement slow
        this.specialActive = true;
        this.specialTimer  = CLASS_SPECIAL_DUR.slinger;
        const VOLLEY_COUNT = 5, SPREAD = 0.22;
        const half = (VOLLEY_COUNT - 1) / 2;
        for (let i = 0; i < VOLLEY_COUNT; i++) {
          const offset = (i - half) * SPREAD;
          this._volleyQueue.push({
            timer: i * 0.08,
            dx: Math.sin(this.aimAngle + offset),
            dz: Math.cos(this.aimAngle + offset),
          });
        }
        return true;
      }

      case 'trickster': {
        // Teleport 5 units in aim direction + iframes
        const dist = 5.0;
        const tx = this.x + Math.sin(this.aimAngle) * dist;
        const tz = this.z + Math.cos(this.aimAngle) * dist;
        this.x = Math.max(-ARENA_HW, Math.min(ARENA_HW, tx));
        this.z = Math.max(-ARENA_HD, Math.min(ARENA_HD, tz));
        this.iframes = 1.5;
        return true;
      }
    }
    return false;
  }

  toState() {
    const cdMax  = CLASS_SPECIAL_CD[this.playerClass] || 10.0;
    const cdRatio = this.specialCd > 0 ? this.specialCd / cdMax : 0;
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
      specialCdRatio: cdRatio,
      specialActive:  this.specialActive,
      aimAngle:    this.aimAngle,
      reviveProgress: this.reviveProgress,
    };
  }
}
