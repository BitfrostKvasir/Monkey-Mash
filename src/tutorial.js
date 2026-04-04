import * as THREE from 'three';
import { BrawlerPlayer }  from './brawler.js';
import { buildMonkeyMesh } from './monkey-model.js';

// ── Tutorial arena dimensions ─────────────────────────────────────
const ARENA_W = 20;
const ARENA_D = 16;

// ── Steps ─────────────────────────────────────────────────────────
const STEPS = [
  {
    id: 'welcome',
    text: "Welcome to the jungle! I will teach you the basics so you can get to monkey mashing!",
    advance: 'space',
  },
  {
    id: 'bananas',
    text: "Use the WASD keys to move around and collect the bananas.",
    advance: 'collect4',
  },
  {
    id: 'dodge',
    text: "You can use Space to dash — it gives you invincibility frames. Dodge 3 bullets from the ball machine!",
    advance: 'dodge3',
  },
  {
    id: 'combat',
    text: "Your basic kit has a main attack and a class-based special. Attack with Left Mouse Button — hold it down to auto-attack! You're using the Brawler, which has a three-move combo that increases in damage with each hit. Your special is Rage Mode — activate it with Shift. Complete a full three-attack combo then use your special!",
    advance: 'comboAndSpecial',
  },
  {
    id: 'classes',
    text: "There are multiple different classes! The Slinger throws projectiles and fires a spread volley with Shift. The Trickster has a 360° Tail Whip and a Decoy that teleports you back and tricks enemies.",
    advance: 'space',
  },
  {
    id: 'upgrades',
    text: "Each round you can buy upgrades and class-specific upgrades costing bananas. Use them wisely!",
    advance: 'space',
  },
  {
    id: 'farewell',
    text: "I believe you are ready, young one. Go on and make gramps proud!",
    advance: 'space',
  },
];

// ── Wise Monkey NPC ───────────────────────────────────────────────
class WiseMonkey {
  constructor(scene) {
    const { group } = buildMonkeyMesh(0xaaaaaa, 'none');

    // Add a long white beard
    const beardGroup = new THREE.Group();
    const beardMat = new THREE.MeshLambertMaterial({ color: 0xffffff });

    // Main beard — tapered cylinder hanging from chin
    const mainBeard = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.04, 0.55, 7),
      beardMat
    );
    mainBeard.position.set(0, 1.0, 0.36);
    beardGroup.add(mainBeard);

    // Moustache — two small blobs
    [-0.12, 0.12].forEach(x => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 7, 5), beardMat);
      m.scale.set(1.2, 0.7, 0.8);
      m.position.set(x, 1.16, 0.46);
      beardGroup.add(m);
    });

    group.add(beardGroup);

    // Scale up slightly to look elder-like
    group.scale.setScalar(1.15);
    group.position.set(-5, 0, 0);

    // Face the player (positive X direction)
    group.rotation.y = Math.PI / 2;

    this.mesh = group;
    this._t = 0;

    scene.add(group);
  }

  update(dt) {
    this._t += dt;
    // Gentle idle bob
    this.mesh.position.y = Math.sin(this._t * 1.4) * 0.04;
  }

  destroy(scene) {
    scene.remove(this.mesh);
  }
}

// ── Ball Machine ──────────────────────────────────────────────────
class BallMachine {
  constructor(scene) {
    this.scene = scene;
    this.bullets = [];
    this._fireTimer = 0;
    this._fireInterval = 1.8;

    // Visual: a cylinder base + sphere turret
    const group = new THREE.Group();
    const baseMat = new THREE.MeshLambertMaterial({ color: 0x444466 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.6, 10), baseMat);
    base.position.y = 0.3;
    group.add(base);

    const turret = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0x6666aa }));
    turret.position.y = 0.75;
    group.add(turret);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8),
      new THREE.MeshLambertMaterial({ color: 0x333344 }));
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(0.4, 0.75, 0);
    group.add(barrel);

    group.position.set(5, 0, 0);
    this.mesh = group;
    scene.add(group);
  }

  fire(targetX, targetZ) {
    const sx = this.mesh.position.x;
    const sz = this.mesh.position.z;
    const dx = targetX - sx;
    const dz = targetZ - sz;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;

    const geo = new THREE.SphereGeometry(0.18, 7, 5);
    const mat = new THREE.MeshLambertMaterial({ color: 0xff4422, emissive: new THREE.Color(0x441100) });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(sx, 0.75, sz);
    mesh.castShadow = true;
    this.scene.add(mesh);

    this.bullets.push({
      mesh,
      vx: (dx / len) * 7,
      vz: (dz / len) * 7,
      life: 3.5,
    });
  }

  update(dt, player) {
    this._fireTimer -= dt;
    if (this._fireTimer <= 0) {
      this._fireTimer = this._fireInterval;
      this.fire(player.position.x, player.position.z);
    }

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      b.mesh.position.x += b.vx * dt;
      b.mesh.position.z += b.vz * dt;
      b.mesh.rotation.y += dt * 5;

      if (b.life <= 0) {
        this.scene.remove(b.mesh);
        this.bullets.splice(i, 1);
      }
    }
  }

  destroy() {
    for (const b of this.bullets) this.scene.remove(b.mesh);
    this.bullets = [];
    this.scene.remove(this.mesh);
  }
}

// ── Training Dummy ────────────────────────────────────────────────
class TrainingDummy {
  constructor(scene) {
    this.scene = scene;
    this.hp    = 300;
    this.maxHp = 300;
    this.isDead = false;
    this.hitRadius = 0.55;
    this._totalDmg = 0;
    this._dmgLabel = null;

    // Monkey-like dummy: grey with an X on its face
    const { group } = buildMonkeyMesh(0x888888, 'none');
    group.scale.setScalar(1.0);
    group.position.set(3, 0, -1);

    // Red X eyes overlay
    group.traverse(c => {
      if (c.isMesh && c.material) {
        c.material = c.material.clone();
      }
    });

    this.mesh = group;
    scene.add(group);

    // Floating damage label — DOM element
    this._label = document.createElement('div');
    this._label.style.cssText = `
      position: fixed;
      pointer-events: none;
      font-family: 'Press Start 2P', monospace;
      font-size: 11px;
      color: #ff4444;
      text-shadow: 0 0 6px #000;
      background: rgba(0,0,0,0.65);
      padding: 3px 8px;
      border-radius: 4px;
      transform: translate(-50%, -100%);
      z-index: 20;
      display: none;
    `;
    document.body.appendChild(this._label);
  }

  takeDamage(amount, kb) {
    // Dummy never dies
    this._totalDmg += Math.round(amount);
    this._label.style.display = 'block';
    this._label.textContent = '💥 ' + this._totalDmg + ' dmg';
    // Flash red
    this.mesh.traverse(c => {
      if (c.isMesh && c.material?.emissive) c.material.emissive.setHex(0x441100);
    });
    clearTimeout(this._flashTimeout);
    this._flashTimeout = setTimeout(() => {
      this.mesh.traverse(c => {
        if (c.isMesh && c.material?.emissive) c.material.emissive.setHex(0x000000);
      });
    }, 120);
  }

  updateLabel(camera, renderer) {
    if (this._label.style.display === 'none') return;
    // Project 3D position to screen
    const pos = this.mesh.position.clone();
    pos.y = 2.2;
    pos.project(camera);
    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;
    const x = (pos.x + 1) / 2 * w;
    const y = (1 - pos.y) / 2 * h;
    this._label.style.left = x + 'px';
    this._label.style.top  = y + 'px';
  }

  destroy() {
    this.scene.remove(this.mesh);
    this._label.remove();
  }
}

// ── Tutorial arena floor & walls ──────────────────────────────────
function buildArena(scene) {
  const objects = [];

  // Floor
  const floorGeo = new THREE.PlaneGeometry(ARENA_W, ARENA_D);
  const floorMat = new THREE.MeshLambertMaterial({ color: 0x2a4a2a });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  objects.push(floor);

  // Wall pattern on floor
  const lineGeo = new THREE.PlaneGeometry(ARENA_W, 0.06);
  const lineMat = new THREE.MeshLambertMaterial({ color: 0x3a6a3a });
  for (let z = -ARENA_D / 2 + 2; z < ARENA_D / 2; z += 2) {
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.001, z);
    scene.add(line);
    objects.push(line);
  }

  // Walls
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x1a3a1a });
  const wallThick = 0.5;
  const walls = [
    { w: ARENA_W + wallThick * 2, h: 1.8, x: 0,              z: -ARENA_D / 2 - wallThick / 2 },
    { w: ARENA_W + wallThick * 2, h: 1.8, x: 0,              z:  ARENA_D / 2 + wallThick / 2 },
    { w: wallThick,               h: 1.8, x: -ARENA_W / 2 - wallThick / 2, z: 0 },
    { w: wallThick,               h: 1.8, x:  ARENA_W / 2 + wallThick / 2, z: 0 },
  ];
  for (const w of walls) {
    const geo = new THREE.BoxGeometry(w.w, w.h, wallThick);
    const mesh = new THREE.Mesh(geo, wallMat);
    mesh.position.set(w.x, w.h / 2, w.z);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    scene.add(mesh);
    objects.push(mesh);
  }

  return objects;
}

// ── Tutorial banana ───────────────────────────────────────────────
class TutorialBanana {
  constructor(scene, x, z) {
    this.collected = false;
    this._t = Math.random() * Math.PI * 2;
    const geo = new THREE.SphereGeometry(0.22, 7, 5);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffe135 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(x, 0.3, z);
    this.mesh.castShadow = true;
    scene.add(this.mesh);
    this.scene = scene;
  }

  update(dt, player) {
    if (this.collected) return;
    this._t += dt * 3;
    this.mesh.position.y = 0.3 + Math.sin(this._t) * 0.12;
    this.mesh.rotation.y += dt * 2.5;
    const dx = player.position.x - this.mesh.position.x;
    const dz = player.position.z - this.mesh.position.z;
    if (dx * dx + dz * dz < 0.81) { // 0.9 radius
      this.collected = true;
      this.scene.remove(this.mesh);
    }
  }

  destroy() {
    if (!this.collected) this.scene.remove(this.mesh);
  }
}

// ── Speech bubble UI ──────────────────────────────────────────────
class SpeechBubble {
  constructor() {
    this._overlay = document.createElement('div');
    this._overlay.id = 'tutorial-overlay';
    this._overlay.style.cssText = `
      position: fixed;
      bottom: 0; left: 0; right: 0;
      pointer-events: none;
      z-index: 50;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      padding: 0 0 32px 60px;
    `;

    this._bubble = document.createElement('div');
    this._bubble.style.cssText = `
      background: rgba(10, 20, 10, 0.92);
      border: 2px solid #44cc44;
      border-radius: 12px;
      padding: 18px 24px 14px;
      max-width: 680px;
      min-width: 300px;
      box-shadow: 0 0 24px rgba(0,200,0,0.25);
      pointer-events: auto;
    `;

    this._speaker = document.createElement('div');
    this._speaker.style.cssText = `
      font-family: 'Press Start 2P', monospace;
      font-size: 10px;
      color: #88ff88;
      margin-bottom: 8px;
      letter-spacing: 0.05em;
    `;
    this._speaker.textContent = '🐒 Old Wise Monkey';

    this._text = document.createElement('div');
    this._text.style.cssText = `
      font-family: 'Press Start 2P', monospace;
      font-size: 9px;
      color: #e8f5e8;
      line-height: 1.8;
      min-height: 36px;
    `;

    this._hint = document.createElement('div');
    this._hint.style.cssText = `
      font-family: 'Press Start 2P', monospace;
      font-size: 8px;
      color: #558855;
      margin-top: 10px;
      text-align: right;
    `;

    this._bubble.appendChild(this._speaker);
    this._bubble.appendChild(this._text);
    this._bubble.appendChild(this._hint);
    this._overlay.appendChild(this._bubble);
    document.body.appendChild(this._overlay);

    this._typeTimer = 0;
    this._fullText = '';
    this._charIdx = 0;
    this._done = false;
  }

  show(text, hintText = 'Press SPACE to continue') {
    this._fullText = text;
    this._charIdx  = 0;
    this._done     = false;
    this._text.textContent = '';
    this._hint.textContent = hintText;
  }

  finish() {
    this._text.textContent = this._fullText;
    this._charIdx = this._fullText.length;
    this._done = true;
  }

  update(dt) {
    if (this._done) return;
    this._typeTimer += dt;
    const charsPerSec = 40;
    const target = Math.min(
      Math.floor(this._typeTimer * charsPerSec),
      this._fullText.length
    );
    if (target > this._charIdx) {
      this._charIdx = target;
      this._text.textContent = this._fullText.slice(0, this._charIdx);
    }
    if (this._charIdx >= this._fullText.length) this._done = true;
  }

  destroy() {
    this._overlay.remove();
  }
}

// ── Progress indicator ────────────────────────────────────────────
class ProgressBar {
  constructor() {
    this._el = document.createElement('div');
    this._el.style.cssText = `
      position: fixed;
      top: 18px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.7);
      border: 1px solid #44cc44;
      border-radius: 8px;
      padding: 6px 16px;
      font-family: 'Press Start 2P', monospace;
      font-size: 9px;
      color: #88ff88;
      z-index: 51;
      pointer-events: none;
    `;
    document.body.appendChild(this._el);
  }

  setText(txt) { this._el.textContent = txt; }
  destroy()    { this._el.remove(); }
}

// ── Main Tutorial class ───────────────────────────────────────────
export class Tutorial {
  constructor(scene, input) {
    this.scene   = scene;
    this.input   = input;
    this.isOver  = false;
    this.onComplete = null;

    // Build arena
    this._arenaObjects = buildArena(scene);

    // Player (brawler, brown, no hat)
    this.player = new BrawlerPlayer(scene, input, 0x7B3F00, 'none');
    this.player.mesh.position.set(0, 0, 2);

    // Ground plane for aim raycast
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._raycaster   = new THREE.Raycaster();
    this._aimTarget   = new THREE.Vector3();

    // NPC
    this._npc = new WiseMonkey(scene);

    // UI
    this._bubble   = new SpeechBubble();
    this._progress = new ProgressBar();

    // State
    this._stepIdx    = 0;
    this._spaceWas   = false;
    this._lmbWas     = false;
    this._shiftWas   = false;

    // Step-specific state
    this._bananas    = [];
    this._ballMachine = null;
    this._dummy       = null;
    this._dodgeCount  = 0;
    this._comboCompleted = false;
    this._specialUsed    = false;
    this._prevComboStep  = 0;
    this._prevComboReset = 0;
    this._prevRageActive = false;
    this._rmbWas         = false;

    this._startStep(0);
  }

  _startStep(idx) {
    this._stepIdx = idx;
    const step    = STEPS[idx];
    const total   = STEPS.length;

    // Clean up previous step artifacts
    this._cleanupBananas();
    this._cleanupBallMachine();
    this._cleanupDummy();

    // Progress label
    this._progress.setText(`Tutorial  ${idx + 1} / ${total}`);

    // Hint text based on advance condition
    let hint = 'Press SPACE to continue';
    if (step.advance === 'collect4')      hint = 'Collect all 4 bananas';
    if (step.advance === 'dodge3')        hint = `Dodge bullets: ${this._dodgeCount} / 3`;
    if (step.advance === 'comboAndSpecial') hint = 'Complete a 3-hit combo then use Shift';

    this._bubble.show(step.text, hint);

    // Offset ability HUD upward on the combat step so speech bubble doesn't cover it
    const abilityHud = document.getElementById('bottom-left-hud');
    if (abilityHud) {
      abilityHud.style.bottom = step.id === 'combat' ? '200px' : '20px';
    }

    // Step setup
    if (step.id === 'bananas') {
      this._spawnBananas();
    } else if (step.id === 'dodge') {
      this._dodgeCount = 0;
      this._ballMachine = new BallMachine(this.scene);
    } else if (step.id === 'combat') {
      this._comboCompleted = false;
      this._specialUsed    = false;
      this._prevComboStep  = this.player._comboStep;
      this._prevComboReset = this.player._comboReset;
      this._prevRageActive = this.player._rageActive;
      this._dummy = new TrainingDummy(this.scene);
    }
  }

  _cleanupBananas() {
    for (const b of this._bananas) b.destroy();
    this._bananas = [];
  }

  _cleanupBallMachine() {
    if (this._ballMachine) { this._ballMachine.destroy(); this._ballMachine = null; }
  }

  _cleanupDummy() {
    if (this._dummy) { this._dummy.destroy(); this._dummy = null; }
  }

  _spawnBananas() {
    const positions = [
      [-3,  3], [3,  3],
      [-3, -3], [3, -3],
    ];
    for (const [x, z] of positions) {
      // Randomize a bit
      const bx = x + (Math.random() - 0.5) * 2;
      const bz = z + (Math.random() - 0.5) * 2;
      this._bananas.push(new TutorialBanana(this.scene, bx, bz));
    }
  }

  _clampPlayer() {
    const hw = ARENA_W / 2 - 0.5;
    const hd = ARENA_D / 2 - 0.5;
    const p  = this.player.mesh.position;
    p.x = Math.max(-hw, Math.min(hw, p.x));
    p.z = Math.max(-hd, Math.min(hd, p.z));
    p.y = 0;
  }

  _advance() {
    const next = this._stepIdx + 1;
    if (next >= STEPS.length) {
      // Tutorial complete
      this._end();
    } else {
      this._startStep(next);
    }
  }

  _end() {
    this.isOver = true;
    // Restore ability HUD position
    const abilityHud = document.getElementById('bottom-left-hud');
    if (abilityHud) abilityHud.style.bottom = '20px';
    this._bubble.destroy();
    this._progress.destroy();
    this._cleanupBananas();
    this._cleanupBallMachine();
    this._cleanupDummy();
    this._npc.destroy(this.scene);

    // Remove arena
    for (const obj of this._arenaObjects) this.scene.remove(obj);

    // Remove player
    this.scene.remove(this.player.mesh);
    if (this.player._arcMesh) this.scene.remove(this.player._arcMesh);

    if (this.onComplete) this.onComplete();
  }

  update(dt, now, camera, mouseNDC) {
    if (this.isOver) return;

    // Aim raycast
    if (mouseNDC && camera) {
      this._raycaster.setFromCamera(mouseNDC, camera);
      this._raycaster.ray.intersectPlane(this._groundPlane, this._aimTarget);
    }

    // Attack input
    const lmb = this.input.isMouseDown(0);
    if (lmb) {
      const targets = this._dummy ? [this._dummy] : [];
      this.player.attack(targets);
    }
    this._lmbWas = lmb;

    // Special input
    const shift = this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight');
    if (shift && !this._shiftWas) this.player.useSpecial([]);
    this._shiftWas = shift;

    this.player.update(dt, now, this._aimTarget);

    // Always restore HP so tutorial can't end in death
    if (this.player.hp < 30) {
      this.player.hp = this.player.maxHp;
      this.player.isAlive = true;
    }

    this._clampPlayer();
    this._bubble.update(dt);
    this._npc.update(dt);

    const step  = STEPS[this._stepIdx];
    const space = this.input.isDown('Space');
    const spaceJust = space && !this._spaceWas;

    // Space bar: skip typewriter first, then advance if condition met
    if (spaceJust) {
      if (!this._bubble._done) {
        this._bubble.finish();
      } else if (step.advance === 'space') {
        this._advance();
      }
    }
    this._spaceWas = space;

    // Per-step logic
    if (step.id === 'bananas') {
      // Update bananas; count collected
      let remaining = 0;
      for (const b of this._bananas) {
        b.update(dt, this.player);
        if (!b.collected) remaining++;
      }
      if (remaining === 0 && this._bananas.length === 4 && this._bubble._done) {
        this._advance();
      }
    }

    if (step.id === 'dodge' && this._ballMachine) {
      this._ballMachine.update(dt, this.player);

      // Check dodge: bullet within 0.8 of player while iframes > 0
      for (let i = this._ballMachine.bullets.length - 1; i >= 0; i--) {
        const b = this._ballMachine.bullets[i];
        const dx = b.mesh.position.x - this.player.position.x;
        const dz = b.mesh.position.z - this.player.position.z;
        const dist2 = dx * dx + dz * dz;
        if (dist2 < 0.64) { // within 0.8 units
          if (this.player._iframes > 0) {
            // Dodged!
            this._dodgeCount++;
            this.scene.remove(b.mesh);
            this._ballMachine.bullets.splice(i, 1);
            // Update hint
            this._bubble._hint.textContent = `Dodge bullets: ${this._dodgeCount} / 3`;
            if (this._dodgeCount >= 3 && this._bubble._done) {
              this._advance();
            }
          } else {
            // Hit — deal small damage and remove bullet
            this.player.takeDamage(12);
            this.scene.remove(b.mesh);
            this._ballMachine.bullets.splice(i, 1);
          }
        }
      }
    }

    if (step.id === 'combat') {
      // Detect combo completion: comboStep went from 2 back to 0 via a hit (not timeout)
      const curStep  = this.player._comboStep;
      const curReset = this.player._comboReset;
      if (!this._comboCompleted) {
        // comboStep just wrapped from 2→0 AND comboReset is fresh (just got set to 1.5)
        if (this._prevComboStep === 2 && curStep === 0 && curReset > 1.2) {
          this._comboCompleted = true;
        }
      }
      this._prevComboStep  = curStep;
      this._prevComboReset = curReset;

      // Detect special used: rageActive flipped to true
      if (!this._prevRageActive && this.player._rageActive) {
        this._specialUsed = true;
      }
      this._prevRageActive = this.player._rageActive;

      // Update hint
      const comboTick   = this._comboCompleted ? '✓' : '○';
      const specialTick = this._specialUsed    ? '✓' : '○';
      this._bubble._hint.textContent = `Combo ${comboTick}  Special ${specialTick}`;

      // Advance when both done and text is displayed
      if (this._comboCompleted && this._specialUsed && this._bubble._done) {
        // Brief pause before advancing
        if (!this._comboPauseTimer) this._comboPauseTimer = 0.8;
        this._comboPauseTimer -= dt;
        if (this._comboPauseTimer <= 0) {
          this._comboPauseTimer = null;
          this._advance();
        }
      }

      // Update dummy label
      if (this._dummy && camera) {
        const canvas = document.querySelector('canvas');
        this._dummy.updateLabel(camera, { domElement: canvas });
      }
    }
  }
}
