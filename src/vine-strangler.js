import * as THREE from 'three';

const SPEED      = 1.5;
const HP         = 80;
const MID_RANGE  = 4.5;
const VINE_RANGE = 8.0;
const ROOT_DUR   = 1.8;
const VINE_LIFE  = 3.0;
const VINE_W     = 0.22;

// ── Vine trap ────────────────────────────────────────────────────
class VineTrap {
  constructor(scene, startPos, dir, len) {
    this.scene  = scene;
    this._timer = VINE_LIFE;
    this._done  = false;

    // Direction & hitbox info
    this._origin = startPos.clone();
    this._dir    = dir.clone().normalize();
    this._len    = len;

    const midX = startPos.x + dir.x * len * 0.5;
    const midZ = startPos.z + dir.z * len * 0.5;

    const geo = new THREE.BoxGeometry(VINE_W, 0.12, len);
    const mat = new THREE.MeshLambertMaterial({ color: 0x2d8a2d });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(midX, 0.06, midZ);
    this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
    scene.add(this.mesh);

    // Small leaf bumps along vine
    for (let i = 0; i < 4; i++) {
      const t = (i + 0.5) / 4;
      const bump = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 6, 4),
        new THREE.MeshLambertMaterial({ color: 0x228822 })
      );
      bump.position.set(midX + dir.x * (t - 0.5) * len, 0.12, midZ + dir.z * (t - 0.5) * len);
      scene.add(bump);
      // Store so we can remove them
      if (!this._bumps) this._bumps = [];
      this._bumps.push(bump);
    }
  }

  update(dt, player) {
    if (this._done) return true;
    this._timer -= dt;

    // Fade green → brown as it expires
    const ratio = this._timer / VINE_LIFE;
    const r = Math.floor(45 + (1 - ratio) * 90);
    const gb = Math.floor(138 * ratio);
    this.mesh.material.color.setRGB(r/255, gb/255, 45/255);

    if (this._timer <= 0) { this.destroy(); return true; }

    // Hit check: closest point on vine segment to player
    const px = player.position.x - this._origin.x;
    const pz = player.position.z - this._origin.z;
    const t  = THREE.MathUtils.clamp(px * this._dir.x + pz * this._dir.z, 0, this._len);
    const cx = this._origin.x + this._dir.x * t;
    const cz = this._origin.z + this._dir.z * t;
    const dx = player.position.x - cx;
    const dz = player.position.z - cz;
    if (dx*dx + dz*dz < 0.45*0.45) player.root(ROOT_DUR);

    return false;
  }

  destroy() {
    if (!this._done) {
      this.scene.remove(this.mesh);
      if (this._bumps) { for (const b of this._bumps) this.scene.remove(b); }
      this._done = true;
    }
  }
}

// ── Vine Strangler enemy ─────────────────────────────────────────
export class VineStrangler {
  constructor(scene, x, z) {
    this.scene          = scene;
    this.isDead         = false;
    this.hp             = HP;
    this.maxHp          = HP;
    this._droppedBanana = false;
    this._flashTimer    = 0;
    this.velocity       = new THREE.Vector3();
    this.traps          = [];

    this._state       = 'approach';
    this._stateTimer  = 0;
    this._shootCd     = 1.0;

    // Wind-up ground glow
    this._glowMesh = null;

    this.mesh = this._buildMesh();
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this._buildHealthBar();
  }

  _buildMesh() {
    const g     = new THREE.Group();
    const fur   = new THREE.MeshLambertMaterial({ color: 0x1a4a1a });
    const green = new THREE.MeshLambertMaterial({ color: 0x2d8a2d });
    const red   = new THREE.MeshLambertMaterial({ color: 0xff2222 });
    const black = new THREE.MeshLambertMaterial({ color: 0x111111 });

    const add = (geo, mat, x=0, y=0, z=0, sx=1, sy=1, sz=1) => {
      const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); m.scale.set(sx,sy,sz); m.castShadow=true; g.add(m); return m;
    };

    add(new THREE.SphereGeometry(0.33, 8, 6), fur, 0, 0.50, 0, 1, 1.2, 0.9);
    add(new THREE.SphereGeometry(0.37, 8, 6), fur, 0, 1.18, 0);
    // Vine crown on head
    for (let i=0; i<5; i++) {
      const a = (i/5)*Math.PI*2;
      const v = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.3, 5), green);
      v.position.set(Math.cos(a)*0.28, 1.52, Math.sin(a)*0.28);
      v.rotation.z = Math.cos(a) * 0.4; v.rotation.x = Math.sin(a) * 0.4;
      g.add(v);
    }
    [-0.11, 0.11].forEach(x => {
      add(new THREE.SphereGeometry(0.07, 6, 4), red,   x, 1.24, 0.31);
      add(new THREE.SphereGeometry(0.04, 5, 3), black, x, 1.24, 0.345);
    });
    // Long arms with vine-like tendrils
    [-1,1].forEach(d => {
      const a = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.60, 6), fur);
      a.rotation.z = Math.PI/2; a.position.set(d*0.42, 0.78, 0); g.add(a);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 0.25, 5), green);
      t.position.set(d*0.78, 0.78, 0); g.add(t);
    });
    [-1,1].forEach(d => add(new THREE.CylinderGeometry(0.10, 0.09, 0.28, 6), fur, d*0.14, 0.14, 0));
    return g;
  }

  _buildHealthBar() {
    const bgM = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
    const fgM = new THREE.MeshBasicMaterial({ color: 0x2d8a2d, side: THREE.DoubleSide });
    this._hpBg = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.1), bgM);
    this._hpFg = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.1), fgM);
    [this._hpBg, this._hpFg].forEach((m,i) => { m.rotation.x=-Math.PI/2; m.position.set(0,1.8+i*0.02,0); this.mesh.add(m); });
  }

  _updateHealthBar() {
    const r = this.hp/this.maxHp;
    this._hpFg.scale.x = r; this._hpFg.position.x = -0.35*(1-r);
  }

  takeDamage(amount, kbDir) {
    if (this.isDead) return;
    this.hp -= amount; this._flashTimer = 0.12;
    if (kbDir) { this.velocity.x += kbDir.x*4; this.velocity.z += kbDir.z*4; }
    if (this.hp <= 0) this.die(); else this._updateHealthBar();
  }

  die() {
    this.isDead = true;
    this.scene.remove(this.mesh);
    this._removeGlow();
    this.cleanup();
  }

  cleanup() {
    for (const t of this.traps) t.destroy();
    this.traps = [];
    this._removeGlow();
  }

  _removeGlow() {
    if (this._glowMesh) { this.scene.remove(this._glowMesh); this._glowMesh = null; }
  }

  update(dt, player, allEnemies = []) {
    if (this.isDead) return;

    if (this._shootCd > 0) this._shootCd -= dt;
    if (this._stateTimer > 0) this._stateTimer -= dt;

    // Flash
    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      const on = Math.floor(this._flashTimer*20)%2===0;
      this.mesh.traverse(c => { if (c.isMesh && c.material?.emissive) c.material.emissive.setHex(on ? 0xffffff : 0x000000); });
    }

    // Update traps
    for (let i=this.traps.length-1; i>=0; i--) {
      if (this.traps[i].update(dt, player)) this.traps.splice(i,1);
    }

    // Knockback decay + separation
    this.velocity.x *= Math.pow(0.05, dt);
    this.velocity.z *= Math.pow(0.05, dt);
    for (const o of allEnemies) {
      if (o===this || o.isDead) continue;
      const sx=this.mesh.position.x-o.mesh.position.x, sz=this.mesh.position.z-o.mesh.position.z;
      const sd=Math.sqrt(sx*sx+sz*sz);
      if (sd>0 && sd<1.2) { const p=(1.2-sd)/1.2*2; this.velocity.x+=sx/sd*p*dt; this.velocity.z+=sz/sd*p*dt; }
    }

    const dx = player.position.x - this.mesh.position.x;
    const dz = player.position.z - this.mesh.position.z;
    const dist = Math.sqrt(dx*dx + dz*dz);

    switch (this._state) {
      case 'approach': this._stateApproach(dt, dist, dx, dz); break;
      case 'windup':   this._stateWindup(dt, player, dist, dx, dz); break;
      case 'reset':    this._stateReset(dt); break;
    }

    this.mesh.position.addScaledVector(this.velocity, dt);
    if (dist > 0.1) this.mesh.rotation.y = Math.atan2(dx, dz);
  }

  _stateApproach(dt, dist, dx, dz) {
    if (dist > MID_RANGE + 0.5) {
      this.velocity.x += dx/dist * SPEED * dt * 5;
      this.velocity.z += dz/dist * SPEED * dt * 5;
      const spd = Math.sqrt(this.velocity.x**2+this.velocity.z**2);
      if (spd > SPEED) { this.velocity.x=this.velocity.x/spd*SPEED; this.velocity.z=this.velocity.z/spd*SPEED; }
    } else {
      this.velocity.x *= Math.pow(0.15, dt);
      this.velocity.z *= Math.pow(0.15, dt);
    }
    if (dist <= MID_RANGE + 1.0 && this._shootCd <= 0) {
      this._state = 'windup'; this._stateTimer = 0.65;
      this._spawnGlow();
    }
  }

  _spawnGlow() {
    this._removeGlow();
    const geo = new THREE.CircleGeometry(1.2, 20);
    const mat = new THREE.MeshBasicMaterial({ color: 0x44ff44, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
    this._glowMesh = new THREE.Mesh(geo, mat);
    this._glowMesh.rotation.x = -Math.PI / 2;
    this._glowMesh.position.copy(this.mesh.position);
    this._glowMesh.position.y = 0.03;
    this.scene.add(this._glowMesh);
  }

  _stateWindup(dt, player, dist, dx, dz) {
    this.velocity.x *= Math.pow(0.05, dt);
    this.velocity.z *= Math.pow(0.05, dt);

    // Pulse green emissive
    const pulse = (Math.sin(Date.now() * 0.012) + 1) * 0.5;
    this.mesh.traverse(c => { if (c.isMesh && c.material?.emissive) c.material.emissive.setHex(Math.floor(pulse*0x44)<<8); });
    if (this._glowMesh) this._glowMesh.material.opacity = 0.2 + pulse * 0.35;

    if (this._stateTimer <= 0) {
      // Shoot vine toward player
      const dir = new THREE.Vector3(dx, 0, dz);
      const len = Math.min(dist, VINE_RANGE);
      this.traps.push(new VineTrap(this.scene, this.mesh.position.clone(), dir, len));
      this.mesh.traverse(c => { if (c.isMesh && c.material?.emissive) c.material.emissive.setHex(0x000000); });
      this._removeGlow();
      this._shootCd = 3.5 + Math.random();
      this._state = 'reset'; this._stateTimer = 1.2;
    }
  }

  _stateReset(dt) {
    this.velocity.x *= Math.pow(0.1, dt);
    this.velocity.z *= Math.pow(0.1, dt);
    if (this._stateTimer <= 0) this._state = 'approach';
  }
}
