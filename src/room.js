import * as THREE from 'three';
import { GruntEnemy } from './enemy.js';

export const ROOM_W = 22;
export const ROOM_H = 18;
const WALL_H = 2.5;
const WALL_T = 0.6;

export class Room {
  constructor(scene, roomNumber = 1) {
    this.scene    = scene;
    this.enemies  = [];
    this._meshes  = [];
    this.isCleared = false;

    this._buildFloor();
    this._buildWalls();
    this._spawnEnemies(roomNumber);
  }

  _buildFloor() {
    const geo = new THREE.PlaneGeometry(ROOM_W, ROOM_H);
    const mat = new THREE.MeshLambertMaterial({ color: 0x2d5a1b });
    const floor = new THREE.Mesh(geo, mat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this._meshes.push(floor);

    // Grid lines for visual depth
    const gridHelper = new THREE.GridHelper(Math.max(ROOM_W, ROOM_H), 10, 0x1a3a0a, 0x1a3a0a);
    gridHelper.position.y = 0.01;
    this.scene.add(gridHelper);
    this._meshes.push(gridHelper);
  }

  _buildWalls() {
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x4a3520 });

    const makeWall = (w, h, d, x, y, z) => {
      const geo  = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(x, y, z);
      mesh.castShadow  = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this._meshes.push(mesh);
    };

    const hw = ROOM_W / 2;
    const hh = ROOM_H / 2;
    makeWall(ROOM_W + WALL_T * 2, WALL_H, WALL_T, 0,   WALL_H / 2, -hh); // north
    makeWall(ROOM_W + WALL_T * 2, WALL_H, WALL_T, 0,   WALL_H / 2,  hh); // south
    makeWall(WALL_T, WALL_H, ROOM_H, -hw, WALL_H / 2, 0);                  // west
    makeWall(WALL_T, WALL_H,  ROOM_H,  hw, WALL_H / 2, 0);                  // east
  }

  _spawnEnemies(roomNumber) {
    const count = 3 + Math.floor(roomNumber * 1.5);
    const hw = ROOM_W / 2 - 2;
    const hh = ROOM_H / 2 - 2;

    for (let i = 0; i < count; i++) {
      let x, z;
      // Keep enemies away from player spawn (center)
      do {
        x = (Math.random() * 2 - 1) * hw;
        z = (Math.random() * 2 - 1) * hh;
      } while (Math.sqrt(x * x + z * z) < 4);

      const enemy = new GruntEnemy(this.scene, x, z);
      // Scale enemy HP with room number
      enemy.hp    = Math.floor(enemy.hp * (1 + (roomNumber - 1) * 0.3));
      enemy.maxHp = enemy.hp;
      this.enemies.push(enemy);
    }
  }

  clampPlayer(player) {
    const hw = ROOM_W / 2 - 0.5;
    const hh = ROOM_H / 2 - 0.5;
    player.mesh.position.x = THREE.MathUtils.clamp(player.mesh.position.x, -hw, hw);
    player.mesh.position.z = THREE.MathUtils.clamp(player.mesh.position.z, -hh, hh);
  }

  update(dt, player) {
    for (const enemy of this.enemies) {
      if (!enemy.isDead) enemy.update(dt, player);
    }

    if (!this.isCleared && this.enemies.every(e => e.isDead)) {
      this.isCleared = true;
    }
  }

  destroy() {
    for (const mesh of this._meshes) {
      this.scene.remove(mesh);
    }
    for (const enemy of this.enemies) {
      if (!enemy.isDead) enemy.die();
    }
    this._meshes  = [];
    this.enemies  = [];
  }
}
