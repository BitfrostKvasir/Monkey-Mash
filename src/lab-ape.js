import * as THREE from 'three';
import { spawnDmgNum } from './damage-numbers.js';

const HP            = 950;
const SCALE         = 1.8;
const SPEED         = 2.8;
const SPEED_OVERLOAD = 4.4;

const LASER_WINDUP   = 0.5;
const LASER_ACTIVE   = 2.0;
const LASER_CD       = 4.5;
const SLAM_WINDUP    = 0.35;
const SLAM_CD        = 3.5;
const GRENADE_CD     = 5.0;
const GRENADE_WINDUP = 0.5;

const SPARK_LIFE     = 5.5;
const SPARK_DMG      = 8;
const SPARK_RADIUS   = 0.9;

// ── Electro grenade ───────────────────────────────────────────────
class ElectroGrenade {
  constructor(scene, startPos, dir) {
    this.scene   = scene;
    this._life   = 1.8;
    this._done   = false;
    this._bounces = 0;
    this._maxBounces = 3;

    this._vx = dir.x * 7.5;
    this._vz = dir.z * 7.5;
    this._vy = 4.5;  // initial upward velocity

    const geo = new THREE.SphereGeometry(0.22, 8, 6);
    const mat = new THREE.MeshLambertMaterial({ color: 0x44ffaa, emissive: new THREE.Color(0x002211) });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(startPos);
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    this._exploded  = false;
    this._explTimer = 0;
    this._explMesh  = null;
  }

  update(dt, player) {
    if (this._done) return true;

    if (this._exploded) {
      this._explTimer -= dt;
      if (this._explMesh) {
        const s = 1 + (1 - this._explTimer / 0.3) * 1.2;
        this._explMesh.scale.set(s, 1, s);
        this._explMesh.material.opacity = (this._explTimer / 0.3) * 0.6;
      }
      if (this._explTimer <= 0) { if (this._explMesh) this.scene.remove(this._explMesh); this._done = true; }
      return false;
    }

    this._vy -= 18 * dt; // gravity
    this.mesh.position.x += this._vx * dt;
    this.mesh.position.z += this._vz * dt;
    this.mesh.position.y += this._vy * dt;
    this.mesh.rotation.x += dt * 6;

    // Bounce on floor
    if (this.mesh.position.y <= 0.22) {
      this.mesh.position.y = 0.22;
      this._vy = Math.abs(this._vy) * 0.55;
      this._vx *= 0.7; this._vz *= 0.7;
      this._bounces++;
    }

    // Damage player on contact
    const dx = player.position.x - this.mesh.position.x;
    const dz = player.position.z - this.mesh.position.z;
    if (dx*dx + dz*dz < 0.8*0.8) player.takeDamage(18);

    this._life -= dt;
    if (this._bounces >= this._maxBounces || this._life <= 0) {
      this._explode(player); return false;
    }
    // Pulse emissive
    const p = (Math.sin(Date.now() * 0.02) + 1) * 0.5;
    this.mesh.material.emissive.setRGB(0, p * 0.35, p * 0.2);
    return false;
  }

  _explode(player) {
    this._exploded = true; this._explTimer = 0.3;
    this.scene.remove(this.mesh);

    const eGeo = new THREE.RingGeometry(0.1, 2.2, 24);
    const eMat = new THREE.MeshBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
    this._explMesh = new THREE.Mesh(eGeo, eMat);
    this._explMesh.rotation.x = -Math.PI / 2;
    this._explMesh.position.set(this.mesh.position.x, 0.06, this.mesh.position.z);
    this.scene.add(this._explMesh);

    const dx = player.position.x - this.mesh.position.x;
    const dz = player.position.z - this.mesh.position.z;
    if (dx*dx + dz*dz < 2.2*2.2) player.takeDamage(30);
  }

  destroy() {
    if (!this._done) {
      this.scene.remove(this.mesh);
      if (this._explMesh) this.scene.remove(this._explMesh);
      this._done = true;
    }
  }
}

// ── Floor spark hazard ────────────────────────────────────────────
class SparkHazard {
  constructor(scene, x, z) {
    this.scene   = scene;
    this._timer  = SPARK_LIFE;
    this._done   = false;

    const geo = new THREE.CircleGeometry(SPARK_RADIUS, 10);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(x, 0.04, z);
    scene.add(this.mesh);
  }

  update(dt, player) {
    if (this._done) return true;
    this._timer -= dt;

    const fade = Math.min(1, this._timer / 0.8);
    this.mesh.material.opacity = 0.45 * fade;
    // Pulse
    const p = (Math.sin(Date.now() * 0.018) + 1) * 0.5;
    this.mesh.material.color.setRGB(0, 0.4 + p * 0.3, 0.7 + p * 0.3);

    const dx = player.position.x - this.mesh.position.x;
    const dz = player.position.z - this.mesh.position.z;
    if (dx*dx + dz*dz < SPARK_RADIUS * SPARK_RADIUS) player.takeDamage(SPARK_DMG * dt * 3);

    if (this._timer <= 0) { this.destroy(); return true; }
    return false;
  }

  destroy() {
    if (!this._done) { this.scene.remove(this.mesh); this._done = true; }
  }
}

// ── Lab Ape ───────────────────────────────────────────────────────
export class LabApe {
  constructor(scene, x, z) {
    this.scene          = scene;
    this.name           = 'Lab Ape';
    this.isDead         = false;
    this.hp             = HP;
    this.maxHp          = HP;
    this._droppedBanana = false;
    this._flashTimer    = 0;
    this.velocity       = new THREE.Vector3();
    this.pendingSpawns  = [];

    this._isOverloaded  = false;
    this._overloadDone  = false;

    this._state      = 'approach';
    this._stateTimer = 0;
    this._attackCd   = 1.5;

    this._laserActive    = false;
    this._laserTimer     = 0;
    this._laserBeam      = null;
    this._laserIndicator = null;

    this._grenades    = [];
    this._sparks      = [];
    this._sparkSpawnTimer = 0;
    this._slamSparks  = [];

    this.hitRadius = 1.1; // world-space — body 0.48 × SCALE 1.8 ≈ 0.86, plus a margin

    this.mesh = this._buildMesh();
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this._buildHealthBar();
  }

  _buildMesh() {
    const g      = new THREE.Group();
    const metal  = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
    const dmetal = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const red    = new THREE.MeshLambertMaterial({ color: 0xff2222 });
    const wire   = new THREE.MeshLambertMaterial({ color: 0x444411 });
    const glow   = new THREE.MeshBasicMaterial({ color: 0xff3300 });

    const add = (geo, mat, x=0, y=0, z=0, sx=1, sy=1, sz=1) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; g.add(m); return m;
    };

    // Body with front chest plate
    add(new THREE.SphereGeometry(0.48, 10, 8), metal, 0, 0.65, 0, 1.1, 1.25, 1.0);
    // Chest plate (front, slightly protruding)
    this._chestPlate = add(new THREE.BoxGeometry(0.75, 0.65, 0.12), dmetal, 0, 0.72, 0.38);
    // Chest reactor
    this._reactorMesh = add(new THREE.SphereGeometry(0.14, 8, 6), glow, 0, 0.72, 0.47);

    // Head
    add(new THREE.SphereGeometry(0.44, 10, 8), metal, 0, 1.62, 0);
    // Glowing red eyes
    [-0.15, 0.15].forEach(x => {
      const eye = add(new THREE.SphereGeometry(0.09, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff2200 }), x, 1.70, 0.37);
      // store for glow effect
    });

    // Metal arm prosthetics — boxy/mechanical
    [-1, 1].forEach(d => {
      // Upper arm
      add(new THREE.BoxGeometry(0.24, 0.58, 0.24), dmetal, d*0.68, 0.82, 0);
      // Forearm
      add(new THREE.BoxGeometry(0.20, 0.50, 0.20), metal, d*0.68, 0.28, 0);
      // Mechanical claw (3 prongs)
      for (let fi = -1; fi <= 1; fi++) {
        const prong = new THREE.Mesh(
          new THREE.BoxGeometry(0.07, 0.22, 0.07),
          dmetal
        );
        prong.position.set(d*0.68 + fi*0.08, 0.01, 0.06);
        prong.castShadow = true;
        g.add(prong);
      }
      // Wires along arm
      for (let wi = 0; wi < 2; wi++) {
        add(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 5), wire, d*0.58, 0.58, (wi-0.5)*0.1);
      }
    });

    // Legs
    [-1, 1].forEach(d => add(new THREE.BoxGeometry(0.24, 0.45, 0.24), metal, d*0.26, 0.22, 0));

    // Back tubes
    for (let i = 0; i < 3; i++) {
      const tx = (i - 1) * 0.22;
      add(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 6), wire, tx, 0.95, -0.38);
    }

    g.scale.set(SCALE, SCALE, SCALE);
    return g;
  }

  _buildHealthBar() {
    const bgM = new THREE.MeshBasicMaterial({ color: 0x001122, side: THREE.DoubleSide });
    const fgM = new THREE.MeshBasicMaterial({ color: 0xff3300, side: THREE.DoubleSide });
    this._hpBg = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.22), bgM);
    this._hpFg = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.22), fgM);
    [this._hpBg, this._hpFg].forEach((m, i) => {
      m.rotation.x = -Math.PI / 2; m.position.set(0, 3.8 + i*0.02, 0); this.mesh.add(m);
    });
  }

  _updateHealthBar() {
    const r = this.hp / this.maxHp;
    this._hpFg.scale.x = r; this._hpFg.position.x = -1.25 * (1 - r);
  }

  takeDamage(amount, kbDir, meta = {}) {
    if (this.isDead) return;
    let dmg = amount;
    // Front plate: 15% mitigation if hit from front
    if (kbDir) {
      const faceX = Math.sin(this.mesh.rotation.y);
      const faceZ = Math.cos(this.mesh.rotation.y);
      const dot = (-kbDir.x) * faceX + (-kbDir.z) * faceZ;
      if (dot > 0.3) dmg *= 0.85;
      this.velocity.x += kbDir.x * 1.8; this.velocity.z += kbDir.z * 1.8;
    }
    spawnDmgNum(dmg, this.mesh.position, meta.isCrit ?? false);
    this.hp -= dmg; this._flashTimer = 0.12;
    if (this.hp <= 0) { this.die(); return; }
    this._updateHealthBar();
    if (!this._overloadDone && this.hp < this.maxHp * 0.6) {
      this._overloadDone = true;
      this._isOverloaded = true;
      this._reactorMesh.material.color.setHex(0xff0000);
    }
  }

  die() {
    this.isDead = true;
    this.scene.remove(this.mesh);
    this._removeLaser();
    for (const g of this._grenades) g.destroy();
    for (const s of this._sparks)   s.destroy();
    for (const s of this._slamSparks) this.scene.remove(s);
    this._grenades = []; this._sparks = []; this._slamSparks = [];
  }

  cleanup() {
    this._removeLaser();
    for (const g of this._grenades) g.destroy();
    for (const s of this._sparks)   s.destroy();
    for (const s of this._slamSparks) this.scene.remove(s);
    this._grenades = []; this._sparks = []; this._slamSparks = [];
  }

  _removeLaser() {
    if (this._laserBeam) { this.scene.remove(this._laserBeam); this._laserBeam = null; }
    if (this._laserIndicator) { this.scene.remove(this._laserIndicator); this._laserIndicator = null; }
    this._laserActive = false;
  }

  update(dt, player, allEnemies = []) {
    if (this.isDead) return;

    if (this._attackCd   > 0) this._attackCd   -= dt;
    if (this._stateTimer > 0) this._stateTimer -= dt;
    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      const on = Math.floor(this._flashTimer * 20) % 2 === 0;
      this.mesh.traverse(c => { if (c.isMesh && c.material?.emissive) c.material.emissive.setHex(on ? 0xffffff : 0x000000); });
    }

    // Update grenades + sparks
    for (let i = this._grenades.length - 1; i >= 0; i--) {
      if (this._grenades[i].update(dt, player)) this._grenades.splice(i, 1);
    }
    for (let i = this._sparks.length - 1; i >= 0; i--) {
      if (this._sparks[i].update(dt, player)) this._sparks.splice(i, 1);
    }

    // Overload: random spark hazards every 2s
    if (this._isOverloaded) {
      this._sparkSpawnTimer -= dt;
      if (this._sparkSpawnTimer <= 0) {
        this._sparkSpawnTimer = 1.2;
        const sx = (Math.random() * 2 - 1) * 9;
        const sz = (Math.random() * 2 - 1) * 7;
        this._sparks.push(new SparkHazard(this.scene, sx, sz));
      }
    }

    // Reactor pulse
    const p = (Math.sin(Date.now() * 0.012) + 1) * 0.5;
    this._reactorMesh.material.color.setRGB(
      this._isOverloaded ? 1 : 0.7 + p * 0.3,
      this._isOverloaded ? p * 0.1 : p * 0.1,
      0
    );

    // Knockback decay
    this.velocity.x *= Math.pow(0.08, dt);
    this.velocity.z *= Math.pow(0.08, dt);

    const dx   = player.position.x - this.mesh.position.x;
    const dz   = player.position.z - this.mesh.position.z;
    const dist = Math.sqrt(dx*dx + dz*dz);

    switch (this._state) {
      case 'approach':       this._stateApproach(dt, dist, dx, dz);          break;
      case 'laser_windup':   this._stateLaserWindup(dt, dist, dx, dz, player); break;
      case 'laser_firing':   this._stateLaserFiring(dt, player);              break;
      case 'slam_windup':    this._stateSlamWindup(dt, player, dist, dx, dz); break;
      case 'slam_active':    this._stateSlamActive(dt, player);               break;
      case 'grenade_windup': this._stateGrenadeWindup(dt, player, dx, dz);   break;
      case 'recover':        this._stateRecover(dt);                          break;
    }

    this.mesh.position.addScaledVector(this.velocity, dt);

    if (this.mesh.position.x >  9.5) { this.mesh.position.x =  9.5; this.velocity.x = Math.min(0, this.velocity.x); }
    if (this.mesh.position.x < -9.5) { this.mesh.position.x = -9.5; this.velocity.x = Math.max(0, this.velocity.x); }
    if (this.mesh.position.z >  7.5) { this.mesh.position.z =  7.5; this.velocity.z = Math.min(0, this.velocity.z); }
    if (this.mesh.position.z < -7.5) { this.mesh.position.z = -7.5; this.velocity.z = Math.max(0, this.velocity.z); }

    if (dist > 0.1) this.mesh.rotation.y = Math.atan2(dx, dz);

    // Update laser beam position
    if (this._laserActive && this._laserBeam) {
      this._updateLaserPosition(player);
    }
  }

  _stateApproach(dt, dist, dx, dz) {
    const speed = this._isOverloaded ? SPEED_OVERLOAD : SPEED;
    if (dist > 4) {
      this.velocity.x += dx / dist * speed * dt * 5;
      this.velocity.z += dz / dist * speed * dt * 5;
      const spd = Math.sqrt(this.velocity.x**2 + this.velocity.z**2);
      if (spd > speed) { this.velocity.x = this.velocity.x/spd*speed; this.velocity.z = this.velocity.z/spd*speed; }
    }
    if (this._attackCd <= 0) this._pickNextAttack(dist);
  }

  _pickNextAttack(dist) {
    // Weight attacks by distance and overload state
    const attacks = ['laser', 'grenade'];
    if (dist < 7.5) attacks.push('slam');
    const pick = attacks[Math.floor(Math.random() * attacks.length)];
    if (pick === 'laser') {
      this._state = 'laser_windup'; this._stateTimer = LASER_WINDUP;
      this._laserActive = false;
    } else if (pick === 'slam') {
      this._state = 'slam_windup'; this._stateTimer = SLAM_WINDUP;
    } else {
      this._state = 'grenade_windup'; this._stateTimer = GRENADE_WINDUP;
    }
    this._attackCd = 0;
  }

  _stateLaserWindup(dt, dist, dx, dz, player) {
    this.velocity.x *= Math.pow(0.05, dt);
    this.velocity.z *= Math.pow(0.05, dt);

    // Show red floor indicator in aim direction
    if (!this._laserIndicator) {
      const range = 12;
      const geo = new THREE.PlaneGeometry(0.18, range);
      const mat = new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
      this._laserIndicator = new THREE.Mesh(geo, mat);
      this._laserIndicator.rotation.x = -Math.PI / 2;
      this.scene.add(this._laserIndicator);
    }
    // Update indicator to aim at player
    const ang = Math.atan2(dx, dz);
    const range = 12;
    this._laserIndicator.position.set(
      this.mesh.position.x + Math.sin(ang) * range/2,
      0.03,
      this.mesh.position.z + Math.cos(ang) * range/2
    );
    this._laserIndicator.rotation.z = ang;

    const p = (Math.sin(Date.now() * 0.025) + 1) * 0.5;
    this._laserIndicator.material.opacity = 0.2 + p * 0.3;

    if (this._stateTimer <= 0) {
      this.scene.remove(this._laserIndicator); this._laserIndicator = null;
      this._fireLaser(player);
      this._state = 'laser_firing'; this._stateTimer = LASER_ACTIVE * (this._isOverloaded ? 0.8 : 1);
      this._attackCd = LASER_CD * (this._isOverloaded ? 0.7 : 1);
    }
  }

  _fireLaser(player) {
    const aimDir = new THREE.Vector3(
      player.position.x - this.mesh.position.x,
      0,
      player.position.z - this.mesh.position.z
    ).normalize();
    this._laserAimDir = aimDir;

    // Create laser beam geometry
    const laserLen = 14;
    const geo = new THREE.BoxGeometry(0.12, 0.12, laserLen);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff3300 });
    this._laserBeam = new THREE.Mesh(geo, mat);
    this.scene.add(this._laserBeam);
    this._laserActive = true;
    this._updateLaserPosition(player);

    // Second laser in overload
    if (this._isOverloaded) {
      const geo2 = new THREE.BoxGeometry(0.12, 0.12, laserLen);
      const mat2 = new THREE.MeshBasicMaterial({ color: 0xff3300 });
      this._laserBeam2 = new THREE.Mesh(geo2, mat2);
      this.scene.add(this._laserBeam2);
      // Offset 90 degrees
      this._laserAimDir2 = new THREE.Vector3(-aimDir.z, 0, aimDir.x);
    }
  }

  _updateLaserPosition(player) {
    if (!this._laserBeam || !this._laserAimDir) return;
    const laserLen = 14;
    const origin = this.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    const ang = Math.atan2(this._laserAimDir.x, this._laserAimDir.z);
    this._laserBeam.position.set(
      origin.x + this._laserAimDir.x * laserLen / 2,
      1.2,
      origin.z + this._laserAimDir.z * laserLen / 2
    );
    this._laserBeam.rotation.y = ang;

    if (this._laserBeam2 && this._laserAimDir2) {
      const ang2 = Math.atan2(this._laserAimDir2.x, this._laserAimDir2.z);
      this._laserBeam2.position.set(
        origin.x + this._laserAimDir2.x * laserLen / 2,
        1.2,
        origin.z + this._laserAimDir2.z * laserLen / 2
      );
      this._laserBeam2.rotation.y = ang2;
    }
  }

  _stateLaserFiring(dt, player) {
    this.velocity.x *= Math.pow(0.05, dt);
    this.velocity.z *= Math.pow(0.05, dt);

    // Damage player if in beam path
    if (this._laserAimDir) {
      this._checkLaserHit(this._laserAimDir, player);
    }
    if (this._laserAimDir2) {
      this._checkLaserHit(this._laserAimDir2, player);
    }

    // Pulse opacity
    const p = (Math.sin(Date.now() * 0.03) + 1) * 0.5;
    if (this._laserBeam) this._laserBeam.scale.y = 0.8 + p * 0.4;

    if (this._stateTimer <= 0) {
      this._removeLaser();
      if (this._laserBeam2) { this.scene.remove(this._laserBeam2); this._laserBeam2 = null; }
      this._state = 'recover'; this._stateTimer = 0.8;
    }
  }

  _checkLaserHit(aimDir, player) {
    // Project player onto laser line
    const ox = this.mesh.position.x, oz = this.mesh.position.z;
    const px = player.position.x - ox, pz = player.position.z - oz;
    const t  = px * aimDir.x + pz * aimDir.z;
    if (t < 0 || t > 14) return;
    const perpX = px - aimDir.x * t;
    const perpZ = pz - aimDir.z * t;
    if (perpX*perpX + perpZ*perpZ < 0.5*0.5) {
      player.takeDamage(28 * (1/60)); // continuous DPS ~28/s
    }
  }

  _stateSlamWindup(dt, player, dist, dx, dz) {
    this.velocity.x *= Math.pow(0.05, dt);
    this.velocity.z *= Math.pow(0.05, dt);
    if (this._stateTimer <= 0) {
      this._state = 'slam_active'; this._stateTimer = 0.22;
      this._slamDir = { dx: dx/(dist||1), dz: dz/(dist||1) };
      this._slamTarget = player.position.clone();
      const spd = this._isOverloaded ? SPEED_OVERLOAD * 3 : SPEED * 3;
      this.velocity.x = this._slamDir.dx * spd;
      this.velocity.z = this._slamDir.dz * spd;
      this.mesh.position.y = 0;
      this._slamHit = false;
    }
  }

  _stateSlamActive(dt, player) {
    const progress = 1 - this._stateTimer / 0.22;
    this.mesh.position.y = 1.5 * Math.sin(progress * Math.PI);

    if (this._stateTimer <= 0) {
      this.mesh.position.y = 0;
      this.velocity.set(0, 0, 0);
      // Two AoE zones
      this._dealSlamAoE(this.mesh.position, player, 3.0, 36);
      const offset = new THREE.Vector3(this._slamDir.dx, 0, this._slamDir.dz).multiplyScalar(1.8);
      this._dealSlamAoE(this.mesh.position.clone().add(offset), player, 2.5, 26);

      // Leave spark hazards at slam sites
      [this.mesh.position.clone(), this.mesh.position.clone().add(offset)].forEach(pos => {
        for (let i = 0; i < (this._isOverloaded ? 4 : 2); i++) {
          const sx = pos.x + (Math.random()-0.5)*2;
          const sz = pos.z + (Math.random()-0.5)*2;
          this._sparks.push(new SparkHazard(this.scene, sx, sz));
        }
      });

      this._state = 'recover'; this._stateTimer = 1.0;
      this._attackCd = SLAM_CD * (this._isOverloaded ? 0.65 : 1);
    }
  }

  _dealSlamAoE(pos, player, radius, damage) {
    const dx = player.position.x - pos.x;
    const dz = player.position.z - pos.z;
    if (dx*dx + dz*dz < radius*radius) player.takeDamage(damage);

    const geo = new THREE.RingGeometry(0.2, radius, 24);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.65, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.05, pos.z);
    this.scene.add(ring);
    this._slamSparks.push(ring);
    let t = 0;
    const fade = () => {
      t += 0.05;
      ring.material.opacity = Math.max(0, 0.65 - t * 2.5);
      if (t < 0.5 && !this.isDead) requestAnimationFrame(fade);
      else { this.scene.remove(ring); this._slamSparks = this._slamSparks.filter(s => s !== ring); }
    };
    requestAnimationFrame(fade);
  }

  _stateGrenadeWindup(dt, player, dx, dz) {
    this.velocity.x *= Math.pow(0.1, dt);
    this.velocity.z *= Math.pow(0.1, dt);
    if (this._stateTimer <= 0) {
      const dist = Math.sqrt(dx*dx + dz*dz) || 1;
      const dir  = new THREE.Vector3(dx/dist, 0, dz/dist);
      const start = this.mesh.position.clone().add(new THREE.Vector3(dir.x*0.8, 1.8, dir.z*0.8));
      this._grenades.push(new ElectroGrenade(this.scene, start, dir));
      if (this._isOverloaded) {
        const dir2 = new THREE.Vector3(dx/dist + 0.45, 0, dz/dist - 0.3).normalize();
        const dir3 = new THREE.Vector3(dx/dist - 0.45, 0, dz/dist + 0.3).normalize();
        this._grenades.push(new ElectroGrenade(this.scene, start.clone(), dir2));
        this._grenades.push(new ElectroGrenade(this.scene, start.clone(), dir3));
      }
      this._state = 'recover'; this._stateTimer = 0.9;
      this._attackCd = GRENADE_CD * (this._isOverloaded ? 0.7 : 1);
    }
  }

  _stateRecover(dt) {
    this.velocity.x *= Math.pow(0.1, dt);
    this.velocity.z *= Math.pow(0.1, dt);
    if (this._stateTimer <= 0) this._state = 'approach';
  }
}
