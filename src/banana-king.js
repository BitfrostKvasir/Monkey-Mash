import * as THREE from 'three';
import { BananaBandit } from './banana-bandit.js';
import { spawnDmgNum } from './damage-numbers.js';

const HP           = 750;
const SCALE        = 2.0;
const SPEED        = 3.2;
const SPEED_ENRAGE = 5.0;

const BARRAGE_WINDUP  = 0.7;
const BARRAGE_CD      = 3.5;
const SLAM_WINDUP     = 0.5;
const SLAM_CD         = 4.0;
const SUMMON_CD       = 20.0;

const BANANA_FLIGHT   = 0.9;
const BANANA_EXPL_R   = 2.1;
const BANANA_DMG      = 30;

// ── Thrown banana projectile ─────────────────────────────────────
class RoyalBanana {
  constructor(scene, startPos, targetPos) {
    this.scene    = scene;
    this._start   = startPos.clone();
    this._target  = targetPos.clone();
    this._t       = 0;
    this._done    = false;
    this._exploded = false;
    this._explTimer = 0;
    this._explMesh  = null;

    const geo = new THREE.SphereGeometry(0.28, 8, 6);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffe135, emissive: new THREE.Color(0x443300) });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(startPos);
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    // Landing ring
    const mGeo = new THREE.RingGeometry(0.1, BANANA_EXPL_R, 24);
    this._markerMat = new THREE.MeshBasicMaterial({ color: 0xffee00, transparent: true, opacity: 0.30, side: THREE.DoubleSide });
    this._marker = new THREE.Mesh(mGeo, this._markerMat);
    this._marker.rotation.x = -Math.PI / 2;
    this._marker.position.set(targetPos.x, 0.04, targetPos.z);
    scene.add(this._marker);
  }

  update(dt, player) {
    if (this._done) return true;

    if (this._exploded) {
      this._explTimer -= dt;
      if (this._explMesh) {
        const s = 1 + (1 - this._explTimer / 0.35) * 1.6;
        this._explMesh.scale.set(s, 1, s);
        this._explMesh.material.opacity = (this._explTimer / 0.35) * 0.55;
      }
      if (this._explTimer <= 0) {
        if (this._explMesh) this.scene.remove(this._explMesh);
        this._done = true;
      }
      return false;
    }

    this._t += dt / BANANA_FLIGHT;
    if (this._t > 0.6) this._markerMat.opacity = 0.25 + Math.sin(this._t * 20) * 0.12;

    if (this._t >= 1.0) { this._explode(player); return false; }

    const x = THREE.MathUtils.lerp(this._start.x, this._target.x, this._t);
    const z = THREE.MathUtils.lerp(this._start.z, this._target.z, this._t);
    const y = 4.0 * Math.sin(this._t * Math.PI);
    this.mesh.position.set(x, y, z);
    this.mesh.rotation.x += dt * 5;
    return false;
  }

  _explode(player) {
    this._exploded = true; this._explTimer = 0.35;
    this.scene.remove(this.mesh);
    this.scene.remove(this._marker);

    const eGeo = new THREE.RingGeometry(0.1, BANANA_EXPL_R, 24);
    const eMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
    this._explMesh = new THREE.Mesh(eGeo, eMat);
    this._explMesh.rotation.x = -Math.PI / 2;
    this._explMesh.position.set(this._target.x, 0.06, this._target.z);
    this.scene.add(this._explMesh);

    const dx = player.position.x - this._target.x;
    const dz = player.position.z - this._target.z;
    if (dx*dx + dz*dz < BANANA_EXPL_R * BANANA_EXPL_R) player.takeDamage(BANANA_DMG);
  }

  destroy() {
    if (!this._done) {
      this.scene.remove(this.mesh);
      this.scene.remove(this._marker);
      if (this._explMesh) this.scene.remove(this._explMesh);
      this._done = true;
    }
  }
}

// ── Banana King ──────────────────────────────────────────────────
export class BananaKing {
  constructor(scene, x, z) {
    this.scene          = scene;
    this.name           = 'The Banana King';
    this.isDead         = false;
    this.hp             = HP;
    this.maxHp          = HP;
    this._droppedBanana = false;
    this._flashTimer    = 0;
    this.velocity       = new THREE.Vector3();
    this.pendingSpawns  = [];

    this._isEnraged     = false;
    this._enrageDone    = false;  // one-time enrage at 50%
    this._minionCd      = 0;
    this._minion25Done  = false;  // first minion wave at 75% hp

    this._state       = 'approach';
    this._stateTimer  = 0;
    this._attackCd    = 1.8;  // initial pause
    this._slamShockwave2Timer = 0;
    this._minion10Done = false; // second minion wave at 25% HP

    this._bananas  = [];
    this._sparkles = [];

    this.hitRadius = 1.4; // world-space — body 0.55 × SCALE 2.0 = 1.1, plus a margin

    this.mesh = this._buildMesh();
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this._buildHealthBar();
  }

  _buildMesh() {
    const g      = new THREE.Group();
    const gold   = new THREE.MeshLambertMaterial({ color: 0xd4a017 });
    const dgold  = new THREE.MeshLambertMaterial({ color: 0xb8860b });
    const banana = new THREE.MeshLambertMaterial({ color: 0xffe135 });
    const green  = new THREE.MeshLambertMaterial({ color: 0x2d8a2d });
    const red    = new THREE.MeshLambertMaterial({ color: 0xff3333 });
    const black  = new THREE.MeshLambertMaterial({ color: 0x111111 });

    const add = (geo, mat, x=0, y=0, z=0, sx=1, sy=1, sz=1) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; g.add(m); return m;
    };

    // Body — broad chest
    add(new THREE.SphereGeometry(0.55, 10, 8), gold, 0, 0.7, 0, 1.2, 1.3, 1.0);
    // Head
    add(new THREE.SphereGeometry(0.52, 10, 8), gold, 0, 1.75, 0);
    // Eyes
    [-0.18, 0.18].forEach(x => {
      add(new THREE.SphereGeometry(0.09, 6, 4), red,   x, 1.83, 0.43);
      add(new THREE.SphereGeometry(0.05, 5, 3), black, x, 1.83, 0.48);
    });
    // Snout / muzzle
    add(new THREE.SphereGeometry(0.22, 8, 6), dgold, 0, 1.65, 0.40);

    // Arms — thick and muscular
    [-1, 1].forEach(d => {
      add(new THREE.CylinderGeometry(0.20, 0.17, 0.80, 8), gold, d*0.75, 0.90, 0, 1,1,1);
      // forearm
      add(new THREE.CylinderGeometry(0.16, 0.14, 0.60, 8), gold, d*0.75, 0.28, 0, 1,1,1);
      // fist
      add(new THREE.SphereGeometry(0.20, 8, 6), gold, d*0.75, 0.02, 0);
      // wrist banana jewelry
      add(new THREE.SphereGeometry(0.06, 6, 4), banana, d*0.75, 0.22, 0.14);
      add(new THREE.SphereGeometry(0.06, 6, 4), banana, d*0.75, 0.22, -0.14);
    });

    // Legs
    [-1, 1].forEach(d => {
      add(new THREE.CylinderGeometry(0.18, 0.16, 0.50, 8), gold, d*0.28, 0.25, 0);
    });

    // Banana-leaf crown (fan of flat leaves)
    this._crownGroup = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const leaf = new THREE.Mesh(
        new THREE.PlaneGeometry(0.18, 0.55),
        new THREE.MeshLambertMaterial({ color: 0x22aa22, side: THREE.DoubleSide })
      );
      leaf.position.set(Math.cos(a) * 0.38, 2.15, Math.sin(a) * 0.38);
      leaf.rotation.y = a;
      leaf.rotation.x = -0.4;
      this._crownGroup.add(leaf);
    }
    // Crown band
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.50, 0.48, 0.14, 16),
      new THREE.MeshLambertMaterial({ color: 0xffd700, emissive: new THREE.Color(0x332200) })
    );
    band.position.y = 2.0;
    this._crownGroup.add(band);
    this._crownBand = band;
    g.add(this._crownGroup);

    // Neck banana necklace
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      add(new THREE.SphereGeometry(0.055, 6, 4), banana, Math.cos(a)*0.42, 1.30, Math.sin(a)*0.42);
    }

    g.scale.set(SCALE, SCALE, SCALE);
    return g;
  }

  _buildHealthBar() {
    const bgM = new THREE.MeshBasicMaterial({ color: 0x220000, side: THREE.DoubleSide });
    const fgM = new THREE.MeshBasicMaterial({ color: 0xffcc00, side: THREE.DoubleSide });
    this._hpBg = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.22), bgM);
    this._hpFg = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.22), fgM);
    [this._hpBg, this._hpFg].forEach((m, i) => {
      m.rotation.x = -Math.PI / 2; m.position.set(0, 4.2 + i*0.02, 0); this.mesh.add(m);
    });
  }

  _updateHealthBar() {
    const r = this.hp / this.maxHp;
    this._hpFg.scale.x = r; this._hpFg.position.x = -1.25 * (1 - r);
    this._hpFg.material.color.setHex(r > 0.5 ? 0xffcc00 : 0xff4400);
  }

  takeDamage(amount, kbDir, meta = {}) {
    if (this.isDead) return;
    spawnDmgNum(amount, this.mesh.position, meta.isCrit ?? false);
    this.hp -= amount; this._flashTimer = 0.12;
    // Boss is heavy — reduced knockback
    if (kbDir) { this.velocity.x += kbDir.x * 1.5; this.velocity.z += kbDir.z * 1.5; }
    if (this.hp <= 0) { this.die(); return; }
    this._updateHealthBar();
    this._checkPhaseTransitions();
  }

  _checkPhaseTransitions() {
    // First minion wave at 75% HP
    if (!this._minion25Done && this.hp < this.maxHp * 0.75) {
      this._minion25Done = true;
      this._summonMinions(3);
      this._minionCd = SUMMON_CD;
    }
    // Enrage at 60% HP (earlier than before)
    if (!this._enrageDone && this.hp < this.maxHp * 0.6) {
      this._enrageDone = true;
      this._isEnraged  = true;
      if (this._crownBand) this._crownBand.material.emissive.setHex(0x886600);
    }
    // Frenzy phase at 25% HP — big minion wave + attackCd reset
    if (!this._minion10Done && this.hp < this.maxHp * 0.25) {
      this._minion10Done = true;
      this._summonMinions(4);
      this._minionCd = SUMMON_CD;
      this._attackCd = 0; // attack immediately
    }
  }

  _summonMinions(count) {
    const hw = 9.5, hh = 7.5;
    const edges = [
      [-hw, (Math.random() - 0.5) * hh * 2],
      [ hw, (Math.random() - 0.5) * hh * 2],
      [(Math.random() - 0.5) * hw * 2, -hh],
      [(Math.random() - 0.5) * hw * 2,  hh],
    ];
    for (let i = 0; i < count; i++) {
      const [ex, ez] = edges[i % edges.length];
      this.pendingSpawns.push(new BananaBandit(this.scene, ex, ez));
    }
  }

  die() {
    this.isDead = true;
    this.scene.remove(this.mesh);
    for (const b of this._bananas) b.destroy();
    this._bananas = [];
    this._removeSparkles();
  }

  _removeSparkles() {
    for (const s of this._sparkles) this.scene.remove(s);
    this._sparkles = [];
  }

  cleanup() {
    for (const b of this._bananas) b.destroy();
    this._bananas = [];
    this._removeSparkles();
  }

  update(dt, player, allEnemies = []) {
    if (this.isDead) return;

    if (this._attackCd    > 0) this._attackCd    -= dt;
    if (this._stateTimer  > 0) this._stateTimer  -= dt;
    if (this._minionCd    > 0) this._minionCd    -= dt;
    if (this._flashTimer  > 0) {
      this._flashTimer -= dt;
      const on = Math.floor(this._flashTimer * 20) % 2 === 0;
      this.mesh.traverse(c => { if (c.isMesh && c.material?.emissive) c.material.emissive.setHex(on ? 0xffffff : (this._isEnraged ? 0x886600 : 0x000000)); });
    }

    // Update banana projectiles
    for (let i = this._bananas.length - 1; i >= 0; i--) {
      if (this._bananas[i].update(dt, player)) this._bananas.splice(i, 1);
    }

    // Second enrage shockwave
    if (this._slamShockwave2Timer > 0) {
      this._slamShockwave2Timer -= dt;
      if (this._slamShockwave2Timer <= 0) {
        this._dealShockwave(player, 5.0, 30);
      }
    }

    // Knockback decay
    this.velocity.x *= Math.pow(0.08, dt);
    this.velocity.z *= Math.pow(0.08, dt);

    // Idle crown sway
    this._crownGroup.rotation.z = Math.sin(Date.now() * 0.0015) * 0.08;

    const dx   = player.position.x - this.mesh.position.x;
    const dz   = player.position.z - this.mesh.position.z;
    const dist = Math.sqrt(dx*dx + dz*dz);

    switch (this._state) {
      case 'approach':        this._stateApproach(dt, dist, dx, dz, player);        break;
      case 'barrage_windup':  this._stateBarrageWindup(dt, dist, dx, dz, player);   break;
      case 'slam_windup':     this._stateSlamWindup(dt, player, dist, dx, dz);      break;
      case 'slam_active':     this._stateSlamActive(dt, player);                    break;
      case 'slam_recover':    this._stateSlamRecover(dt);                           break;
      case 'recover':         this._stateRecover(dt);                               break;
    }

    this.mesh.position.addScaledVector(this.velocity, dt);

    if (this.mesh.position.x >  9.5) { this.mesh.position.x =  9.5; this.velocity.x = Math.min(0, this.velocity.x); }
    if (this.mesh.position.x < -9.5) { this.mesh.position.x = -9.5; this.velocity.x = Math.max(0, this.velocity.x); }
    if (this.mesh.position.z >  7.5) { this.mesh.position.z =  7.5; this.velocity.z = Math.min(0, this.velocity.z); }
    if (this.mesh.position.z < -7.5) { this.mesh.position.z = -7.5; this.velocity.z = Math.max(0, this.velocity.z); }

    if (dist > 0.1) this.mesh.rotation.y = Math.atan2(dx, dz);
  }

  _stateApproach(dt, dist, dx, dz, player) {
    const speed = this._isEnraged ? SPEED_ENRAGE : SPEED;
    if (dist > 3.5) {
      this.velocity.x += dx / dist * speed * dt * 5;
      this.velocity.z += dz / dist * speed * dt * 5;
      const spd = Math.sqrt(this.velocity.x**2 + this.velocity.z**2);
      if (spd > speed) { this.velocity.x = this.velocity.x/spd*speed; this.velocity.z = this.velocity.z/spd*speed; }
    }
    // Minion summon check
    if (this._minionCd <= 0 && this._minion25Done) {
      this._summonMinions(this._isEnraged ? 4 : 3); this._minionCd = SUMMON_CD;
    }
    if (this._attackCd <= 0) this._pickNextAttack(dist);
  }

  _pickNextAttack(dist) {
    // Prefer slam if close, barrage if far; enraged slams more
    const doSlam = dist < 7 && Math.random() < (this._isEnraged ? 0.7 : 0.55);
    if (doSlam) {
      this._state = 'slam_windup'; this._stateTimer = SLAM_WINDUP;
      this.mesh.scale.set(SCALE, SCALE * 0.85, SCALE); // crouch
    } else {
      this._state = 'barrage_windup'; this._stateTimer = BARRAGE_WINDUP;
      this._barrageTargetPos = player ? new THREE.Vector3(
        player.position.x + (Math.random()-0.5)*2,
        0,
        player.position.z + (Math.random()-0.5)*2
      ) : null;
    }
    this._attackCd = 0;
  }

  _stateBarrageWindup(dt, dist, dx, dz, player) {
    // Slow during windup
    this.velocity.x *= Math.pow(0.1, dt);
    this.velocity.z *= Math.pow(0.1, dt);
    // Raise arms animation — slight body pitch
    this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, -0.25, dt * 4);
    if (this._stateTimer <= 0) {
      this.mesh.rotation.x = 0;
      this._fireBarrage(player);
      this._state = 'recover'; this._stateTimer = 1.0;
      this._attackCd = BARRAGE_CD * (this._isEnraged ? 0.7 : 1);
    }
  }

  _fireBarrage(player) {
    const count = this._isEnraged ? 14 : (8 + Math.floor(Math.random() * 4));
    const baseAngle = Math.atan2(
      player.position.x - this.mesh.position.x,
      player.position.z - this.mesh.position.z
    );
    const spreadTotal = Math.PI * 0.65;
    for (let i = 0; i < count; i++) {
      const angle = baseAngle - spreadTotal/2 + (i / (count-1)) * spreadTotal;
      const dist  = 4 + Math.random() * 3;
      const tx = this.mesh.position.x + Math.sin(angle) * dist;
      const tz = this.mesh.position.z + Math.cos(angle) * dist;
      const start = this.mesh.position.clone().add(new THREE.Vector3(0, 2.0, 0));
      this._bananas.push(new RoyalBanana(this.scene, start, new THREE.Vector3(
        THREE.MathUtils.clamp(tx, -9.5, 9.5),
        0,
        THREE.MathUtils.clamp(tz, -7.5, 7.5)
      )));
    }
  }

  _stateSlamWindup(dt, player, dist, dx, dz) {
    this.velocity.x *= Math.pow(0.05, dt);
    this.velocity.z *= Math.pow(0.05, dt);
    // Roar pulse
    const p = (Math.sin(Date.now() * 0.015) + 1) * 0.5;
    this.mesh.traverse(c => { if (c.isMesh && c.material?.emissive && !c.material.color?.equals?.(new THREE.Color(0xffd700))) {
      c.material.emissive.setRGB(p * 0.3, p * 0.15, 0);
    }});
    if (this._stateTimer <= 0) {
      this.mesh.scale.set(SCALE, SCALE, SCALE);
      this._state = 'slam_active'; this._stateTimer = 0.25; // jump time
      // Launch upward
      this.mesh.position.y = 0;
      this._slamJumpY = 0; this._slamJumpDir = { dx: dx/(dist||1), dz: dz/(dist||1) };
      this._slamTargetPlayer = player;
    }
  }

  _stateSlamActive(dt, player) {
    this._slamJumpY = (this._slamJumpY || 0) + dt;
    const progress = 1 - this._stateTimer / 0.25;
    this.mesh.position.y = 2.2 * Math.sin(progress * Math.PI);
    // Move toward where player was
    if (this._slamJumpDir) {
      const speed = this._isEnraged ? SPEED_ENRAGE * 2.5 : SPEED * 2.5;
      this.velocity.x = this._slamJumpDir.dx * speed;
      this.velocity.z = this._slamJumpDir.dz * speed;
    }
    if (this._stateTimer <= 0) {
      this.mesh.position.y = 0;
      // SLAM — shockwave
      this._dealShockwave(player, 3.5, 38);
      this._slamShockwave2Timer = this._isEnraged ? 0.25 : 0.45; // always a second wave
      this._state = 'slam_recover'; this._stateTimer = 0.7;
      this._attackCd = SLAM_CD * (this._isEnraged ? 0.65 : 1);
      this.velocity.set(0, 0, 0);
    }
  }

  _dealShockwave(player, radius, damage) {
    const dx = player.position.x - this.mesh.position.x;
    const dz = player.position.z - this.mesh.position.z;
    if (dx*dx + dz*dz < radius * radius) player.takeDamage(damage);

    // Visual ring
    const geo = new THREE.RingGeometry(0.2, radius, 28);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(this.mesh.position); ring.position.y = 0.05;
    this.scene.add(ring);
    this._sparkles.push(ring);
    // Fade ring out
    let t = 0;
    const fade = () => {
      t += 0.04;
      ring.material.opacity = Math.max(0, 0.7 - t * 2.5);
      ring.scale.set(1 + t * 0.8, 1, 1 + t * 0.8);
      if (t < 0.55 && !this.isDead) requestAnimationFrame(fade);
      else { this.scene.remove(ring); this._sparkles = this._sparkles.filter(s => s !== ring); }
    };
    requestAnimationFrame(fade);
  }

  _stateSlamRecover(dt) {
    this.velocity.x *= Math.pow(0.1, dt);
    this.velocity.z *= Math.pow(0.1, dt);
    if (this._stateTimer <= 0) { this._state = 'approach'; }
  }

  _stateRecover(dt) {
    this.velocity.x *= Math.pow(0.15, dt);
    this.velocity.z *= Math.pow(0.15, dt);
    if (this._stateTimer <= 0) { this._state = 'approach'; }
  }
}
