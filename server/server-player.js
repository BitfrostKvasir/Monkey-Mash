// server/server-player.js
const SPEED      = 7;
const DASH_SPEED = 22;
const DASH_DUR   = 0.18;
const DASH_CD    = 1.0;
const IFRAMES    = 0.8;
const ARENA_HW   = 10.5;
const ARENA_HD   = 8.5;

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

    this.atkCd      = 0;
    this.comboStep  = 0;
    this.comboReset = 0;
    this.rageCd     = 0;
    this.rageActive = false;
    this.rageTimer  = 0;

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

    this._pendingAttack  = input.lmb && this.atkCd <= 0;
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
    const COMBO_DMG = [18, 28, 45];
    const COMBO_RNG = [1.8, 1.8, 2.1];
    const COMBO_CD  = [0.30, 0.35, 0.55];
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
