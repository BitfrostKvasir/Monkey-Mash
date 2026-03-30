import * as THREE from 'three';

const MOVE_SPEED = 6;
const JUMP_FORCE = 9;
const GRAVITY = -20;
const GROUND_Y = 0;
const DOUBLE_JUMP_WINDOW = 0.3; // seconds between jumps to trigger double jump

export class Player {
  /**
   * @param {THREE.Scene} scene
   * @param {object} opts
   * @param {number} opts.side  1 = player (positive Z side), -1 = opponent (negative Z side)
   * @param {boolean} opts.isHuman
   * @param {InputManager} [opts.input]
   */
  constructor(scene, { side, isHuman, input }) {
    this.side = side;
    this.isHuman = isHuman;
    this.input = input;

    this.velocity = new THREE.Vector3();
    this.isAirborne = false;
    this.isSpiking = false;
    this.curveLeft = false;
    this.curveRight = false;

    // Double-jump tracking
    this._jumpPressedLast = false;
    this._lastJumpTime = -999;
    this._doubleJumped = false;

    // Spike click tracking
    this._mouseWasDown = false;

    // Build monkey mesh (capsule-ish from primitives)
    this.mesh = this._buildMesh(scene, side);
  }

  _buildMesh(scene, side) {
    const group = new THREE.Group();

    const bodyColor = side === 1 ? 0xc8860a : 0x2266cc;

    // Body
    const bodyGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.7, 12);
    const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.7;
    body.castShadow = true;
    group.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.3, 12, 12);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.y = 1.35;
    head.castShadow = true;
    group.add(head);

    // Face (muzzle)
    const muzzleGeo = new THREE.SphereGeometry(0.18, 8, 8);
    const muzzleMat = new THREE.MeshLambertMaterial({ color: 0xd4a96a });
    const muzzle = new THREE.Mesh(muzzleGeo, muzzleMat);
    muzzle.position.set(0, 1.32, 0.25);
    muzzle.scale.z = 0.5;
    group.add(muzzle);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.06, 6, 6);
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    [-0.1, 0.1].forEach(x => {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(x, 1.42, 0.28);
      group.add(eye);
    });

    // Arms
    const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8);
    const armMat = new THREE.MeshLambertMaterial({ color: bodyColor });
    [-0.4, 0.4].forEach((x, i) => {
      const arm = new THREE.Mesh(armGeo, armMat);
      arm.rotation.z = (i === 0 ? 1 : -1) * Math.PI / 4;
      arm.position.set(x, 0.85, 0);
      arm.castShadow = true;
      group.add(arm);
    });

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.5, 8);
    [-0.15, 0.15].forEach(x => {
      const leg = new THREE.Mesh(legGeo, bodyMat);
      leg.position.set(x, 0.25, 0);
      leg.castShadow = true;
      group.add(leg);
    });

    group.position.set(0, GROUND_Y, side * 4);
    scene.add(group);
    return group;
  }

  get position() {
    return this.mesh.position;
  }

  update(dt, now, ball) {
    if (this.isHuman) {
      this._handleHumanInput(dt, now, ball);
    } else {
      this._handleAI(dt, ball);
    }

    // Apply gravity
    if (this.isAirborne || this.mesh.position.y > GROUND_Y) {
      this.velocity.y += GRAVITY * dt;
    }

    this.mesh.position.addScaledVector(this.velocity, dt);

    // Ground clamp
    if (this.mesh.position.y <= GROUND_Y) {
      this.mesh.position.y = GROUND_Y;
      this.velocity.y = 0;
      this.isAirborne = false;
      this._doubleJumped = false;
    } else {
      this.isAirborne = true;
    }

    // Keep player on their side of the court
    const halfDepth = 9;
    const minZ = this.side === 1 ? 0.4 : -halfDepth;
    const maxZ = this.side === 1 ? halfDepth : -0.4;
    this.mesh.position.z = THREE.MathUtils.clamp(this.mesh.position.z, minZ, maxZ);

    // Horizontal court bounds
    this.mesh.position.x = THREE.MathUtils.clamp(this.mesh.position.x, -8.5, 8.5);

    // Tilt mesh when curving spike
    if (this.isSpiking) {
      if (this.curveLeft) this.mesh.rotation.z = 0.4;
      else if (this.curveRight) this.mesh.rotation.z = -0.4;
      else this.mesh.rotation.z = 0;
    } else {
      this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, 0, 10 * dt);
    }
  }

  _handleHumanInput(dt, now, ball) {
    const inp = this.input;

    // Movement
    this.velocity.x = 0;
    this.velocity.z = 0;

    if (inp.isDown('KeyW')) this.velocity.z -= MOVE_SPEED * this.side;
    if (inp.isDown('KeyS')) this.velocity.z += MOVE_SPEED * this.side;
    if (inp.isDown('KeyA')) this.velocity.x -= MOVE_SPEED;
    if (inp.isDown('KeyD')) this.velocity.x += MOVE_SPEED;

    // Jump / double jump
    const jumpPressed = inp.isDown('Space');
    if (jumpPressed && !this._jumpPressedLast) {
      const timeSinceLast = now - this._lastJumpTime;
      if (!this.isAirborne) {
        // Normal jump
        this.velocity.y = JUMP_FORCE;
        this._lastJumpTime = now;
        this._doubleJumped = false;
      } else if (!this._doubleJumped && timeSinceLast < DOUBLE_JUMP_WINDOW) {
        // Double jump
        this.velocity.y = JUMP_FORCE * 0.85;
        this._doubleJumped = true;
      } else if (!this._doubleJumped) {
        // First press while airborne — allow double jump on next press
        this._lastJumpTime = now;
      }
    }
    this._jumpPressedLast = jumpPressed;

    // Spike
    const mouseDown = inp.isMouseDown(0);
    this.isSpiking = mouseDown && this.isAirborne;
    this.curveLeft = this.isSpiking && inp.isDown('KeyA');
    this.curveRight = this.isSpiking && inp.isDown('KeyD');
    this._mouseWasDown = mouseDown;
  }

  _handleAI(dt, ball) {
    if (!ball || !ball.inPlay) return;

    const bpos = ball.mesh.position;
    const ppos = this.mesh.position;

    // Move toward ball (only on own side)
    const targetX = THREE.MathUtils.clamp(bpos.x, -8, 8);
    const targetZ = THREE.MathUtils.clamp(bpos.z, -8.5, -0.4);

    const dx = targetX - ppos.x;
    const dz = targetZ - ppos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0.2) {
      this.velocity.x = (dx / dist) * MOVE_SPEED * 0.8;
      this.velocity.z = (dz / dist) * MOVE_SPEED * 0.8;
    } else {
      this.velocity.x = 0;
      this.velocity.z = 0;
    }

    // Jump if ball is close and above
    if (dist < 1.5 && bpos.y > 1.2 && !this.isAirborne) {
      this.velocity.y = JUMP_FORCE;
    }

    // Spike if airborne and ball is close
    this.isSpiking = this.isAirborne && dist < 1.2;
    this.curveLeft = false;
    this.curveRight = false;
  }
}
