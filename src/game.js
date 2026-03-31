import * as THREE from 'three';
import { Player }    from './player.js';
import { Room }      from './room.js';
import { BananaDrop } from './pickup.js';

const CLEAR_DELAY      = 2.0;  // seconds between room cleared and next room loading
const BANANA_DROP_CHANCE = 0.6; // per enemy

export class Game {
  constructor(scene, input, config = {}) {
    this.scene   = scene;
    this.input   = input;
    this.isOver  = false;
    this._roomNumber = 1;
    this._clearTimer = 0;
    this._transitioning = false;
    this.onRoomClear  = null; // callback(roomNumber)
    this.onGameOver   = null;

    const { color = 0x7B3F00, hat = 'none' } = config;

    this.player  = new Player(scene, input, color, hat);
    this.room    = new Room(scene, this._roomNumber);
    this.pickups = [];

    // Ground plane for mouse raycasting
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._raycaster   = new THREE.Raycaster();
    this._aimTarget   = new THREE.Vector3();

    // Mouse state
    this._lmbWas  = false;
  }

  // ── Update ───────────────────────────────────────────────────────

  update(dt, now, camera, mouseNDC) {
    if (this.isOver) return;

    // Aim via raycast
    if (mouseNDC && camera) {
      this._raycaster.setFromCamera(mouseNDC, camera);
      this._raycaster.ray.intersectPlane(this._groundPlane, this._aimTarget);
    }

    this.player.update(dt, now, this._aimTarget);

    if (!this.player.isAlive) {
      this.isOver = true;
      if (this.onGameOver) this.onGameOver();
      return;
    }

    // Left-click attack
    const lmb = this.input.isMouseDown(0);
    if (lmb && !this._lmbWas) {
      this.player.attack(this.room.enemies);
    }
    this._lmbWas = lmb;

    // Room update
    if (!this._transitioning) {
      this.room.update(dt, this.player);
      this.room.clampPlayer(this.player);

      if (this.room.isCleared && this._clearTimer <= 0) {
        this._transitioning = true;
        this._clearTimer = CLEAR_DELAY;
        if (this.onRoomClear) this.onRoomClear(this._roomNumber);
      }
    } else {
      this._clearTimer -= dt;
      if (this._clearTimer <= 0) {
        this._nextRoom();
        this._transitioning = false;
      }
    }

    // Pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.update(dt, this.player);
      if (p.collected) this.pickups.splice(i, 1);
    }
  }

  // ── Room transitions ─────────────────────────────────────────────

  _nextRoom() {
    // Drop bananas for cleared enemies
    this._spawnBananasForRoom();

    this.room.destroy();
    this._roomNumber++;
    this.room = new Room(this.scene, this._roomNumber);

    // Reset player to centre
    this.player.mesh.position.set(0, 0, 0);
    this.player.velocity.set(0, 0, 0);
  }

  _spawnBananasForRoom() {
    for (const enemy of this.room.enemies) {
      if (!enemy.isDead) continue;
      if (Math.random() < BANANA_DROP_CHANCE) {
        const drop = new BananaDrop(
          this.scene,
          enemy.mesh.position.x + (Math.random() - 0.5),
          enemy.mesh.position.z + (Math.random() - 0.5)
        );
        this.pickups.push(drop);
      }
    }
    // Clear leftover pickups from previous room that weren't collected
    // (they'll be destroyed when room is destroyed; we clear the list)
  }

  getRoomNumber() { return this._roomNumber; }
}
