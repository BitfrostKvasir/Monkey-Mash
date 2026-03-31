import * as THREE from 'three';

const MOVE_SPEED = 6;
const JUMP_FORCE = 13;
const GRAVITY = -20;
const GROUND_Y = 0;

export class Player {
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
    this._rightMouseWasDown = false;
    this.wantsPass = false;
    this._passAnimTimer = 0;
    this._camAzimuth = 0;
    this._hitCooldown = 0;

    // Dive state
    this.isDiving = false;
    this._diveTimer = 0;
    this._diveCooldown = 0;
    this._diveDir = new THREE.Vector3();
    this._leanX = 0;

    // Animated limb groups (set in _buildMesh)
    this._rightArm = null;
    this._leftArm  = null;
    this._rightLeg = null;
    this._leftLeg  = null;

    const bodyColor = color ?? (side === 1 ? 0x7B3F00 : 0x2266cc);
    this.mesh = this._buildMesh(scene, side, bodyColor, hat);
  }

  // ── Mesh construction ────────────────────────────────────────────

  _buildMesh(scene, side, bodyColor, hat) {
    const group = new THREE.Group();
    const mat   = (c) => new THREE.MeshLambertMaterial({ color: c });
    const bodyM = mat(bodyColor);
    const cream = mat(0xF5DEB3);
    const white = mat(0xF5F5F5);
    const black = mat(0x151515);

    const add = (geo, m, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      mesh.castShadow = true;
      group.add(mesh);
      return mesh;
    };

    // Body
    add(new THREE.SphereGeometry(0.36, 12, 10), bodyM, 0, 0.56, 0, 1, 1.25, 0.95);

    // Head
    add(new THREE.SphereGeometry(0.44, 14, 12), bodyM, 0, 1.32, 0);

    // Face mask
    add(new THREE.SphereGeometry(0.34, 12, 10), white, 0, 1.28, 0.36, 0.88, 0.72, 0.28);

    // Eyes
    [-0.14, 0.14].forEach(x => {
      add(new THREE.SphereGeometry(0.115, 10, 8), white, x, 1.38, 0.48, 1, 1, 0.45);
      add(new THREE.SphereGeometry(0.072, 8,  6), black, x, 1.38, 0.51);
      add(new THREE.SphereGeometry(0.026, 6,  4), white, x + 0.03, 1.41, 0.545);
    });

    // Nose
    add(new THREE.SphereGeometry(0.055, 7, 5), black, 0, 1.22, 0.52);

    // Ears
    [-0.44, 0.44].forEach(x => {
      add(new THREE.SphereGeometry(0.155, 8, 6), bodyM, x, 1.36, 0);
      add(new THREE.SphereGeometry(0.085, 7, 5), cream, x, 1.36, 0.08);
    });

    // ── Arm groups — pivot at shoulder ──
    // rotating the group around Z lifts/lowers the whole arm+hand
    // right arm (dir=1):  rotation.z = +π/2 → arm UP,  -π/2 → arm DOWN
    // left  arm (dir=-1): rotation.z = -π/2 → arm UP,  +π/2 → arm DOWN
    const makeArmGroup = (dir) => {
      const g = new THREE.Group();
      g.position.set(dir * 0.42, 0.85, 0);
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.55, 8), bodyM);
      cyl.rotation.z = Math.PI / 2;
      cyl.position.set(dir * 0.275, 0, 0);
      cyl.castShadow = true;
      g.add(cyl);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), cream);
      hand.position.set(dir * 0.55, 0, 0);
      hand.castShadow = true;
      g.add(hand);
      group.add(g);
      return g;
    };
    this._rightArm = makeArmGroup(1);
    this._leftArm  = makeArmGroup(-1);

    // ── Leg groups — pivot at hip ──
    // rotating around X swings leg forward (+) or backward (-)
    const makeLegGroup = (dir) => {
      const g = new THREE.Group();
      g.position.set(dir * 0.17, 0.37, 0);
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.32, 8), bodyM);
      cyl.position.set(0, -0.16, 0);
      cyl.castShadow = true;
      g.add(cyl);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), black);
      foot.scale.set(1, 0.75, 1.35);
      foot.position.set(0, -0.32, 0.07);
      foot.castShadow = true;
      g.add(foot);
      group.add(g);
      return g;
    };
    this._rightLeg = makeLegGroup(1);
    this._leftLeg  = makeLegGroup(-1);

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
      [0, 1, 2, 3, 4].forEach(i => {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.25, 6), crownMat);
        const a = (i / 5) * Math.PI * 2;
        spike.position.set(Math.cos(a) * 0.24, 0.22, Math.sin(a) * 0.24);
        hatGroup.add(spike);
      });
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

  // ── Animation ────────────────────────────────────────────────────

  _animate(dt, now) {
    const L = Math.min(1, 14 * dt); // lerp speed

    const moving = !this.isAirborne &&
      (Math.abs(this.velocity.x) > 0.3 || Math.abs(this.velocity.z) > 0.3);

    let tRA = 0, tLA = 0; // target arm rotation.z (right, left)
    let tRL = 0, tLL = 0; // target leg rotation.x (right, left)

    if (this.isDiving) {
      // Both arms stretch forward (down toward ground in world space = arms out front)
      tRA =  Math.PI / 4;
      tLA = -Math.PI / 4;
      tRL =  0.3;
      tLL =  0.3;
    } else if (this.isSpiking) {
      // Right hand drives down, left hand stays up
      tRA = -Math.PI / 2;
      tLA = -Math.PI / 2;
    } else if (this._passAnimTimer > 0) {
      // Both hands up for pass
      tRA =  Math.PI / 2;
      tLA = -Math.PI / 2;
      this._passAnimTimer -= dt;
    } else if (this.isAirborne) {
      // In air: both arms up
      tRA =  Math.PI / 2;
      tLA = -Math.PI / 2;
    } else if (moving) {
      // Walking: alternating arm swing + leg swing
      const phase = now * 8;
      tRA =  Math.sin(phase) * 0.5;
      tLA = -Math.sin(phase) * 0.5;
      tRL =  Math.sin(phase) * 0.55;
      tLL = -Math.sin(phase) * 0.55;
    }
    // else idle: all targets stay 0 → T-pose

    this._rightArm.rotation.z = THREE.MathUtils.lerp(this._rightArm.rotation.z, tRA, L);
    this._leftArm.rotation.z  = THREE.MathUtils.lerp(this._leftArm.rotation.z,  tLA, L);
    this._rightLeg.rotation.x = THREE.MathUtils.lerp(this._rightLeg.rotation.x, tRL, L);
    this._leftLeg.rotation.x  = THREE.MathUtils.lerp(this._leftLeg.rotation.x,  tLL, L);
  }

  // ── Main update ──────────────────────────────────────────────────

  get position() { return this.mesh.position; }

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
    } else {
      this.isAirborne = true;
    }

    // Dive slide deceleration + timer
    if (this.isDiving) {
      this._diveTimer -= dt;
      const drag = Math.pow(0.18, dt); // aggressive friction
      this.velocity.x *= drag;
      this.velocity.z *= drag;
      if (this._diveTimer <= 0) {
        this.isDiving = false;
        this._diveCooldown = 1.0;
        this.velocity.x = 0;
        this.velocity.z = 0;
      }
    }
    if (this._diveCooldown > 0) this._diveCooldown -= dt;

    const halfDepth = 9;
    const minZ = this.side === 1 ? 0.4 : -halfDepth;
    const maxZ = this.side === 1 ? halfDepth : -0.4;
    this.mesh.position.z = THREE.MathUtils.clamp(this.mesh.position.z, minZ, maxZ);
    this.mesh.position.x = THREE.MathUtils.clamp(this.mesh.position.x, -6, 6);

    // Body tilt when curving spike
    if (this.isSpiking) {
      this.mesh.rotation.z = this.curveLeft ? 0.4 : this.curveRight ? -0.4 : 0;
    } else {
      this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, 0, 10 * dt);
    }

    // Dive lean — tilt body forward along the dive direction
    const targetLean = this.isDiving ? -0.72 : 0;
    this._leanX = THREE.MathUtils.lerp(this._leanX, targetLean, Math.min(1, 14 * dt));
    this.mesh.rotation.x = this._leanX;

    // Shift-lock facing
    if (this.isHuman) {
      this.mesh.rotation.y = THREE.MathUtils.lerp(
        this.mesh.rotation.y,
        Math.PI + this._camAzimuth,
        15 * dt
      );
    }

    this._animate(dt, now);
  }

  // ── Input ────────────────────────────────────────────────────────

  _handleHumanInput(dt, now, ball, camAzimuth) {
    this._camAzimuth = camAzimuth;
    const inp = this.input;

    const fwdX = -Math.sin(camAzimuth);
    const fwdZ = -Math.cos(camAzimuth);
    const rgtX =  Math.cos(camAzimuth);
    const rgtZ = -Math.sin(camAzimuth);

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
        this.isSpiking = true;
      }
    }
    if (!this.isAirborne) this.isSpiking = false;
    this._jumpPressedLast = jumpPressed;

    this.curveLeft  = this.isSpiking && inp.isDown('KeyA');
    this.curveRight = this.isSpiking && inp.isDown('KeyD');

    const mouseDown = inp.isMouseDown(0);
    if (mouseDown && !this._mouseWasDown) {
      this.wantsPass = true;
      this._passAnimTimer = 0.45;
    }
    this._mouseWasDown = mouseDown;

    // Right click → dive in movement direction
    const rmbDown = inp.isMouseDown(2);
    if (rmbDown && !this._rightMouseWasDown && !this.isDiving && this._diveCooldown <= 0 && !this.isAirborne) {
      let dx = mx, dz = mz; // reuse already-computed movement direction
      if (dx === 0 && dz === 0) { dx = fwdX; dz = fwdZ; } // default: dive forward
      const dlen = Math.sqrt(dx * dx + dz * dz);
      this._diveDir.set(dx / dlen, 0, dz / dlen);
      this.isDiving = true;
      this._diveTimer = 0.55;
      this.velocity.x = this._diveDir.x * 15;
      this.velocity.z = this._diveDir.z * 15;
    }
    this._rightMouseWasDown = rmbDown;
  }

  _handleAI(dt, ball) {
    if (!ball || !ball.inPlay) return;

    const cfg  = this.aiConfig;
    const bpos = ball.mesh.position;
    const ppos = this.mesh.position;

    const targetX = THREE.MathUtils.clamp(bpos.x, -8, 8);
    const targetZ = THREE.MathUtils.clamp(bpos.z, -8.5, -0.4);

    const dx   = targetX - ppos.x;
    const dz   = targetZ - ppos.z;
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

    this.isSpiking  = this.isAirborne && dist < 1.2 && Math.random() < cfg.spikeChance;
    this.curveLeft  = false;
    this.curveRight = false;
  }
}
