import * as THREE from 'three';
import { BasePlayer } from './player-base.js';

const ATK_CD       = 0.5;
const ATK_RANGE    = 1.6;
const ATK_DMG      = 30;
const DECOY_CD     = 8.0;
const TELEPORT_DIST = 5.0;

class Decoy {
  constructor(scene, x, z, color) {
    this.scene   = scene;
    this.expired = false;
    this._timer  = 3.0; // decoy lives for 3 seconds

    const mat = () => new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.55 });

    this.mesh = new THREE.Group();

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.44, 8, 6), mat());
    head.position.set(0, 1.32, 0);
    this.mesh.add(head);

    // Body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.36, 8, 6), mat());
    body.position.set(0, 0.56, 0);
    this.mesh.add(body);

    // Arms
    [-1, 1].forEach(d => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.45, 6), mat());
      arm.rotation.z = Math.PI / 2;
      arm.position.set(d * 0.42, 0.88, 0);
      this.mesh.add(arm);
    });

    this._parts = [];
    this.mesh.traverse(c => { if (c.isMesh) this._parts.push(c); });

    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
  }

  get position() { return this.mesh.position; }

  takeDamage() {
    // no-op: decoy absorbs damage
  }

  update(dt) {
    this._timer -= dt;
    if (this._timer < 0.8) {
      const t = this._timer;
      const opacity = 0.55 * (t / 0.8) * (0.5 + 0.5 * Math.sin(t * 25));
      for (const c of this._parts) {
        if (c.material) c.material.opacity = Math.max(0, opacity);
      }
    }
    if (this._timer <= 0) {
      this.scene.remove(this.mesh);
      this.expired = true;
    }
  }

  destroy() {
    if (!this.expired) {
      this.scene.remove(this.mesh);
      this.expired = true;
    }
  }
}

export class TricksterPlayer extends BasePlayer {
  constructor(scene, input, color = 0x7B3F00, hat = 'none') {
    super(scene, input, color, hat);

    this._color           = color;
    this._atkCd           = 0;
    this._decoyCd         = 0;
    this._decoy           = null;
    this._momentumTimer   = 0;
    this.onDecoyExpire    = null;

    this._ringMesh      = this._createRing();
    this._lastRangeMult = 1;
    scene.add(this._ringMesh);
  }

  _createRing(rangeMult = 1) {
    const geo  = new THREE.RingGeometry(0.3, ATK_RANGE * rangeMult, 32, 1, 0, Math.PI * 2);
    const mat  = new THREE.MeshBasicMaterial({ color: 0x44ffff, transparent: true, opacity: 0.18, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  _syncRingGeometry() {
    const rm = this.stats.rangeMult;
    if (rm === this._lastRangeMult) return;
    this._ringMesh.geometry.dispose();
    this._ringMesh.geometry = new THREE.RingGeometry(0.3, ATK_RANGE * rm, 32, 1, 0, Math.PI * 2);
    this._lastRangeMult = rm;
  }

  _getSpeedMult() {
    return this._momentumTimer > 0 ? 1.5 : 1;
  }

  attack(enemies) {
    if (this._atkCd > 0) return false;
    this._atkCd = ATK_CD * this.stats.atkCdMult;

    const range = ATK_RANGE * this.stats.rangeMult;
    const px = this.mesh.position.x;
    const pz = this.mesh.position.z;

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

      let dmg = ATK_DMG * this.stats.damageMult * hitMult;
      const isCrit = Math.random() < this.stats.critChance;
      if (isCrit) dmg *= 2;

      const kbMag = this.stats.knockbackMult * 1.5;
      const kb = new THREE.Vector3(ex / (dist || 1), 0, ez / (dist || 1)).multiplyScalar(kbMag);
      enemy.takeDamage(dmg, kb, { isCrit });
      if (this.stats.tricksterConfusion && enemy.confuse && Math.random() < 0.25) {
        enemy.confuse(2.0);
      }
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
        const chainDmg = ATK_DMG * this.stats.damageMult * 0.5;
        const dx = nearest.mesh.position.x - firstHit.mesh.position.x;
        const dz = nearest.mesh.position.z - firstHit.mesh.position.z;
        const d  = Math.sqrt(dx*dx + dz*dz);
        nearest.takeDamage(chainDmg, new THREE.Vector3(dx/d, 0, dz/d));
      }
    }

    return true;
  }

  getSpecialState() {
    return {
      name:     'Decoy Swap',
      icon:     '🎭',
      cdRatio:  Math.max(0, this._decoyCd) / DECOY_CD,
      isReady:  this._decoyCd <= 0,
      isActive: this._decoy !== null,
    };
  }

  useSpecial() {
    if (this._decoyCd > 0) return;

    if (this._decoy) {
      if (this.onDecoyExpire) this.onDecoyExpire(this._decoy.position.clone());
      this._decoy.destroy();
    }

    const decoy = new Decoy(this.scene, this.mesh.position.x, this.mesh.position.z, this._color);
    this._decoy      = decoy;
    this.activeDecoy = decoy;

    // Teleport
    const hw = 10.5, hh = 8.5;
    let tx = this.mesh.position.x + this.aimDir.x * TELEPORT_DIST;
    let tz = this.mesh.position.z + this.aimDir.z * TELEPORT_DIST;
    tx = Math.max(-hw, Math.min(hw, tx));
    tz = Math.max(-hh, Math.min(hh, tz));

    this.mesh.position.x = tx;
    this.mesh.position.z = tz;
    this.velocity.set(0, 0, 0);
    this._iframes = 0.3;

    this._decoyCd = Math.max(2, DECOY_CD + this.stats.tricksterDecoyCdBonus);

    if (this.stats.tricksterMomentumBoost) {
      this._momentumTimer = 2.0;
    }
  }

  update(dt, now, aimPoint) {
    if (this._atkCd         > 0) this._atkCd         -= dt;
    if (this._decoyCd       > 0) this._decoyCd       -= dt;
    if (this._momentumTimer > 0) this._momentumTimer -= dt;

    if (this._decoy) {
      this._decoy.update(dt);
      if (this._decoy.expired) {
        if (this.onDecoyExpire) this.onDecoyExpire(this._decoy.position.clone());
        this._decoy      = null;
        this.activeDecoy = null;
      }
    }

    super.update(dt, now, aimPoint);

    // Sync ring geometry to current stats
    this._syncRingGeometry();

    // Update ring position
    this._ringMesh.position.copy(this.mesh.position);
    this._ringMesh.position.y = 0.05;
  }

  _animate(dt, now) {
    const L = Math.min(1, 14 * dt);
    const moving = Math.abs(this.velocity.x) > 0.5 || Math.abs(this.velocity.z) > 0.5;
    let tRA = 0, tLA = 0, tRL = 0, tLL = 0;

    if (this._atkCd > 0) {
      tRA = -Math.PI / 3;
      tLA =  Math.PI / 3;
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
