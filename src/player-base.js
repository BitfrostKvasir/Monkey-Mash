import * as THREE from 'three';
import { buildMonkeyMesh } from './monkey-model.js';

const SPEED        = 7;
const DASH_SPEED   = 22;
const DASH_DUR     = 0.18;
const DASH_CD      = 1.0;
const IFRAMES      = 0.8;
const MAX_HP       = 100;
const MAX_BANANAS  = 10;

export class BasePlayer {
  constructor(scene, input, color = 0x7B3F00, hat = 'none') {
    this.scene   = scene;
    this.input   = input;
    this.hp      = MAX_HP;
    this.bananas = 0;
    this.isAlive = true;

    this.stats = {
      damageMult:    1.0,
      speedMult:     1.0,
      atkCdMult:     1.0,
      dashCdMult:    1.0,
      bonusMaxHp:    0,
      knockbackMult: 1.0,
      critChance:    0,
      arcMult:       1.0,
      rangeMult:     1.0,
      lifesteal:     0,
      chain:         false,
      bananaExplosion: false,
      dashDmgLight:  false,
      dashDmgHeavy:  false,
      doubleStrike:  false,
      _hitCount:     0,
      // Brawler-specific
      brawlerHeavyKnuckles:   false,
      brawlerAdrenaline:      false,
      brawlerShockwave:       false,
      brawlerRageDurationBonus: 0,
      brawlerRageDmgBonus:    0,
      // Slinger-specific
      slingerSplitShot:  false,
      slingerVolleyBonus: 0,
      slingerPierce:     false,
      slingerCritSlow:   false,
      // Trickster-specific
      tricksterDecoyBurst:    false,
      tricksterDecoyCdBonus:  0,
      tricksterMomentumBoost: false,
      tricksterConfusion:     false,
    };

    this.velocity  = new THREE.Vector3();
    this.aimDir    = new THREE.Vector3(0, 0, -1);

    this._dashTimer = 0;
    this._dashCd    = 0;
    this._iframes   = 0;
    this._spaceWas  = false;
    this._rootTimer = 0;

    this._dashJustStarted = false;
    this._dashJustEnded   = false;

    this._howlSlowTimer = 0;
    this._epic = null;

    this.onBananaCollect        = null;
    this.onHeal                 = null;
    this._totalBananasCollected = 0;

    // Used by Trickster
    this.activeDecoy = null;

    const { group, rightArm, leftArm, rightLeg, leftLeg } = buildMonkeyMesh(color, hat);
    this.mesh      = group;
    this._rightArm = rightArm;
    this._leftArm  = leftArm;
    this._rightLeg = rightLeg;
    this._leftLeg  = leftLeg;

    this.mesh.position.set(0, 0, 0);
    scene.add(this.mesh);

    // Dash cooldown indicator — small ring above head, attached to mesh
    const dashRingGeo = new THREE.RingGeometry(0.20, 0.28, 20);
    this._dashRingMat = new THREE.MeshBasicMaterial({
      color: 0x44ffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
    });
    this._dashRingMesh = new THREE.Mesh(dashRingGeo, this._dashRingMat);
    this._dashRingMesh.rotation.x = -Math.PI / 2;
    this._dashRingMesh.position.y = 2.1;
    this._dashRingMesh.position.z = 0.6;
    this.mesh.add(this._dashRingMesh);
  }

  resetStats() {
    const hitCount = this.stats._hitCount;
    this.stats = {
      damageMult:    1.0,
      speedMult:     1.0,
      atkCdMult:     1.0,
      dashCdMult:    1.0,
      bonusMaxHp:    0,
      knockbackMult: 1.0,
      critChance:    0,
      arcMult:       1.0,
      rangeMult:     1.0,
      lifesteal:     0,
      chain:         false,
      bananaExplosion: false,
      dashDmgLight:  false,
      dashDmgHeavy:  false,
      doubleStrike:  false,
      _hitCount:     hitCount,
      brawlerHeavyKnuckles:     false,
      brawlerAdrenaline:        false,
      brawlerShockwave:         false,
      brawlerRageDurationBonus: 0,
      brawlerRageDmgBonus:      0,
      slingerSplitShot:   false,
      slingerVolleyBonus: 0,
      slingerPierce:      false,
      slingerCritSlow:    false,
      tricksterDecoyBurst:    false,
      tricksterDecoyCdBonus:  0,
      tricksterMomentumBoost: false,
      tricksterConfusion:     false,
    };
    this._epic = null;
  }

  get position() { return this.mesh.position; }
  get maxHp()    { return MAX_HP + this.stats.bonusMaxHp; }

  // ── Virtual methods ──────────────────────────────────────────────

  _getSpeedMult() { return 1; }

  attack(enemies) {}
  useSpecial(enemies) {}
  // Override in subclasses — return { name, icon, cdRatio (0=ready, 1=just used), isReady, isActive }
  getSpecialState() {
    return { name: 'Special', icon: '⚡', cdRatio: 0, isReady: true, isActive: false };
  }

  // ── Public API ───────────────────────────────────────────────────

  takeDamage(amount) {
    if (this._iframes > 0 || !this.isAlive) return;
    this.hp = Math.max(0, this.hp - amount);
    this._iframes = IFRAMES;
    if (this.hp <= 0) this.isAlive = false;
  }

  heal(amount) {
    const actual = Math.min(amount, this.maxHp - this.hp);
    if (actual <= 0) return;
    this.hp += actual;
    if (this.onHeal) this.onHeal(Math.round(actual));
  }

  collectBanana(worldPos) {
    if (this.bananas >= MAX_BANANAS) return false;
    this.bananas++;
    this._totalBananasCollected++;
    // Every 20 bananas collected over the run → heal 3% max HP
    if (this._totalBananasCollected % 20 === 0 && this.stats.bananaCure > 0) {
      this.heal(this.maxHp * 0.03);
    }
    if (this.onBananaCollect && worldPos) this.onBananaCollect(worldPos);
    return true;
  }

  root(duration) {
    this._rootTimer = Math.max(this._rootTimer, duration);
  }

  slowMovement(duration) {
    this._howlSlowTimer = Math.max(this._howlSlowTimer, duration);
  }

  activateEpic(enemies, aimTarget) {
    if (this._epic) this._epic.activate(enemies, aimTarget);
  }

  getEpicState() {
    return this._epic ? this._epic.getState() : null;
  }

  dash() {
    if (this._dashCd > 0 || this._dashTimer > 0) return;
    const inp = this.input;
    let dx = 0, dz = 0;
    if (inp.isDown('KeyW')) dz -= 1;
    if (inp.isDown('KeyS')) dz += 1;
    if (inp.isDown('KeyA')) dx -= 1;
    if (inp.isDown('KeyD')) dx += 1;
    if (dx === 0 && dz === 0) { dx = this.aimDir.x; dz = this.aimDir.z; }
    const len = Math.sqrt(dx*dx + dz*dz);
    this.velocity.x = (dx/len) * DASH_SPEED;
    this.velocity.z = (dz/len) * DASH_SPEED;
    this._dashTimer = DASH_DUR;
    this._iframes   = DASH_DUR + 0.1;
    this._dashJustStarted = true;
  }

  // ── Update ───────────────────────────────────────────────────────

  update(dt, now, aimPoint) {
    // Reset single-frame signals
    this._dashJustStarted = false;
    this._dashJustEnded   = false;

    if (!this.isAlive) return;

    if (this._dashTimer     > 0) this._dashTimer     -= dt;
    if (this._dashCd        > 0) this._dashCd        -= dt;
    if (this._iframes       > 0) this._iframes       -= dt;
    if (this._rootTimer     > 0) this._rootTimer     -= dt;
    if (this._howlSlowTimer > 0) this._howlSlowTimer -= dt;

    // Aim
    if (aimPoint) {
      const dx = aimPoint.x - this.mesh.position.x;
      const dz = aimPoint.z - this.mesh.position.z;
      const len = Math.sqrt(dx*dx + dz*dz);
      if (len > 0.05) this.aimDir.set(dx/len, 0, dz/len);
    }

    // Movement
    if (this._dashTimer <= 0) {
      const inp = this.input;
      let mx = 0, mz = 0;
      if (inp.isDown('KeyW')) mz -= 1;
      if (inp.isDown('KeyS')) mz += 1;
      if (inp.isDown('KeyA')) mx -= 1;
      if (inp.isDown('KeyD')) mx += 1;
      const len = Math.sqrt(mx*mx + mz*mz);
      const spd = SPEED * this.stats.speedMult * this._getSpeedMult() * (this._rootTimer > 0 ? 0.15 : 1) * (this._howlSlowTimer > 0 ? 0.75 : 1);
      if (len > 0) {
        this.velocity.x = (mx/len) * spd;
        this.velocity.z = (mz/len) * spd;
      } else {
        this.velocity.x *= 0.1;
        this.velocity.z *= 0.1;
      }
    } else {
      this.velocity.x *= Math.pow(0.3, dt);
      this.velocity.z *= Math.pow(0.3, dt);
    }

    this.mesh.position.addScaledVector(this.velocity, dt);

    // Dash ended
    if (this._dashTimer < 0 && this._dashCd <= 0) {
      this._dashTimer = 0;
      this._dashCd    = DASH_CD * this.stats.dashCdMult;
      this._dashJustEnded = true;
    }

    // Space → dash
    const spaceNow = this.input.isDown('Space');
    if (spaceNow && !this._spaceWas) this.dash();
    this._spaceWas = spaceNow;

    // Face aim direction
    this.mesh.rotation.y = Math.atan2(this.aimDir.x, this.aimDir.z);

    // Damage flash
    const flash = this._iframes > 0 && Math.floor(this._iframes * 10) % 2 === 0;
    const rootFlash = this._rootTimer > 0 && Math.floor(this._rootTimer * 8) % 2 === 0;
    this.mesh.traverse(c => {
      if (c.isMesh && c.material?.emissive) {
        c.material.emissive.setHex(flash ? 0x440000 : rootFlash ? 0x004400 : 0x000000);
      }
    });

    this._animate(dt, now);
    this._updateDashRing(now);
  }

  _updateDashRing(now) {
    const r   = this._dashRingMesh;
    const mat = this._dashRingMat;
    const dashing = this._dashTimer > 0;
    const ready   = this._dashCd <= 0 && !dashing;

    if (dashing) {
      // Bright white-blue while actively dashing
      mat.color.setHex(0xaaddff);
      mat.opacity = 0.95;
      r.scale.setScalar(1.0);
    } else if (ready) {
      // Cyan pulse when ready
      mat.color.setHex(0x44ffff);
      mat.opacity = 0.65 + Math.sin(now * 4) * 0.2;
      r.scale.setScalar(1.0);
    } else {
      // Grow from small to full as cooldown recovers
      const progress = 1 - (this._dashCd / (DASH_CD * this.stats.dashCdMult));
      const s = 0.25 + progress * 0.75;
      r.scale.setScalar(s);
      mat.color.setHex(0x226666);
      mat.opacity = 0.35 + progress * 0.25;
    }
  }

  // ── Animation (walk cycle only) ──────────────────────────────────

  _animate(dt, now) {
    const L = Math.min(1, 14 * dt);
    const moving = Math.abs(this.velocity.x) > 0.5 || Math.abs(this.velocity.z) > 0.5;
    let tRA = 0, tLA = 0, tRL = 0, tLL = 0;

    if (moving) {
      const phase = now * 9;
      tRA =  Math.sin(phase) * 0.55;
      tLA = -Math.sin(phase) * 0.55;
      tRL =  Math.sin(phase) * 0.6;
      tLL = -Math.sin(phase) * 0.6;
    }

    this._rightArm.rotation.z = THREE.MathUtils.lerp(this._rightArm.rotation.z, tRA, L);
    this._leftArm.rotation.z  = THREE.MathUtils.lerp(this._leftArm.rotation.z,  tLA, L);
    this._rightLeg.rotation.x = THREE.MathUtils.lerp(this._rightLeg.rotation.x, tRL, L);
    this._leftLeg.rotation.x  = THREE.MathUtils.lerp(this._leftLeg.rotation.x,  tLL, L);
  }
}
