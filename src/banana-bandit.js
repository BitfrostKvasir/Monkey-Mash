import * as THREE from 'three';
import { spawnDmgNum } from './damage-numbers.js';

function getTarget(player) {
  return (player.activeDecoy && !player.activeDecoy.expired) ? player.activeDecoy : player;
}

const SPEED        = 4.5;
const HP           = 50;
const CIRCLE_R     = 3.0;
const SWIPE_RANGE  = 1.6;
const SWIPE_DMG    = 18;
const DASH_SPEED   = 14;
const DASH_DMG     = 22;
const CONTACT_CD   = 0.5;

export class BananaBandit {
  constructor(scene, x, z) {
    this.scene          = scene;
    this.isDead         = false;
    this.hp             = HP;
    this.maxHp          = HP;
    this._droppedBanana = false;
    this._flashTimer    = 0;
    this.velocity       = new THREE.Vector3();

    // State machine
    this._state       = 'circle';
    this._stateTimer  = 1.5 + Math.random() * 1.5;
    this._dashCd      = 4.0;
    this._swipeCd     = 0;
    this._swipeHits   = 0;
    this._swipeTimer  = 0;
    this._contactCd   = 0;
    this._circleAngle = Math.random() * Math.PI * 2;
    this._circleDir   = Math.random() > 0.5 ? 1 : -1;
    this._dashDir     = new THREE.Vector3();
    this._confuseTimer = 0;
    this._confuseAngle = 0;
    this._slowTimer    = 0;

    this.mesh = this._buildMesh();
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this._buildHealthBar();
  }

  _buildMesh() {
    const g     = new THREE.Group();
    const fur   = new THREE.MeshLambertMaterial({ color: 0xcc8800 });
    const red   = new THREE.MeshLambertMaterial({ color: 0xff2222 });
    const black = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const band  = new THREE.MeshLambertMaterial({ color: 0xcc1111 });

    const add = (geo, mat, x=0, y=0, z=0, sx=1, sy=1, sz=1) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true;
      g.add(m); return m;
    };

    add(new THREE.SphereGeometry(0.27, 8, 6), fur, 0, 0.40, 0, 1, 1.1, 0.85);
    add(new THREE.SphereGeometry(0.32, 8, 6), fur, 0, 0.96, 0);
    add(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 12), band, 0, 1.00, 0); // bandana
    [-0.10, 0.10].forEach(x => {
      add(new THREE.SphereGeometry(0.07, 6, 4), red,   x, 1.04, 0.27);
      add(new THREE.SphereGeometry(0.04, 5, 3), black, x, 1.04, 0.30);
    });
    [-1, 1].forEach(d => {
      const a = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.50, 6), fur);
      a.rotation.z = Math.PI / 2; a.position.set(d * 0.38, 0.60, 0); g.add(a);
    });
    [-1, 1].forEach(d => {
      add(new THREE.CylinderGeometry(0.07, 0.07, 0.24, 6), fur, d * 0.12, 0.12, 0);
    });
    return g;
  }

  _buildHealthBar() {
    const bgM = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
    const fgM = new THREE.MeshBasicMaterial({ color: 0xffaa00, side: THREE.DoubleSide });
    this._hpBg = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.09), bgM);
    this._hpFg = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.09), fgM);
    [this._hpBg, this._hpFg].forEach((m, i) => {
      m.rotation.x = -Math.PI / 2; m.position.set(0, 1.4 + i * 0.02, 0); this.mesh.add(m);
    });
  }

  _updateHealthBar() {
    const r = this.hp / this.maxHp;
    this._hpFg.scale.x = r; this._hpFg.position.x = -0.3 * (1 - r);
  }

  takeDamage(amount, kbDir, meta = {}) {
    if (this.isDead) return;
    spawnDmgNum(amount, this.mesh.position, meta.isCrit ?? false);
    this.hp -= amount; this._flashTimer = 0.12;
    if (kbDir) { this.velocity.x += kbDir.x * 6; this.velocity.z += kbDir.z * 6; }
    if (this.hp <= 0) this.die(); else this._updateHealthBar();
  }

  die()     { this.isDead = true; this.scene.remove(this.mesh); }
  cleanup() {}

  confuse(duration) {
    this._confuseTimer = Math.max(this._confuseTimer, duration);
    this._confuseAngle = Math.random() * Math.PI * 2;
  }

  slow(duration) {
    this._slowTimer = Math.max(this._slowTimer, duration);
  }

  update(dt, player, allEnemies = []) {
    if (this.isDead) return;

    if (this._dashCd    > 0) this._dashCd    -= dt;
    if (this._swipeCd   > 0) this._swipeCd   -= dt;
    if (this._contactCd > 0) this._contactCd -= dt;
    if (this._stateTimer> 0) this._stateTimer -= dt;

    // Hit flash
    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      const on = Math.floor(this._flashTimer * 20) % 2 === 0;
      this.mesh.traverse(c => { if (c.isMesh && c.material?.emissive) c.material.emissive.setHex(on ? 0xffffff : 0x000000); });
    }

    // Knockback decay
    this.velocity.x *= Math.pow(0.05, dt);
    this.velocity.z *= Math.pow(0.05, dt);

    // Timers
    if (this._confuseTimer > 0) this._confuseTimer -= dt;
    if (this._slowTimer    > 0) this._slowTimer    -= dt;

    // Separation
    for (const o of allEnemies) {
      if (o === this || o.isDead) continue;
      const sx = this.mesh.position.x - o.mesh.position.x;
      const sz = this.mesh.position.z - o.mesh.position.z;
      const sd = Math.sqrt(sx*sx + sz*sz);
      if (sd > 0 && sd < 1.1) {
        const p = (1.1 - sd) / 1.1 * 2.5;
        this.velocity.x += sx / sd * p * dt;
        this.velocity.z += sz / sd * p * dt;
      }
    }

    if (this._confuseTimer > 0) {
      // Wander in random direction
      this.velocity.x += Math.cos(this._confuseAngle) * SPEED * dt * 3;
      this.velocity.z += Math.sin(this._confuseAngle) * SPEED * dt * 3;
      const spd = Math.sqrt(this.velocity.x**2 + this.velocity.z**2);
      if (spd > SPEED) { this.velocity.x = this.velocity.x/spd*SPEED; this.velocity.z = this.velocity.z/spd*SPEED; }
    } else {
      const tgt  = getTarget(player);
      const dx   = tgt.position.x - this.mesh.position.x;
      const dz   = tgt.position.z - this.mesh.position.z;
      const dist = Math.sqrt(dx*dx + dz*dz);

      switch (this._state) {
        case 'circle':  this._stateCircle(dt, tgt, dist, dx, dz);     break;
        case 'windup':  this._stateWindup(dt, tgt, dx, dz);           break;
        case 'dash':    this._stateDash(dt, tgt, player, dist);       break;
        case 'swipe':   this._stateSwipe(dt, tgt, dist, dx, dz);     break;
        case 'retreat': this._stateRetreat(dt, dist, dx, dz);        break;
      }

      if (this._slowTimer > 0) {
        const maxSpd = SPEED * 0.5;
        const spd = Math.sqrt(this.velocity.x**2 + this.velocity.z**2);
        if (spd > maxSpd) { this.velocity.x = this.velocity.x/spd*maxSpd; this.velocity.z = this.velocity.z/spd*maxSpd; }
      }

      if (dist > 0.1) this.mesh.rotation.y = Math.atan2(dx, dz);
    }

    this.mesh.position.addScaledVector(this.velocity, dt);

    if (this.mesh.position.x >  10.5) { this.mesh.position.x =  10.5; this.velocity.x = Math.min(0, this.velocity.x); }
    if (this.mesh.position.x < -10.5) { this.mesh.position.x = -10.5; this.velocity.x = Math.max(0, this.velocity.x); }
    if (this.mesh.position.z >   8.5) { this.mesh.position.z =   8.5; this.velocity.z = Math.min(0, this.velocity.z); }
    if (this.mesh.position.z <  -8.5) { this.mesh.position.z =  -8.5; this.velocity.z = Math.max(0, this.velocity.z); }
  }

  _stateCircle(dt, tgt, dist, dx, dz) {
    this._circleAngle += this._circleDir * dt * 1.8;
    const r  = CIRCLE_R + Math.sin(this._circleAngle * 2.5) * 0.6;
    const tx = tgt.position.x + Math.cos(this._circleAngle) * r;
    const tz = tgt.position.z + Math.sin(this._circleAngle) * r;
    const ex = tx - this.mesh.position.x, ez = tz - this.mesh.position.z;
    const ed = Math.sqrt(ex*ex + ez*ez);
    if (ed > 0.1) {
      this.velocity.x += ex / ed * SPEED * dt * 8;
      this.velocity.z += ez / ed * SPEED * dt * 8;
      const spd = Math.sqrt(this.velocity.x**2 + this.velocity.z**2);
      if (spd > SPEED) { this.velocity.x = this.velocity.x/spd*SPEED; this.velocity.z = this.velocity.z/spd*SPEED; }
    }
    if (this._stateTimer <= 0) {
      if (dist < 1.8 && this._swipeCd <= 0) {
        this._state = 'swipe'; this._swipeHits = 0; this._swipeTimer = 0.25; this._swipeCd = 1.8;
      } else if (this._dashCd <= 0) {
        this._state = 'windup'; this._stateTimer = 0.55;
      } else {
        this._stateTimer = 0.5 + Math.random();
      }
    }
  }

  _stateWindup(dt, tgt, dx, dz) {
    this.velocity.x *= 0.85; this.velocity.z *= 0.85;
    // Shake + crouch
    this.mesh.position.x += Math.sin(Date.now() * 0.04) * 0.025;
    this.mesh.scale.y = 0.82;
    this.mesh.traverse(c => { if (c.isMesh && c.material?.emissive) c.material.emissive.setHex(0x443300); });

    if (this._stateTimer <= 0) {
      const dist = Math.sqrt(dx*dx + dz*dz);
      this._dashDir.set(dist > 0 ? dx/dist : 0, 0, dist > 0 ? dz/dist : 1);
      this._state = 'dash'; this._stateTimer = 0.38;
      this.velocity.x = this._dashDir.x * DASH_SPEED;
      this.velocity.z = this._dashDir.z * DASH_SPEED;
      this._dashCd = 4.0 + Math.random() * 2.0;
      this.mesh.scale.y = 1.0;
      this.mesh.traverse(c => { if (c.isMesh && c.material?.emissive) c.material.emissive.setHex(0x000000); });
    }
  }

  _stateDash(dt, tgt, player, dist) {
    if (dist < 1.0 && this._contactCd <= 0) {
      tgt.takeDamage(DASH_DMG);
      if (tgt === player && player.bananas > 0) player.bananas = Math.max(0, player.bananas - 1);
      this._contactCd = CONTACT_CD;
      this._state = 'retreat'; this._stateTimer = 0.8; return;
    }
    if (this._stateTimer <= 0) { this._state = 'retreat'; this._stateTimer = 0.8; }
  }

  _stateSwipe(dt, tgt, dist, dx, dz) {
    this._swipeTimer -= dt;
    if (dist > 0.1) {
      this.velocity.x += dx/dist * 2.5 * dt;
      this.velocity.z += dz/dist * 2.5 * dt;
    }
    if (this._swipeTimer <= 0) {
      if (this._swipeHits < 2) {
        if (dist < SWIPE_RANGE && this._contactCd <= 0) { tgt.takeDamage(SWIPE_DMG); this._contactCd = 0.2; }
        this._swipeHits++; this._swipeTimer = 0.28;
      } else {
        this._state = 'retreat'; this._stateTimer = 0.7;
      }
    }
  }

  _stateRetreat(dt, dist, dx, dz) {
    if (dist > 0.1) {
      this.velocity.x -= dx/dist * SPEED * dt * 6;
      this.velocity.z -= dz/dist * SPEED * dt * 6;
      const spd = Math.sqrt(this.velocity.x**2 + this.velocity.z**2);
      if (spd > SPEED*1.3) { this.velocity.x=this.velocity.x/spd*SPEED*1.3; this.velocity.z=this.velocity.z/spd*SPEED*1.3; }
    }
    if (this._stateTimer <= 0) {
      this._state = 'circle'; this._stateTimer = 1.0 + Math.random() * 2.0;
      if (Math.random() > 0.5) this._circleDir *= -1;
    }
  }
}
