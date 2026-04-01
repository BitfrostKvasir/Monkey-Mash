import * as THREE from 'three';
import { BasePlayer } from './player-base.js';

const ATK_ARC  = Math.PI * 0.65;
const RAGE_DUR = 3.0;
const RAGE_CD  = 10.0;
const COMBO = [
  { dmg: 18, range: 1.8, arc: ATK_ARC,       kb: 1.0, cd: 0.30, push: 1.5 },
  { dmg: 28, range: 1.8, arc: ATK_ARC,       kb: 1.5, cd: 0.35, push: 2.0 },
  { dmg: 45, range: 2.1, arc: ATK_ARC * 1.2, kb: 3.5, cd: 0.55, push: 2.5 },
];

export class BrawlerPlayer extends BasePlayer {
  constructor(scene, input, color = 0x7B3F00, hat = 'none') {
    super(scene, input, color, hat);

    this._atkCd      = 0;
    this._comboStep  = 0;
    this._comboReset = 0;

    this._rageActive      = false;
    this._rageTimer       = 0;
    this._rageCd          = 0;
    this._adrenalineTimer = 0;

    this._arcRotMat    = new THREE.Matrix4();
    this._arcMesh      = this._createArc();
    this._lastRangeMult = 1;
    this._lastArcMult   = 1;
    scene.add(this._arcMesh);
  }

  _createArc(rangeMult = 1, arcMult = 1) {
    const range = COMBO[0].range * rangeMult;
    const arc   = ATK_ARC * arcMult;
    const geo = new THREE.RingGeometry(0.3, range, 24, 1, -arc / 2, arc);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffff44, transparent: true, opacity: 0.18, side: THREE.DoubleSide });
    return new THREE.Mesh(geo, mat);
  }

  _syncArcGeometry() {
    const rm = this.stats.rangeMult;
    const am = this.stats.arcMult;
    if (rm === this._lastRangeMult && am === this._lastArcMult) return;
    this._arcMesh.geometry.dispose();
    const range = COMBO[0].range * rm;
    const arc   = ATK_ARC * am;
    this._arcMesh.geometry = new THREE.RingGeometry(0.3, range, 24, 1, -arc / 2, arc);
    this._lastRangeMult = rm;
    this._lastArcMult   = am;
  }

  _getSpeedMult() {
    return this._adrenalineTimer > 0 ? 1.3 : 1;
  }

  takeDamage(amount) {
    super.takeDamage(this._rageActive ? amount * 0.8 : amount);
    if (this.stats.brawlerAdrenaline && this.isAlive) {
      this._adrenalineTimer = 2.0;
    }
  }

  attack(enemies) {
    if (this._atkCd > 0) return false;

    const isThirdHit = this._comboStep === 2;
    const combo = COMBO[this._comboStep];
    const rage  = this._rageActive;

    let dmg = combo.dmg * this.stats.damageMult;
    if (rage) dmg *= 1.25 + this.stats.brawlerRageDmgBonus;
    if (this.stats.brawlerHeavyKnuckles && isThirdHit) dmg *= 1.15;

    const cdBase = combo.cd * this.stats.atkCdMult;
    this._atkCd = rage ? cdBase * 0.7 : cdBase;

    this._comboReset = 1.5;
    this._comboStep  = (this._comboStep + 1) % 3;

    // Forward lunge
    this.velocity.x += this.aimDir.x * combo.push;
    this.velocity.z += this.aimDir.z * combo.push;

    const arcHalf = (combo.arc * this.stats.arcMult) / 2;
    const range   = combo.range * this.stats.rangeMult;
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
      if (dist > range + (enemy.hitRadius ?? 0)) continue;

      let diff = Math.atan2(ex, ez) - aimAngle;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > arcHalf) continue;

      let hitDmg = dmg * hitMult;
      const isCrit = Math.random() < this.stats.critChance;
      if (isCrit) hitDmg *= 2;

      const kbMag = combo.kb * this.stats.knockbackMult * (this.stats.brawlerHeavyKnuckles && isThirdHit ? 1.5 : 1);
      const kb = new THREE.Vector3(ex / dist, 0, ez / dist).multiplyScalar(kbMag);
      enemy.takeDamage(hitDmg, kb, { isCrit });
      totalHeal += hitDmg;
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
        const chainDmg = combo.dmg * this.stats.damageMult * 0.5;
        const dx = nearest.mesh.position.x - firstHit.mesh.position.x;
        const dz = nearest.mesh.position.z - firstHit.mesh.position.z;
        const d  = Math.sqrt(dx*dx + dz*dz);
        nearest.takeDamage(chainDmg, new THREE.Vector3(dx/d, 0, dz/d));
      }
    }

    // Ground Slam Shockwave on 3rd combo hit

    if (this.stats.brawlerShockwave && isThirdHit) {
      for (const enemy of enemies) {
        if (enemy.isDead) continue;
        const ex = enemy.mesh.position.x - px;
        const ez = enemy.mesh.position.z - pz;
        const d  = Math.sqrt(ex*ex + ez*ez);
        if (d < 4.5) {
          enemy.slow(1.5);
          const kb = new THREE.Vector3(ex/(d||1), 0, ez/(d||1)).multiplyScalar(2);
          enemy.takeDamage(8, kb);
        }
      }
    }

    return true;
  }

  useSpecial() {
    if (this._rageCd > 0) return;
    this._rageActive = true;
    this._rageTimer  = RAGE_DUR + this.stats.brawlerRageDurationBonus;
    this._rageCd     = RAGE_CD;
  }

  getSpecialState() {
    return {
      name:     'Rage Mode',
      icon:     '🔥',
      cdRatio:  Math.max(0, this._rageCd) / RAGE_CD,
      isReady:  this._rageCd <= 0,
      isActive: this._rageActive,
    };
  }

  update(dt, now, aimPoint) {
    if (this._atkCd           > 0) this._atkCd           -= dt;
    if (this._rageCd          > 0) this._rageCd          -= dt;
    if (this._adrenalineTimer > 0) this._adrenalineTimer -= dt;
    if (this._comboReset > 0) {
      this._comboReset -= dt;
      if (this._comboReset <= 0) this._comboStep = 0;
    }

    if (this._rageActive) {
      this._rageTimer -= dt;
      if (this._rageTimer <= 0) this._rageActive = false;
    }

    super.update(dt, now, aimPoint);

    // Sync arc geometry to current stats
    this._syncArcGeometry();

    // Update arc position/rotation
    if (this._arcMesh) {
      this._arcMesh.position.copy(this.mesh.position);
      this._arcMesh.position.y = 0.05;
      const ax = this.aimDir.x, az = this.aimDir.z;
      this._arcRotMat.set(
        ax,  az, 0, 0,
         0,   0, 1, 0,
        az, -ax, 0, 0,
         0,   0, 0, 1
      );
      this._arcMesh.setRotationFromMatrix(this._arcRotMat);
    }

    // Rage pulse emissive
    if (this._rageActive && this.isAlive && this._iframes <= 0 && this._rootTimer <= 0) {
      const r = 0.275 + Math.sin(Date.now() * 0.01) * 0.075; // 0.2 to 0.35
      this.mesh.traverse(c => {
        if (c.isMesh && c.material?.emissive) {
          c.material.emissive.setRGB(r, 0, 0);
        }
      });
    }
  }

  _animate(dt, now) {
    const L = Math.min(1, 14 * dt);
    const moving = Math.abs(this.velocity.x) > 0.5 || Math.abs(this.velocity.z) > 0.5;
    let tRA = 0, tLA = 0, tRL = 0, tLL = 0;

    if (this._atkCd > 0) {
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
