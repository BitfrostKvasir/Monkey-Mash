import * as THREE from 'three';
import { COURT } from './court.js';

const GRAVITY = -18;
const BALL_RADIUS = 0.21;
const AIR_DRAG = 0.995;
const HIT_COOLDOWN = 0.35; // seconds before same player can hit again

// Returns 'right' | 'left' — the LOSING side (side that committed fault / let ball land)
// 'right' = player side (positive Z, side=1)   loses → opponent scores
// 'left'  = opponent side (negative Z, side=-1) loses → player scores

function sideStr(side) {
  return side === 1 ? 'right' : 'left';
}

export class Ball {
  constructor(scene) {
    const geo = new THREE.SphereGeometry(BALL_RADIUS, 16, 16);
    const mat = new THREE.MeshLambertMaterial({ color: 0xf5f0c8 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    this.velocity = new THREE.Vector3();
    this._fault = null; // side value (1 or -1) of the player who faulted
    this.reset();
  }

  reset(side = 1) {
    this.mesh.position.set(0, 1.5, side * 3);
    this.velocity.set(0, 0, 0);
    this.inPlay = false;
    this.lastTouchedSide = 0;   // 1 = player, -1 = opponent, 0 = nobody
    this.consecutiveTouches = 0; // touches by the current possession side
    this._fault = null;
  }

  serve(side = 1) {
    this.inPlay = true;
    this.lastTouchedSide = side;
    this.consecutiveTouches = 1; // serve counts as first touch
    this._fault = null;
    this.velocity.set((Math.random() - 0.5) * 2, 8, -side * 6);
  }

  /**
   * Returns: null | 'left' | 'right'
   *   'left'  → opponent (left/AI) side lost the point → player scores
   *   'right' → player (right) side lost the point    → opponent scores
   */
  update(dt, players) {
    if (!this.inPlay) return null;

    // Decrement per-player hit cooldowns
    for (const p of players) {
      if (p._hitCooldown > 0) p._hitCooldown -= dt;
    }

    this.velocity.y += GRAVITY * dt;
    this.velocity.x *= AIR_DRAG;
    this.velocity.z *= AIR_DRAG;

    this.mesh.position.addScaledVector(this.velocity, dt);

    const pos = this.mesh.position;

    // Net collision — ball hitting the net below the top is a fault for whoever hit it
    if (Math.abs(pos.z) < COURT.netThickness / 2 + BALL_RADIUS && pos.y < COURT.netHeight) {
      // Push back to near side
      pos.z = Math.sign(pos.z || this.lastTouchedSide) * (COURT.netThickness / 2 + BALL_RADIUS);
      this.velocity.z *= -0.2;
      this.velocity.x *= 0.4;
      this.velocity.y = Math.min(this.velocity.y, 0); // fall down
    }

    // Player collisions
    for (const player of players) {
      const fault = this._checkPlayerHit(player);
      if (fault !== null) {
        this.inPlay = false;
        return sideStr(fault);
      }
    }

    // Ball hits floor
    if (pos.y - BALL_RADIUS <= 0) {
      pos.y = BALL_RADIUS;
      this.inPlay = false;

      const hw = COURT.width / 2;
      const hd = COURT.depth / 2;
      const inBounds = Math.abs(pos.x) <= hw && Math.abs(pos.z) <= hd;

      if (inBounds) {
        // Lands in bounds: the side it landed on loses
        return pos.z >= 0 ? 'right' : 'left';
      } else {
        // Out of bounds: whoever last touched it loses
        if (this.lastTouchedSide === 0) return null;
        return sideStr(this.lastTouchedSide);
      }
    }

    return null;
  }

  /**
   * Returns the faulting side (1 or -1) if a 4-touch violation occurred, otherwise null.
   */
  _checkPlayerHit(player) {
    if (player._hitCooldown > 0) return null;

    const dist = this.mesh.position.distanceTo(player.mesh.position);
    const hitRadius = BALL_RADIUS + 0.5;
    if (dist >= hitRadius) return null;

    // Update possession and touch count
    if (this.lastTouchedSide === player.side) {
      this.consecutiveTouches++;
    } else {
      this.consecutiveTouches = 1;
      this.lastTouchedSide = player.side;
    }

    player._hitCooldown = HIT_COOLDOWN;

    // 3-touch limit: 4th touch is a fault
    if (this.consecutiveTouches > 3) {
      return player.side;
    }

    if (player.isSpiking && player.isAirborne) {
      this._applySpikeForce(player);
    } else {
      this._applyBumpForce(player);
    }

    return null;
  }

  _applyBumpForce(player) {
    const toNet = new THREE.Vector3(0, 0, -player.side);
    const upward = new THREE.Vector3(0, 1, 0);
    const dir = toNet.add(upward).normalize();
    const speed = 8 + Math.random() * 2;
    this.velocity.copy(dir.multiplyScalar(speed));
  }

  _applySpikeForce(player) {
    const baseZ = -player.side * (7 + Math.random() * 3);
    const baseY = -6;
    let baseX = (Math.random() - 0.5) * 4;

    if (player.curveLeft) baseX -= 4;
    if (player.curveRight) baseX += 4;

    this.velocity.set(baseX, baseY, baseZ);
  }
}
