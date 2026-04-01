import * as THREE from 'three';
import { GruntEnemy }      from './enemy.js';
import { BananaBandit }    from './banana-bandit.js';
import { CoconutBomber }   from './coconut-bomber.js';
import { VineStrangler }   from './vine-strangler.js';
import { SpikedHowler }    from './spiked-howler.js';
import { ThunderSimian }   from './thunder-simian.js';
import { BananaKing }      from './banana-king.js';
import { LabApe }          from './lab-ape.js';

// ── Enemy data ────────────────────────────────────────────────────

const ENTRIES = [
  {
    id: 'grunt',
    cls: GruntEnemy,
    name: 'Grunt',
    wave: 'Wave 1+',
    role: 'Melee Chaser',
    hp: 60,
    attacks: [
      { name: 'Contact Damage', desc: 'Charges straight at the player, dealing 10 damage per hit with a short cooldown.' },
    ],
    lore: 'The most common jungle brute. No strategy — just fury. They gain HP as you go deeper.',
    camPos: [1.7, 2.1, 3.4], camLook: [0, 0.76, 0],
    meshRot: 0.28,
  },
  {
    id: 'bandit',
    cls: BananaBandit,
    name: 'Banana Bandit',
    wave: 'Wave 3+',
    role: 'Duelist',
    hp: 50,
    attacks: [
      { name: 'Swipe Combo', desc: 'Dashes in and delivers a rapid multi-hit swipe for 18 damage per strike.' },
      { name: 'Strafe Circle', desc: 'Orbits the player at mid-range before committing to a dash attack.' },
    ],
    lore: 'A cunning fighter that probes for openings. Dodge the dash — the swipes follow immediately.',
    camPos: [1.7, 2.1, 3.4], camLook: [0, 0.76, 0],
    meshRot: 0.28,
  },
  {
    id: 'bomber',
    cls: CoconutBomber,
    name: 'Coconut Bomber',
    wave: 'Wave 5+',
    role: 'Artillery',
    hp: 65,
    attacks: [
      { name: 'Coconut Lob', desc: 'Arcs a coconut toward the player that explodes on landing for 20 damage in a 2-unit radius. A red ring telegraphs the blast zone.' },
    ],
    lore: 'Prefers to stay far back and rain shells down. Closing the gap forces it to reposition.',
    camPos: [1.7, 2.1, 3.4], camLook: [0, 0.76, 0],
    meshRot: 0.28,
  },
  {
    id: 'strangler',
    cls: VineStrangler,
    name: 'Vine Strangler',
    wave: 'Wave 7+',
    role: 'Controller',
    hp: 60,
    attacks: [
      { name: 'Vine Trap', desc: 'Launches a vine along the ground that roots the player in place for 0.9 seconds. The vine persists for 2 seconds.' },
    ],
    lore: 'Glows green before firing. Rooting you is its only goal — watch out for other enemies capitalising on the lockdown.',
    camPos: [1.7, 2.3, 3.4], camLook: [0, 0.90, 0],
    meshRot: 0.28,
  },
  {
    id: 'howler',
    cls: SpikedHowler,
    name: 'Spiked Howler',
    wave: 'Wave 11+',
    role: 'Berserker',
    hp: 75,
    attacks: [
      { name: 'Spike Lunge', desc: 'Lunges and slams with metal spikes for 20 damage, sending the player flying.' },
      { name: 'Fear Howl', desc: 'Unleashes a howl in a 2.5-unit radius that slows the player by 25% for 2 seconds.' },
    ],
    lore: 'Takes 10% more damage from projectiles — the spikes are real but the armour is in the mind. Stagger it before the howl.',
    camPos: [1.7, 2.1, 3.4], camLook: [0, 0.76, 0],
    meshRot: 0.28,
  },
  {
    id: 'thunder',
    cls: ThunderSimian,
    name: 'Thunder Simian',
    wave: 'Wave 18+',
    role: 'Storm Dancer',
    hp: 60,
    attacks: [
      { name: 'Electric Arc', desc: 'Fires pulsing blue projectiles while strafing in orbit. Deals 6 damage on hit.' },
      { name: 'Shockwave Slam', desc: 'Leaps toward the player and lands for 8 damage plus 7-unit knockback in a 2.2-unit AoE.' },
      { name: 'Overload Pulse', desc: 'Charges all limbs then emits an AoE stun in a 3-unit radius for 5 damage, rooting the player for 0.75s.' },
    ],
    lore: 'Never stands still. Its orbit pattern makes melee risky — keep moving and break its arc rhythm.',
    camPos: [1.7, 2.1, 3.4], camLook: [0, 0.76, 0],
    meshRot: 0.28,
  },
  {
    id: 'bananaking',
    cls: BananaKing,
    name: 'Banana King',
    wave: 'Boss — Room 8',
    role: 'Warlord',
    hp: 750,
    attacks: [
      { name: 'Royal Barrage', desc: 'Hurls 8–11 golden bananas in a wide fan that explode for 30 damage each in a 2.1-unit radius. Fires 14 bananas when enraged.' },
      { name: 'Ground Slam', desc: 'Leaps and slams the floor for 38 damage in a 3.5-unit shockwave. Always follows up with a second delayed shockwave (30 damage, 5-unit radius).' },
      { name: 'Minion Summons', desc: 'Calls 3 Banana Bandits at 75% HP, then 4 more at 25% HP. Continues summoning every 20s. Enrages at 60% HP.' },
    ],
    lore: 'The ruler of the jungle — and now far more aggressive. He enrages earlier, slams relentlessly, and floods the arena with minions at 25% health. The second shockwave always comes.',
    camPos: [3.5, 4.2, 7.0], camLook: [0, 1.55, 0],
    meshRot: 0.22,
  },
  {
    id: 'labape',
    cls: LabApe,
    name: 'Lab Ape',
    wave: 'Boss — Room 16',
    role: 'Experiment',
    hp: 950,
    attacks: [
      { name: 'Chemical Laser', desc: 'After a 0.5s windup, fires a continuous laser for 2 seconds dealing 28 damage per second. Fires a second perpendicular laser when Overloaded.' },
      { name: 'Electro Grenade', desc: 'Lobs a fast bouncing grenade (18 contact / 30 explosion damage). Fires 3 grenades in a spread when Overloaded.' },
      { name: 'Ground Slam', desc: 'Charges and slams for 36 damage in a 3-unit AoE, followed by a second hit for 26 damage. Leaves 2–4 electric spark hazards (8 damage/s) at impact sites.' },
    ],
    lore: 'A product of dark science pushed well past its limits. Overloads at 60% HP — gaining speed, a second laser, triple grenades, and a constant rain of electric sparks across the arena.',
    camPos: [3.2, 3.8, 6.2], camLook: [0, 1.4, 0],
    meshRot: 0.22,
  },
];

// ── Portrait renderer ──────────────────────────────────────────────

let _portraits = null;

function buildPortraits(size = 118) {
  _portraits = {};

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(size, size);
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x0a1505);

  for (const entry of ENTRIES) {
    const pScene = new THREE.Scene();
    pScene.add(new THREE.AmbientLight(0xffffff, 0.70));

    const key = new THREE.DirectionalLight(0xfff8e0, 1.05);
    key.position.set(3, 8, 5);
    pScene.add(key);

    const rim = new THREE.DirectionalLight(0x335588, 0.28);
    rim.position.set(-4, 3, -6);
    pScene.add(rim);

    let enemy;
    try {
      enemy = new entry.cls(pScene, 0, 0);
    } catch (e) {
      _portraits[entry.id] = '';
      pScene.clear();
      continue;
    }

    // Hide flat health-bar planes — they look wrong in portrait
    if (enemy._hpBg) enemy.mesh.remove(enemy._hpBg);
    if (enemy._hpFg) enemy.mesh.remove(enemy._hpFg);

    // Face slightly toward the camera
    enemy.mesh.rotation.y = entry.meshRot;

    const pCam = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
    pCam.position.set(...entry.camPos);
    pCam.lookAt(new THREE.Vector3(...entry.camLook));

    renderer.render(pScene, pCam);
    _portraits[entry.id] = renderer.domElement.toDataURL('image/png');

    pScene.clear();
  }

  renderer.dispose();
}

// ── Overlay HTML/CSS ───────────────────────────────────────────────

const WAVE_COLOR = id =>
  (id === 'bananaking' || id === 'labape') ? '#ffcc00' : '#88ff44';

function buildEntryHTML(entry) {
  const waveCol = WAVE_COLOR(entry.id);
  const attacksHTML = entry.attacks.map(a => `
    <div class="bst-attack">
      <span class="bst-attack-name">${a.name}</span>
      <span class="bst-attack-desc">${a.desc}</span>
    </div>
  `).join('');

  return `
    <div class="bst-entry">
      <img class="bst-portrait" src="${_portraits[entry.id] || ''}" alt="${entry.name}">
      <div class="bst-info">
        <div class="bst-entry-top">
          <div class="bst-entry-name">${entry.name}</div>
          <div class="bst-wave-badge" style="color:${waveCol}; border-color:${waveCol}33;">${entry.wave}</div>
        </div>
        <div class="bst-role">${entry.role} &nbsp;·&nbsp; HP: ${entry.hp}</div>
        <div class="bst-attacks">${attacksHTML}</div>
        <div class="bst-lore">${entry.lore}</div>
      </div>
    </div>
  `;
}

function injectStyles() {
  if (document.getElementById('bst-style')) return;
  const style = document.createElement('style');
  style.id = 'bst-style';
  style.textContent = `
    #bst-overlay {
      position: fixed; inset: 0; z-index: 160;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.82);
      font-family: 'Arial Black', sans-serif;
    }
    #bst-panel {
      background: rgba(8,18,6,0.97);
      border: 1px solid rgba(255,255,255,0.11);
      border-radius: 18px;
      width: min(700px, 95vw);
      max-height: 88vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    #bst-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 26px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      flex-shrink: 0;
    }
    #bst-title {
      font-size: 22px;
      letter-spacing: 5px;
      text-transform: uppercase;
      color: #fff;
    }
    #bst-back {
      font-family: 'Arial Black', sans-serif;
      font-size: 11px;
      letter-spacing: 2px;
      text-transform: uppercase;
      padding: 8px 20px;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 20px;
      cursor: pointer;
      background: transparent;
      color: rgba(255,255,255,0.55);
      transition: background .15s, color .15s;
    }
    #bst-back:hover { background: rgba(255,255,255,0.1); color: #fff; }
    #bst-list {
      overflow-y: auto;
      padding: 10px 10px 20px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.12) transparent;
    }
    .bst-entry {
      display: flex;
      gap: 16px;
      padding: 14px 16px;
      border-radius: 12px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06);
      align-items: flex-start;
    }
    .bst-entry:hover { background: rgba(255,255,255,0.055); }
    .bst-portrait {
      width: 118px; height: 118px;
      border-radius: 10px;
      flex-shrink: 0;
      background: #0a1505;
      display: block;
      border: 1px solid rgba(255,255,255,0.08);
      image-rendering: pixelated;
    }
    .bst-info { flex: 1; min-width: 0; }
    .bst-entry-top {
      display: flex;
      align-items: baseline;
      gap: 10px;
      margin-bottom: 3px;
    }
    .bst-entry-name {
      font-size: 16px;
      color: #fff;
      letter-spacing: 1px;
    }
    .bst-wave-badge {
      font-size: 9px;
      letter-spacing: 2px;
      text-transform: uppercase;
      padding: 2px 8px;
      border: 1px solid;
      border-radius: 10px;
      font-family: Arial, sans-serif;
      font-weight: normal;
      white-space: nowrap;
    }
    .bst-role {
      font-size: 10px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: rgba(255,255,255,0.35);
      font-family: Arial, sans-serif;
      font-weight: normal;
      margin-bottom: 8px;
    }
    .bst-attacks {
      display: flex;
      flex-direction: column;
      gap: 5px;
      margin-bottom: 8px;
    }
    .bst-attack {
      font-family: Arial, sans-serif;
      font-size: 11px;
      line-height: 1.4;
    }
    .bst-attack-name {
      font-family: 'Arial Black', sans-serif;
      font-size: 11px;
      color: rgba(255,210,80,0.9);
      margin-right: 6px;
    }
    .bst-attack-desc { color: rgba(255,255,255,0.5); }
    .bst-lore {
      font-family: Arial, sans-serif;
      font-size: 10px;
      color: rgba(255,255,255,0.28);
      font-style: italic;
      line-height: 1.45;
      border-top: 1px solid rgba(255,255,255,0.06);
      padding-top: 7px;
      margin-top: 2px;
    }
  `;
  document.head.appendChild(style);
}

// ── Public API ─────────────────────────────────────────────────────

export function openBestiary() {
  if (!_portraits) buildPortraits();
  injectStyles();

  const overlay = document.createElement('div');
  overlay.id = 'bst-overlay';
  overlay.innerHTML = `
    <div id="bst-panel">
      <div id="bst-header">
        <div id="bst-title">📖 Bestiary</div>
        <button id="bst-back">← Back</button>
      </div>
      <div id="bst-list">
        ${ENTRIES.map(buildEntryHTML).join('')}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#bst-back').addEventListener('click', () => {
    overlay.remove();
  });

  // Click outside panel to close
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.remove();
  });
}
