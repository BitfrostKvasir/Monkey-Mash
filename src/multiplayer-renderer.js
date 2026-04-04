// src/multiplayer-renderer.js
import * as THREE from 'three';
import { buildMonkeyMesh } from './monkey-model.js';

function disposeMesh(mesh) {
  mesh.geometry?.dispose();
  if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose());
  else mesh.material?.dispose();
}

export class MultiplayerRenderer {
  constructor(scene, mySocketId) {
    this.scene      = scene;
    this.mySocketId = mySocketId;
    this._players   = {}; // socketId -> { mesh, ring, baseColors }
    this._enemies   = {}; // id -> mesh
    this._bananas   = {}; // id -> mesh
  }

  applyState(state) {
    if (!state) return;
    this._syncPlayers(state.players || []);
    this._syncEnemies(state.enemies || []);
    this._syncBananas(state.bananas || []);
  }

  getMyState(state) {
    return (state.players || []).find(p => p.socketId === this.mySocketId) || null;
  }

  _syncPlayers(players) {
    const seen = new Set();
    for (const p of players) {
      if (p.socketId === this.mySocketId) continue; // local player rendered separately
      seen.add(p.socketId);
      if (!this._players[p.socketId]) {
        const { group } = buildMonkeyMesh(p.colour, p.hat);
        // Revive ring
        const ringGeo = new THREE.RingGeometry(0.6, 0.72, 24);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x44ff44, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
        const ring    = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.02;
        ring.visible = false;
        group.add(ring);
        this.scene.add(group);

        // Collect base colors at creation time
        const baseColors = {};
        group.traverse(c => {
          if (c.isMesh && c.material?.color) baseColors[c.uuid] = c.material.color.getHex();
        });
        this._players[p.socketId] = { mesh: group, ring, baseColors };
      }
      const entry = this._players[p.socketId];
      entry.mesh.position.set(p.x, 0, p.z);
      entry.mesh.rotation.y = p.aimAngle ?? 0;

      // Grey out if downed/dead
      const grey = p.isDown || !p.isAlive;
      entry.mesh.traverse(c => {
        if (c.isMesh && c.material?.color) {
          c.material.color.setHex(grey ? 0x666666 : (entry.baseColors[c.uuid] ?? c.material.color.getHex()));
        }
      });

      // Revive ring
      entry.ring.visible = p.isDown && p.reviveProgress > 0;
      if (entry.ring.visible) {
        entry.ring.scale.setScalar(p.reviveProgress);
      }
    }
    // Remove departed
    for (const id of Object.keys(this._players)) {
      if (!seen.has(id)) {
        const entry = this._players[id];
        this.scene.remove(entry.mesh);
        entry.mesh.traverse(c => { if (c.isMesh) disposeMesh(c); });
        delete this._players[id];
      }
    }
  }

  _syncEnemies(enemies) {
    const seen = new Set();
    for (const e of enemies) {
      seen.add(String(e.id));
      if (!this._enemies[e.id]) {
        const geo  = new THREE.SphereGeometry(0.4, 8, 6);
        const mat  = new THREE.MeshLambertMaterial({ color: 0xcc3300 });
        const mesh = new THREE.Mesh(geo, mat);
        this.scene.add(mesh);
        this._enemies[e.id] = mesh;
      }
      this._enemies[e.id].position.set(e.x, 0.4, e.z);
    }
    for (const id of Object.keys(this._enemies)) {
      if (!seen.has(id)) { this.scene.remove(this._enemies[id]); disposeMesh(this._enemies[id]); delete this._enemies[id]; }
    }
  }

  _syncBananas(bananas) {
    const seen = new Set();
    for (const b of bananas) {
      if (b.collected) continue;
      seen.add(String(b.id));
      if (!this._bananas[b.id]) {
        const geo  = new THREE.SphereGeometry(0.2, 7, 5);
        const mat  = new THREE.MeshLambertMaterial({ color: 0xffe135 });
        const mesh = new THREE.Mesh(geo, mat);
        this.scene.add(mesh);
        this._bananas[b.id] = mesh;
      }
      this._bananas[b.id].position.set(b.x, 0.3 + Math.sin(Date.now()/400 + b.id) * 0.1, b.z);
    }
    for (const id of Object.keys(this._bananas)) {
      if (!seen.has(id)) { this.scene.remove(this._bananas[id]); disposeMesh(this._bananas[id]); delete this._bananas[id]; }
    }
  }

  destroy() {
    for (const { mesh } of Object.values(this._players)) {
      this.scene.remove(mesh);
      mesh.traverse(c => { if (c.isMesh) disposeMesh(c); });
    }
    for (const mesh of Object.values(this._enemies))  { this.scene.remove(mesh); disposeMesh(mesh); }
    for (const mesh of Object.values(this._bananas))  { this.scene.remove(mesh); disposeMesh(mesh); }
    this._players = {}; this._enemies = {}; this._bananas = {};
  }
}
