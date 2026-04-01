import * as THREE from 'three';
import { spawnDmgNum } from './damage-numbers.js';

const SPEED            = 5.5;
const HP               = 60;
const ORBIT_R          = 4.5;

const ARC_DMG          = 6;
const ARC_SPEED        = 16;
const ARC_HIT_R        = 0.5;
const ARC_CD           = 3.5;

const SLAM_DMG         = 8;
const SLAM_AOE_R       = 2.2;
const SLAM_KB          = 7;
const SLAM_CD          = 5.5;
const SLAM_LEAP_SPD    = 14;
const SLAM_LEAP_DUR    = 0.28;

const OVERLOAD_DMG     = 5;
const OVERLOAD_R       = 3.0;
const OVERLOAD_CD_MIN  = 12;
const OVERLOAD_CD_MAX  = 15;

const AGGRO_R          = 6.0;

// ── Electric arc projectile ───────────────────────────────────────

class ElectricArc {
  constructor(scene, x, z, vx, vz) {
    this.scene  = scene;
    this._vx    = vx;
    this._vz    = vz;
    this._life  = 1.4;
    this._done  = false;

    const mat = new THREE.MeshLambertMaterial({ color: 0x66aaff, emissive: new THREE.Color(0x2255ee) });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(0.20, 7, 5), mat);
    this.mesh.position.set(x, 0.6, z);
    scene.add(this.mesh);
  }

  update(dt, player) {
    if (this._done) return true;

    this._life -= dt;
    if (this._life <= 0) { this.destroy(); return true; }

    this.mesh.position.x += this._vx * dt;
    this.mesh.position.z += this._vz * dt;

    // Pulsing blue glow
    const p = Math.sin(Date.now() * 0.025) * 0.5 + 0.5;
    this.mesh.material.emissive.setRGB(0.1 + p * 0.2, 0.2 + p * 0.45, 0.8 + p * 0.2);

    const dx = player.position.x - this.mesh.position.x;
    const dz = player.position.z - this.mesh.position.z;
    if (dx*dx + dz*dz < ARC_HIT_R * ARC_HIT_R) {
      player.takeDamage(ARC_DMG);
      this.destroy();
      return true;
    }
    return false;
  }

  destroy() {
    if (!this._done) { this.scene.remove(this.mesh); this._done = true; }
  }
}

// ── Thunder Simian ────────────────────────────────────────────────

export class ThunderSimian {
  constructor(scene, x, z) {
    this.scene          = scene;
    this.isDead         = false;
    this.hp             = HP;
    this.maxHp          = HP;
    this._droppedBanana = false;
    this._flashTimer    = 0;
    this.velocity       = new THREE.Vector3();

    this._state      = 'idle';
    this._stateTimer = 0;
    this._aggroed    = false;

    this._arcCd      = 1.5 + Math.random();
    this._slamCd     = 3.0 + Math.random() * 2;
    this._overloadCd = OVERLOAD_CD_MIN + Math.random() * (OVERLOAD_CD_MAX - OVERLOAD_CD_MIN);

    this._orbitAngle = Math.random() * Math.PI * 2;
    this._orbitDir   = Math.random() > 0.5 ? 1 : -1;
    this._burstTimer = 0;
    this._slamTarget = new THREE.Vector3();

    this._arcs = [];

    this._confuseTimer = 0;
    this._confuseAngle = 0;
    this._slowTimer    = 0;

    this._wristL = null;
    this._wristR = null;

    this.mesh = this._buildMesh();
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this._buildHealthBar();
  }

  // ── Mesh ──────────────────────────────────────────────────────────

  _buildMesh() {
    const g = new THREE.Group();

    const metal    = new THREE.MeshLambertMaterial({ color: 0x2e3540 });
    const panel    = new THREE.MeshLambertMaterial({ color: 0x3d4d5e });
    const wireMat  = new THREE.MeshLambertMaterial({ color: 0x111122 });
    const eyeMat   = new THREE.MeshLambertMaterial({ color: 0xffee00, emissive: new THREE.Color(0xffbb00) });
    const sparkMat = new THREE.MeshLambertMaterial({ color: 0x88ddff, emissive: new THREE.Color(0x4499ff) });

    const mkWrist = () => new THREE.MeshLambertMaterial({ color: 0x3366ff, emissive: new THREE.Color(0x1144cc) });

    const add = (geo, mat, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      g.add(m); return m;
    };

    // Torso
    add(new THREE.SphereGeometry(0.28, 8, 6), metal, 0, 0.38, 0);
    // Chest armour plate
    add(new THREE.BoxGeometry(0.30, 0.24, 0.07), panel, 0, 0.42, 0.26);
    // Head
    add(new THREE.SphereGeometry(0.30, 8, 6), metal, 0, 0.95, 0);

    // Yellow glowing eyes
    [-0.10, 0.10].forEach(ex => add(new THREE.SphereGeometry(0.07, 6, 4), eyeMat, ex, 1.00, 0.27));

    // Arms + wires + wristbands
    [-1, 1].forEach(d => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.50, 6), metal);
      arm.rotation.z = d * Math.PI / 2;
      arm.position.set(d * 0.37, 0.60, 0);
      arm.castShadow = true;
      g.add(arm);

      // Wire along arm (electric conduit)
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.50, 4), wireMat);
      wire.rotation.z = d * Math.PI / 2;
      wire.position.set(d * 0.37, 0.65, 0.07);
      g.add(wire);

      // Glowing wristband
      const wb = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.10, 10), mkWrist());
      wb.rotation.z = d * Math.PI / 2;
      wb.position.set(d * 0.62, 0.60, 0);
      wb.castShadow = true;
      g.add(wb);
      if (d === -1) this._wristL = wb; else this._wristR = wb;
    });

    // Legs
    [-1, 1].forEach(d => add(new THREE.CylinderGeometry(0.08, 0.08, 0.24, 6), metal, d * 0.13, 0.12, 0));

    // Shoulder spark nodes
    [-1, 1].forEach(d => {
      const node = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 4), sparkMat.clone());
      node.position.set(d * 0.28, 0.68, 0);
      g.add(node);
    });

    return g;
  }

  _buildHealthBar() {
    const bgM = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
    const fgM = new THREE.MeshBasicMaterial({ color: 0xffdd00, side: THREE.DoubleSide });
    this._hpBg = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 0.09), bgM);
    this._hpFg = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 0.09), fgM);
    this._hpBg.rotation.x = -Math.PI / 2; this._hpBg.position.set(0, 1.55, 0);
    this._hpFg.rotation.x = -Math.PI / 2; this._hpFg.position.set(0, 1.57, 0);
    this.mesh.add(this._hpBg);
    this.mesh.add(this._hpFg);
  }

  _updateHealthBar() {
    const r = this.hp / this.maxHp;
    this._hpFg.scale.x = r;
    this._hpFg.position.x = -0.325 * (1 - r);
  }

  // ── Public API ────────────────────────────────────────────────────

  takeDamage(amount, kbDir, meta = {}) {
    if (this.isDead) return;
    spawnDmgNum(amount, this.mesh.position, meta.isCrit ?? false);
    this.hp -= amount;
    this._flashTimer = 0.12;
    this._aggroed    = true;
    if (kbDir) { this.velocity.x += kbDir.x * 5; this.velocity.z += kbDir.z * 5; }
    if (this.hp <= 0) this.die(); else this._updateHealthBar();
  }

  die() {
    this.isDead = true;
    this.scene.remove(this.mesh);
    for (const a of this._arcs) a.destroy();
    this._arcs = [];
  }

  cleanup() {
    for (const a of this._arcs) a.destroy();
    this._arcs = [];
  }

  confuse(duration) {
    this._confuseTimer = Math.max(this._confuseTimer, duration);
    this._confuseAngle = Math.random() * Math.PI * 2;
  }

  slow(duration) { this._slowTimer = Math.max(this._slowTimer, duration); }

  // ── Visual helpers ────────────────────────────────────────────────

  _spawnRing(color, radius, x, z) {
    const mat  = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.22, 40), mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.04, z);
    this.scene.add(ring);
    let age = 0;
    const tick = () => {
      age += 1 / 60;
      const t = Math.min(age / 0.55, 1);
      ring.scale.setScalar(1 + t * (radius / 0.22 - 1));
      mat.opacity = 0.72 * (1 - t);
      if (age < 0.55) requestAnimationFrame(tick); else this.scene.remove(ring);
    };
    requestAnimationFrame(tick);
  }

  _setWristGlow(r, g, b) {
    if (this._wristL) this._wristL.material.emissive.setRGB(r, g, b);
    if (this._wristR) this._wristR.material.emissive.setRGB(r, g, b);
  }

  _setFullGlow(r, g, b) {
    this.mesh.traverse(c => { if (c.isMesh && c.material?.emissive) c.material.emissive.setRGB(r, g, b); });
  }

  // ── Update ────────────────────────────────────────────────────────

  update(dt, player, allEnemies = []) {
    if (this.isDead) return;

    if (this._arcCd      > 0) this._arcCd      -= dt;
    if (this._slamCd     > 0) this._slamCd     -= dt;
    if (this._overloadCd > 0) this._overloadCd -= dt;
    if (this._stateTimer > 0) this._stateTimer -= dt;
    if (this._burstTimer > 0) this._burstTimer -= dt;
    if (this._confuseTimer > 0) this._confuseTimer -= dt;
    if (this._slowTimer    > 0) this._slowTimer    -= dt;

    // Update arcs
    for (let i = this._arcs.length - 1; i >= 0; i--) {
      if (this._arcs[i].update(dt, player)) this._arcs.splice(i, 1);
    }

    // Hit flash
    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      const on = Math.floor(this._flashTimer * 20) % 2 === 0;
      this.mesh.traverse(c => { if (c.isMesh && c.material?.emissive) c.material.emissive.setHex(on ? 0xffffff : 0x000000); });
    }

    // Knockback decay
    this.velocity.x *= Math.pow(0.05, dt);
    this.velocity.z *= Math.pow(0.05, dt);

    // Enemy separation
    for (const o of allEnemies) {
      if (o === this || o.isDead) continue;
      const sx = this.mesh.position.x - o.mesh.position.x;
      const sz = this.mesh.position.z - o.mesh.position.z;
      const sd = Math.sqrt(sx*sx + sz*sz);
      if (sd > 0 && sd < 1.1) {
        const p = (1.1 - sd) / 1.1 * 2.5;
        this.velocity.x += sx/sd * p * dt;
        this.velocity.z += sz/sd * p * dt;
      }
    }

    if (this._confuseTimer > 0) {
      this.velocity.x += Math.cos(this._confuseAngle) * SPEED * dt * 3;
      this.velocity.z += Math.sin(this._confuseAngle) * SPEED * dt * 3;
      const spd = Math.sqrt(this.velocity.x**2 + this.velocity.z**2);
      if (spd > SPEED) { this.velocity.x = this.velocity.x/spd*SPEED; this.velocity.z = this.velocity.z/spd*SPEED; }
    } else {
      const dx   = player.position.x - this.mesh.position.x;
      const dz   = player.position.z - this.mesh.position.z;
      const dist = Math.sqrt(dx*dx + dz*dz);

      if (!this._aggroed && dist < AGGRO_R) this._aggroed = true;

      if (this._aggroed) {
        if (this._state === 'idle') this._state = 'approach';

        switch (this._state) {
          case 'approach':       this._stateApproach(dt, player, dist, dx, dz);    break;
          case 'arc_windup':     this._stateArcWindup(dt, dx, dz, dist);           break;
          case 'slam_windup':    this._stateSlamWindup(dt, dx, dz, dist);          break;
          case 'slam_leap':      this._stateSlamLeap(dt, player, dist);            break;
          case 'overload_windup':this._stateOverloadWindup(dt, player, dist);      break;
          case 'recover':        this._stateRecover(dt);                            break;
        }

        if (this._slowTimer > 0) {
          const maxSpd = SPEED * 0.5;
          const spd = Math.sqrt(this.velocity.x**2 + this.velocity.z**2);
          if (spd > maxSpd) { this.velocity.x = this.velocity.x/spd*maxSpd; this.velocity.z = this.velocity.z/spd*maxSpd; }
        }

        if (dist > 0.1 && this._state !== 'slam_leap') {
          this.mesh.rotation.y = Math.atan2(dx, dz);
        }
      }
    }

    this.mesh.position.addScaledVector(this.velocity, dt);

    if (this.mesh.position.x >  10.5) { this.mesh.position.x =  10.5; this.velocity.x = Math.min(0, this.velocity.x); }
    if (this.mesh.position.x < -10.5) { this.mesh.position.x = -10.5; this.velocity.x = Math.max(0, this.velocity.x); }
    if (this.mesh.position.z >   8.5) { this.mesh.position.z =   8.5; this.velocity.z = Math.min(0, this.velocity.z); }
    if (this.mesh.position.z <  -8.5) { this.mesh.position.z =  -8.5; this.velocity.z = Math.max(0, this.velocity.z); }
  }

  // ── State handlers ────────────────────────────────────────────────

  _stateApproach(dt, player, dist, dx, dz) {
    // Attack priority: overload > arc > slam
    if (this._overloadCd <= 0 && dist <= OVERLOAD_R + 1.5) {
      this._state = 'overload_windup';
      this._stateTimer = 0.8;
      return;
    }
    if (this._arcCd <= 0 && dist >= 2.5 && dist <= 9.0) {
      this._state = 'arc_windup';
      this._stateTimer = 0.5;
      return;
    }
    if (this._slamCd <= 0 && dist <= 5.0) {
      this._slamTarget.copy(player.position);
      this._state = 'slam_windup';
      this._stateTimer = 0.5;
      return;
    }

    // Strafe orbit at mid range
    this._orbitAngle += this._orbitDir * dt * 1.8;
    const r  = ORBIT_R + Math.sin(this._orbitAngle * 1.8) * 0.7;
    const tx = player.position.x + Math.cos(this._orbitAngle) * r;
    const tz = player.position.z + Math.sin(this._orbitAngle) * r;
    const ex = tx - this.mesh.position.x;
    const ez = tz - this.mesh.position.z;
    const ed = Math.sqrt(ex*ex + ez*ez);
    if (ed > 0.1) {
      this.velocity.x += ex/ed * SPEED * dt * 8;
      this.velocity.z += ez/ed * SPEED * dt * 8;
    }

    // Occasional short forward burst toward player
    if (this._burstTimer <= 0 && dist > 3.0) {
      this._burstTimer = 1.2 + Math.random() * 1.3;
      const nd = dist || 1;
      this.velocity.x += dx/nd * 5.0;
      this.velocity.z += dz/nd * 5.0;
    }

    const spd = Math.sqrt(this.velocity.x**2 + this.velocity.z**2);
    if (spd > SPEED) { this.velocity.x = this.velocity.x/spd*SPEED; this.velocity.z = this.velocity.z/spd*SPEED; }
  }

  _stateArcWindup(dt, dx, dz, dist) {
    this.velocity.x *= 0.86; this.velocity.z *= 0.86;

    // Wristbands build up blue spark
    const charge = 1 - Math.max(this._stateTimer, 0) / 0.5;
    this._setWristGlow(0.05 + charge * 0.2, 0.1 + charge * 0.4, charge * 1.0);

    if (this._stateTimer <= 0) {
      // Fire electric arc toward player
      const nd = dist || 1;
      this._arcs.push(new ElectricArc(
        this.scene,
        this.mesh.position.x, this.mesh.position.z,
        (dx/nd) * ARC_SPEED,
        (dz/nd) * ARC_SPEED
      ));
      this._setWristGlow(0.1, 0.2, 0.7);
      this._arcCd   = ARC_CD + Math.random() * 1.5;
      this._state   = 'recover';
      this._stateTimer = 0.4;
    }
  }

  _stateSlamWindup(dt, dx, dz, dist) {
    this.velocity.x *= 0.82; this.velocity.z *= 0.82;

    // Crouch + intensifying sparks
    this.mesh.scale.y = THREE.MathUtils.lerp(this.mesh.scale.y, 0.72, 0.13);
    const charge = 1 - Math.max(this._stateTimer, 0) / 0.5;
    this._setFullGlow(charge * 0.05, charge * 0.25, charge * 0.8);

    if (this._stateTimer <= 0) {
      // Leap toward stored target
      const tx = this._slamTarget.x - this.mesh.position.x;
      const tz = this._slamTarget.z - this.mesh.position.z;
      const td = Math.sqrt(tx*tx + tz*tz) || 1;
      this.velocity.x = (tx/td) * SLAM_LEAP_SPD;
      this.velocity.z = (tz/td) * SLAM_LEAP_SPD;
      this.mesh.scale.y = 1.0;
      this._setFullGlow(0, 0, 0);
      this._slamCd  = SLAM_CD + Math.random() * 1.5;
      this._state   = 'slam_leap';
      this._stateTimer = SLAM_LEAP_DUR;
    }
  }

  _stateSlamLeap(dt, player, dist) {
    if (this._stateTimer <= 0) {
      // Land — fire AoE
      this._spawnRing(0xffcc00, SLAM_AOE_R, this.mesh.position.x, this.mesh.position.z);
      if (dist <= SLAM_AOE_R) {
        player.takeDamage(SLAM_DMG);
        if (player.velocity) {
          const nd = dist || 1;
          const dx = player.position.x - this.mesh.position.x;
          const dz = player.position.z - this.mesh.position.z;
          player.velocity.x += (dx/nd) * SLAM_KB;
          player.velocity.z += (dz/nd) * SLAM_KB;
        }
      }
      this._state = 'recover';
      this._stateTimer = 0.55;
    }
  }

  _stateOverloadWindup(dt, player, dist) {
    this.velocity.x *= 0.84; this.velocity.z *= 0.84;

    // All limbs pulse bright yellow
    const charge = 1 - Math.max(this._stateTimer, 0) / 0.8;
    const pulse  = Math.sin(Date.now() * 0.016) * 0.5 + 0.5;
    this._setFullGlow(charge * pulse * 0.9, charge * pulse * 0.7, 0);

    if (this._stateTimer <= 0) {
      // Fire overload AoE
      this._spawnRing(0xffee22, OVERLOAD_R, this.mesh.position.x, this.mesh.position.z);
      if (dist <= OVERLOAD_R) {
        player.takeDamage(OVERLOAD_DMG);
        player.root(0.75); // brief stun via root
      }
      this._setFullGlow(0, 0, 0);
      this._overloadCd = OVERLOAD_CD_MIN + Math.random() * (OVERLOAD_CD_MAX - OVERLOAD_CD_MIN);
      this._state      = 'recover';
      this._stateTimer = 0.7;
    }
  }

  _stateRecover(dt) {
    this.velocity.x *= Math.pow(0.1, dt);
    this.velocity.z *= Math.pow(0.1, dt);
    if (this._stateTimer <= 0) this._state = 'approach';
  }
}
