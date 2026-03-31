import * as THREE from 'three';

const COLLECT_RADIUS = 0.9;
const VACUUM_SPEED   = 18;

export class BananaDrop {
  constructor(scene, x, z) {
    this.scene     = scene;
    this.collected = false;
    this._t        = Math.random() * Math.PI * 2;
    this._vacuum   = false;

    const geo = new THREE.SphereGeometry(0.2, 7, 5);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffe135 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(x, 0.3, z);
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    const stemGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.15, 5);
    const stemMat = new THREE.MeshLambertMaterial({ color: 0x7a5c00 });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 0.17;
    this.mesh.add(stem);
  }

  startVacuum() { this._vacuum = true; }

  update(dt, player) {
    if (this.collected) return;

    const dx = player.position.x - this.mesh.position.x;
    const dz = player.position.z - this.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (this._vacuum) {
      if (dist < 0.25) { this.collect(player); return; }
      this.mesh.position.x += (dx / dist) * VACUUM_SPEED * dt;
      this.mesh.position.z += (dz / dist) * VACUUM_SPEED * dt;
      this.mesh.position.y = 0.3;
    } else {
      this._t += dt * 3;
      this.mesh.position.y = 0.3 + Math.sin(this._t) * 0.12;
      this.mesh.rotation.y += dt * 2;
      if (dist < COLLECT_RADIUS) this.collect(player);
    }
  }

  collect(player) {
    if (this.collected) return;
    this.collected = true;
    const pos = this.mesh.position.clone();
    player.collectBanana(pos);
    this.scene.remove(this.mesh);
  }

  destroy() {
    if (!this.collected) this.scene.remove(this.mesh);
  }
}
