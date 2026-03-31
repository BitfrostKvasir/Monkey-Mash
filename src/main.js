import * as THREE from 'three';
import { Game } from './game.js';
import { InputManager } from './input.js';
import { Menu } from './menu.js';

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 30, 60);

// Camera
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Lighting
const ambient = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(10, 20, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 60;
sun.shadow.camera.left = -15;
sun.shadow.camera.right = 15;
sun.shadow.camera.top = 15;
sun.shadow.camera.bottom = -15;
scene.add(sun);

// Resize handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Orbit camera ─────────────────────────────────────────────────────────────
const CAM_RADIUS      = 13;
const CAM_SENSITIVITY = 0.003;
const CAM_ELEV_MIN    = 0.15;  // ~9°  — don't dip below ground
const CAM_ELEV_MAX    = 1.45;  // ~83° — don't flip over top

// Initial angles: elevated, behind-right of player side
let camAzimuth   = 0.5;
let camElevation = 0.75;

let gameActive = false;

document.addEventListener('mousemove', (e) => {
  if (!gameActive || !document.pointerLockElement) return;
  camAzimuth   -= e.movementX * CAM_SENSITIVITY;
  camElevation -= e.movementY * CAM_SENSITIVITY;
  camElevation  = Math.max(CAM_ELEV_MIN, Math.min(CAM_ELEV_MAX, camElevation));
});

// Click canvas to grab pointer lock (only after game starts)
renderer.domElement.addEventListener('click', () => {
  if (gameActive && !document.pointerLockElement) {
    renderer.domElement.requestPointerLock();
  }
});

function updateCamera(targetPos) {
  const x = targetPos.x + CAM_RADIUS * Math.sin(camAzimuth) * Math.cos(camElevation);
  const y = targetPos.y + CAM_RADIUS * Math.sin(camElevation);
  const z = targetPos.z + CAM_RADIUS * Math.cos(camAzimuth) * Math.cos(camElevation);
  camera.position.set(x, y, z);
  camera.lookAt(targetPos.x, targetPos.y + 1, targetPos.z);
}

// Set a static default view for the menu background
updateCamera(new THREE.Vector3(0, 0, 4));

// ── Input & game ──────────────────────────────────────────────────────────────
const input = new InputManager();
let game = null;

let last = performance.now();

function loop() {
  requestAnimationFrame(loop);
  const now = performance.now() / 1000;
  const dt = Math.min((performance.now() - last) / 1000, 0.05);
  last = performance.now();

  if (game) {
    game.update(dt, now, camAzimuth);
    updateCamera(game.player.mesh.position);
  }

  renderer.render(scene, camera);
}

loop();

new Menu((config) => {
  document.getElementById('ui').style.display = 'flex';
  document.getElementById('controls').style.display = 'block';

  game = new Game(scene, input, config);
  gameActive = true;

  // Auto-lock pointer on game start
  renderer.domElement.requestPointerLock();
});
