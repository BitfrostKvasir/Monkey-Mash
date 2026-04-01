import * as THREE from 'three';
import { spawnDmgNum } from './damage-numbers.js';

const S             = 1.2;          // scale relative to normal enemies
const SPEED         = 5.5;
const HP            = 75;
const SLAM_DMG      = 20;
const SLAM_RANGE    = 1.8;
const SLAM_LUNGE    = 16;           // lunge velocity
const SLAM_CD       = 2.5;
const HOWL_RADIUS   = 2.5;
const HOWL_CD_MIN   = 8.0;
const HOWL_CD_MAX   = 10.0;
const HOWL_SLOW_DUR = 1.5;
const AGGRO_RADIUS  = 6.0;
const PROJ_DMG_MULT = 1.10;        // +10% damage from projectiles

export class SpikedHowler {
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
    this._slamCd     = 1.5;
    this._howlCd     = HOWL_CD_MIN + Math.random() * (HOWL_CD_MAX - HOWL_CD_MIN);
    this._aggroed    = false;

    this._zigTimer  = 0;
    this._zigOffset = 0;
    this._lungeDir  = new THREE.Vector3();

    // Howl telegraph ring (created on windup entry, removed on activation)
    this._howlAura  = null;
    this._howlWindupDur = 0.7;

    this._confuseTimer = 0;
    this._confuseAngle = 0;
    this._slowTimer    = 0;

    this.mesh = this._buildMesh();
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this._buildHealthBar();
  }

  // ── Mesh ────────────────────────────────────────────────────────

  _buildMesh() {
    const g = new THREE.Group();

    const darkFur  = new THREE.MeshLambertMaterial({ color: 0x1a0a00 });
    const burnMat  = new THREE.MeshLambertMaterial({ color: 0x2e1800 });
    const spikeMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    const eyeMat   = new THREE.MeshLambertMaterial({ color: 0xff0000, emissive: new THREE.Color(0xcc0000) });
    const teethMat = new THREE.MeshLambertMaterial({ color: 0xddddcc });

    const add = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      m.castShadow = true;
      g.add(m); return m;
    };

    // Torso (hunched slightly forward)
    add(new THREE.SphereGeometry(0.27 * S, 8, 6), darkFur, 0, 0.38 * S, 0.06);
    // Burn patches on torso
    add(new THREE.SphereGeometry(0.10, 5, 4), burnMat,  0.16, 0.50,  0.22);
    add(new THREE.SphereGeometry(0.08, 5, 4), burnMat, -0.18, 0.42,  0.18);
    add(new THREE.SphereGeometry(0.07, 5, 4), burnMat,  0.08, 0.32, -0.15);

    // Head
    add(new THREE.SphereGeometry(0.32 * S, 8, 6), darkFur, 0, 0.96 * S, 0);

    // Red glowing eyes
    [-0.11 * S, 0.11 * S].forEach(ex => {
      add(new THREE.SphereGeometry(0.07 * S, 6, 4), eyeMat, ex, 1.01 * S, 0.28 * S);
    });

    // Jagged teeth
    [-0.07, 0, 0.07].forEach(tx => {
      add(new THREE.BoxGeometry(0.04, 0.07, 0.04), teethMat, tx, 0.82 * S, 0.30 * S);
    });

    // Arms — angled downward (hands dragging near ground)
    [-1, 1].forEach(d => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.55 * S, 6), darkFur);
      arm.rotation.z = d * (Math.PI / 2 + 0.45);
      arm.position.set(d * 0.42 * S, 0.40 * S, 0.06);
      arm.castShadow = true;
      g.add(arm);
    });

    // Legs
    [-1, 1].forEach(d => {
      add(new THREE.CylinderGeometry(0.08, 0.08, 0.26 * S, 6), darkFur, d * 0.13 * S, 0.13 * S, 0);
    });

    // Back spikes — 3 along spine, angled rearward
    [-0.12, 0, 0.12].forEach((sx, i) => {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.24, 5), spikeMat);
      spike.rotation.x = -(Math.PI / 2) + 0.35;
      spike.position.set(sx, (0.52 + i * 0.10) * S, -0.26);
      spike.castShadow = true;
      g.add(spike);
    });

    // Arm spikes — 2 per arm, pointing outward
    [-1, 1].forEach(d => {
      [0, 1].forEach(i => {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.18, 5), spikeMat);
        spike.rotation.z = d * Math.PI / 2;
        spike.position.set(d * (0.54 + i * 0.13) * S, (0.44 - i * 0.06) * S, 0.05);
        spike.castShadow = true;
        g.add(spike);
      });
    });

    // Slight forward lean
    g.rotation.x = 0.18;

    return g;
  }

  _buildHealthBar() {
    const bgM = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
    const fgM = new THREE.MeshBasicMaterial({ color: 0xff3300, side: THREE.DoubleSide });
    this._hpBg = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.09), bgM);
    this._hpFg = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.09), fgM);
    this._hpBg.rotation.x = -Math.PI / 2; this._hpBg.position.set(0, 1.75, 0);
    this._hpFg.rotation.x = -Math.PI / 2; this._hpFg.position.set(0, 1.77, 0);
    this.mesh.add(this._hpBg);
    this.mesh.add(this._hpFg);
  }

  _updateHealthBar() {
    const r = this.hp / this.maxHp;
    this._hpFg.scale.x = r;
    this._hpFg.position.x = -0.36 * (1 - r);
  }

  // ── Public API ───────────────────────────────────────────────────

  takeDamage(amount, kbDir, meta = {}) {
    if (this.isDead) return;
    const dmg = meta.isProjectile ? Math.ceil(amount * PROJ_DMG_MULT) : amount;
    spawnDmgNum(dmg, this.mesh.position, meta.isCrit ?? false);
    this.hp -= dmg;
    this._flashTimer = 0.12;
    this._aggroed    = true;
    if (kbDir) { this.velocity.x += kbDir.x * 5; this.velocity.z += kbDir.z * 5; }
    if (this.hp <= 0) this.die(); else this._updateHealthBar();
  }

  die() {
    this.isDead = true;
    this._removeHowlAura();
    this.scene.remove(this.mesh);
  }

  cleanup() { this._removeHowlAura(); }

  confuse(duration) {
    this._confuseTimer = Math.max(this._confuseTimer, duration);
    this._confuseAngle = Math.random() * Math.PI * 2;
  }

  slow(duration) { this._slowTimer = Math.max(this._slowTimer, duration); }

  // ── Howl ring visuals ─────────────────────────────────────────────

  _createHowlAura() {
    if (this._howlAura) return;
    const mat  = new THREE.MeshBasicMaterial({ color: 0xff1100, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.22, 40), mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(this.mesh.position.x, 0.04, this.mesh.position.z);
    this.scene.add(ring);
    this._howlAura = ring;
  }

  _removeHowlAura() {
    if (this._howlAura) { this.scene.remove(this._howlAura); this._howlAura = null; }
  }

  _spawnHowlBurst() {
    // Expanding fading ring that plays out independently
    const mat  = new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.22, 40), mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(this.mesh.position.x, 0.04, this.mesh.position.z);
    this.scene.add(ring);
    let age = 0;
    const tick = () => {
      age += 1 / 60;
      const t = Math.min(age / 0.55, 1);
      const targetScale = HOWL_RADIUS / 0.22;
      ring.scale.setScalar(1 + t * (targetScale - 1));
      mat.opacity = 0.7 * (1 - t);
      if (age < 0.55) requestAnimationFrame(tick);
      else this.scene.remove(ring);
    };
    requestAnimationFrame(tick);
  }

  // ── Update ───────────────────────────────────────────────────────

  update(dt, player, allEnemies = []) {
    if (this.isDead) return;

    if (this._slamCd    > 0) this._slamCd    -= dt;
    if (this._howlCd    > 0) this._howlCd    -= dt;
    if (this._stateTimer > 0) this._stateTimer -= dt;
    if (this._zigTimer   > 0) this._zigTimer   -= dt;
    if (this._confuseTimer > 0) this._confuseTimer -= dt;
    if (this._slowTimer    > 0) this._slowTimer    -= dt;

    // Hit flash
    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      const on = Math.floor(this._flashTimer * 20) % 2 === 0;
      this.mesh.traverse(c => {
        if (c.isMesh && c.material?.emissive) c.material.emissive.setHex(on ? 0xffffff : 0x000000);
      });
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
      if (sd > 0 && sd < 1.2) {
        const p = (1.2 - sd) / 1.2 * 2.5;
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

      if (!this._aggroed && dist < AGGRO_RADIUS) this._aggroed = true;

      if (this._aggroed) {
        if (this._state === 'idle') this._state = 'approach';

        switch (this._state) {
          case 'approach':    this._stateApproach(dt, player, dist, dx, dz);     break;
          case 'slam_windup': this._stateSlamWindup(dt, dx, dz, dist);           break;
          case 'slam_active': this._stateSlamActive(dt, player, dist);           break;
          case 'slam_recover':this._stateSlamRecover(dt);                        break;
          case 'howl_windup': this._stateHowlWindup(dt, player, dist);           break;
          case 'howl_active': this._stateHowlActive(dt, player, dist);           break;
          case 'recover':     this._stateRecover(dt);                            break;
        }

        if (this._slowTimer > 0) {
          const maxSpd = SPEED * 0.5;
          const spd = Math.sqrt(this.velocity.x**2 + this.velocity.z**2);
          if (spd > maxSpd) { this.velocity.x = this.velocity.x/spd*maxSpd; this.velocity.z = this.velocity.z/spd*maxSpd; }
        }

        if (dist > 0.1 && this._state !== 'slam_active') {
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
    if (this._howlCd <= 0) {
      this._state = 'howl_windup';
      this._stateTimer = this._howlWindupDur;
      this._createHowlAura();
      return;
    }
    if (dist < SLAM_RANGE && this._slamCd <= 0) {
      this._state = 'slam_windup';
      this._stateTimer = 0.5;
      return;
    }

    // Zig-zag: periodically shift lateral offset
    if (this._zigTimer <= 0) {
      this._zigOffset = (Math.random() - 0.5) * 3.0;
      this._zigTimer  = 0.45 + Math.random() * 0.4;
    }
    const nd = dist || 1;
    const perp = { x: -dz / nd, z: dx / nd };
    const tx = dx/nd + perp.x * this._zigOffset * 0.35;
    const tz = dz/nd + perp.z * this._zigOffset * 0.35;
    const tl = Math.sqrt(tx*tx + tz*tz) || 1;
    const speed = SPEED;
    this.velocity.x += tx/tl * speed * dt * 10;
    this.velocity.z += tz/tl * speed * dt * 10;
    const spd = Math.sqrt(this.velocity.x**2 + this.velocity.z**2);
    if (spd > speed) { this.velocity.x = this.velocity.x/spd*speed; this.velocity.z = this.velocity.z/spd*speed; }
  }

  _stateSlamWindup(dt, dx, dz, dist) {
    this.velocity.x *= 0.82; this.velocity.z *= 0.82;
    // Crouch down + shake + red emissive
    this.mesh.scale.y = THREE.MathUtils.lerp(this.mesh.scale.y, 0.72, 0.12);
    this.mesh.position.x += Math.sin(Date.now() * 0.05) * 0.02;
    this.mesh.traverse(c => { if (c.isMesh && c.material?.emissive) c.material.emissive.setHex(0x440000); });

    if (this._stateTimer <= 0) {
      const d = dist || 1;
      this._lungeDir.set(dx/d, 0, dz/d);
      this.velocity.x = this._lungeDir.x * SLAM_LUNGE;
      this.velocity.z = this._lungeDir.z * SLAM_LUNGE;
      this.mesh.scale.y = 1.0;
      this.mesh.traverse(c => { if (c.isMesh && c.material?.emissive) c.material.emissive.setHex(0x000000); });
      this._state = 'slam_active';
      this._stateTimer = 0.22;
      this._slamCd = SLAM_CD + Math.random();
    }
  }

  _stateSlamActive(dt, player, dist) {
    if (dist < SLAM_RANGE) {
      player.takeDamage(SLAM_DMG);
      if (player.velocity) {
        player.velocity.x += this._lungeDir.x * 9;
        player.velocity.z += this._lungeDir.z * 9;
      }
      this._state = 'slam_recover';
      this._stateTimer = 0.4;
      return;
    }
    if (this._stateTimer <= 0) {
      this._state = 'slam_recover';
      this._stateTimer = 0.4;
    }
  }

  _stateSlamRecover(dt) {
    this.velocity.x *= Math.pow(0.06, dt);
    this.velocity.z *= Math.pow(0.06, dt);
    if (this._stateTimer <= 0) this._state = 'approach';
  }

  _stateHowlWindup(dt, player, dist) {
    this.velocity.x *= 0.85; this.velocity.z *= 0.85;

    // Pulse the mesh red
    const pulse = (Math.sin(Date.now() * 0.012) * 0.5 + 0.5);
    const hex   = Math.floor(pulse * 0x44) << 16;
    this.mesh.traverse(c => { if (c.isMesh && c.material?.emissive) c.material.emissive.setHex(hex); });

    // Grow the aura ring toward howl radius
    if (this._howlAura) {
      const elapsed  = this._howlWindupDur - this._stateTimer;
      const t        = Math.min(elapsed / this._howlWindupDur, 1);
      const targetScale = HOWL_RADIUS / 0.22;
      this._howlAura.scale.setScalar(1 + t * (targetScale - 1));
      this._howlAura.material.opacity = 0.3 + 0.3 * (1 - t);
      this._howlAura.position.set(this.mesh.position.x, 0.04, this.mesh.position.z);
    }

    if (this._stateTimer <= 0) {
      this._state = 'howl_active';
      this._stateTimer = 0.12;
    }
  }

  _stateHowlActive(dt, player, dist) {
    this._removeHowlAura();
    this._spawnHowlBurst();

    // Slow player if inside radius
    if (dist <= HOWL_RADIUS) {
      player.slowMovement(HOWL_SLOW_DUR);
    }

    this.mesh.traverse(c => { if (c.isMesh && c.material?.emissive) c.material.emissive.setHex(0x000000); });
    this._howlCd = HOWL_CD_MIN + Math.random() * (HOWL_CD_MAX - HOWL_CD_MIN);
    this._state  = 'recover';
    this._stateTimer = 0.8;
  }

  _stateRecover(dt) {
    this.velocity.x *= Math.pow(0.08, dt);
    this.velocity.z *= Math.pow(0.08, dt);
    if (this._stateTimer <= 0) this._state = 'approach';
  }
}
