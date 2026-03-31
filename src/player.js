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

    const bodyColor = color ?? (side === 1 ? 0xc8860a : 0x2266cc);
    this.mesh = this._buildMesh(scene, side, bodyColor, hat);
  }

  _buildMesh(scene, side, bodyColor, hat) {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
    const muzzleMat = new THREE.MeshLambertMaterial({ color: 0xd4a96a });
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0x111111 });

    // Body
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.7, 12), bodyMat);
    body.position.y = 0.7;
    body.castShadow = true;
    group.add(body);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), bodyMat);
    head.position.y = 1.35;
    head.castShadow = true;
    group.add(head);

    // Muzzle
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), muzzleMat);
    muzzle.position.set(0, 1.32, 0.25);
    muzzle.scale.z = 0.5;
    group.add(muzzle);

    // Eyes
    [-0.1, 0.1].forEach(x => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), eyeMat);
      eye.position.set(x, 1.42, 0.28);
      group.add(eye);
    });

    // Arms
    [-0.4, 0.4].forEach((x, i) => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8), bodyMat);
      arm.rotation.z = (i === 0 ? 1 : -1) * Math.PI / 4;
      arm.position.set(x, 0.85, 0);
      arm.castShadow = true;
      group.add(arm);
    });

    // Legs
    [-0.15, 0.15].forEach(x => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 8), bodyMat);
      leg.position.set(x, 0.25, 0);
      leg.castShadow = true;
      group.add(leg);
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
    hatGroup.position.y = 1.68;

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
