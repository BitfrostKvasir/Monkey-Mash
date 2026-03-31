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

export class Player {
  constructor(scene, input, color = 0x7B3F00, hat = 'none') {
    this.scene  = scene;
    this.input  = input;
    this.hp     = MAX_HP;
    this.maxHp  = MAX_HP;
    this.bananas = 0;
    this.isAlive = true;

    this.velocity  = new THREE.Vector3();
    this.aimDir    = new THREE.Vector3(0, 0, -1);

    this._dashTimer  = 0;
    this._dashCd     = 0;
    this._atkCd      = 0;
    this._iframes    = 0;
    this._spaceWas   = false;
    this._lmbWas     = false;

    // Arc visual
    this._arcMesh    = null;
    this._arcTimer   = 0;

    const { group, rightArm, leftArm, rightLeg, leftLeg } = buildMonkeyMesh(color, hat);
    this.mesh     = group;
    this._rightArm = rightArm;
    this._leftArm  = leftArm;
    this._rightLeg = rightLeg;
    this._leftLeg  = leftLeg;

    this.mesh.position.set(0, 0, 0);
    scene.add(this.mesh);
  }

  get position() { return this.mesh.position; }

  // ── Public API ───────────────────────────────────────────────────

  takeDamage(amount) {
    if (this._iframes > 0 || !this.isAlive) return;
    this.hp = Math.max(0, this.hp - amount);
    this._iframes = IFRAMES;
    if (this.hp <= 0) this.isAlive = false;
  }

  collectBanana() {
    this.bananas++;
  }

  attack(enemies) {
    if (this._atkCd > 0) return;
    this._atkCd = ATK_CD;
    this._showArc();

    const px = this.mesh.position.x;
    const pz = this.mesh.position.z;
    const aimAngle = Math.atan2(this.aimDir.x, this.aimDir.z);

    for (const enemy of enemies) {
      if (enemy.isDead) continue;
      const ex = enemy.mesh.position.x - px;
      const ez = enemy.mesh.position.z - pz;
      const dist = Math.sqrt(ex * ex + ez * ez);
      if (dist > ATK_RANGE) continue;

      const enemyAngle = Math.atan2(ex, ez);
      let diff = enemyAngle - aimAngle;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      if (Math.abs(diff) <= ATK_ARC / 2) {
        const kbDir = new THREE.Vector3(ex / dist, 0, ez / dist);
        enemy.takeDamage(ATK_DAMAGE, kbDir);
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
    if (dx === 0 && dz === 0) {
      dx = this.aimDir.x;
      dz = this.aimDir.z;
    }
    const len = Math.sqrt(dx * dx + dz * dz);
    this.velocity.x = (dx / len) * DASH_SPEED;
    this.velocity.z = (dz / len) * DASH_SPEED;
    this._dashTimer = DASH_DUR;
    this._iframes   = DASH_DUR + 0.1;
  }

  // ── Update ───────────────────────────────────────────────────────

  update(dt, now, aimPoint) {
    if (!this.isAlive) return;

    // Timers
    if (this._dashTimer  > 0) this._dashTimer  -= dt;
    if (this._dashCd     > 0) this._dashCd     -= dt;
    if (this._atkCd      > 0) this._atkCd      -= dt;
    if (this._iframes    > 0) this._iframes    -= dt;
    if (this._arcTimer   > 0) {
      this._arcTimer -= dt;
      if (this._arcTimer <= 0 && this._arcMesh) {
        this.mesh.remove(this._arcMesh);
        this._arcMesh = null;
      }
    }

    // Aim direction
    if (aimPoint) {
      const dx = aimPoint.x - this.mesh.position.x;
      const dz = aimPoint.z - this.mesh.position.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len > 0.05) {
        this.aimDir.set(dx / len, 0, dz / len);
      }
    }

    // Movement
    if (this._dashTimer <= 0) {
      const inp = this.input;
      let mx = 0, mz = 0;
      if (inp.isDown('KeyW')) mz -= 1;
      if (inp.isDown('KeyS')) mz += 1;
      if (inp.isDown('KeyA')) mx -= 1;
      if (inp.isDown('KeyD')) mx += 1;
      const len = Math.sqrt(mx * mx + mz * mz);
      if (len > 0) {
        this.velocity.x = (mx / len) * SPEED;
        this.velocity.z = (mz / len) * SPEED;
      } else {
        this.velocity.x *= 0.1;
        this.velocity.z *= 0.1;
      }
    } else {
      // Decelerate dash
      this.velocity.x *= Math.pow(0.3, dt);
      this.velocity.z *= Math.pow(0.3, dt);
    }

    this.mesh.position.addScaledVector(this.velocity, dt);

    // Start dash cooldown once the dash duration ends
    if (this._dashTimer < 0 && this._dashCd <= 0) {
      this._dashTimer = 0;
      this._dashCd = DASH_CD;
    }

    // Space = dash
    const spaceNow = this.input.isDown('Space');
    if (spaceNow && !this._spaceWas) this.dash();
    this._spaceWas = spaceNow;

    // Face aim direction
    this.mesh.rotation.y = Math.atan2(this.aimDir.x, this.aimDir.z);

    // Flash white when damaged
    const flash = this._iframes > 0 && Math.floor(this._iframes * 10) % 2 === 0;
    this.mesh.traverse(c => {
      if (c.isMesh && c.material) c.material.emissive?.setHex(flash ? 0x440000 : 0x000000);
    });

    this._animate(dt, now);
  }

  // ── Arc visual ───────────────────────────────────────────────────

  _showArc() {
    if (this._arcMesh) this.mesh.remove(this._arcMesh);

    const geo = new THREE.RingGeometry(0.3, ATK_RANGE, 16, 1, -ATK_ARC / 2, ATK_ARC);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffff44, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
    this._arcMesh = new THREE.Mesh(geo, mat);
    this._arcMesh.rotation.x = -Math.PI / 2;
    this._arcMesh.position.y = 0.05;
    // Face the aim direction
    this._arcMesh.rotation.z = Math.atan2(-this.aimDir.x, this.aimDir.z);

    this.mesh.add(this._arcMesh);
    this._arcTimer = 0.12;
  }

  // ── Animation ────────────────────────────────────────────────────

  _animate(dt, now) {
    const L = Math.min(1, 14 * dt);
    const moving = Math.abs(this.velocity.x) > 0.5 || Math.abs(this.velocity.z) > 0.5;

    let tRA = 0, tLA = 0;
    let tRL = 0, tLL = 0;

    if (this._atkCd > ATK_CD - 0.15) {
      // Attack swing — right arm sweeps forward
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
