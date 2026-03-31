import * as THREE from 'three';

const MOVE_SPEED = 6;
const JUMP_FORCE = 13;
const GRAVITY = -20;
const GROUND_Y = 0;

export class Player {
  /**
   * @param {THREE.Scene} scene
   * @param {object} opts
   * @param {number}  opts.side       1 = player side (positive Z), -1 = opponent side
   * @param {boolean} opts.isHuman
   * @param {object}  [opts.input]    InputManager (human only)
   * @param {number}  [opts.color]    Body color hex (human player)
   * @param {string}  [opts.hat]      Hat id: 'none' | 'tophat' | 'party' | 'cowboy' | 'crown'
   * @param {object}  [opts.aiConfig] AI difficulty config
   */
  constructor(scene, { side, isHuman, input, color, hat = 'none', aiConfig }) {
    this.side = side;
    this.isHuman = isHuman;
    this.input = input;
    this.aiConfig = aiConfig || { speedMult: 0.8, reactionDist: 2.0, spikeChance: 0.6 };

    this.velocity = new THREE.Vector3();
    this.isAirborne = false;
    this.isSpiking = false;
    this.curveLeft = false;
    this.curveRight = false;

    this._jumpPressedLast = false;
    this._mouseWasDown = false;
    this.wantsPass = false;
    this._camAzimuth = 0;       // set for one frame on fresh left-click
    this._hitCooldown = 0; // managed by ball.js to prevent multi-frame contacts

    const bodyColor = color ?? (side === 1 ? 0x7B3F00 : 0x2266cc);
    this.mesh = this._buildMesh(scene, side, bodyColor, hat);
  }

  _buildMesh(scene, side, bodyColor, hat) {
    const group = new THREE.Group();

    const mat    = (c) => new THREE.MeshLambertMaterial({ color: c });
    const body   = mat(bodyColor);
    const cream  = mat(0xF5DEB3);
    const white  = mat(0xF5F5F5);
    const black  = mat(0x151515);

    const add = (geo, m, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      mesh.castShadow = true;
      group.add(mesh);
      return mesh;
    };

    // ── Body (rounded barrel) ──
    add(new THREE.SphereGeometry(0.36, 12, 10), body, 0, 0.56, 0, 1, 1.25, 0.95);

    // ── Head (large, round) ──
    add(new THREE.SphereGeometry(0.44, 14, 12), body, 0, 1.32, 0);

    // Face mask — white oval on front of head
    add(new THREE.SphereGeometry(0.34, 12, 10), white, 0, 1.28, 0.36, 0.88, 0.72, 0.28);

    // Eyes — white sclera
    [-0.14, 0.14].forEach(x => {
      add(new THREE.SphereGeometry(0.115, 10, 8), white, x, 1.38, 0.48, 1, 1, 0.45);
      // Pupil
      add(new THREE.SphereGeometry(0.072, 8, 6), black, x, 1.38, 0.51);
      // Shine dot
      add(new THREE.SphereGeometry(0.026, 6, 4), white, x + 0.03, 1.41, 0.545);
    });

    // Nose
    add(new THREE.SphereGeometry(0.055, 7, 5), black, 0, 1.22, 0.52);

    // Ears
    [-0.44, 0.44].forEach(x => {
      add(new THREE.SphereGeometry(0.155, 8, 6), body, x, 1.36, 0);
      // Inner ear
      add(new THREE.SphereGeometry(0.085, 7, 5), cream, x, 1.36, 0.08);
    });

    // ── Arms — horizontal T-pose ──
    [-1, 1].forEach(dir => {
      // Upper arm
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.55, 8), body);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(dir * 0.65, 0.9, 0);
      arm.castShadow = true;
      group.add(arm);
      // Hand (cream sphere)
      add(new THREE.SphereGeometry(0.13, 8, 6), cream, dir * 0.98, 0.9, 0);
    });

    // ── Legs — short & stubby ──
    [-0.17, 0.17].forEach(x => {
      add(new THREE.CylinderGeometry(0.11, 0.1, 0.32, 8), body, x, 0.2, 0);
      // Foot (black, slightly forward)
      add(new THREE.SphereGeometry(0.13, 8, 6), black, x, 0.04, 0.07, 1, 0.75, 1.35);
    });

    // Hat
    this._addHat(group, hat);

    group.position.set(0, GROUND_Y, side * 4);
    scene.add(group);
    return group;
  }

  _addHat(group, hat) {
    if (hat === 'none') return;

    const hatGroup = new THREE.Group();
    hatGroup.position.y = 1.82;

    if (hat === 'tophat') {
      const brimMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 16), brimMat);
      hatGroup.add(brim);
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.48, 16), brimMat);
      crown.position.y = 0.26;
      hatGroup.add(crown);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.07, 16),
        new THREE.MeshLambertMaterial({ color: 0xcc0000 }));
      band.position.y = 0.05;
      hatGroup.add(band);

    } else if (hat === 'party') {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 12),
        new THREE.MeshLambertMaterial({ color: 0xff44cc }));
      cone.position.y = 0.3;
      hatGroup.add(cone);
      // Polka dots
      [0, 1, 2, 3].forEach(i => {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6),
          new THREE.MeshLambertMaterial({ color: 0xffff00 }));
        const a = (i / 4) * Math.PI * 2;
        dot.position.set(Math.cos(a) * 0.14, 0.22, Math.sin(a) * 0.14);
        hatGroup.add(dot);
      });
      const pom = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8),
        new THREE.MeshLambertMaterial({ color: 0xffffff }));
      pom.position.y = 0.62;
      hatGroup.add(pom);

    } else if (hat === 'cowboy') {
      const brimMat = new THREE.MeshLambertMaterial({ color: 0x8B5E3C });
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.04, 16), brimMat);
      hatGroup.add(brim);
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.35, 16), brimMat);
      crown.position.y = 0.18;
      hatGroup.add(crown);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.285, 0.285, 0.06, 16),
        new THREE.MeshLambertMaterial({ color: 0x333333 }));
      band.position.y = 0.05;
      hatGroup.add(band);

    } else if (hat === 'crown') {
      const crownMat = new THREE.MeshLambertMaterial({ color: 0xffcc00 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.3, 0.2, 16), crownMat);
      hatGroup.add(base);
      // Crown spikes
      [0, 1, 2, 3, 4].forEach(i => {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.25, 6), crownMat);
        const a = (i / 5) * Math.PI * 2;
        spike.position.set(Math.cos(a) * 0.24, 0.22, Math.sin(a) * 0.24);
        hatGroup.add(spike);
      });
      // Gems
      const gemColors = [0xff2222, 0x2222ff, 0x22ff22];
      [0, 1, 2].forEach(i => {
        const gem = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6),
          new THREE.MeshLambertMaterial({ color: gemColors[i] }));
        const a = (i / 3) * Math.PI * 2;
        gem.position.set(Math.cos(a) * 0.24, 0.1, Math.sin(a) * 0.24);
        hatGroup.add(gem);
      });
    }

    group.add(hatGroup);
  }

  get position() {
    return this.mesh.position;
  }

  update(dt, now, ball, camAzimuth = 0) {
    if (this.isHuman) {
      this._handleHumanInput(dt, now, ball, camAzimuth);

    } else {
      this._handleAI(dt, ball);
    }

    if (this.isAirborne || this.mesh.position.y > GROUND_Y) {
      this.velocity.y += GRAVITY * dt;
    }

    this.mesh.position.addScaledVector(this.velocity, dt);

    if (this.mesh.position.y <= GROUND_Y) {
      this.mesh.position.y = GROUND_Y;
      this.velocity.y = 0;
      this.isAirborne = false;
      this._doubleJumped = false;
    } else {
      this.isAirborne = true;
    }

    const halfDepth = 9;
    const minZ = this.side === 1 ? 0.4 : -halfDepth;
    const maxZ = this.side === 1 ? halfDepth : -0.4;
    this.mesh.position.z = THREE.MathUtils.clamp(this.mesh.position.z, minZ, maxZ);
    this.mesh.position.x = THREE.MathUtils.clamp(this.mesh.position.x, -6, 6);

    if (this.isSpiking) {
      if (this.curveLeft) this.mesh.rotation.z = 0.4;
      else if (this.curveRight) this.mesh.rotation.z = -0.4;
      else this.mesh.rotation.z = 0;
    } else {
      this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, 0, 10 * dt);
    }

    // Shift-lock: face the direction the camera is pointing
    if (this.isHuman) {
      this.mesh.rotation.y = THREE.MathUtils.lerp(
        this.mesh.rotation.y,
        Math.PI + this._camAzimuth,
        15 * dt
      );
    }
  }

  _handleHumanInput(dt, now, ball, camAzimuth) {
    this._camAzimuth = camAzimuth;
    const inp = this.input;

    // Camera-relative movement vectors
    // forward = direction camera faces projected on XZ plane
    const fwdX = -Math.sin(camAzimuth);
    const fwdZ = -Math.cos(camAzimuth);
    const rgtX =  Math.cos(camAzimuth);
    const rgtZ = -Math.sin(camAzimuth);  // right = forward rotated -90° around Y

    let mx = 0, mz = 0;
    if (inp.isDown('KeyW')) { mx += fwdX; mz += fwdZ; }
    if (inp.isDown('KeyS')) { mx -= fwdX; mz -= fwdZ; }
    if (inp.isDown('KeyD')) { mx += rgtX; mz += rgtZ; }
    if (inp.isDown('KeyA')) { mx -= rgtX; mz -= rgtZ; }

    const len = Math.sqrt(mx * mx + mz * mz);
    if (len > 0) {
      this.velocity.x = (mx / len) * MOVE_SPEED;
      this.velocity.z = (mz / len) * MOVE_SPEED;
    } else {
      this.velocity.x = 0;
      this.velocity.z = 0;
    }

    const jumpPressed = inp.isDown('Space');
    if (jumpPressed && !this._jumpPressedLast) {
      if (!this.isAirborne) {
        this.velocity.y = JUMP_FORCE;
      } else {
        // Second space press in air → spike
        this.isSpiking = true;
      }
    }
    // Clear spike once player lands
    if (!this.isAirborne) this.isSpiking = false;
    this._jumpPressedLast = jumpPressed;

    this.curveLeft  = this.isSpiking && inp.isDown('KeyA');
    this.curveRight = this.isSpiking && inp.isDown('KeyD');

    // Left click → pass (consumed by ball.js on contact)
    const mouseDown = inp.isMouseDown(0);
    this.wantsPass = mouseDown && !this._mouseWasDown;
    this._mouseWasDown = mouseDown;
  }

  _handleAI(dt, ball) {
    if (!ball || !ball.inPlay) return;

    const cfg = this.aiConfig;
    const bpos = ball.mesh.position;
    const ppos = this.mesh.position;

    const targetX = THREE.MathUtils.clamp(bpos.x, -8, 8);
    const targetZ = THREE.MathUtils.clamp(bpos.z, -8.5, -0.4);

    const dx = targetX - ppos.x;
    const dz = targetZ - ppos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0.2) {
      this.velocity.x = (dx / dist) * MOVE_SPEED * cfg.speedMult;
      this.velocity.z = (dz / dist) * MOVE_SPEED * cfg.speedMult;
    } else {
      this.velocity.x = 0;
      this.velocity.z = 0;
    }

    if (dist < cfg.reactionDist && bpos.y > 1.2 && !this.isAirborne) {
      this.velocity.y = JUMP_FORCE;
    }

    this.isSpiking = this.isAirborne && dist < 1.2 && Math.random() < cfg.spikeChance;
    this.curveLeft = false;
    this.curveRight = false;
  }
}
