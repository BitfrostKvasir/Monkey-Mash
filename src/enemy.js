import * as THREE from 'three';

const GRUNT_SPEED  = 3.5;
const GRUNT_DAMAGE = 12;
const GRUNT_HP     = 60;
const CONTACT_CD   = 0.8;

export class GruntEnemy {
  constructor(scene, x, z) {
    this.scene   = scene;
    this.isDead  = false;
    this.hp      = GRUNT_HP;
    this.maxHp   = GRUNT_HP;
    this._contactCd = 0;
    this._flashTimer = 0;
    this.velocity = new THREE.Vector3();

    this.mesh = this._buildMesh();
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);

    this._hpBg  = null;
    this._hpFg  = null;
    this._buildHealthBar();
  }

  _buildMesh() {
    const group = new THREE.Group();
    const fur   = new THREE.MeshLambertMaterial({ color: 0x2a1a0a });
    const red   = new THREE.MeshLambertMaterial({ color: 0xff2222 });
    const black = new THREE.MeshLambertMaterial({ color: 0x111111 });

    const addTo = (parent, geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      m.castShadow = true;
      parent.add(m);
      return m;
    };

    // Body
    addTo(group, new THREE.SphereGeometry(0.3, 8, 6), fur, 0, 0.46, 0, 1, 1.2, 0.9);
    // Head
    addTo(group, new THREE.SphereGeometry(0.36, 8, 6), fur, 0, 1.1, 0);
    // Eyes — red
    [-0.12, 0.12].forEach(x => {
      addTo(group, new THREE.SphereGeometry(0.08, 6, 4), red, x, 1.16, 0.3);
      addTo(group, new THREE.SphereGeometry(0.04, 5, 3), black, x, 1.16, 0.34);
    });
    // Arms
    [-1, 1].forEach(dir => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.45, 6), fur);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(dir * 0.42, 0.7, 0);
      group.add(arm);
    });
    // Legs
    [-1, 1].forEach(dir => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.28, 6), fur);
      leg.position.set(dir * 0.14, 0.14, 0);
      group.add(leg);
    });

    return group;
  }

  _buildHealthBar() {
    const bgGeo = new THREE.PlaneGeometry(0.7, 0.1);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
    this._hpBg  = new THREE.Mesh(bgGeo, bgMat);
    this._hpBg.rotation.x = -Math.PI / 2;
    this._hpBg.position.set(0, 1.5, 0);
    this.mesh.add(this._hpBg);

    const fgGeo = new THREE.PlaneGeometry(0.7, 0.1);
    const fgMat = new THREE.MeshBasicMaterial({ color: 0x44ff44, side: THREE.DoubleSide });
    this._hpFg  = new THREE.Mesh(fgGeo, fgMat);
    this._hpFg.rotation.x = -Math.PI / 2;
    this._hpFg.position.set(0, 1.52, 0);
    this.mesh.add(this._hpFg);
  }

  _updateHealthBar() {
    const ratio = this.hp / this.maxHp;
    this._hpFg.scale.x = ratio;
    this._hpFg.position.x = -0.35 * (1 - ratio);
  }

  takeDamage(amount, knockbackDir) {
    if (this.isDead) return;
    this.hp -= amount;
    this._flashTimer = 0.12;

    if (knockbackDir) {
      this.velocity.x += knockbackDir.x * 8;
      this.velocity.z += knockbackDir.z * 8;
    }

    if (this.hp <= 0) this.die();
    else this._updateHealthBar();
  }

  die() {
    this.isDead = true;
    this.scene.remove(this.mesh);
  }

  update(dt, player) {
    if (this.isDead) return;

    // Cooldowns
    if (this._contactCd > 0) this._contactCd -= dt;
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

    // Move toward player
    const dx = player.position.x - this.mesh.position.x;
    const dz = player.position.z - this.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0.4) {
      const s = GRUNT_SPEED / dist;
      this.velocity.x += dx * s;
      this.velocity.z += dz * s;
      // Cap speed
      const spd = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
      if (spd > GRUNT_SPEED * 2.5) {
        this.velocity.x = (this.velocity.x / spd) * GRUNT_SPEED * 2.5;
        this.velocity.z = (this.velocity.z / spd) * GRUNT_SPEED * 2.5;
      }
    }

    this.mesh.position.addScaledVector(this.velocity, dt);

    // Face player
    this.mesh.rotation.y = Math.atan2(dx, dz);

    // Contact damage
    if (dist < 0.8 && this._contactCd <= 0) {
      player.takeDamage(GRUNT_DAMAGE);
      this._contactCd = CONTACT_CD;
    }
  }
}
