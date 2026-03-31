import * as THREE from 'three';
import { Game }   from './game.js';
import { InputManager } from './input.js';
import { Menu }   from './menu.js';

// ── Scene ─────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a2a1a);
scene.fog = new THREE.Fog(0x1a2a1a, 25, 45);

// ── Top-down camera ───────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 26, 1);
camera.lookAt(0, 0, 0);

// ── Renderer ──────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ── Lighting ──────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.6));

const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(8, 20, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far  = 60;
sun.shadow.camera.left = sun.shadow.camera.bottom = -20;
sun.shadow.camera.right = sun.shadow.camera.top   =  20;
scene.add(sun);

// ── Resize ────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Mouse NDC tracking ────────────────────────────────────────────
const mouseNDC = new THREE.Vector2();
window.addEventListener('mousemove', e => {
  mouseNDC.x =  (e.clientX / window.innerWidth)  * 2 - 1;
  mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

// ── HUD elements ──────────────────────────────────────────────────
const hpFill      = document.getElementById('hp-fill');
const bananaCount = document.getElementById('banana-count');
const roomNumEl   = document.getElementById('room-num');
const roomClearEl = document.getElementById('room-clear');
const gameOverEl  = document.getElementById('gameover-overlay');
const tryAgainBtn = document.getElementById('btn-try-again');

// ── Game state ────────────────────────────────────────────────────
const input = new InputManager();
let game = null;
let last = performance.now();

function startGame(config) {
  if (game) {
    // Clean up previous game if restarting
    scene.clear();
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    scene.add(sun);
  }

  game = new Game(scene, input, config);

  game.onRoomClear = (roomNum) => {
    roomClearEl.style.opacity = '1';
    setTimeout(() => { roomClearEl.style.opacity = '0'; }, 1800);
  };

  game.onGameOver = () => {
    gameOverEl.style.display = 'flex';
  };

  document.getElementById('hud').style.display = 'block';
  gameOverEl.style.display = 'none';
}

tryAgainBtn?.addEventListener('click', () => {
  gameOverEl.style.display = 'none';
  startGame({ color: 0x7B3F00, hat: 'none' });
});

// ── Render loop ───────────────────────────────────────────────────
function loop() {
  requestAnimationFrame(loop);
  const now = performance.now() / 1000;
  const dt  = Math.min((performance.now() - last) / 1000, 0.05);
  last = performance.now();

  if (game) {
    game.update(dt, now, camera, mouseNDC);

    // Update HUD
    const hp = game.player.hp / game.player.maxHp;
    if (hpFill) hpFill.style.width = (hp * 100).toFixed(1) + '%';
    if (bananaCount) bananaCount.textContent = '🍌 ' + game.player.bananas;
    if (roomNumEl) roomNumEl.textContent = 'Room ' + game.getRoomNumber();
  }

  renderer.render(scene, camera);
}

loop();

// ── Menu ──────────────────────────────────────────────────────────
new Menu((config) => {
  startGame(config);
});
