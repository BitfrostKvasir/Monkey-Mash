import * as THREE from 'three';
import { Game }     from './game.js';
import { Tutorial } from './tutorial.js';
import { InputManager } from './input.js';
import { Menu, PLAYER_COLORS, HATS, PLAYER_CLASSES } from './menu.js';
import { initDamageNumbers, updateDmgNums, setDmgNumColor } from './damage-numbers.js';
import { openBestiary } from './bestiary.js';
import { UPGRADES }     from './upgrades.js';

initDamageNumbers(document.getElementById('dmg-layer'));

const CLASS_COLORS = {
  brawler:  '#ff7722',
  slinger:  '#ffe135',
  trickster: '#44ffee',
};

// ── Scene ─────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1608);
scene.fog = new THREE.Fog(0x0b1608, 20, 38);

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

// Prevent right-click context menu so right-click can be used as a game input
window.addEventListener('contextmenu', e => e.preventDefault());

// ── HUD elements ──────────────────────────────────────────────────
// ── High score ────────────────────────────────────────────────────
const DIFF_COLORS = { easy: '#44cc22', normal: '#ffcc00', hard: '#ff4444' };
const getHighScore = (diff = 'normal') => parseInt(localStorage.getItem('monkeyMash_hs_' + diff) || '0', 10);
const setHighScore = (diff = 'normal', v) => localStorage.setItem('monkeyMash_hs_' + diff, v);

const scoreHudEl  = document.getElementById('score-hud');
const goScoreVal  = document.getElementById('go-score-val');
const goScoreDiff = document.getElementById('go-score-diff');
const goBestVal   = document.getElementById('go-best-val');
const goBestDiff  = document.getElementById('go-best-diff');
const goNewRecord = document.getElementById('go-new-record');

// ── HUD elements ──────────────────────────────────────────────────
const hpFill          = document.getElementById('hp-fill');
const bananaCount     = document.getElementById('banana-count');
const roomNumEl       = document.getElementById('room-num');
const roomClearEl     = document.getElementById('room-clear');
const gameOverEl      = document.getElementById('gameover-overlay');
const tryAgainBtn     = document.getElementById('btn-try-again');
const changeKitBtn    = document.getElementById('btn-change-kit');
const goCustomizerEl  = document.getElementById('go-customizer');
const confirmKitBtn   = document.getElementById('btn-confirm-kit');
const specialIndicator = document.getElementById('special-indicator');
const specialIcon     = document.getElementById('special-icon');
const specialName     = document.getElementById('special-name');
const specialCdFill   = document.getElementById('special-cd-fill');
const epicIndicator   = document.getElementById('epic-indicator');
const epicIcon        = document.getElementById('epic-icon');
const epicName        = document.getElementById('epic-name');
const epicCdFill      = document.getElementById('epic-cd-fill');
const bossHud         = document.getElementById('boss-hud');
const bossNameEl      = document.getElementById('boss-name');
const bossHpFill      = document.getElementById('boss-hp-fill');
const healMsgEl       = document.getElementById('heal-msg');
const pauseOverlay    = document.getElementById('pause-overlay');
const pauseUpgradeList = document.getElementById('upgrade-list');
const btnPause        = document.getElementById('btn-pause');
const btnResume       = document.getElementById('btn-resume');
const goClassRow      = document.getElementById('go-class-row');
const goColorRow      = document.getElementById('go-color-row');
const goHatRow        = document.getElementById('go-hat-row');

// ── Game Over customizer ──────────────────────────────────────────
let _goConfig = null; // tracks selections inside the game over screen

function buildGameOverCustomizer() {
  _goConfig = { ...(lastConfig ?? { color: 0x7B3F00, hat: 'none', playerClass: 'brawler' }) };

  // Class cards
  goClassRow.innerHTML = PLAYER_CLASSES.map(p => `
    <div class="go-class-card${_goConfig.playerClass === p.id ? ' selected' : ''}" data-id="${p.id}">
      <div class="go-class-icon">${p.emoji}</div>
      <div class="go-class-name">${p.label}</div>
    </div>
  `).join('');
  goClassRow.querySelectorAll('.go-class-card').forEach(card => {
    card.addEventListener('click', () => {
      _goConfig.playerClass = card.dataset.id;
      goClassRow.querySelectorAll('.go-class-card').forEach(c =>
        c.classList.toggle('selected', c.dataset.id === _goConfig.playerClass));
    });
  });

  // Color swatches
  goColorRow.innerHTML = PLAYER_COLORS.map((c, i) => `
    <div class="go-color-swatch${_goConfig.color === c.value ? ' selected' : ''}"
         data-idx="${i}" title="${c.label}" style="background:${c.hex};"></div>
  `).join('');
  goColorRow.querySelectorAll('.go-color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      _goConfig.color = PLAYER_COLORS[parseInt(sw.dataset.idx)].value;
      goColorRow.querySelectorAll('.go-color-swatch').forEach((s, i) =>
        s.classList.toggle('selected', PLAYER_COLORS[i].value === _goConfig.color));
    });
  });

  // Hat cards
  goHatRow.innerHTML = HATS.map(h => `
    <div class="go-hat-card${_goConfig.hat === h.id ? ' selected' : ''}" data-id="${h.id}">
      <div class="go-hat-icon">${h.emoji}</div>
      <div class="go-hat-name">${h.label}</div>
    </div>
  `).join('');
  goHatRow.querySelectorAll('.go-hat-card').forEach(card => {
    card.addEventListener('click', () => {
      _goConfig.hat = card.dataset.id;
      goHatRow.querySelectorAll('.go-hat-card').forEach(c =>
        c.classList.toggle('selected', c.dataset.id === _goConfig.hat));
    });
  });
}

let _healTimeout = null;
function showHealMsg(amount) {
  if (!healMsgEl) return;
  healMsgEl.textContent = '+' + amount + ' HP';
  healMsgEl.classList.add('visible');
  if (hpFill) { hpFill.style.background = 'linear-gradient(90deg, #22cc55, #44ff88)'; }
  clearTimeout(_healTimeout);
  _healTimeout = setTimeout(() => {
    healMsgEl.classList.remove('visible');
    if (hpFill) { hpFill.style.background = ''; }
  }, 1600);
}

function buildUpgradeList(upgrades) {
  if (!pauseUpgradeList) return;
  if (upgrades.length === 0) {
    pauseUpgradeList.innerHTML = '<div class="pause-empty">No upgrades yet</div>';
    return;
  }
  pauseUpgradeList.innerHTML = upgrades.map(u => `
    <div class="pause-upgrade-row">
      <div class="pause-upgrade-icon">${u.icon}</div>
      <div class="pause-upgrade-info">
        <div class="pause-upgrade-name">${u.label}</div>
        <div class="pause-upgrade-desc">${u.desc}</div>
      </div>
      <div class="pause-upgrade-count">${u.count > 1 ? `×${u.count}` : '×1'}</div>
    </div>
  `).join('');
}

function openPause() {
  if (!game || game.isOver) return;
  game.pause();
  buildUpgradeList(game.getPurchasedUpgrades());
  pauseOverlay?.classList.add('visible');
}

function closePause() {
  if (!game) return;
  game.resume();
  pauseOverlay?.classList.remove('visible');
}

function togglePause() {
  if (!game || game.isOver) return;
  if (game.isPaused) closePause(); else openPause();
}

btnPause?.addEventListener('click', togglePause);
btnResume?.addEventListener('click', closePause);
document.getElementById('btn-bestiary')?.addEventListener('click', openBestiary);
document.getElementById('btn-exit-to-menu')?.addEventListener('click', () => {
  pauseOverlay?.classList.remove('visible');
  gameOverEl.style.display = 'none';
  document.getElementById('hud').style.display = 'none';
  if (game) { game.isOver = true; }
  if (tutorial) { tutorial.isOver = true; tutorial = null; }
  new Menu(cfg => startGame(cfg), () => startTutorial());
});

// ── Dev mode ──────────────────────────────────────────────────────
let devMode   = false;
let _cheatBuf = '';
const devBadgeEl = document.getElementById('dev-badge');

function activateDevMode() {
  if (devMode) return;
  devMode = true;
  _cheatBuf = '';
  if (devBadgeEl) devBadgeEl.style.display = 'block';
}

function openDevShop() {
  if (!game || game.isOver) return;
  if (document.getElementById('dev-shop-overlay')) {
    document.getElementById('dev-shop-overlay').remove();
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'dev-shop-overlay';
  overlay.innerHTML = `
    <div id="dev-shop-panel">
      <div id="dev-shop-header">
        <div id="dev-shop-title">🛠 Dev Build — Upgrades</div>
        <button id="dev-shop-close">✕ Close</button>
      </div>
      <div id="dev-shop-hint">
        O — toggle this panel &nbsp;·&nbsp; ← → — skip rooms &nbsp;·&nbsp; ∞ health active
      </div>
      <div id="dev-shop-body"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#dev-shop-close').addEventListener('click', () => overlay.remove());

  function renderDevShop() {
    const tierColor = u => u.epic ? '#cc44ff' : u.cost >= 3 ? '#ff7755' : u.cost === 2 ? '#ffcc00' : '#88ff44';
    const tierLabel = u => u.epic ? 'Epic'    : u.cost >= 3 ? 'Rare'    : u.cost === 2 ? 'Uncommon' : 'Common';

    const purchased = game.getPurchasedUpgrades();
    const purchasedSection = purchased.length === 0 ? '' : `
      <div class="dev-section-label">Purchased Upgrades</div>
      ${purchased.map(p => `
        <div class="dev-row dev-row-owned">
          <div class="dev-row-icon">${p.icon}</div>
          <div class="dev-row-info">
            <div class="dev-row-top">
              <span class="dev-row-name">${p.label}</span>
              ${p.count > 1 ? `<span class="dev-row-count">×${p.count}</span>` : ''}
            </div>
            <div class="dev-row-desc">${p.desc}</div>
          </div>
          <button class="dev-remove-btn" data-id="${p.id}">Remove</button>
        </div>
      `).join('')}
      <div class="dev-section-label" style="margin-top:12px;">All Upgrades</div>
    `;

    const allRows = UPGRADES.map(u => `
      <div class="dev-row">
        <div class="dev-row-icon">${u.icon}</div>
        <div class="dev-row-info">
          <div class="dev-row-top">
            <span class="dev-row-name">${u.label}</span>
            <span class="dev-row-tier" style="color:${tierColor(u)}">${tierLabel(u)}</span>
            ${u.classes ? `<span class="dev-row-class">${u.classes.join('/')}</span>` : ''}
          </div>
          <div class="dev-row-desc">${u.desc}</div>
        </div>
        <button class="dev-buy-btn" data-id="${u.id}">Buy Free</button>
      </div>
    `).join('');

    const body = overlay.querySelector('#dev-shop-body');
    body.innerHTML = purchasedSection + `<div id="dev-shop-list">${allRows}</div>`;

    body.querySelectorAll('.dev-buy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const upg = UPGRADES.find(u => u.id === btn.dataset.id);
        if (upg && game?.player) {
          upg.apply(game.player);
          game._purchasedUpgrades.push(upg);
          const orig = btn.textContent;
          btn.textContent = '✓';
          btn.classList.add('dev-buy-confirm');
          setTimeout(() => { btn.textContent = orig; btn.classList.remove('dev-buy-confirm'); renderDevShop(); }, 500);
        }
      });
    });

    body.querySelectorAll('.dev-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (game?.removeUpgrade(btn.dataset.id)) renderDevShop();
      });
    });
  }

  renderDevShop();
}

window.addEventListener('keydown', e => {
  // Dev shop takes priority for Escape
  const devShop = document.getElementById('dev-shop-overlay');
  if (devShop && (e.code === 'Escape' || e.code === 'KeyO')) {
    devShop.remove();
    return;
  }

  if (e.code === 'Escape' || e.code === 'KeyP') { togglePause(); return; }

  // Cheat code: type "helloworld" while paused
  if (game?.isPaused && !game.isOver) {
    if (e.key.length === 1) {
      _cheatBuf = (_cheatBuf + e.key.toLowerCase()).slice(-10);
      if (_cheatBuf === 'helloworld') activateDevMode();
    } else if (!['Shift','Control','Alt','CapsLock','Tab'].includes(e.key)) {
      _cheatBuf = '';
    }
  } else {
    _cheatBuf = '';
  }

  if (!devMode || !game || game.isOver) return;

  if (e.code === 'KeyO') {
    e.preventDefault();
    openDevShop();
  }
  if (e.code === 'ArrowRight') {
    e.preventDefault();
    if (game.isPaused) closePause();
    game.devSkipForward();
  }
  if (e.code === 'ArrowLeft') {
    e.preventDefault();
    if (game.isPaused) closePause();
    game.devSkipBack();
  }
});

// ── Game state ────────────────────────────────────────────────────
const input = new InputManager();
let game     = null;
let tutorial = null;
let last = performance.now();
let lastConfig = null;

function startTutorial() {
  // Clean up any existing game/tutorial
  scene.clear();
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  scene.add(sun);
  if (game) game.isOver = true;
  game = null;

  document.getElementById('hud').style.display = 'block';
  gameOverEl.style.display = 'none';
  pauseOverlay?.classList.remove('visible');

  // Hide irrelevant HUD elements during tutorial
  if (scoreHudEl)  scoreHudEl.style.display  = 'none';
  if (roomNumEl)   roomNumEl.style.display    = 'none';
  if (bossHud)     bossHud.style.display      = 'none';
  if (roomClearEl) roomClearEl.style.opacity  = '0';

  tutorial = new Tutorial(scene, input);
  tutorial.onComplete = () => {
    tutorial = null;
    // Restore HUD elements hidden during tutorial
    if (scoreHudEl) scoreHudEl.style.display = '';
    if (roomNumEl)  roomNumEl.style.display  = '';
    document.getElementById('hud').style.display = 'none';
    scene.clear();
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    scene.add(sun);
    new Menu(cfg => startGame(cfg), () => startTutorial());
  };
}

function startGame(config) {
  if (tutorial) { tutorial = null; }
  lastConfig = config;
  setDmgNumColor(CLASS_COLORS[config.playerClass] ?? '#ffffff');
  if (game) {
    // Clean up previous game if restarting
    scene.clear();
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    scene.add(sun);
  }

  game = new Game(scene, input, config);

  game.onHeal = (amount) => showHealMsg(amount);

  game.onRoomClear = (roomNum) => {
    roomClearEl.style.opacity = '1';
    setTimeout(() => { roomClearEl.style.opacity = '0'; }, 1800);
  };

  game.onGameOver = () => {
    const score = game.getScore();
    const diff  = (lastConfig?.difficulty) || 'normal';
    const prev  = getHighScore(diff);
    const isNew = score > prev;
    if (isNew) setHighScore(diff, score);
    const diffLabel = diff.charAt(0).toUpperCase() + diff.slice(1);
    const diffColor = DIFF_COLORS[diff] ?? '#ffffff';
    if (goScoreVal)  goScoreVal.textContent  = score;
    if (goScoreDiff) { goScoreDiff.textContent = diffLabel; goScoreDiff.style.color = diffColor; }
    if (goBestVal)   goBestVal.textContent   = Math.max(score, prev);
    if (goBestDiff)  { goBestDiff.textContent = diffLabel;  goBestDiff.style.color  = diffColor; }
    if (goNewRecord) goNewRecord.style.display = isNew ? 'block' : 'none';
    // Reset kit panel to collapsed state
    _goConfig = null;
    goCustomizerEl?.classList.remove('open');
    if (changeKitBtn) changeKitBtn.style.display = '';
    gameOverEl.style.display = 'flex';
  };

  document.getElementById('hud').style.display = 'block';
  gameOverEl.style.display = 'none';
  pauseOverlay?.classList.remove('visible');
}

tryAgainBtn?.addEventListener('click', () => {
  gameOverEl.style.display = 'none';
  goCustomizerEl?.classList.remove('open');
  _goConfig = null;
  startGame(lastConfig ?? { color: 0x7B3F00, hat: 'none', playerClass: 'brawler' });
});

changeKitBtn?.addEventListener('click', () => {
  buildGameOverCustomizer();
  goCustomizerEl?.classList.add('open');
  changeKitBtn.style.display = 'none';
});

confirmKitBtn?.addEventListener('click', () => {
  if (!_goConfig) return;
  lastConfig = { ...lastConfig, ..._goConfig };
  gameOverEl.style.display = 'none';
  goCustomizerEl?.classList.remove('open');
  startGame(lastConfig);
});

document.getElementById('btn-go-exit')?.addEventListener('click', () => {
  gameOverEl.style.display = 'none';
  document.getElementById('hud').style.display = 'none';
  if (game) { game.isOver = true; }
  new Menu(cfg => startGame(cfg), () => startTutorial());
});

// ── Render loop ───────────────────────────────────────────────────
function loop() {
  requestAnimationFrame(loop);
  const now = performance.now() / 1000;
  const dt  = Math.min((performance.now() - last) / 1000, 0.05);
  last = performance.now();

  if (tutorial) {
    tutorial.update(dt, now, camera, mouseNDC);

    // Update HP bar and special indicator from tutorial player
    const tp = tutorial.player;
    if (hpFill) hpFill.style.width = ((tp.hp / tp.maxHp) * 100).toFixed(1) + '%';
    if (bananaCount) bananaCount.textContent = '';
    if (specialIndicator && tp.getSpecialState) {
      const s = tp.getSpecialState();
      specialIcon.textContent = s.icon;
      specialName.textContent = s.name;
      const pct = (1 - s.cdRatio) * 100;
      specialCdFill.style.width = pct.toFixed(1) + '%';
      specialCdFill.style.background = s.isActive
        ? 'linear-gradient(90deg, #ffaa22, #ffcc44)'
        : s.isReady
          ? 'linear-gradient(90deg, #44ff88, #88ff44)'
          : 'linear-gradient(90deg, #4488ff, #66aaff)';
      specialIndicator.className = s.isActive ? 'active' : s.isReady ? 'ready' : '';
    }
    if (epicIndicator) epicIndicator.style.display = 'none';

    updateDmgNums(dt, camera);
    renderer.render(scene, camera);
    return;
  }

  if (game) {
    game.update(dt, now, camera, mouseNDC);

    // Dev mode — infinite health
    if (devMode && game.player.isAlive) game.player.hp = game.player.maxHp;

    // Update HUD
    const hp = game.player.hp / game.player.maxHp;
    if (hpFill) hpFill.style.width = (hp * 100).toFixed(1) + '%';
    if (bananaCount) bananaCount.textContent = '🍌 ' + game.player.bananas;
    if (roomNumEl) roomNumEl.textContent = 'Room ' + game.getRoomNumber();

    // Score / high-score HUD
    if (scoreHudEl) {
      const diff = (lastConfig?.difficulty) || 'normal';
      const best = getHighScore(diff);
      const cur  = game.getScore();
      scoreHudEl.textContent = best > 0
        ? `Score: ${cur}  •  Best: ${best}`
        : `Score: ${cur}`;
    }

    // Boss HP bar
    const boss = game.room?.boss;
    if (bossHud) {
      if (boss && !boss.isDead) {
        bossHud.style.display = 'block';
        bossNameEl.textContent = boss.name || 'Boss';
        const bpct = (boss.hp / boss.maxHp * 100).toFixed(1);
        bossHpFill.style.width = bpct + '%';
        bossHpFill.style.background = boss.hp / boss.maxHp > 0.5
          ? 'linear-gradient(90deg, #cc4400, #ff8800)'
          : 'linear-gradient(90deg, #ff0000, #ff4400)';
      } else {
        bossHud.style.display = 'none';
      }
    }

    // Special ability indicator
    if (specialIndicator && game.player.getSpecialState) {
      const s = game.player.getSpecialState();
      specialIcon.textContent = s.icon;
      specialName.textContent = s.name;
      // Fill grows left-to-right as ability charges back (0% = just used, 100% = ready)
      const pct = (1 - s.cdRatio) * 100;
      specialCdFill.style.width = pct.toFixed(1) + '%';
      specialCdFill.style.background = s.isActive
        ? 'linear-gradient(90deg, #ffaa22, #ffcc44)'
        : s.isReady
          ? 'linear-gradient(90deg, #44ff88, #88ff44)'
          : 'linear-gradient(90deg, #4488ff, #66aaff)';
      specialIndicator.className = s.isActive ? 'active' : s.isReady ? 'ready' : '';
    }

    // Epic ability indicator
    if (epicIndicator) {
      const es = game.player.getEpicState?.();
      if (es) {
        epicIndicator.style.display = '';
        epicIcon.textContent = es.icon;
        epicName.textContent = es.name;
        const epct = (1 - es.cdRatio) * 100;
        epicCdFill.style.width = epct.toFixed(1) + '%';
        epicCdFill.style.background = es.isActive
          ? 'linear-gradient(90deg, #dd88ff, #bb44ff)'
          : es.isReady
            ? 'linear-gradient(90deg, #cc44ff, #ee88ff)'
            : 'linear-gradient(90deg, #663388, #884499)';
        epicIndicator.className = es.isActive ? 'active' : es.isReady ? 'ready' : '';
      } else {
        epicIndicator.style.display = 'none';
      }
    }
  }

  updateDmgNums(dt, camera);
  renderer.render(scene, camera);
}

loop();

// ── Menu ──────────────────────────────────────────────────────────
new Menu((config) => {
  startGame(config);
}, () => {
  startTutorial();
});
