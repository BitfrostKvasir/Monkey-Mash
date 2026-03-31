import * as THREE from 'three';
import { Game } from './game.js';
import { InputManager } from './input.js';
import { Menu } from './menu.js';

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 30, 60);

// Camera — elevated view from above the player's (right) side
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 14, 7);
camera.lookAt(0, 0, -2);

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

// Input
const input = new InputManager();

// Game instance (created after menu)
let game = null;

// Render loop runs immediately so the court preview shows behind the menu
let last = performance.now();

function loop() {
  requestAnimationFrame(loop);
  const now = performance.now() / 1000;
  const dt = Math.min((performance.now() - last) / 1000, 0.05);
  last = performance.now();

  if (game) {
    game.update(dt, now);

    // Loosely follow player X
    const px = game.player.mesh.position.x;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, px * 0.25, 0.05);
  }

  renderer.render(scene, camera);
}

loop();

// Show menu — game starts when player clicks Play through all screens
new Menu((config) => {
  // Show the in-game HUD
  document.getElementById('ui').style.display = 'flex';
  document.getElementById('controls').style.display = 'block';

  game = new Game(scene, input, config);
});
