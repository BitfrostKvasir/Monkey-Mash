import * as THREE from 'three';
import { Player }      from './player.js';
import { Room }        from './room.js';
import { BananaDrop }  from './pickup.js';
import { Shop }        from './shop.js';
import { generateOffers } from './upgrades.js';

const BANANA_DROP_CHANCE = 0.3;  // per enemy during combat
const VACUUM_TIMEOUT     = 1.4;  // max seconds to wait for vacuum

export class Game {
  constructor(scene, input, config = {}) {
    this.scene   = scene;
    this.input   = input;
    this.isOver  = false;

    this._roomNumber = 1;
    this._phase      = 'fight'; // 'fight' | 'vacuum' | 'shop' | 'transition'
    this._vacuumTimer  = 0;
    this._transTimer   = 0;

    this.onRoomClear = null;
    this.onGameOver  = null;

    const { color = 0x7B3F00, hat = 'none' } = config;

    this.player  = new Player(scene, input, color, hat);
    this.room    = new Room(scene, this._roomNumber);
    this.pickups = [];
    this._shop   = new Shop();

    // Wire banana explosion callback
    this.player.onBananaCollect = (pos) => {
      if (!this.player.stats.bananaExplosion) return;
      for (const e of this.room.enemies) {
        if (e.isDead) continue;
        const dx = e.mesh.position.x - pos.x;
        const dz = e.mesh.position.z - pos.z;
        if (dx*dx + dz*dz < 9) {
          const d = Math.sqrt(dx*dx + dz*dz);
          e.takeDamage(20, new THREE.Vector3(dx/d, 0, dz/d));
        }
      }
    };

    // Ground plane for mouse aim
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._raycaster   = new THREE.Raycaster();
    this._aimTarget   = new THREE.Vector3();

    this._lmbWas = false;
  }

  // ── Main update ──────────────────────────────────────────────────

  update(dt, now, camera, mouseNDC) {
    if (this.isOver) return;

    // Aim raycast
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

    // Dash damage effects (read single-frame flags set by player.update)
    if (this.player._dashJustStarted || this.player._dashJustEnded) {
      const s = this.player.stats;
      if (s.dashDmgHeavy || (s.dashDmgLight && this.player._dashJustEnded)) {
        const dmg = s.dashDmgHeavy ? 30 : 15;
        for (const e of this.room.enemies) {
          if (e.isDead) continue;
          const dx = e.mesh.position.x - this.player.position.x;
          const dz = e.mesh.position.z - this.player.position.z;
          if (dx*dx + dz*dz < 9) {
            const d = Math.sqrt(dx*dx + dz*dz) || 1;
            e.takeDamage(dmg, new THREE.Vector3(dx/d, 0, dz/d));
          }
        }
      }
    }

    if (this._phase === 'fight') {
      this._updateFight(dt);
    } else if (this._phase === 'vacuum') {
      this._updateVacuum(dt);
    } else if (this._phase === 'shop') {
      this._shop.update(dt);
    } else if (this._phase === 'transition') {
      this._transTimer -= dt;
      if (this._transTimer <= 0) {
        this._nextRoom();
        this._phase = 'fight';
      }
    }
  }

  _updateFight(dt) {
    // Attack input
    const lmb = this.input.isMouseDown(0);
    if (lmb && !this._lmbWas) this.player.attack(this.room.enemies);
    this._lmbWas = lmb;

    this.room.update(dt, this.player);
    this.room.clampPlayer(this.player);

    // Spawn drops when enemies die
    for (const e of this.room.enemies) {
      if (e.isDead && !e._droppedBanana) {
        e._droppedBanana = true;
        if (Math.random() < BANANA_DROP_CHANCE) {
          this.pickups.push(new BananaDrop(this.scene, e.mesh.position.x, e.mesh.position.z));
        }
      }
    }

    // Update pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      this.pickups[i].update(dt, this.player);
      if (this.pickups[i].collected) this.pickups.splice(i, 1);
    }

    // Wave cleared?
    if (this.room.isCleared) this._startVacuum();
  }

  _updateVacuum(dt) {
    this._vacuumTimer -= dt;

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      this.pickups[i].update(dt, this.player);
      if (this.pickups[i].collected) this.pickups.splice(i, 1);
    }

    if (this.pickups.length === 0 || this._vacuumTimer <= 0) {
      // Clean up any remaining
      for (const p of this.pickups) p.destroy();
      this.pickups = [];
      this._openShop();
    }
  }

  // ── Wave flow ─────────────────────────────────────────────────────

  _startVacuum() {
    this._phase       = 'vacuum';
    this._vacuumTimer = VACUUM_TIMEOUT;

    // Vacuum any mid-combat drops
    for (const p of this.pickups) p.startVacuum();

    // Spawn economy reward bananas around player, immediately vacuum them
    const reward = this._calcReward();
    for (let i = 0; i < reward; i++) {
      const angle = (i / reward) * Math.PI * 2;
      const r     = 1.2 + Math.random() * 0.8;
      const drop  = new BananaDrop(
        this.scene,
        this.player.position.x + Math.cos(angle) * r,
        this.player.position.z + Math.sin(angle) * r
      );
      drop.startVacuum();
      this.pickups.push(drop);
    }

    if (this.onRoomClear) this.onRoomClear(this._roomNumber);
  }

  _calcReward() {
    // Rooms 1-2: 1-2 bananas. Rooms 3-4: 2-3. Room 5+: 3-4.
    const base  = 1 + Math.min(Math.floor((this._roomNumber - 1) / 2), 2);
    const bonus = Math.random() < 0.4 ? 1 : 0;
    return Math.min(base + bonus, 4);
  }

  _openShop() {
    this._phase = 'shop';
    const offers = generateOffers(this.player.bananas, this._roomNumber);
    this._shop.open(offers, this.player.bananas, (upgrade) => {
      if (upgrade) {
        this.player.bananas -= upgrade.cost;
        upgrade.apply(this.player);
      }
      this._phase      = 'transition';
      this._transTimer = 0.4;
    });
  }

  _nextRoom() {
    for (const p of this.pickups) p.destroy();
    this.pickups = [];

    this.room.destroy();
    this._roomNumber++;
    this.room = new Room(this.scene, this._roomNumber);

    this.player.mesh.position.set(0, 0, 0);
    this.player.velocity.set(0, 0, 0);
  }

  getRoomNumber() { return this._roomNumber; }
}
