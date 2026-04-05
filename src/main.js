import * as THREE from 'three';
import { Game }     from './game.js';
import { Tutorial } from './tutorial.js';
import { InputManager } from './input.js';
import { Menu, PLAYER_COLORS, HATS, PLAYER_CLASSES } from './menu.js';
import { initDamageNumbers, updateDmgNums, setDmgNumColor, spawnDmgNum } from './damage-numbers.js';
import { openBestiary } from './bestiary.js';
import { UPGRADES }     from './upgrades.js';
import { NetworkManager }       from './network.js';
import { MultiplayerRenderer }  from './multiplayer-renderer.js';
import { MultiplayerHUD }       from './multiplayer-hud.js';
import { generateOffers }       from './upgrades.js';
import { buildArenaVisuals, buildPvPArena } from './room.js';

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

btnPause?.addEventListener('click', () => {
  if (net && mpRend) {
    // Multiplayer pause: send to server
    if (_mpIsPaused && _mpPausedBy === net.mySocketId) {
      net.resumeGame();
    } else if (!_mpIsPaused) {
      net.pauseGame();
    }
  } else {
    togglePause();
  }
});
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
let net    = null;  // NetworkManager
let mpRend = null;  // MultiplayerRenderer
let mpHud  = null;  // MultiplayerHUD
let mpMode = null;  // 'coop' | 'pvp'
let _mpArena = null; // arena visuals disposer
let _mpLastPhase = null; // track phase transitions for room-clear flash
let _mpIsPaused = false;
let _mpPausedBy = null;
let _spectating = false;
let _spectatorTarget = new THREE.Vector3(0, 0, 0);
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

function startMultiplayer(mode) {
  mpMode = mode;
  if (game)     { game.isOver = true; game = null; }
  if (tutorial) { tutorial.isOver = true; tutorial = null; }
  scene.clear();
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  scene.add(sun);
  document.getElementById('hud').style.display = 'block';
  if (scoreHudEl) scoreHudEl.style.display = 'none';
  if (bossHud)    bossHud.style.display     = 'none';
  if (roomClearEl) roomClearEl.style.opacity = '0';

  if (mode === 'pvp') {
    // PvP: hide solo HP bar (replaced by fighting-game bars in MultiplayerHUD)
    const hpBar = document.getElementById('hp-bar');
    if (hpBar) hpBar.style.display = 'none';
    if (roomNumEl) roomNumEl.style.display = 'none';
    _mpLastPhase = 'round';
    _mpArena?.dispose();
    _mpArena = buildPvPArena(scene);
  } else {
    const hpBar = document.getElementById('hp-bar');
    if (hpBar) hpBar.style.display = '';
    if (roomNumEl) { roomNumEl.style.display = ''; roomNumEl.textContent = 'Room 1'; }
    _mpLastPhase = 'fight';
    _mpArena?.dispose();
    _mpArena = buildArenaVisuals(scene);
  }

  mpRend = new MultiplayerRenderer(scene, net.mySocketId);
  mpHud  = new MultiplayerHUD(mode);
}

function stopMultiplayer() {
  mpRend?.destroy(); mpRend = null;
  mpHud?.destroy();  mpHud  = null;
  mpMode = null;
  _mpArena?.dispose(); _mpArena = null;
  _mpLastPhase = null;
  _mpIsPaused = false; _mpPausedBy = null;
  document.getElementById('mp-pause-overlay')?.remove();
  document.getElementById('coop-shop-overlay')?.remove();
  if (net) { net.onPoolUpdate = null; net.onShopReadyUpdate = null; }
  if (bossHud) bossHud.style.display = 'none';
  _spectating = false;
  camera.position.set(0, 26, 1);
  camera.lookAt(0, 0, 0);
  document.getElementById('hud').style.display = 'none';
  const hpBar = document.getElementById('hp-bar');
  if (hpBar) hpBar.style.display = '';
  if (scoreHudEl) scoreHudEl.style.display = '';
  if (roomNumEl)  roomNumEl.style.display  = '';
  document.getElementById('round-overlay')?.remove();
  document.getElementById('pvp-upgrade-overlay')?.remove();
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

// ── Multiplayer overlay helpers ───────────────────────────────────
function _buildCoopShopOverlay(offers, sharedPool, roomNumber) {
  document.getElementById('coop-shop-overlay')?.remove();

  const costColor = c => c <= 1 ? '#88ff44' : c === 2 ? '#ffcc00' : c === 3 ? '#ff7755' : '#cc44ff';
  const costLabel = c => c <= 1 ? 'Common'  : c === 2 ? 'Uncommon' : c === 3 ? 'Rare'   : 'Epic';

  const overlay = document.createElement('div');
  overlay.id = 'coop-shop-overlay';
  overlay.style.cssText = `
    position:fixed; inset:0;
    display:flex; flex-direction:column;
    align-items:center; justify-content:center;
    z-index:200;
    background:rgba(0,0,0,0.72);
    font-family:'Arial Black',sans-serif;
    color:#fff;
  `;

  overlay.innerHTML = `
    <div style="text-align:center; margin-bottom:20px; user-select:none;">
      <div style="font-size:26px; letter-spacing:5px; text-transform:uppercase; opacity:.9;">Upgrade Shop</div>
      <div style="font-size:13px; color:#ffe135; margin-top:6px;">Room ${roomNumber} complete — Shared Pool: 🍌 <span id="coop-pool">${sharedPool}</span></div>
    </div>

    <div style="display:flex; gap:14px; margin-bottom:26px; user-select:none; flex-wrap:wrap; justify-content:center; max-width:760px;" id="coop-offers"></div>

    <button id="coop-ready-btn" style="
      font-family:'Arial Black',sans-serif;
      font-size:13px; letter-spacing:2px; text-transform:uppercase;
      padding:10px 30px;
      border:2px solid #44cc22; border-radius:30px;
      cursor:pointer; background:rgba(68,204,34,0.15); color:#88ff44;
      transition:background .12s;
    ">✔ Ready Up</button>

    <div id="coop-ready-status" style="
      font-size:11px; color:rgba(255,255,255,0.45); margin-top:10px;
      font-family:Arial,sans-serif; display:none;
    "></div>
  `;

  document.body.appendChild(overlay);

  // Build upgrade cards
  const offerEl = overlay.querySelector('#coop-offers');
  for (const u of offers) {
    const can = sharedPool >= u.cost;
    const card = document.createElement('div');
    card.className = 'shop-card';
    card.dataset.id = u.id;
    card.style.cssText = `
      cursor:${can ? 'pointer' : 'default'};
      opacity:${can ? '1' : '0.4'};
      border:2px solid ${costColor(u.cost)};
      border-radius:14px;
      padding:18px 14px;
      width:150px;
      text-align:center;
      background:rgba(255,255,255,0.06);
      transition:transform .12s, background .12s;
    `;
    card.innerHTML = `
      <div style="font-size:30px; margin-bottom:5px;">${u.icon}</div>
      <div style="font-size:10px; letter-spacing:2px; color:${costColor(u.cost)}; margin-bottom:5px; text-transform:uppercase;">${costLabel(u.cost)}</div>
      <div style="font-size:14px; margin-bottom:7px; line-height:1.2;">${u.label}</div>
      <div style="font-size:10px; opacity:.6; font-family:Arial,sans-serif; font-weight:normal; margin-bottom:10px; line-height:1.4;">${u.desc}</div>
      <div style="font-size:13px; color:${can ? '#ffe135' : '#666'};">🍌 ${u.cost}</div>
    `;
    if (can) {
      card.addEventListener('mouseenter', () => { card.style.transform = 'scale(1.05)'; card.style.background = 'rgba(255,255,255,0.13)'; });
      card.addEventListener('mouseleave', () => { card.style.transform = 'scale(1)'; card.style.background = 'rgba(255,255,255,0.06)'; });
      card.addEventListener('click', () => {
        net.buyUpgrade(u.id);
        // Mark card as purchased visually
        card.style.opacity = '0.5';
        card.style.cursor = 'default';
        card.querySelectorAll('div').forEach(d => { d.style.pointerEvents = 'none'; });
        card.replaceWith(card.cloneNode(true)); // remove listeners
      });
    }
    offerEl.appendChild(card);
  }

  // Pool update
  net.onPoolUpdate = ({ sharedPool: p }) => {
    const el = document.getElementById('coop-pool');
    if (el) el.textContent = p;
  };

  // Ready button
  let hasReadied = false;
  overlay.querySelector('#coop-ready-btn').addEventListener('click', () => {
    if (hasReadied) return;
    hasReadied = true;
    net.sendShopReady();
    const btn = overlay.querySelector('#coop-ready-btn');
    if (btn) { btn.textContent = '⏳ Waiting...'; btn.style.opacity = '0.6'; btn.style.cursor = 'default'; }
    const status = overlay.querySelector('#coop-ready-status');
    if (status) status.style.display = 'block';
  });

  // Ready update from server
  net.onShopReadyUpdate = ({ readyCount, total }) => {
    const status = document.getElementById('coop-ready-status');
    if (status) {
      status.style.display = 'block';
      status.textContent = `${readyCount} / ${total} players ready`;
    }
    if (readyCount >= total) {
      net.onPoolUpdate = null;
      net.onShopReadyUpdate = null;
      overlay.style.transition = 'opacity 0.2s';
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 220);
    }
  };
}

function _buildPvpUpgradeOverlay(offers) {
  document.getElementById('pvp-upgrade-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'pvp-upgrade-overlay';
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.8);
    display:flex;align-items:center;justify-content:center;z-index:40`;
  overlay.innerHTML = `
    <div style="background:#0b1608;border:2px solid #ffcc44;border-radius:12px;padding:24px;max-width:480px;width:90%">
      <div style="font-family:'Press Start 2P',monospace;font-size:11px;color:#ffcc44;margin-bottom:16px">🏆 Round Win! Choose Upgrade</div>
      <div id="pvp-offers" style="display:flex;flex-direction:column;gap:8px"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  const offerEl = overlay.querySelector('#pvp-offers');
  for (const u of offers) {
    const btn = document.createElement('button');
    btn.className = 'home-btn';
    btn.style.cssText = 'width:100%;text-align:left;padding:10px 14px;font-size:8px';
    btn.innerHTML = `${u.icon} ${u.label} — ${u.desc}`;
    btn.addEventListener('click', () => { net.choosePvpUpgrade(u.id); overlay.remove(); });
    offerEl.appendChild(btn);
  }
}

function _showGameLoadingOverlay(mode) {
  const existing = document.getElementById('mp-loading-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'mp-loading-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(5,15,5,0.96);
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:20px;z-index:100;
  `;
  overlay.innerHTML = `
    <div style="font-family:'Press Start 2P',monospace;font-size:18px;color:#88ff44;letter-spacing:2px">
      ${mode === 'pvp' ? '⚔️ PvP' : '🤝 Co-op'}
    </div>
    <div style="font-family:'Press Start 2P',monospace;font-size:9px;color:#557744">
      Loading game...
    </div>
    <div style="width:280px;background:#111;border:1px solid #335522;border-radius:6px;height:14px;overflow:hidden">
      <div id="mp-load-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#226611,#44cc22);
        border-radius:6px;transition:width 0.25s ease"></div>
    </div>
    <div id="mp-load-label" style="font-family:'Press Start 2P',monospace;font-size:7px;color:#335522">
      Connecting to server...
    </div>
  `;
  document.body.appendChild(overlay);

  // Animate bar to 85% while waiting for first game state
  let pct = 0;
  const bar = overlay.querySelector('#mp-load-bar');
  const label = overlay.querySelector('#mp-load-label');
  const steps = [
    { to: 30, delay: 100,  text: 'Syncing players...' },
    { to: 60, delay: 400,  text: 'Building arena...' },
    { to: 85, delay: 800,  text: 'Starting game...' },
  ];
  steps.forEach(({ to, delay, text }) => {
    setTimeout(() => {
      if (!document.getElementById('mp-loading-overlay')) return;
      bar.style.width = to + '%';
      label.textContent = text;
    }, delay);
  });
}

function _hideGameLoadingOverlay() {
  const overlay = document.getElementById('mp-loading-overlay');
  if (!overlay) return;
  const bar = overlay.querySelector('#mp-load-bar');
  const label = overlay.querySelector('#mp-load-label');
  if (bar) bar.style.width = '100%';
  if (label) label.textContent = 'Ready!';
  setTimeout(() => overlay.remove(), 350);
}

function _showMatchEndScreen(winnerId, scores) {
  stopMultiplayer();
  const overlay = document.createElement('div');
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.85);
    display:flex;align-items:center;justify-content:center;z-index:50`;
  const winnerName = net?.gameState?.players?.find(p => p.socketId === winnerId)?.name || 'Player';
  overlay.innerHTML = `
    <div style="background:#0b1608;border:2px solid #ffcc44;border-radius:12px;padding:32px;text-align:center">
      <div style="font-family:'Press Start 2P',monospace;font-size:16px;color:#ffcc44;margin-bottom:12px">🏆 Match Over!</div>
      <div style="font-family:'Press Start 2P',monospace;font-size:10px;color:#88ff44;margin-bottom:24px">
        ${winnerId === net?.mySocketId ? 'You win!' : (winnerName + ' wins!')}
      </div>
      <div style="display:flex;gap:12px;justify-content:center">
        <button class="home-btn primary" id="btn-rematch">Rematch</button>
        <button class="home-btn" id="btn-back-menu">Main Menu</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#btn-rematch').addEventListener('click', () => {
    overlay.remove();
    net?.startGame();
  });
  overlay.querySelector('#btn-back-menu').addEventListener('click', () => {
    overlay.remove();
    net?.destroy(); net = null;
    new Menu(cfg => startGame(cfg), () => startTutorial(), () => {});
  });
}

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

  if (net && mpRend) {
    const state = net.gameState;
    if (state) {
      mpRend.applyState(state);
      mpHud.update(state, net.mySocketId);

      // Update local player HP bar and special indicator from server state
      const me = mpRend.getMyState(state);
      if (me) {
        if (hpFill) hpFill.style.width = ((me.hp / (me.maxHp || 100)) * 100).toFixed(1) + '%';
        if (specialIndicator) {
          const cdRatio = me.specialCdRatio ?? 0;
          specialIcon.textContent = me.playerClass === 'brawler' ? '🔥' : me.playerClass === 'slinger' ? '🌀' : '👻';
          specialName.textContent = me.playerClass === 'brawler' ? 'Rage' : me.playerClass === 'slinger' ? 'Barrage' : 'Decoy';
          const pct = (1 - cdRatio) * 100;
          specialCdFill.style.width = pct.toFixed(1) + '%';
          specialCdFill.style.background = me.specialActive
            ? 'linear-gradient(90deg, #ffaa22, #ffcc44)'
            : cdRatio === 0
              ? 'linear-gradient(90deg, #44ff88, #88ff44)'
              : 'linear-gradient(90deg, #4488ff, #66aaff)';
          specialIndicator.className = me.specialActive ? 'active' : cdRatio === 0 ? 'ready' : '';
        }
      }

      // Room number
      if (roomNumEl && state.roomNumber) roomNumEl.textContent = 'Room ' + state.roomNumber;

      // Boss HUD
      if (state.isBossRoom && state.enemies?.length > 0) {
        const boss = state.enemies[0];
        if (bossHud) bossHud.style.display = 'block';
        if (bossNameEl) bossNameEl.textContent = boss.type === 'bananaKing' ? '👑 Banana King' : '🧪 Lab Ape';
        if (bossHpFill) bossHpFill.style.width = ((boss.hp / (boss.maxHp || 1)) * 100).toFixed(1) + '%';
      } else if (bossHud && state.phase !== 'fight') {
        bossHud.style.display = 'none';
      }

      // Room clear flash when fight phase ends
      if (state.phase !== _mpLastPhase) {
        if (_mpLastPhase === 'fight' && (state.phase === 'vacuum' || state.phase === 'shop')) {
          if (roomClearEl) {
            roomClearEl.style.opacity = '1';
            setTimeout(() => { if (roomClearEl) roomClearEl.style.opacity = '0'; }, 1200);
          }
        }
        _mpLastPhase = state.phase;
      }
    }
    // Don't send inputs while paused
    if (_mpIsPaused) { renderer.render(scene, camera); return; }
    // Send inputs every frame
    const keys = [];
    ['KeyW','KeyS','KeyA','KeyD'].forEach(k => { if (input.isDown(k)) keys.push(k); });
    // Calculate mouse angle relative to center of screen
    const mouseAngle = Math.atan2(mouseNDC.x, -mouseNDC.y);
    // Update aim indicator every frame from local mouse (no server lag)
    const meLocal = state ? mpRend.getMyState(state) : null;
    if (meLocal?.isAlive && !meLocal.isDown) mpRend.updateLocalAim(meLocal.x, meLocal.z, mouseAngle);
    net.sendInput({
      keys,
      mouseAngle,
      lmb:   input.isMouseDown(0),
      shift: input.isDown('ShiftLeft') || input.isDown('ShiftRight'),
      space: input.isDown('Space'),
    });
    updateDmgNums(dt, camera);
    if (_spectating && mouseNDC) {
      _spectatorTarget.x = THREE.MathUtils.lerp(_spectatorTarget.x, mouseNDC.x * 8, 0.04);
      _spectatorTarget.z = THREE.MathUtils.lerp(_spectatorTarget.z, mouseNDC.y * -6, 0.04);
      camera.position.x  = THREE.MathUtils.lerp(camera.position.x, _spectatorTarget.x, 0.1);
      camera.position.z  = THREE.MathUtils.lerp(camera.position.z, _spectatorTarget.z + 1, 0.1);
      camera.lookAt(_spectatorTarget.x, 0, _spectatorTarget.z);
    }
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

// ── PvP round overlay ─────────────────────────────────────────────
function _showRoundOverlay(title, sub, ms = 2000) {
  document.getElementById('round-overlay')?.remove();
  const el = document.createElement('div');
  el.id = 'round-overlay';
  el.style.cssText = `
    position:fixed;inset:0;display:flex;flex-direction:column;
    align-items:center;justify-content:center;z-index:45;pointer-events:none;
    background:rgba(0,0,0,0.45);
  `;
  el.innerHTML = `
    <div style="font-family:'Press Start 2P',monospace;font-size:22px;color:#ffcc44;
      text-shadow:0 0 24px rgba(255,200,0,0.7);
      animation:pvp-round-pop 0.25s cubic-bezier(.2,1.4,.4,1) both">
      ${title}
    </div>
    ${sub ? `<div style="font-family:'Press Start 2P',monospace;font-size:9px;
      color:#88ff44;margin-top:14px;opacity:0.85">${sub}</div>` : ''}
  `;
  document.body.appendChild(el);
  if (ms > 0) setTimeout(() => { el.style.transition = 'opacity 0.3s'; el.style.opacity = '0';
    setTimeout(() => el.remove(), 320); }, ms - 320);
}

// ── Menu ──────────────────────────────────────────────────────────
new Menu(
  (config) => startGame(config),
  () => startTutorial(),
  () => {
    net = new NetworkManager();

    net.onGameStarting = ({ mode }) => {
      m._overlay?.remove();
      _showGameLoadingOverlay(mode);
      startMultiplayer(mode);
      // Dismiss overlay on first game state packet
      net.onGameState = (state) => {
        _hideGameLoadingOverlay();
        net.onGameState = null; // one-shot
      };
    };

    net.onEnemyHit = ({ id, dmg }) => {
      if (!mpRend || !net.gameState) return;
      // Find world position — check enemies first, then players (for PvP hits)
      const state = net.gameState;
      const enemy = state.enemies?.find(e => String(e.id) === String(id));
      if (enemy) {
        spawnDmgNum(dmg, new THREE.Vector3(enemy.x, 1.2, enemy.z));
        return;
      }
      const player = state.players?.find(p => p.socketId === id);
      if (player) spawnDmgNum(dmg, new THREE.Vector3(player.x, 1.4, player.z));
    };

    net.onOpenShop = ({ sharedPool, roomNumber }) => {
      const me = net.gameState?.players?.find(p => p.socketId === net.mySocketId);
      const cls = me?.playerClass || 'brawler';
      const rn = roomNumber || net.gameState?.roomNumber || 1;
      const offers = generateOffers(sharedPool, rn, cls, false, false, []);
      _buildCoopShopOverlay(offers, sharedPool, rn);
    };

    net.onGameOver = () => {
      stopMultiplayer();
      const gameOverEl = document.getElementById('game-over');
      if (gameOverEl) gameOverEl.style.display = 'flex';
    };

    net.onMatchEnd = ({ winnerId, scores }) => {
      _showMatchEndScreen(winnerId, scores);
    };

    net.onOpenPvpUpgrade = () => {
      document.getElementById('pvp-waiting-overlay')?.remove();
      const me = net.gameState?.players?.find(p => p.socketId === net.mySocketId);
      const cls = me?.playerClass || 'brawler';
      const offers = generateOffers(99, 1, cls, false, false, []);
      _buildPvpUpgradeOverlay(offers.slice(0, 3));
    };

    net.onWaitingUpgrade = ({ scores }) => {
      document.getElementById('pvp-upgrade-overlay')?.remove();
      const el = document.createElement('div');
      el.id = 'pvp-waiting-overlay';
      el.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.7);
        display:flex;align-items:center;justify-content:center;z-index:40;pointer-events:none`;
      el.innerHTML = `
        <div style="font-family:'Press Start 2P',monospace;font-size:11px;color:#aaaaaa;
          background:rgba(0,0,0,0.85);border:1px solid #444;border-radius:10px;padding:24px 32px;text-align:center">
          ⏳ Opponent is choosing an upgrade...
        </div>
      `;
      document.body.appendChild(el);
    };

    net.onRoundEnd = ({ winnerId, scores }) => {
      document.getElementById('pvp-waiting-overlay')?.remove();
      const state = net.gameState;
      const me = state?.players?.find(p => p.socketId === net.mySocketId);
      _spectating = me != null && !me.isAlive;
      // Round result overlay
      let title, sub = '';
      if (!winnerId) {
        title = 'DRAW!';
      } else if (winnerId === net.mySocketId) {
        title = 'YOU WIN!';
        sub = 'Round complete';
      } else {
        const name = state?.players?.find(p => p.socketId === winnerId)?.name || 'Opponent';
        title = `${name} WINS!`;
      }
      _showRoundOverlay(title, sub, 2500);
    };

    net.onRoundStart = ({ round, scores }) => {
      _spectating = false;
      document.getElementById('pvp-waiting-overlay')?.remove();
      document.getElementById('pvp-upgrade-overlay')?.remove();
      _showRoundOverlay(`ROUND ${round}`, '', 1800);
    };

    net.onGamePaused = ({ by }) => {
      _mpIsPaused = true;
      _mpPausedBy = by;
      const isMe = by === net.mySocketId;
      const pauserName = net.gameState?.players?.find(p => p.socketId === by)?.name || 'A player';
      document.getElementById('mp-pause-overlay')?.remove();
      const el = document.createElement('div');
      el.id = 'mp-pause-overlay';
      el.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.75);
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        gap:20px;z-index:60;`;
      el.innerHTML = `
        <div style="font-family:'Press Start 2P',monospace;font-size:20px;color:#ffcc44">⏸ PAUSED</div>
        <div style="font-family:'Press Start 2P',monospace;font-size:9px;color:#aaaaaa">
          ${isMe ? 'You paused the game' : `${pauserName} paused the game`}
        </div>
        ${isMe
          ? `<button id="mp-resume-btn" class="home-btn primary" style="margin-top:8px">▶ Resume</button>`
          : `<div style="font-family:'Press Start 2P',monospace;font-size:8px;color:#556655">
              Only ${pauserName} can resume
            </div>`}
      `;
      document.body.appendChild(el);
      if (isMe) {
        document.getElementById('mp-resume-btn')?.addEventListener('click', () => net.resumeGame());
      }
    };

    net.onGameResumed = () => {
      _mpIsPaused = false;
      _mpPausedBy = null;
      document.getElementById('mp-pause-overlay')?.remove();
    };

    net.onConnectError = (err) => {
      console.error('Multiplayer connection error:', err);
    };

    net.onKicked = () => {
      stopMultiplayer();
      net?.destroy(); net = null;
      new Menu(cfg => startGame(cfg), () => startTutorial(), () => {});
    };

    // Show multiplayer screen via menu
    const m = new Menu(
      (config) => startGame(config),
      () => startTutorial(),
      null
    );
    m._net = net;
    m._showMultiplayer();
    m._net.onRoomJoined = ({ code }) => {
      m._showLobby({ id: code, mode: 'coop', difficulty: 'normal', players: [] });
    };
    m._net.onLobbyUpdate = (data) => m._showLobby(data);
    m._net.onJoinError = (msg) => {
      const errEl = m._overlay?.querySelector('#mp-error');
      if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
    };
    m._net.onQueueWaiting = () => {
      const statusEl = m._overlay?.querySelector('#mp-status');
      if (statusEl) { statusEl.textContent = 'Searching for players...'; statusEl.style.display = 'block'; }
    };
  }
);
