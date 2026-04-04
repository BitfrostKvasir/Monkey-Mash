// src/multiplayer-renderer.js
import * as THREE from 'three';
import { buildMonkeyMesh } from './monkey-model.js';

// Build a simple but distinct 3D mesh per enemy type, matching solo visuals
function _buildEnemyMesh(type) {
  const add = (parent, geo, color, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const g = new THREE.Group();
  switch (type) {
    case 'bandit': {
      // Leaner, lighter brown — banana thief look
      add(g, new THREE.SphereGeometry(0.28, 8, 6), 0x8B4513, 0, 0.44, 0);
      add(g, new THREE.SphereGeometry(0.32, 8, 6), 0x8B4513, 0, 1.02, 0);
      add(g, new THREE.SphereGeometry(0.07, 5, 3), 0xffcc00, -0.11, 1.07, 0.28); // eye
      add(g, new THREE.SphereGeometry(0.07, 5, 3), 0xffcc00,  0.11, 1.07, 0.28);
      break;
    }
    case 'bomber': {
      // Stocky green with bomb-like helmet
      add(g, new THREE.SphereGeometry(0.35, 8, 6), 0x2a5520, 0, 0.46, 0);
      add(g, new THREE.SphereGeometry(0.38, 8, 6), 0x2a5520, 0, 1.14, 0);
      add(g, new THREE.CylinderGeometry(0.2, 0.38, 0.22, 8), 0x1a3a10, 0, 1.57, 0);
      add(g, new THREE.SphereGeometry(0.08, 5, 3), 0xff4400, -0.12, 1.18, 0.32);
      add(g, new THREE.SphereGeometry(0.08, 5, 3), 0xff4400,  0.12, 1.18, 0.32);
      break;
    }
    case 'howler': {
      // Spiky orange-furred bruiser
      add(g, new THREE.SphereGeometry(0.33, 8, 6), 0xcc5500, 0, 0.46, 0);
      add(g, new THREE.SphereGeometry(0.38, 8, 6), 0xcc5500, 0, 1.14, 0);
      // Spikes on head
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        add(g, new THREE.ConeGeometry(0.07, 0.28, 4), 0xff7700, Math.cos(a)*0.3, 1.55, Math.sin(a)*0.3);
      }
      add(g, new THREE.SphereGeometry(0.08, 5, 3), 0xff2222, -0.12, 1.18, 0.32);
      add(g, new THREE.SphereGeometry(0.08, 5, 3), 0xff2222,  0.12, 1.18, 0.32);
      break;
    }
    case 'boss': {
      // Large golden king
      add(g, new THREE.SphereGeometry(0.55, 10, 8), 0xd4a017, 0, 0.6, 0);
      add(g, new THREE.SphereGeometry(0.52, 10, 8), 0xd4a017, 0, 1.5, 0);
      add(g, new THREE.CylinderGeometry(0.18, 0.52, 0.35, 8), 0xffcc00, 0, 2.05, 0);
      add(g, new THREE.SphereGeometry(0.1, 5, 3), 0xff2222, -0.18, 1.55, 0.44);
      add(g, new THREE.SphereGeometry(0.1, 5, 3), 0xff2222,  0.18, 1.55, 0.44);
      break;
    }
    default: { // grunt
      // Dark brown basic monkey enemy
      add(g, new THREE.SphereGeometry(0.3, 8, 6), 0x2a1a0a, 0, 0.46, 0);
      add(g, new THREE.SphereGeometry(0.36, 8, 6), 0x2a1a0a, 0, 1.1, 0);
      add(g, new THREE.SphereGeometry(0.08, 6, 4), 0xff2222, -0.12, 1.16, 0.3);
      add(g, new THREE.SphereGeometry(0.08, 6, 4), 0xff2222,  0.12, 1.16, 0.3);
      break;
    }
  }
  return g;
}

function disposeMesh(mesh) {
  mesh.geometry?.dispose();
  if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose());
  else mesh.material?.dispose();
}

export class MultiplayerRenderer {
  constructor(scene, mySocketId) {
    this.scene      = scene;
    this.mySocketId = mySocketId;
    this._players   = {}; // socketId -> { mesh, ring, baseColors, aimArc? }
    this._enemies   = {}; // id -> { mesh, hpBg, hpFg }
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

        // Aim arc — only for local player, shows attack cone direction
        let aimArc = null;
        if (p.socketId === this.mySocketId) {
          const arcPts = [];
          const ARC = Math.PI * 0.65, RANGE = 2.1, SEGS = 16;
          arcPts.push(0, 0.05, 0);
          for (let i = 0; i <= SEGS; i++) {
            const a = -ARC / 2 + (i / SEGS) * ARC;
            arcPts.push(Math.sin(a) * RANGE, 0.05, Math.cos(a) * RANGE);
          }
          arcPts.push(0, 0.05, 0);
          const arcGeo = new THREE.BufferGeometry();
          arcGeo.setAttribute('position', new THREE.Float32BufferAttribute(arcPts, 3));
          aimArc = new THREE.Line(arcGeo, new THREE.LineBasicMaterial({ color: 0x44ffaa, transparent: true, opacity: 0.55 }));
          group.add(aimArc);
        }

        this.scene.add(group);

        // Collect base colors at creation time
        const baseColors = {};
        group.traverse(c => {
          if (c.isMesh && c.material?.color) baseColors[c.uuid] = c.material.color.getHex();
        });
        this._players[p.socketId] = { mesh: group, ring, baseColors, aimArc };
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
        const mesh = _buildEnemyMesh(e.type);

        // HP bar — background track + foreground fill as child meshes
        const barW = 0.7, barH = 0.08;
        const hpBg = new THREE.Mesh(
          new THREE.PlaneGeometry(barW, barH),
          new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide, depthWrite: false })
        );
        hpBg.rotation.x = -Math.PI / 2;
        hpBg.position.set(0, 1.9, 0);
        mesh.add(hpBg);

        const hpFg = new THREE.Mesh(
          new THREE.PlaneGeometry(barW, barH),
          new THREE.MeshBasicMaterial({ color: 0x44ff44, side: THREE.DoubleSide, depthWrite: false })
        );
        hpFg.rotation.x = -Math.PI / 2;
        hpFg.position.set(0, 1.91, 0);
        mesh.add(hpFg);

        this.scene.add(mesh);
        this._enemies[e.id] = { mesh, hpBg, hpFg };
      }
      const entry = this._enemies[e.id];
      entry.mesh.position.set(e.x, 0, e.z);

      // Update HP bar fill
      const pct = Math.max(0, e.hp / (e.maxHp || 1));
      entry.hpFg.scale.x = pct;
      entry.hpFg.position.x = -(1 - pct) * 0.35; // slide left as HP drops
      entry.hpFg.material.color.setHex(pct > 0.5 ? 0x44cc44 : pct > 0.25 ? 0xffcc00 : 0xff4444);
    }
    for (const id of Object.keys(this._enemies)) {
      if (!seen.has(id)) {
        const entry = this._enemies[id];
        this.scene.remove(entry.mesh);
        entry.mesh.traverse(c => { if (c.isMesh) disposeMesh(c); });
        delete this._enemies[id];
      }
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
    for (const entry of Object.values(this._enemies)) {
      this.scene.remove(entry.mesh);
      entry.mesh.traverse(c => { if (c.isMesh) disposeMesh(c); });
    }
    for (const mesh of Object.values(this._bananas))  { this.scene.remove(mesh); disposeMesh(mesh); }
    this._players = {}; this._enemies = {}; this._bananas = {};
  }
}
