import * as THREE from 'three';
import { BasePlayer } from './player-base.js';

const ATK_CD          = 0.35;
const PROJ_SPEED      = 14;
const PROJ_DMG        = 22;
const BASE_HIT_RADIUS = 0.45;
const BEAM_LENGTH     = 12;
const VOLLEY_CD       = 7.0;
const VOLLEY_SLOW_DUR = 1.5;
const VOLLEY_COUNT    = 5;
const VOLLEY_SPREAD   = 0.22; // radians between shots

class BananaProjectile {
  constructor(scene, x, z, vx, vz, dmg, hitRadius = BASE_HIT_RADIUS, pierce = false, slowOnHit = false, isCrit = false) {
    this.scene       = scene;
    this._vx         = vx;
    this._vz         = vz;
    this._dmg        = dmg;
    this._hitRadius  = hitRadius;
    this._pierce     = pierce;
    this._slowOnHit  = slowOnHit;
    this._isCrit     = isCrit;
    this._hitEnemies = new Set();
    this._life       = 2.5;
    this._done       = false;

    const geo = new THREE.SphereGeometry(hitRadius * 0.9, 8, 6);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffdd00 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(x, 0.55, z);
    this.mesh.castShadow = true;
    scene.add(this.mesh);
  }

  update(dt, enemies) {
    if (this._done) return true;

    this._life -= dt;
    if (this._life <= 0) {
      this.destroy();
      return true;
    }

    this.mesh.position.x += this._vx * dt;
    this.mesh.position.z += this._vz * dt;

    // Check enemy hits — total radius = projectile radius + enemy's own hitbox radius
    for (const enemy of enemies) {
      if (enemy.isDead || this._hitEnemies.has(enemy)) continue;
      const dx = enemy.mesh.position.x - this.mesh.position.x;
      const dz = enemy.mesh.position.z - this.mesh.position.z;
      const totalR = this._hitRadius + (enemy.hitRadius ?? 0);
      if (dx*dx + dz*dz < totalR * totalR) {
        const d = Math.sqrt(dx*dx + dz*dz) || 1;
        const kb = new THREE.Vector3(dx/d, 0, dz/d);
        enemy.takeDamage(this._dmg, kb, { isCrit: this._isCrit, isProjectile: true });
        if (this._slowOnHit && enemy.slow) enemy.slow(1.0);
        if (!this._pierce) { this.destroy(); return true; }
        this._hitEnemies.add(enemy);
      }
    }

    return false;
  }

  destroy() {
    if (!this._done) {
      this.scene.remove(this.mesh);
      this._done = true;
    }
  }
}

export class SlingerPlayer extends BasePlayer {
  constructor(scene, input, color = 0x7B3F00, hat = 'none') {
    super(scene, input, color, hat);

    this._atkCd           = 0;
    this._volleyCd        = 0;
    this._volleySlowTimer = 0;
    this._projectiles     = [];
    this._volleyQueue     = [];

    this._lastArcMult = 1;
    this._beamMesh    = this._createBeam(1);
    // Child of player mesh — inherits rotation so it always points in aim direction
    this.mesh.add(this._beamMesh);
  }

  _createBeam(arcMult = 1) {
    const width = BASE_HIT_RADIUS * 2 * arcMult;
    // BoxGeometry: width left-right, very thin vertically, BEAM_LENGTH forward along local +Z
    const geo  = new THREE.BoxGeometry(width, 0.01, BEAM_LENGTH);
    const mat  = new THREE.MeshBasicMaterial({ color: 0xffff44, transparent: true, opacity: 0.18 });
    const mesh = new THREE.Mesh(geo, mat);
    // Center the box so its near face sits at the player's origin (local Z = 0),
    // far face at local Z = BEAM_LENGTH
    mesh.position.set(0, 0.04, BEAM_LENGTH / 2);
    return mesh;
  }

  _syncBeamGeometry() {
    const am = this.stats.arcMult;
    if (am === this._lastArcMult) return;
    this._beamMesh.geometry.dispose();
    const width = BASE_HIT_RADIUS * 2 * am;
    this._beamMesh.geometry = new THREE.BoxGeometry(width, 0.01, BEAM_LENGTH);
    this._lastArcMult = am;
  }

  _getSpeedMult() {
    return this._volleySlowTimer > 0 ? 0.4 : 1;
  }

  attack(enemies) {
    if (this._atkCd > 0) return false;
    this._atkCd = ATK_CD * this.stats.atkCdMult;
    if (this.stats.slingerSplitShot) {
      const baseAngle = Math.atan2(this.aimDir.x, this.aimDir.z);
      const spread = 0.18;
      this._spawnProjectile(Math.sin(baseAngle - spread), Math.cos(baseAngle - spread));
      this._spawnProjectile(Math.sin(baseAngle + spread), Math.cos(baseAngle + spread));
    } else {
      this._spawnProjectile(this.aimDir.x, this.aimDir.z);
    }
    return true;
  }

  _spawnProjectile(dx, dz) {
    const len = Math.sqrt(dx*dx + dz*dz) || 1;
    const ndx = dx / len;
    const ndz = dz / len;
    const x   = this.mesh.position.x + ndx * 0.6;
    const z   = this.mesh.position.z + ndz * 0.6;

    const isCrit    = Math.random() < this.stats.critChance;
    const baseDmg   = PROJ_DMG * this.stats.damageMult;
    const dmg       = isCrit ? baseDmg * 2 : baseDmg;
    const slowOnHit = isCrit && this.stats.slingerCritSlow;
    const hitRadius = BASE_HIT_RADIUS * this.stats.arcMult;

    this._projectiles.push(new BananaProjectile(
      this.scene, x, z,
      ndx * PROJ_SPEED,
      ndz * PROJ_SPEED,
      dmg,
      hitRadius,
      this.stats.slingerPierce,
      slowOnHit,
      isCrit
    ));
  }

  useSpecial() {
    if (this._volleyCd > 0) return;
    this._volleyCd        = VOLLEY_CD;
    this._volleySlowTimer = VOLLEY_SLOW_DUR;

    const totalCount = VOLLEY_COUNT + this.stats.slingerVolleyBonus;
    const baseAngle  = Math.atan2(this.aimDir.x, this.aimDir.z);
    const halfCount  = (totalCount - 1) / 2;
    for (let i = 0; i < totalCount; i++) {
      const offset = (i - halfCount) * VOLLEY_SPREAD;
      this._volleyQueue.push({
        timer: i * 0.08,
        dx: Math.sin(baseAngle + offset),
        dz: Math.cos(baseAngle + offset),
      });
    }
  }

  updateProjectiles(dt, enemies) {
    // Process volley queue
    for (let i = this._volleyQueue.length - 1; i >= 0; i--) {
      this._volleyQueue[i].timer -= dt;
      if (this._volleyQueue[i].timer <= 0) {
        const { dx, dz } = this._volleyQueue[i];
        this._spawnProjectile(dx, dz);
        this._volleyQueue.splice(i, 1);
      }
    }

    // Update projectiles
    for (let i = this._projectiles.length - 1; i >= 0; i--) {
      if (this._projectiles[i].update(dt, enemies)) {
        this._projectiles.splice(i, 1);
      }
    }
  }

  getSpecialState() {
    return {
      name:     'Rapid Volley',
      icon:     '🍌',
      cdRatio:  Math.max(0, this._volleyCd) / VOLLEY_CD,
      isReady:  this._volleyCd <= 0,
      isActive: this._volleySlowTimer > 0,
    };
  }

  cleanup() {
    for (const p of this._projectiles) p.destroy();
    this._projectiles = [];
    this._volleyQueue = [];
  }

  update(dt, now, aimPoint) {
    if (this._atkCd           > 0) this._atkCd           -= dt;
    if (this._volleyCd        > 0) this._volleyCd        -= dt;
    if (this._volleySlowTimer > 0) this._volleySlowTimer -= dt;

    super.update(dt, now, aimPoint);

    // Sync beam width to current arcMult (position/rotation handled by parent mesh)
    this._syncBeamGeometry();
  }

  _animate(dt, now) {
    const L = Math.min(1, 14 * dt);
    const moving = Math.abs(this.velocity.x) > 0.5 || Math.abs(this.velocity.z) > 0.5;
    let tRA = 0, tLA = 0, tRL = 0, tLL = 0;

    if (this._atkCd > 0) {
      tRA = -Math.PI / 2.5;
      tLA =  Math.PI / 6;
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
