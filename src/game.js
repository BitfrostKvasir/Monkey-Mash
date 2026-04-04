import * as THREE from 'three';
import { BrawlerPlayer }   from './brawler.js';
import { SlingerPlayer }   from './slinger.js';
import { TricksterPlayer } from './trickster.js';
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
    this.onHeal      = null;

    this.isPaused = false;
    this._purchasedUpgrades = [];

    const { color = 0x7B3F00, hat = 'none' } = config;
    this._playerClass = config.playerClass || 'brawler';
    const diffMults = { easy: 0.65, normal: 1.0, hard: 1.45 };
    this._difficulty  = config.difficulty || 'normal';
    this._enemyHpMult = diffMults[this._difficulty] ?? 1.0;

    const cls = { brawler: BrawlerPlayer, slinger: SlingerPlayer, trickster: TricksterPlayer }[this._playerClass] || BrawlerPlayer;
    this.player  = new cls(scene, input, color, hat);
    this.room    = new Room(scene, this._roomNumber, { enemyHpMult: this._enemyHpMult, difficulty: this._difficulty });
    this.pickups = [];
    this._shop   = new Shop();

    // Forward player heal events to game-level callback
    this.player.onHeal = (amount) => { if (this.onHeal) this.onHeal(amount); };

    // Wire decoy burst callback (Trickster upgrade)
    this.player.onDecoyExpire = (pos) => {
      if (!this.player.stats.tricksterDecoyBurst) return;
      for (const e of this.room.enemies) {
        if (e.isDead) continue;
        const dx = e.mesh.position.x - pos.x;
        const dz = e.mesh.position.z - pos.z;
        if (dx*dx + dz*dz < 9) {
          const d = Math.sqrt(dx*dx + dz*dz) || 1;
          e.takeDamage(25, new THREE.Vector3(dx/d, 0, dz/d));
        }
      }
    };

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

    this._lmbWas   = false;
    this._shiftWas = false;
    this._rmbWas   = false;
  }

  // ── Main update ──────────────────────────────────────────────────

  pause()  { this.isPaused = true; }
  resume() { this.isPaused = false; }

  removeUpgrade(upgradeId) {
    const idx = this._purchasedUpgrades.findLastIndex(u => u.id === upgradeId);
    if (idx === -1) return false;
    this._purchasedUpgrades.splice(idx, 1);
    this.player.resetStats();
    for (const u of this._purchasedUpgrades) u.apply(this.player);
    // Clamp hp to new max
    this.player.hp = Math.min(this.player.hp, this.player.maxHp);
    return true;
  }

  getPurchasedUpgrades() {
    // Return array of { id, label, icon, desc, count } grouped by id
    const map = new Map();
    for (const u of this._purchasedUpgrades) {
      if (map.has(u.id)) {
        map.get(u.id).count++;
      } else {
        map.set(u.id, { id: u.id, label: u.label, icon: u.icon, desc: u.desc, count: 1 });
      }
    }
    return [...map.values()];
  }

  update(dt, now, camera, mouseNDC) {
    if (this.isOver) return;
    if (this.isPaused) return;

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
    // Attack input — hold to auto-fire at the attack cooldown rate
    const lmb = this.input.isMouseDown(0);
    if (lmb) {
      const fired = this.player.attack(this.room.enemies);
      if (fired) {
        if (this.player._epic?.onPlayerAttack) this.player._epic.onPlayerAttack(this.room.enemies);
        if (this.player._epic?.cloneAttack)    this.player._epic.cloneAttack(this.room.enemies, this._aimTarget);
      }
    }
    this._lmbWas = lmb;

    const shift = this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight');
    if (shift && !this._shiftWas) this.player.useSpecial(this.room.enemies);
    this._shiftWas = shift;

    // Epic ability — right click
    const rmb = this.input.isMouseDown(2);
    if (rmb && !this._rmbWas) this.player.activateEpic(this.room.enemies, this._aimTarget);
    this._rmbWas = rmb;

    // Update active epic ability
    if (this.player._epic) this.player._epic.update(dt, this.room.enemies);

    this.room.update(dt, this.player);
    this.room.clampPlayer(this.player);

    if (this.player.updateProjectiles) {
      this.player.updateProjectiles(dt, this.room.enemies);
    }

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
    if (this.room.isBossRoom) return 8 + Math.floor(Math.random() * 3); // 8-10 bananas
    // Rooms 1-2: 1-2 bananas. Rooms 3-4: 2-3. Room 5+: 3-4.
    const base  = 1 + Math.min(Math.floor((this._roomNumber - 1) / 2), 2);
    const bonus = Math.random() < 0.4 ? 1 : 0;
    return Math.min(base + bonus, 4);
  }

  _openShop() {
    this._phase = 'shop';
    // Boss rooms guarantee a class-specific rare upgrade in slot 3
    const purchasedIds = this._purchasedUpgrades.map(u => u.id);
    const offers = generateOffers(this.player.bananas, this._roomNumber, this._playerClass, this.room.isBossRoom, !!this.player._epic, purchasedIds);
    this._shop.open(offers, this.player.bananas, (upgrade) => {
      if (upgrade) {
        this.player.bananas -= upgrade.cost;
        upgrade.apply(this.player);
        this._purchasedUpgrades.push(upgrade);
      }
      this._phase      = 'transition';
      this._transTimer = 0.4;
    });
  }

  _nextRoom() {
    for (const p of this.pickups) p.destroy();
    this.pickups = [];

    // Heal between rooms — 15% after boss, 7% after every 2nd room
    if (this.room.isBossRoom) {
      this.player.heal(this.player.maxHp * 0.15);
    } else if (this._roomNumber % 2 === 0) {
      this.player.heal(this.player.maxHp * 0.07);
    }

    if (this.player.cleanup) this.player.cleanup();
    this.room.destroy();
    this._roomNumber++;
    this.room = new Room(this.scene, this._roomNumber, { enemyHpMult: this._enemyHpMult, difficulty: this._difficulty });

    this.player.mesh.position.set(0, 0, 0);
    this.player.velocity.set(0, 0, 0);
  }

  getRoomNumber()  { return this._roomNumber; }
  getPlayerClass() { return this._playerClass; }
  getScore()       { return Math.max(0, this._roomNumber - 1); }

  // ── Dev mode helpers ─────────────────────────────────────────────

  _devCloseShop() {
    if (this._shop._overlay) {
      this._shop._overlay.remove();
      this._shop._overlay = null;
    }
    this._shop._closed = true;
  }

  devSkipForward() {
    if (this.isOver) return;
    this._devCloseShop();
    for (const p of this.pickups) p.destroy();
    this.pickups = [];
    if (this.player.cleanup) this.player.cleanup();
    this._nextRoom();
    this._phase = 'fight';
  }

  devSkipBack() {
    if (this.isOver || this._roomNumber <= 1) return;
    this._devCloseShop();
    for (const p of this.pickups) p.destroy();
    this.pickups = [];
    if (this.player.cleanup) this.player.cleanup();
    this.room.destroy();
    this._roomNumber = Math.max(1, this._roomNumber - 1);
    this.room = new Room(this.scene, this._roomNumber, { enemyHpMult: this._enemyHpMult, difficulty: this._difficulty });
    this.player.mesh.position.set(0, 0, 0);
    this.player.velocity.set(0, 0, 0);
    this._phase = 'fight';
  }
}
