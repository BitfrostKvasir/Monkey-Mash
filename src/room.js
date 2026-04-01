import * as THREE from 'three';
import { GruntEnemy } from './enemy.js';
import { BananaBandit } from './banana-bandit.js';
import { CoconutBomber } from './coconut-bomber.js';
import { VineStrangler } from './vine-strangler.js';
import { BananaKing } from './banana-king.js';
import { LabApe } from './lab-ape.js';
import { SpikedHowler } from './spiked-howler.js';
import { ThunderSimian } from './thunder-simian.js';

export const ROOM_W = 22;
export const ROOM_H = 18;
const WALL_H = 2.5;
const WALL_T = 0.6;

export class Room {
  constructor(scene, roomNumber = 1, { enemyHpMult = 1 } = {}) {
    this.scene     = scene;
    this.enemies   = [];
    this._meshes   = [];
    this.isCleared = false;
    this.boss      = null;
    this.isBossRoom = (roomNumber === 8 || roomNumber === 16);
    this._enemyHpMult = enemyHpMult;

    this._buildForest();
    this._buildFloor();
    this._buildWalls();
    this._spawnEnemies(roomNumber);
  }

  _buildForest() {
    // Extended ground plane visible beyond the room walls
    const fGeo = new THREE.PlaneGeometry(80, 80);
    const fMat = new THREE.MeshLambertMaterial({ color: 0x0c1a07 });
    const forestFloor = new THREE.Mesh(fGeo, fMat);
    forestFloor.rotation.x = -Math.PI / 2;
    forestFloor.position.y = -0.02;
    forestFloor.receiveShadow = true;
    this.scene.add(forestFloor);
    this._meshes.push(forestFloor);

    // Shared materials
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x2a1205 });
    const leafMats = [0x0f2a07, 0x153d0a, 0x0a2205, 0x1a4a0d, 0x112d08]
      .map(c => new THREE.MeshLambertMaterial({ color: c }));

    // Deterministic LCG — same forest every room build
    let seed = 0x7f3a9b1c;
    const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

    const addTree = (x, z) => {
      const scale   = 0.6 + rand() * 0.75;
      const mat1    = leafMats[Math.floor(rand() * leafMats.length)];
      const mat2    = leafMats[Math.floor(rand() * leafMats.length)];
      const group   = new THREE.Group();

      // Trunk
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11 * scale, 0.17 * scale, 0.75 * scale, 6),
        trunkMat
      );
      trunk.position.y = 0.38 * scale;
      trunk.castShadow = true;
      group.add(trunk);

      // Main canopy sphere
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.88 * scale, 8, 6), mat1);
      canopy.position.y = 1.1 * scale;
      canopy.castShadow = true;
      group.add(canopy);

      // Upper highlight sphere
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.52 * scale, 7, 5), mat2);
      top.position.y = 1.58 * scale;
      top.castShadow = true;
      group.add(top);

      group.position.set(x, 0, z);
      group.rotation.y = rand() * Math.PI * 2;
      this.scene.add(group);
      this._meshes.push(group);
    };

    // Grid of trees outside the room walls; skip interior and far corners
    for (let gx = -19; gx <= 19; gx += 3) {
      for (let gz = -15; gz <= 15; gz += 3) {
        if (Math.abs(gx) < 13 && Math.abs(gz) < 11) continue; // inside room area
        if (Math.abs(gx) > 18 && Math.abs(gz) > 13) continue; // off-screen corners
        const x = gx + (rand() - 0.5) * 2.2;
        const z = gz + (rand() - 0.5) * 2.2;
        addTree(x, z);
      }
    }
  }

  _buildFloor() {
    const geo = new THREE.PlaneGeometry(ROOM_W, ROOM_H);
    const mat = new THREE.MeshLambertMaterial({ color: 0x2d5a1b });
    const floor = new THREE.Mesh(geo, mat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this._meshes.push(floor);

    // Grid lines exactly sized to the room — 2×2 unit cells (GCD of 22 and 18)
    const CELL = 2;
    const pts  = [];
    for (let i = 0; i <= ROOM_W / CELL; i++) {
      const x = -ROOM_W / 2 + i * CELL;
      pts.push(x, 0.01, -ROOM_H / 2,  x, 0.01, ROOM_H / 2);
    }
    for (let j = 0; j <= ROOM_H / CELL; j++) {
      const z = -ROOM_H / 2 + j * CELL;
      pts.push(-ROOM_W / 2, 0.01, z,  ROOM_W / 2, 0.01, z);
    }
    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const grid = new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ color: 0x1a3a0a }));
    this.scene.add(grid);
    this._meshes.push(grid);
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
    if (roomNumber === 8) {
      this._buildThroneRoom();
      this.boss = new BananaKing(this.scene, 0, -4);
      this.boss.hp = Math.floor(this.boss.hp * this._enemyHpMult);
      this.boss.maxHp = this.boss.hp;
      this.enemies.push(this.boss);
      return;
    }
    if (roomNumber === 16) {
      this._buildLabRoom();
      this.boss = new LabApe(this.scene, 0, -4);
      this.boss.hp = Math.floor(this.boss.hp * this._enemyHpMult);
      this.boss.maxHp = this.boss.hp;
      this.enemies.push(this.boss);
      return;
    }

    const count = 3 + Math.floor(roomNumber * 1.2);
    const hw = ROOM_W / 2 - 2;
    const hh = ROOM_H / 2 - 2;

    const pool = ['grunt'];
    if (roomNumber >= 3) pool.push('bandit');
    if (roomNumber >= 3) pool.push('bandit');
    if (roomNumber >= 5) pool.push('bomber');
    if (roomNumber >= 7)  pool.push('strangler');
    if (roomNumber >= 11) pool.push('howler');
    if (roomNumber >= 11) pool.push('howler');
    if (roomNumber >= 18) pool.push('thunder');
    if (roomNumber >= 18) pool.push('thunder');

    for (let i = 0; i < count; i++) {
      let x, z;
      do {
        x = (Math.random() * 2 - 1) * hw;
        z = (Math.random() * 2 - 1) * hh;
      } while (Math.sqrt(x*x + z*z) < 4);

      const type = pool[Math.floor(Math.random() * pool.length)];
      let enemy;
      switch (type) {
        case 'bandit':    enemy = new BananaBandit(this.scene, x, z);   break;
        case 'bomber':    enemy = new CoconutBomber(this.scene, x, z);  break;
        case 'strangler': enemy = new VineStrangler(this.scene, x, z);  break;
        case 'howler':    enemy = new SpikedHowler(this.scene, x, z);   break;
        case 'thunder':   enemy = new ThunderSimian(this.scene, x, z);  break;
        default:          enemy = new GruntEnemy(this.scene, x, z);     break;
      }
      enemy.hp    = Math.floor(enemy.hp * (1 + (roomNumber - 1) * 0.25) * this._enemyHpMult);
      enemy.maxHp = enemy.hp;
      this.enemies.push(enemy);
    }
  }

  _buildThroneRoom() {
    // Darker earthy floor
    const fgeo = new THREE.PlaneGeometry(ROOM_W, ROOM_H);
    const fmat = new THREE.MeshLambertMaterial({ color: 0x3a2510 });
    const floor2 = new THREE.Mesh(fgeo, fmat);
    floor2.rotation.x = -Math.PI / 2;
    floor2.position.y = 0.001;
    floor2.receiveShadow = true;
    this.scene.add(floor2); this._meshes.push(floor2);

    // Banana crates as cover props
    const crateMat = new THREE.MeshLambertMaterial({ color: 0x8b6914 });
    const bananaMarkMat = new THREE.MeshLambertMaterial({ color: 0xffe135 });
    const cratePositions = [
      [-7, -5], [7, -5], [-7, 5], [7, 5],
      [-4, -7], [4, -7], [0, -6],
    ];
    for (const [cx, cz] of cratePositions) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 1.2), crateMat);
      crate.position.set(cx, 0.5, cz);
      crate.castShadow = true; crate.receiveShadow = true;
      this.scene.add(crate); this._meshes.push(crate);
      // Banana mark on crate front
      const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.4), bananaMarkMat);
      mark.position.set(cx, 0.5, cz + 0.61);
      mark.receiveShadow = true;
      this.scene.add(mark); this._meshes.push(mark);
    }

    // Throne at north wall
    const throneMat = new THREE.MeshLambertMaterial({ color: 0x5a3a10 });
    const throneGold = new THREE.MeshLambertMaterial({ color: 0xd4a017 });
    // seat
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 1.4), throneMat);
    seat.position.set(0, 0.2, -7.5);
    this.scene.add(seat); this._meshes.push(seat);
    // back
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 0.3), throneMat);
    back.position.set(0, 1.5, -8.1);
    this.scene.add(back); this._meshes.push(back);
    // gold trim
    const trim = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.12, 0.12), throneGold);
    trim.position.set(0, 2.6, -8.0);
    this.scene.add(trim); this._meshes.push(trim);

    // Hanging vine curtains along walls
    const vineMat = new THREE.MeshLambertMaterial({ color: 0x1a4a1a });
    for (let i = -4; i <= 4; i += 2) {
      const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 2.2 + Math.random(), 5), vineMat);
      vine.position.set(i, 1.4, -ROOM_H/2 + 0.1);
      this.scene.add(vine); this._meshes.push(vine);
    }
  }

  _buildLabRoom() {
    // Concrete gray floor
    const fgeo = new THREE.PlaneGeometry(ROOM_W, ROOM_H);
    const fmat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
    const floor2 = new THREE.Mesh(fgeo, fmat);
    floor2.rotation.x = -Math.PI / 2;
    floor2.position.y = 0.001;
    floor2.receiveShadow = true;
    this.scene.add(floor2); this._meshes.push(floor2);

    // Chemical pools on floor
    const poolMat = new THREE.MeshBasicMaterial({ color: 0x22ff88, transparent: true, opacity: 0.30, side: THREE.DoubleSide });
    [[5, 4], [-6, -3], [3, -6], [-4, 6]].forEach(([px, pz]) => {
      const pool = new THREE.Mesh(new THREE.CircleGeometry(1.2, 16), poolMat.clone());
      pool.rotation.x = -Math.PI / 2; pool.position.set(px, 0.03, pz);
      this.scene.add(pool); this._meshes.push(pool);
    });

    // Broken machine debris
    const machineMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const machineAccent = new THREE.MeshLambertMaterial({ color: 0x334455 });
    [[-8, -4], [8, 3], [-7, 6], [6, -6]].forEach(([mx, mz]) => {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 1.0), machineMat);
      body.position.set(mx, 0.7, mz);
      body.castShadow = true; body.receiveShadow = true;
      this.scene.add(body); this._meshes.push(body);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 0.05), machineAccent);
      panel.position.set(mx, 0.7, mz + 0.53);
      this.scene.add(panel); this._meshes.push(panel);
    });

    // Warning stripe on floor edges
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xff8800, side: THREE.DoubleSide });
    for (let i = -9; i <= 9; i += 3) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.18), stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(i, 0.02, ROOM_H/2 - 0.2);
      this.scene.add(stripe); this._meshes.push(stripe);
    }
  }

  clampPlayer(player) {
    const hw = ROOM_W / 2 - 0.5;
    const hh = ROOM_H / 2 - 0.5;
    player.mesh.position.x = THREE.MathUtils.clamp(player.mesh.position.x, -hw, hw);
    player.mesh.position.z = THREE.MathUtils.clamp(player.mesh.position.z, -hh, hh);
  }

  update(dt, player) {
    // Drain boss pending spawns (minion summoning)
    if (this.boss && this.boss.pendingSpawns && this.boss.pendingSpawns.length > 0) {
      for (const e of this.boss.pendingSpawns) this.enemies.push(e);
      this.boss.pendingSpawns = [];
    }

    for (const enemy of this.enemies) {
      if (!enemy.isDead) enemy.update(dt, player, this.enemies);
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
      if (enemy.cleanup) enemy.cleanup();
    }
    this._meshes  = [];
    this.enemies  = [];
  }
}
