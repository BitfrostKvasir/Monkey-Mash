import * as THREE from 'three';

// ── Shared helper ─────────────────────────────────────────────────

function spawnRing(scene, color, innerR, outerR, x, z, duration = 0.55) {
  const mat  = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(innerR, outerR, 48), mat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.05, z);
  scene.add(ring);
  let age = 0;
  const tick = () => {
    age += 1 / 60;
    const t = Math.min(age / duration, 1);
    mat.opacity = 0.72 * (1 - t);
    if (age < duration) requestAnimationFrame(tick); else scene.remove(ring);
  };
  requestAnimationFrame(tick);
}

// ── 1. Thunder Primate ────────────────────────────────────────────
// 4-unit AoE lightning strike with 0.75s telegraph

export class ThunderPrimateEpic {
  constructor(player) {
    this.player   = player;
    this.id       = 'thunder_primate';
    this.label    = 'Thunder Primate';
    this.icon     = '🌩️';
    this.cdMax    = 18;
    this._cd      = 0;
    this.isActive = false;
    this._strikeTimer  = -1;
    this._strikePos    = null;
    this._telegraph    = null;
    this._telegraphMat = null;
  }

  activate(enemies, aimTarget) {
    if (this._cd > 0 || this._strikeTimer > 0) return;
    this._strikePos   = aimTarget.clone();
    this._strikeTimer = 0.75;
    this._cd          = this.cdMax;
    this.isActive     = true;

    // Blue pulsing target ring
    this._telegraphMat = new THREE.MeshBasicMaterial({ color: 0x4499ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    this._telegraph = new THREE.Mesh(new THREE.RingGeometry(0.15, 4.0, 48), this._telegraphMat);
    this._telegraph.rotation.x = -Math.PI / 2;
    this._telegraph.position.set(this._strikePos.x, 0.05, this._strikePos.z);
    this.player.scene.add(this._telegraph);
  }

  update(dt, enemies) {
    if (this._cd > 0) this._cd -= dt;
    if (this._strikeTimer < 0) return;
    this._strikeTimer -= dt;

    if (this._telegraphMat) {
      this._telegraphMat.opacity = 0.3 + 0.28 * Math.sin(Date.now() * 0.018);
    }

    if (this._strikeTimer <= 0) {
      if (this._telegraph) { this.player.scene.remove(this._telegraph); this._telegraph = null; }

      const px = this._strikePos.x, pz = this._strikePos.z;
      const R = 4.0;
      for (const e of enemies) {
        if (e.isDead) continue;
        const dx = e.mesh.position.x - px, dz = e.mesh.position.z - pz;
        if (dx*dx + dz*dz <= R*R) {
          const d = Math.sqrt(dx*dx + dz*dz) || 1;
          e.takeDamage(55, new THREE.Vector3(dx/d, 0, dz/d));
          if (e.confuse) e.confuse(1.0);
          if (e.slow)    e.slow(2.0);
        }
      }

      // Impact rings
      spawnRing(this.player.scene, 0xffffff, 0.1, 4.3, px, pz, 0.28);
      spawnRing(this.player.scene, 0x88ccff, 0.1, 0.5, px, pz, 0.40);

      // Brief screen flash
      const fl = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 32),
        new THREE.MeshBasicMaterial({ color: 0x2244cc, transparent: true, opacity: 0.16, depthTest: false, side: THREE.DoubleSide })
      );
      fl.rotation.x = -Math.PI / 2; fl.position.y = 0.07;
      this.player.scene.add(fl);
      setTimeout(() => this.player.scene.remove(fl), 110);

      this._strikeTimer = -1;
      this.isActive = false;
    }
  }

  getState() {
    return { name: this.label, icon: this.icon,
      cdRatio: Math.max(0, this._cd) / this.cdMax,
      isReady: this._cd <= 0 && this._strikeTimer < 0, isActive: this.isActive };
  }
}

// ── 2. Banana Barrage Rain ────────────────────────────────────────
// 6-8 banana drops over 3s in a 6-unit radius

export class BananaBarrageEpic {
  constructor(player) {
    this.player   = player;
    this.id       = 'banana_barrage';
    this.label    = 'Banana Barrage';
    this.icon     = '🍌';
    this.cdMax    = 20;
    this._cd      = 0;
    this.isActive = false;
    this._pending = [];
  }

  activate(enemies, aimTarget) {
    if (this._cd > 0 || this.isActive) return;
    this._cd      = this.cdMax;
    this.isActive = true;
    this._pending = [];

    const count = 6 + Math.floor(Math.random() * 3);
    const cx = aimTarget.x, cz = aimTarget.z;

    for (let i = 0; i < count; i++) {
      const delay = i * (3.0 / count);
      const angle = Math.random() * Math.PI * 2;
      const r     = 1.0 + Math.random() * 5.0;
      const x = THREE.MathUtils.clamp(cx + Math.cos(angle) * r, -9.5, 9.5);
      const z = THREE.MathUtils.clamp(cz + Math.sin(angle) * r, -7.5, 7.5);

      const mat  = new THREE.MeshLambertMaterial({ color: 0xffee00, emissive: new THREE.Color(0x886600) });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 7, 5), mat);
      mesh.scale.set(0.55, 2.4, 0.55);
      mesh.rotation.z = (Math.random() - 0.5) * 0.7;
      mesh.position.set(x, 4.0, z);
      mesh.castShadow = true;
      this.player.scene.add(mesh);

      this._pending.push({ waitTimer: delay, fallTimer: 0.5, x, z, marker: mesh, fired: false });
    }
  }

  update(dt, enemies) {
    if (this._cd > 0) this._cd -= dt;
    if (!this.isActive) return;

    let anyAlive = false;
    for (const p of this._pending) {
      if (p.fired) continue;
      anyAlive = true;

      if (p.waitTimer > 0) {
        p.waitTimer -= dt;
      } else {
        p.fallTimer -= dt;
        if (p.marker) p.marker.position.y = Math.max(0.2, 4.0 * (p.fallTimer / 0.5));

        if (p.fallTimer <= 0) {
          if (p.marker) { this.player.scene.remove(p.marker); p.marker = null; }
          spawnRing(this.player.scene, 0xffdd00, 0.1, 1.9, p.x, p.z, 0.45);

          for (const e of enemies) {
            if (e.isDead) continue;
            const dx = e.mesh.position.x - p.x, dz = e.mesh.position.z - p.z;
            if (dx*dx + dz*dz <= 1.5*1.5) {
              const d = Math.sqrt(dx*dx + dz*dz) || 1;
              e.takeDamage(20, new THREE.Vector3(dx/d, 0, dz/d));
            }
          }
          p.fired = true;
        }
      }
    }

    if (!anyAlive && this._pending.length > 0) {
      this._pending = [];
      this.isActive = false;
    }
  }

  getState() {
    return { name: this.label, icon: this.icon,
      cdRatio: Math.max(0, this._cd) / this.cdMax,
      isReady: this._cd <= 0 && !this.isActive, isActive: this.isActive };
  }
}

// ── 3. Primal Fury ────────────────────────────────────────────────
// 10s attack supercharge: +50% dmg, +25% atk speed, mini shockwave

export class PrimalFuryEpic {
  constructor(player) {
    this.player   = player;
    this.id       = 'primal_fury';
    this.label    = 'Primal Fury';
    this.icon     = '🔥';
    this.cdMax    = 18;
    this._cd      = 0;
    this.isActive = false;
    this._timer   = 0;
    this._savedDamageMult = 1;
    this._savedAtkCdMult  = 1;
  }

  activate(enemies, aimTarget) {
    if (this._cd > 0 || this.isActive) return;
    this._cd      = this.cdMax;
    this.isActive = true;
    this._timer   = 10;

    this._savedDamageMult = this.player.stats.damageMult;
    this._savedAtkCdMult  = this.player.stats.atkCdMult;
    this.player.stats.damageMult += 0.50;
    this.player.stats.atkCdMult  = Math.max(0.3, this.player.stats.atkCdMult - 0.25);
  }

  // Called from game.js each time player attacks while active
  onPlayerAttack(enemies) {
    if (!this.isActive) return;
    const r = 1.1, dmg = Math.round(8 * this.player.stats.damageMult);
    const px = this.player.position.x, pz = this.player.position.z;
    for (const e of enemies) {
      if (e.isDead) continue;
      const dx = e.mesh.position.x - px, dz = e.mesh.position.z - pz;
      if (dx*dx + dz*dz <= r*r) {
        const d = Math.sqrt(dx*dx + dz*dz) || 1;
        e.takeDamage(dmg, new THREE.Vector3(dx/d, 0, dz/d));
      }
    }
    spawnRing(this.player.scene, 0xff5500, 0.05, 1.2, px, pz, 0.28);
  }

  update(dt, enemies) {
    if (this._cd > 0) this._cd -= dt;
    if (!this.isActive) return;
    this._timer -= dt;

    const pulse = Math.sin(Date.now() * 0.012) * 0.5 + 0.5;
    this.player.mesh.traverse(c => {
      if (c.isMesh && c.material?.emissive) c.material.emissive.setRGB(pulse * 0.55, pulse * 0.12, 0);
    });

    if (this._timer <= 0) {
      this.player.stats.damageMult = this._savedDamageMult;
      this.player.stats.atkCdMult  = this._savedAtkCdMult;
      this.player.mesh.traverse(c => {
        if (c.isMesh && c.material?.emissive) c.material.emissive.setHex(0x000000);
      });
      this.isActive = false;
    }
  }

  getState() {
    return { name: this.label, icon: this.icon,
      cdRatio: Math.max(0, this._cd) / this.cdMax,
      isReady: this._cd <= 0 && !this.isActive, isActive: this.isActive };
  }
}

// ── 4. Time-Swap Echo ─────────────────────────────────────────────
// Semi-transparent blue clone mirrors attacks at 50% dmg for 5s

export class TimeEchoEpic {
  constructor(player) {
    this.player   = player;
    this.id       = 'time_echo';
    this.label    = 'Time-Swap Echo';
    this.icon     = '👥';
    this.cdMax    = 20;
    this._cd      = 0;
    this.isActive = false;
    this._timer   = 0;
    this._clone   = null;
  }

  activate(enemies, aimTarget) {
    if (this._cd > 0 || this.isActive) return;
    this._cd      = this.cdMax;
    this.isActive = true;
    this._timer   = 5;

    // Semi-transparent blue clone
    const g   = new THREE.Group();
    const mkM = () => new THREE.MeshLambertMaterial({
      color: 0x4488ff, transparent: true, opacity: 0.42, emissive: new THREE.Color(0x1133aa)
    });
    const add = (geo, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mkM()); m.position.set(x, y, z); g.add(m);
    };
    add(new THREE.SphereGeometry(0.27, 7, 5), 0, 0.38, 0);
    add(new THREE.SphereGeometry(0.30, 7, 5), 0, 0.96, 0);
    [-1, 1].forEach(d => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.50, 6), mkM());
      arm.rotation.z = d * Math.PI / 2; arm.position.set(d * 0.38, 0.60, 0); g.add(arm);
    });
    [-1, 1].forEach(d => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.24, 6), mkM());
      leg.position.set(d * 0.13, 0.12, 0); g.add(leg);
    });

    this._clone = g;
    this._clone.position.copy(this.player.position);
    this.player.scene.add(this._clone);
  }

  // Called from game.js when player attacks while clone is active
  cloneAttack(enemies, aimTarget) {
    if (!this.isActive || !this._clone) return;
    const cp  = this._clone.position;
    const dmg = Math.round(this.player.stats.damageMult * 12 * 0.5);
    const r   = 2.2;
    for (const e of enemies) {
      if (e.isDead) continue;
      const dx = e.mesh.position.x - cp.x, dz = e.mesh.position.z - cp.z;
      if (dx*dx + dz*dz <= r*r) {
        const d = Math.sqrt(dx*dx + dz*dz) || 1;
        e.takeDamage(dmg, new THREE.Vector3(dx/d, 0, dz/d));
      }
    }
  }

  update(dt, enemies) {
    if (this._cd > 0) this._cd -= dt;
    if (!this.isActive) return;
    this._timer -= dt;

    if (this._clone) {
      const perp = new THREE.Vector3(-this.player.aimDir.z, 0, this.player.aimDir.x);
      this._clone.position.set(
        this.player.position.x + perp.x * 1.6,
        0,
        this.player.position.z + perp.z * 1.6
      );
      this._clone.rotation.y = this.player.mesh.rotation.y;

      // Flicker near expiry
      const flicker = this._timer < 1.5 && Math.floor(Date.now() / 75) % 2 === 0;
      this._clone.visible = !flicker;

      const pulse = Math.sin(Date.now() * 0.012) * 0.5 + 0.5;
      this._clone.traverse(c => {
        if (c.isMesh && c.material?.emissive) c.material.emissive.setRGB(0.04, 0.1 + pulse * 0.18, 0.45 + pulse * 0.28);
      });
    }

    if (this._timer <= 0) {
      if (this._clone) { this.player.scene.remove(this._clone); this._clone = null; }
      this.isActive = false;
    }
  }

  getState() {
    return { name: this.label, icon: this.icon,
      cdRatio: Math.max(0, this._cd) / this.cdMax,
      isReady: this._cd <= 0 && !this.isActive, isActive: this.isActive };
  }
}

// ── 5. Monkey Meteor ──────────────────────────────────────────────
// Straight-line strike: 6×2 units, 0.75s telegraph, 65 dmg

export class MonkeyMeteorEpic {
  constructor(player) {
    this.player   = player;
    this.id       = 'monkey_meteor';
    this.label    = 'Monkey Meteor';
    this.icon     = '☄️';
    this.cdMax    = 20;
    this._cd      = 0;
    this.isActive = false;
    this._strikeTimer = -1;
    this._dir         = new THREE.Vector3();
    this._pathCenter  = new THREE.Vector3();
    this._silhouette  = null;
    this._silMat      = null;
  }

  activate(enemies, aimTarget) {
    if (this._cd > 0 || this._strikeTimer > 0) return;
    this._cd          = this.cdMax;
    this.isActive     = true;
    this._strikeTimer = 0.75;

    const dx = aimTarget.x - this.player.position.x;
    const dz = aimTarget.z - this.player.position.z;
    const len = Math.sqrt(dx*dx + dz*dz) || 1;
    this._dir.set(dx/len, 0, dz/len);
    this._pathCenter.set(
      this.player.position.x + this._dir.x * 3,
      0,
      this.player.position.z + this._dir.z * 3
    );

    this._silMat = new THREE.MeshLambertMaterial({
      color: 0xff4400, emissive: new THREE.Color(0xcc2200), transparent: true, opacity: 0.78
    });
    this._silhouette = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.20, 6.0), this._silMat);
    this._silhouette.position.set(this._pathCenter.x, 0.10, this._pathCenter.z);
    this._silhouette.rotation.y = Math.atan2(this._dir.x, this._dir.z);
    this.player.scene.add(this._silhouette);
  }

  update(dt, enemies) {
    if (this._cd > 0) this._cd -= dt;
    if (this._strikeTimer < 0) return;
    this._strikeTimer -= dt;

    if (this._silMat) {
      const pulse = Math.sin(Date.now() * 0.02) * 0.5 + 0.5;
      this._silMat.emissive.setRGB(0.5 + pulse * 0.3, 0.06, 0);
      this._silMat.opacity = 0.5 + pulse * 0.35;
    }

    if (this._strikeTimer <= 0) {
      if (this._silhouette) { this.player.scene.remove(this._silhouette); this._silhouette = null; }

      // Rectangular hit: 6 long × 2 wide
      for (const e of enemies) {
        if (e.isDead) continue;
        const ex = e.mesh.position.x - this._pathCenter.x;
        const ez = e.mesh.position.z - this._pathCenter.z;
        const along = ex * this._dir.x + ez * this._dir.z;
        const perpX = ex - this._dir.x * along;
        const perpZ = ez - this._dir.z * along;
        if (Math.abs(along) <= 3.0 && perpX*perpX + perpZ*perpZ <= 1.0*1.0) {
          const d = Math.sqrt(ex*ex + ez*ez) || 1;
          e.takeDamage(65, new THREE.Vector3(ex/d, 0, ez/d));
          if (e.confuse) e.confuse(0.75);
          if (e.slow)    e.slow(1.5);
        }
      }

      // Fire sparks along impact line
      for (let i = -2; i <= 2; i++) {
        const ix = this._pathCenter.x + this._dir.x * i * 1.2;
        const iz = this._pathCenter.z + this._dir.z * i * 1.2;
        spawnRing(this.player.scene, 0xff6600, 0.05, 0.55 + Math.random() * 0.45, ix, iz, 0.35);
      }

      this._strikeTimer = -1;
      this.isActive = false;
    }
  }

  getState() {
    return { name: this.label, icon: this.icon,
      cdRatio: Math.max(0, this._cd) / this.cdMax,
      isReady: this._cd <= 0 && this._strikeTimer < 0, isActive: this.isActive };
  }
}
