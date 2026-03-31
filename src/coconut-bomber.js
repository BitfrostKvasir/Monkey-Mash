import * as THREE from 'three';

const SPEED          = 1.8;
const HP             = 65;
const PREFERRED_DIST = 5.0;
const FLIGHT_TIME    = 1.4;
const EXPL_RADIUS    = 2.0;
const EXPL_DMG       = 20;

// ── Coconut projectile ───────────────────────────────────────────
class Coconut {
  constructor(scene, startPos, targetPos) {
    this.scene    = scene;
    this._start   = startPos.clone();
    this._target  = targetPos.clone();
    this._t       = 0;
    this._done    = false;
    this._exploded = false;
    this._explosionTimer = 0;
    this._explosion = null;

    // Coconut mesh
    const geo = new THREE.SphereGeometry(0.22, 8, 6);
    const mat = new THREE.MeshLambertMaterial({ color: 0x6B4226 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.mesh.position.copy(startPos);
    scene.add(this.mesh);

    // Landing zone marker
    const mGeo = new THREE.RingGeometry(0.1, EXPL_RADIUS, 28);
    this._markerMat = new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    this._marker = new THREE.Mesh(mGeo, this._markerMat);
    this._marker.rotation.x = -Math.PI / 2;
    this._marker.position.set(targetPos.x, 0.04, targetPos.z);
    scene.add(this._marker);
  }

  update(dt, player) {
    if (this._done) return true;

    if (this._exploded) {
      this._explosionTimer -= dt;
      if (this._explosion) {
        const s = 1 + (1 - this._explosionTimer / 0.3) * 1.4;
        this._explosion.scale.set(s, 1, s);
        this._explosion.material.opacity = (this._explosionTimer / 0.3) * 0.65;
      }
      if (this._explosionTimer <= 0) {
        if (this._explosion) this.scene.remove(this._explosion);
        this._done = true;
      }
      return false;
    }

    this._t += dt / FLIGHT_TIME;

    // Pulse marker when close to landing
    if (this._t > 0.55) {
      this._markerMat.opacity = 0.25 + Math.sin(this._t * 22) * 0.15;
    }

    if (this._t >= 1.0) { this._explode(player); return false; }

    const x = THREE.MathUtils.lerp(this._start.x, this._target.x, this._t);
    const z = THREE.MathUtils.lerp(this._start.z, this._target.z, this._t);
    const y = 3.5 * Math.sin(this._t * Math.PI);
    this.mesh.position.set(x, y, z);
    this.mesh.rotation.x += dt * 6;
    this.mesh.rotation.z += dt * 3;
    return false;
  }

  _explode(player) {
    this._exploded = true; this._explosionTimer = 0.3;
    this.scene.remove(this.mesh);
    this.scene.remove(this._marker);

    const eGeo = new THREE.RingGeometry(0.1, EXPL_RADIUS, 28);
    const eMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.65, side: THREE.DoubleSide });
    this._explosion = new THREE.Mesh(eGeo, eMat);
    this._explosion.rotation.x = -Math.PI / 2;
    this._explosion.position.set(this._target.x, 0.06, this._target.z);
    this.scene.add(this._explosion);

    const dx = player.position.x - this._target.x;
    const dz = player.position.z - this._target.z;
    if (dx*dx + dz*dz < EXPL_RADIUS * EXPL_RADIUS) player.takeDamage(EXPL_DMG);
  }

  destroy() {
    if (!this._done) {
      this.scene.remove(this.mesh);
      this.scene.remove(this._marker);
      if (this._explosion) this.scene.remove(this._explosion);
      this._done = true;
    }
  }
}

// ── Coconut Bomber enemy ─────────────────────────────────────────
export class CoconutBomber {
  constructor(scene, x, z) {
    this.scene          = scene;
    this.isDead         = false;
    this.hp             = HP;
    this.maxHp          = HP;
    this._droppedBanana = false;
    this._flashTimer    = 0;
    this.velocity       = new THREE.Vector3();
    this.projectiles    = [];

    this._state       = 'position';
    this._throwCd     = 2.0 + Math.random();
    this._windupTimer = 0;
    this._throwArmG   = null;

    this.mesh = this._buildMesh();
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this._buildHealthBar();
  }

  _buildMesh() {
    const g         = new THREE.Group();
    const fur       = new THREE.MeshLambertMaterial({ color: 0x3a5a30 });
    const red       = new THREE.MeshLambertMaterial({ color: 0xff2222 });
    const black     = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const coconutM  = new THREE.MeshLambertMaterial({ color: 0x7B5E3C });

    const add = (geo, mat, x=0, y=0, z=0, sx=1, sy=1, sz=1) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x,y,z); m.scale.set(sx,sy,sz); m.castShadow=true; g.add(m); return m;
    };

    add(new THREE.SphereGeometry(0.34, 8, 6), fur, 0, 0.52, 0, 1, 1.15, 0.9);
    add(new THREE.SphereGeometry(0.38, 8, 6), fur, 0, 1.22, 0);
    [-0.12, 0.12].forEach(x => {
      add(new THREE.SphereGeometry(0.08, 6, 4), red,   x, 1.29, 0.32);
      add(new THREE.SphereGeometry(0.045,5, 3), black, x, 1.29, 0.355);
    });

    // Throw arm group (right)
    const ag = new THREE.Group();
    ag.position.set(0.44, 0.84, 0);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.50, 6), fur);
    arm.rotation.z = Math.PI / 2; arm.position.set(0.25, 0, 0); ag.add(arm);
    const coco = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 6), coconutM);
    coco.position.set(0.55, 0, 0); ag.add(coco);
    g.add(ag); this._throwArmG = ag;

    // Left arm
    const la = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.50, 6), fur);
    la.rotation.z = Math.PI / 2; la.position.set(-0.44, 0.84, 0); g.add(la);

    [-1,1].forEach(d => add(new THREE.CylinderGeometry(0.10, 0.09, 0.30, 6), fur, d*0.15, 0.15, 0));
    return g;
  }

  _buildHealthBar() {
    const bgM = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
    const fgM = new THREE.MeshBasicMaterial({ color: 0x44aa44, side: THREE.DoubleSide });
    this._hpBg = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.1), bgM);
    this._hpFg = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.1), fgM);
    [this._hpBg, this._hpFg].forEach((m, i) => { m.rotation.x=-Math.PI/2; m.position.set(0, 1.82+i*0.02, 0); this.mesh.add(m); });
  }

  _updateHealthBar() {
    const r = this.hp / this.maxHp;
    this._hpFg.scale.x = r; this._hpFg.position.x = -0.35*(1-r);
  }

  takeDamage(amount, kbDir) {
    if (this.isDead) return;
    this.hp -= amount; this._flashTimer = 0.12;
    if (kbDir) { this.velocity.x += kbDir.x*5; this.velocity.z += kbDir.z*5; }
    if (this.hp <= 0) this.die(); else this._updateHealthBar();
  }

  die() {
    this.isDead = true;
    this.scene.remove(this.mesh);
    this.cleanup();
  }

  cleanup() {
    for (const p of this.projectiles) p.destroy();
    this.projectiles = [];
  }

  update(dt, player, allEnemies = []) {
    if (this.isDead) return;

    if (this._throwCd > 0) this._throwCd -= dt;

    // Flash
    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      const on = Math.floor(this._flashTimer * 20) % 2 === 0;
      this.mesh.traverse(c => { if (c.isMesh && c.material?.emissive) c.material.emissive.setHex(on ? 0xffffff : 0x000000); });
    }

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      if (this.projectiles[i].update(dt, player)) this.projectiles.splice(i, 1);
    }

    // Knockback decay + separation
    this.velocity.x *= Math.pow(0.05, dt);
    this.velocity.z *= Math.pow(0.05, dt);
    for (const o of allEnemies) {
      if (o === this || o.isDead) continue;
      const sx = this.mesh.position.x - o.mesh.position.x;
      const sz = this.mesh.position.z - o.mesh.position.z;
      const sd = Math.sqrt(sx*sx + sz*sz);
      if (sd > 0 && sd < 1.2) { const p=(1.2-sd)/1.2*2.5; this.velocity.x+=sx/sd*p*dt; this.velocity.z+=sz/sd*p*dt; }
    }

    const dx = player.position.x - this.mesh.position.x;
    const dz = player.position.z - this.mesh.position.z;
    const dist = Math.sqrt(dx*dx + dz*dz);

    switch (this._state) {
      case 'position': this._statePosition(dt, dist, dx, dz); break;
      case 'windup':   this._stateWindup(dt, player, dx, dz); break;
    }

    this.mesh.position.addScaledVector(this.velocity, dt);
    if (dist > 0.1) this.mesh.rotation.y = Math.atan2(dx, dz);
  }

  _statePosition(dt, dist, dx, dz) {
    // Maintain preferred distance
    if (dist < PREFERRED_DIST - 1.0) {
      this.velocity.x -= dx/dist * SPEED * dt * 5;
      this.velocity.z -= dz/dist * SPEED * dt * 5;
    } else if (dist > PREFERRED_DIST + 2.0) {
      this.velocity.x += dx/dist * SPEED * dt * 5;
      this.velocity.z += dz/dist * SPEED * dt * 5;
    } else {
      this.velocity.x *= Math.pow(0.2, dt);
      this.velocity.z *= Math.pow(0.2, dt);
    }
    const spd = Math.sqrt(this.velocity.x**2+this.velocity.z**2);
    if (spd > SPEED) { this.velocity.x=this.velocity.x/spd*SPEED; this.velocity.z=this.velocity.z/spd*SPEED; }

    if (this._throwCd <= 0 && dist < 11 && dist > 2) {
      this._state = 'windup'; this._windupTimer = 0.85;
    }
  }

  _stateWindup(dt, player, dx, dz) {
    this._windupTimer -= dt;
    // Slow down
    this.velocity.x *= Math.pow(0.1, dt);
    this.velocity.z *= Math.pow(0.1, dt);
    // Raise arm
    if (this._throwArmG) {
      const progress = 1 - Math.max(0, this._windupTimer / 0.85);
      this._throwArmG.rotation.z = -progress * (Math.PI * 0.7);
    }
    // Glow yellow
    this.mesh.traverse(c => { if (c.isMesh && c.material?.emissive) c.material.emissive.setHex(0x332200); });

    if (this._windupTimer <= 0) {
      // Throw
      const startPos = this.mesh.position.clone().add(new THREE.Vector3(0, 1.1, 0));
      this.projectiles.push(new Coconut(this.scene, startPos, player.position.clone()));
      // Reset arm + glow
      if (this._throwArmG) this._throwArmG.rotation.z = 0;
      this.mesh.traverse(c => { if (c.isMesh && c.material?.emissive) c.material.emissive.setHex(0x000000); });
      this._state = 'position';
      this._throwCd = 2.5 + Math.random() * 1.5;
    }
  }
}
