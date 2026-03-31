import * as THREE from 'three';
import { buildMonkeyMesh } from './monkey-model.js';

const SPEED        = 7;
const DASH_SPEED   = 22;
const DASH_DUR     = 0.18;
const DASH_CD      = 1.0;
const ATK_CD       = 0.45;
const ATK_RANGE    = 1.8;
const ATK_ARC      = Math.PI * 0.65;
const ATK_DAMAGE   = 25;
const IFRAMES      = 0.8;
const MAX_HP       = 100;
const MAX_BANANAS  = 10;

export class Player {
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
    };

    this.velocity  = new THREE.Vector3();
    this.aimDir    = new THREE.Vector3(0, 0, -1);

    this._dashTimer = 0;
    this._dashCd    = 0;
    this._atkCd     = 0;
    this._iframes   = 0;
    this._spaceWas  = false;
    this._lmbWas    = false;

    this._dashJustStarted = false;
    this._dashJustEnded   = false;

    this.onBananaCollect = null; // (worldPos: THREE.Vector3) => void

    const { group, rightArm, leftArm, rightLeg, leftLeg } = buildMonkeyMesh(color, hat);
    this.mesh      = group;
    this._rightArm = rightArm;
    this._leftArm  = leftArm;
    this._rightLeg = rightLeg;
    this._leftLeg  = leftLeg;

    this.mesh.position.set(0, 0, 0);
    scene.add(this.mesh);

    this._arcMesh = this._createArc();
    scene.add(this._arcMesh);
  }

  get position() { return this.mesh.position; }
  get maxHp()    { return MAX_HP + this.stats.bonusMaxHp; }

  // ── Public API ───────────────────────────────────────────────────

  takeDamage(amount) {
    if (this._iframes > 0 || !this.isAlive) return;
    this.hp = Math.max(0, this.hp - amount);
    this._iframes = IFRAMES;
    if (this.hp <= 0) this.isAlive = false;
  }

  collectBanana(worldPos) {
    if (this.bananas >= MAX_BANANAS) return false;
    this.bananas++;
    if (this.onBananaCollect && worldPos) this.onBananaCollect(worldPos);
    return true;
  }

  attack(enemies) {
    if (this._atkCd > 0) return;
    this._atkCd = ATK_CD * this.stats.atkCdMult;

    const arcHalf = (ATK_ARC * this.stats.arcMult) / 2;
    const range   = ATK_RANGE * this.stats.rangeMult;

    const px = this.mesh.position.x;
    const pz = this.mesh.position.z;
    const aimAngle = Math.atan2(this.aimDir.x, this.aimDir.z);

    this.stats._hitCount++;
    const isDouble = this.stats.doubleStrike && (this.stats._hitCount % 5 === 0);
    const hitMult  = isDouble ? 2 : 1;

    let totalHeal = 0;
    let firstHit  = null;

    for (const enemy of enemies) {
      if (enemy.isDead) continue;
      const ex = enemy.mesh.position.x - px;
      const ez = enemy.mesh.position.z - pz;
      const dist = Math.sqrt(ex * ex + ez * ez);
      if (dist > range) continue;

      let diff = Math.atan2(ex, ez) - aimAngle;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > arcHalf) continue;

      let dmg = ATK_DAMAGE * this.stats.damageMult * hitMult;
      if (Math.random() < this.stats.critChance) dmg *= 2;

      const kb = new THREE.Vector3(ex / dist, 0, ez / dist).multiplyScalar(this.stats.knockbackMult);
      enemy.takeDamage(dmg, kb);
      totalHeal += dmg;
      if (!firstHit) firstHit = enemy;
    }

    // Lifesteal
    if (totalHeal > 0 && this.stats.lifesteal > 0) {
      this.hp = Math.min(this.maxHp, this.hp + totalHeal * this.stats.lifesteal);
    }

    // Chain hit
    if (this.stats.chain && firstHit) {
      let nearest = null, nearestD = Infinity;
      for (const e of enemies) {
        if (e === firstHit || e.isDead) continue;
        const dx = e.mesh.position.x - firstHit.mesh.position.x;
        const dz = e.mesh.position.z - firstHit.mesh.position.z;
        const d  = Math.sqrt(dx*dx + dz*dz);
        if (d < nearestD && d < 5) { nearest = e; nearestD = d; }
      }
      if (nearest) {
        const chainDmg = ATK_DAMAGE * this.stats.damageMult * 0.5;
        const dx = nearest.mesh.position.x - firstHit.mesh.position.x;
        const dz = nearest.mesh.position.z - firstHit.mesh.position.z;
        const d  = Math.sqrt(dx*dx + dz*dz);
        nearest.takeDamage(chainDmg, new THREE.Vector3(dx/d, 0, dz/d));
      }
    }
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

    if (this._dashTimer  > 0) this._dashTimer  -= dt;
    if (this._dashCd     > 0) this._dashCd     -= dt;
    if (this._atkCd      > 0) this._atkCd      -= dt;
    if (this._iframes > 0) this._iframes -= dt;

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
      const spd = SPEED * this.stats.speedMult;
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
    this.mesh.traverse(c => {
      if (c.isMesh && c.material?.emissive) c.material.emissive.setHex(flash ? 0x440000 : 0x000000);
    });

    // Update arc to always track player position and aim
    if (this._arcMesh) {
      this._arcMesh.position.copy(this.mesh.position);
      this._arcMesh.position.y = 0.05;
      this._arcMesh.rotation.y = Math.atan2(-this.aimDir.z, this.aimDir.x);
    }

    this._animate(dt, now);
  }

  // ── Arc visual ───────────────────────────────────────────────────

  _createArc() {
    const geo = new THREE.RingGeometry(0.3, ATK_RANGE, 24, 1, -ATK_ARC / 2, ATK_ARC);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffff44, transparent: true, opacity: 0.18, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  // ── Animation ────────────────────────────────────────────────────

  _animate(dt, now) {
    const L = Math.min(1, 14 * dt);
    const moving = Math.abs(this.velocity.x) > 0.5 || Math.abs(this.velocity.z) > 0.5;
    let tRA = 0, tLA = 0, tRL = 0, tLL = 0;

    if (this._atkCd > ATK_CD * this.stats.atkCdMult - 0.15) {
      tRA = -Math.PI / 2;
      tLA =  Math.PI / 4;
    } else if (moving) {
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
