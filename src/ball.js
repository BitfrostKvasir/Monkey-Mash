import * as THREE from 'three';
import { COURT } from './court.js';

const GRAVITY = -18;
const BALL_RADIUS = 0.21;
const BOUNCE_DAMPING = 0.45;
const AIR_DRAG = 0.995;

export class Ball {
  constructor(scene) {
    const geo = new THREE.SphereGeometry(BALL_RADIUS, 16, 16);
    const mat = new THREE.MeshLambertMaterial({ color: 0xf5f0c8 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    this.velocity = new THREE.Vector3();
    this.reset();
  }

  reset(side = 1) {
    // Place ball on serving side
    this.mesh.position.set(0, 1.5, side * 3);
    this.velocity.set(0, 0, 0);
    this.inPlay = false;
    this.lastTouchedSide = 0;
    this.touchCount = 0; // touches per side possession
  }

  serve(side = 1) {
    this.inPlay = true;
    this.lastTouchedSide = side;
    this.touchCount = 1;
    // Gentle lob over net
    this.velocity.set((Math.random() - 0.5) * 2, 8, -side * 6);
  }

  /** Returns: null | 'left' | 'right' — which side scored */
  update(dt, players) {
    if (!this.inPlay) return null;

    this.velocity.y += GRAVITY * dt;
    this.velocity.x *= AIR_DRAG;
    this.velocity.z *= AIR_DRAG;

    this.mesh.position.addScaledVector(this.velocity, dt);

    // Net collision (x-axis net at z=0)
    const pos = this.mesh.position;
    if (Math.abs(pos.z) < COURT.netThickness / 2 + BALL_RADIUS) {
      if (pos.y < COURT.netHeight) {
        // Hit the net — push back and kill horizontal velocity
        pos.z = (pos.z >= 0 ? 1 : -1) * (COURT.netThickness / 2 + BALL_RADIUS);
        this.velocity.z *= -0.3;
        this.velocity.x *= 0.5;
      }
    }

    // Wall / boundary bounce (keep in horizontal bounds loosely)
    const hw = COURT.width / 2 + 1;
    if (Math.abs(pos.x) > hw) {
      pos.x = Math.sign(pos.x) * hw;
      this.velocity.x *= -0.5;
    }

    // Player collisions
    for (const player of players) {
      this._checkPlayerHit(player);
    }

    // Floor / ground detection
    if (pos.y - BALL_RADIUS <= 0) {
      pos.y = BALL_RADIUS;
      // Determine which side it landed on
      const landedSide = pos.z > 0 ? 'right' : 'left';
      this.inPlay = false;
      return landedSide;
    }

    return null;
  }

  _checkPlayerHit(player) {
    if (!this.inPlay) return;
    const dist = this.mesh.position.distanceTo(player.mesh.position);
    const hitRadius = BALL_RADIUS + 0.5;

    if (dist < hitRadius) {
      const sideSign = player.side; // 1 = right (player), -1 = left (opponent)

      // Determine if this is a spike attempt
      if (player.isSpiking && player.isAirborne) {
        this._applySpikeForce(player);
      } else {
        // Bump / receive
        this._applyBumpForce(player);
      }

      this.lastTouchedSide = sideSign;
      this.touchCount = (this.lastTouchedSide === sideSign) ? this.touchCount + 1 : 1;
    }
  }

  _applyBumpForce(player) {
    const pos = this.mesh.position;
    // Lift ball upward, toward net
    const toNet = new THREE.Vector3(0, 0, -player.side);
    const upward = new THREE.Vector3(0, 1, 0);
    const dir = toNet.add(upward).normalize();
    const speed = 8 + Math.random() * 2;
    this.velocity.copy(dir.multiplyScalar(speed));
  }

  _applySpikeForce(player) {
    const pos = this.mesh.position;
    // Base spike: fast downward at an angle toward opposite side
    const baseZ = -player.side * (7 + Math.random() * 3);
    const baseY = -6;
    let baseX = (Math.random() - 0.5) * 4;

    // Curve based on A/D held during spike
    if (player.curveLeft) baseX -= 4;
    if (player.curveRight) baseX += 4;

    this.velocity.set(baseX, baseY, baseZ);
  }

  /** External: bump the ball (for bumping contact from non-player entity) */
  bump(direction, speed) {
    this.velocity.copy(direction.normalize().multiplyScalar(speed));
    this.inPlay = true;
  }
}
