export const PLAYER_COLORS = [
  { label: 'Brown',  hex: '#7B3F00', value: 0x7B3F00 },
  { label: 'Red',    hex: '#cc2222', value: 0xcc2222 },
  { label: 'Green',  hex: '#22aa44', value: 0x22aa44 },
  { label: 'Purple', hex: '#8833cc', value: 0x8833cc },
  { label: 'Pink',   hex: '#dd44aa', value: 0xdd44aa },
  { label: 'Cyan',   hex: '#11aacc', value: 0x11aacc },
  { label: 'White',  hex: '#dddddd', value: 0xdddddd },
  { label: 'Black',  hex: '#333333', value: 0x333333 },
];

export const HATS = [
  { id: 'none',   label: 'None',       emoji: '🐵' },
  { id: 'tophat', label: 'Top Hat',    emoji: '🎩' },
  { id: 'party',  label: 'Party Hat',  emoji: '🎉' },
  { id: 'cowboy', label: 'Cowboy Hat', emoji: '🤠' },
  { id: 'crown',  label: 'Crown',      emoji: '👑' },
];

export const PLAYER_CLASSES = [
  { id: 'brawler',   label: 'Brawler',   emoji: '🥊', desc: 'Melee Combo\nRage Mode' },
  { id: 'slinger',   label: 'Slinger',   emoji: '🍌', desc: 'Ranged Toss\nRapid Volley' },
  { id: 'trickster', label: 'Trickster', emoji: '🎭', desc: 'Tail Whip\nDecoy Swap' },
];

export const DIFFICULTIES = [
  { id: 'easy',   label: 'Easy',   color: '#44cc22', desc: 'Fewer enemies\nMore HP' },
  { id: 'normal', label: 'Normal', color: '#ffcc00', desc: 'Standard\nexperience' },
  { id: 'hard',   label: 'Hard',   color: '#ff4444', desc: 'More enemies\nLess mercy' },
];

// Newest patch first — add new patches at the TOP of this array
export const PATCHES = [
  {
    version: 'v1.2',
    label:   'Boss Overhaul, Tutorial & Multiplayer',
    entries: [
      { text: '🤝 Co-op multiplayer added',  tip: 'Play the full roguelike campaign with up to 4 players online. Shared banana economy, separate upgrades, teammate revive, and difficulty scaling tuned for groups.' },
      { text: '⚔️ PvP mode added',           tip: 'Best-of-3 rounds on a stone battle arena. The round winner picks a free upgrade between rounds. First to 3 wins takes the match.' },
      { text: '👑 Banana King reworked',     tip: 'HP raised to 750. Faster, enrages at 60% HP, barrages fire 8–14 bananas, both shockwave hits always land, and a frenzy phase triggers at 25% HP spawning 4 minions.' },
      { text: '🧪 Lab Ape reworked',         tip: 'HP raised to 950. Faster, overloads at 60% HP, laser lasts 2s at 28 DPS, grenades fire in triples on overload, slam leaves 2–4 spark hazards, sparks spawn every 1.2s.' },
      { text: '📖 Bestiary updated',         tip: 'Boss entries in the Bestiary now reflect the new HP, attack values, phase thresholds, and abilities introduced in this patch.' },
      { text: '🎓 Tutorial added',           tip: 'A guided 7-step tutorial taught by Old Wise Monkey. Covers movement, dashing, combat combos, class abilities, and upgrades. Accessible from the main menu.' },
    ],
  },
  {
    version: 'v1.1',
    label:   'UI & QoL Update',
    entries: [
      { text: '🏠 New home screen & menu flow',  tip: 'Two-screen menu: home with Solo/Two Player/Tutorial, then class, colour, hat, and difficulty selection.' },
      { text: '🎯 Difficulty selection',          tip: 'Choose Easy (0.65× enemy HP), Normal, or Hard (1.45× enemy HP) before each run.' },
      { text: '💀 Revamped game over screen',     tip: 'Try Again keeps your full kit. Change Kit lets you swap class, colour, and hat before retrying.' },
      { text: '⏸ Pause menu exit button',        tip: 'Exit to the main menu at any time from the pause screen without closing the game.' },
      { text: '🛠 Dev mode upgrade removal',      tip: 'In dev mode (type "helloworld" while paused) you can now remove purchased upgrades one at a time.' },
      { text: '📋 Patch notes panel',             tip: 'This very panel — scroll through version history right from the home screen.' },
    ],
  },
  {
    version: 'v1.0',
    label:   'Initial Release',
    entries: [
      { text: '🥊 Three playable classes',      tip: 'Brawler, Slinger, and Trickster — each with unique attacks and a special ability.' },
      { text: '🍌 Roguelike room progression',  tip: 'Survive procedurally scaling rooms, face two bosses, and collect banana upgrades.' },
      { text: '⚡ Epic abilities system',        tip: 'Unlock powerful epic abilities after room 10. Each class has a signature epic.' },
      { text: '👾 8 enemies + 2 bosses',         tip: 'Grunts, Bandits, Bombers, Stranglers, Howlers, Thunder Simians, Banana King, Lab Ape.' },
      { text: '📖 In-game Bestiary',             tip: 'Browse every enemy\'s appearance, attacks, and lore from the pause menu.' },
      { text: '🏆 Per-difficulty high scores',   tip: 'Easy, Normal, and Hard each track their own personal best, saved locally.' },
    ],
  },
];

// ── shared styles injected once ────────────────────────────────
const MENU_STYLE = `
  #menu-overlay * { box-sizing: border-box; }
  #menu-overlay {
    position: fixed; inset: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    z-index: 100;
    color: #fff;
    background: linear-gradient(160deg, #0a1a0a 0%, #1a3a0a 50%, #0a2a0a 100%);
    transition: opacity 0.35s;
    overflow-y: auto;
    font-family: 'Arial Black', Impact, sans-serif;
  }
  .menu-screen {
    display: flex; flex-direction: column;
    align-items: center;
    width: 100%;
    padding: 24px 16px 32px;
    animation: menuFadeIn 0.25s ease;
  }
  @keyframes menuFadeIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── pixel title ── */
  .menu-title {
    font-family: 'Press Start 2P', monospace;
    font-size: clamp(28px, 5.5vw, 64px);
    line-height: 1.35;
    text-align: center;
    background: linear-gradient(135deg, #88ff44 0%, #44ff88 50%, #ffdd00 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    filter: drop-shadow(0 4px 18px rgba(100,255,100,0.55));
    margin-bottom: 10px;
    letter-spacing: 2px;
  }
  .menu-subtitle {
    font-size: 11px;
    letter-spacing: 5px;
    text-transform: uppercase;
    opacity: 0.45;
    font-family: Arial, sans-serif;
    font-weight: normal;
    color: #aaffaa;
    margin-bottom: 52px;
  }

  /* ── home buttons ── */
  .home-btn-group {
    display: flex; flex-direction: column;
    align-items: center; gap: 14px;
    width: 100%; max-width: 280px;
  }
  .home-btn {
    width: 100%;
    padding: 18px 24px;
    border: none; border-radius: 10px;
    font-family: 'Press Start 2P', monospace;
    font-size: clamp(10px, 2vw, 14px);
    letter-spacing: 1px;
    cursor: pointer;
    transition: transform 0.12s, box-shadow 0.12s, opacity 0.12s;
    position: relative;
  }
  .home-btn:not(:disabled):hover {
    transform: scale(1.05);
  }
  .home-btn:not(:disabled):active {
    transform: scale(0.97);
  }
  .home-btn.primary {
    background: linear-gradient(135deg, #44cc22, #22aa44);
    color: #fff;
    box-shadow: 0 6px 28px rgba(68,200,34,0.55);
  }
  .home-btn.primary:hover {
    box-shadow: 0 8px 36px rgba(68,200,34,0.85);
  }
  .home-btn.disabled-btn {
    background: rgba(255,255,255,0.07);
    color: rgba(255,255,255,0.3);
    border: 2px solid rgba(255,255,255,0.12);
    cursor: not-allowed;
  }
  .home-btn .coming-soon {
    display: block;
    font-size: 7px;
    letter-spacing: 2px;
    opacity: 0.6;
    margin-top: 5px;
    font-family: Arial, sans-serif;
    font-weight: normal;
    text-transform: uppercase;
  }

  /* ── section labels ── */
  .menu-section-label {
    font-size: 10px;
    letter-spacing: 4px;
    opacity: 0.45;
    margin-bottom: 12px;
    font-family: Arial, sans-serif;
    font-weight: normal;
    text-transform: uppercase;
  }

  /* ── class / hat cards ── */
  .card-row {
    display: flex; gap: 8px;
    justify-content: center; flex-wrap: wrap;
  }
  .class-card, .hat-card {
    cursor: pointer;
    border: 2px solid rgba(255,255,255,0.15);
    border-radius: 10px;
    padding: 10px 14px;
    background: rgba(255,255,255,0.04);
    text-align: center;
    transition: border-color 0.12s, background 0.12s, transform 0.12s;
    min-width: 80px;
  }
  .class-card:hover, .hat-card:hover { transform: scale(1.06); }
  .class-card.sel, .hat-card.sel {
    border-color: #88ff44;
    background: rgba(136,255,68,0.12);
  }
  .card-emoji { font-size: 24px; margin-bottom: 3px; }
  .card-label {
    font-size: 11px; letter-spacing: 1px;
    margin-bottom: 3px;
  }
  .card-desc {
    font-size: 9px; opacity: 0.55;
    font-family: Arial, sans-serif;
    font-weight: normal;
    white-space: pre-line; line-height: 1.4;
  }
  .hat-card .card-label { font-size: 10px; opacity: 0.7; }

  /* ── color swatches ── */
  .swatch-row {
    display: flex; gap: 10px;
    justify-content: center; flex-wrap: wrap;
  }
  .color-swatch {
    width: 34px; height: 34px; border-radius: 50%;
    cursor: pointer;
    border: 3px solid transparent;
    transition: border-color 0.12s, box-shadow 0.12s, transform 0.12s;
  }
  .color-swatch:hover { transform: scale(1.2); }
  .color-swatch.sel {
    border-color: #fff;
    box-shadow: 0 0 10px rgba(255,255,255,0.7);
  }

  /* ── difficulty cards ── */
  .diff-card {
    cursor: pointer;
    border: 2px solid rgba(255,255,255,0.15);
    border-radius: 10px;
    padding: 12px 18px;
    background: rgba(255,255,255,0.04);
    text-align: center;
    transition: border-color 0.12s, background 0.12s, transform 0.12s;
    min-width: 90px;
  }
  .diff-card:hover { transform: scale(1.06); }
  .diff-card .diff-label {
    font-size: 12px; letter-spacing: 2px;
    margin-bottom: 5px;
  }
  .diff-card .diff-desc {
    font-size: 9px; opacity: 0.55;
    font-family: Arial, sans-serif; font-weight: normal;
    white-space: pre-line; line-height: 1.4;
  }

  /* ── play / back buttons ── */
  .solo-actions {
    display: flex; gap: 14px;
    align-items: center; flex-wrap: wrap;
    justify-content: center;
  }
  #btn-back {
    padding: 13px 28px;
    border: 2px solid rgba(255,255,255,0.25);
    border-radius: 50px;
    background: transparent;
    color: rgba(255,255,255,0.6);
    font-family: 'Arial Black', sans-serif;
    font-size: 13px;
    letter-spacing: 2px;
    cursor: pointer;
    transition: border-color 0.12s, color 0.12s, transform 0.12s;
  }
  #btn-back:hover { border-color: #fff; color: #fff; transform: scale(1.05); }
  #btn-play {
    padding: 16px 52px;
    border: none; border-radius: 50px;
    background: linear-gradient(135deg, #44cc22, #22aa44);
    color: #fff;
    font-family: 'Arial Black', sans-serif;
    font-size: 20px;
    letter-spacing: 3px;
    text-transform: uppercase;
    cursor: pointer;
    box-shadow: 0 6px 28px rgba(68,200,34,0.5);
    transition: transform 0.12s, box-shadow 0.12s;
  }
  #btn-play:hover {
    transform: scale(1.07);
    box-shadow: 0 8px 36px rgba(68,200,34,0.85);
  }
  #btn-play:active { transform: scale(0.97); }

  .controls-hint {
    margin-top: 28px;
    font-family: Arial, sans-serif; font-weight: normal;
    font-size: 10px; opacity: 0.3;
    letter-spacing: 1px; line-height: 1.9;
    text-align: center;
  }
  .menu-section { margin-bottom: 22px; width: 100%; max-width: 480px; text-align: center; }

  /* ── home layout (title+buttons centred, patch panel right) ── */
  .home-layout {
    display: grid;
    grid-template-columns: 260px 1fr 260px;
    align-items: center;
    width: 100%;
    min-height: 100%;
    padding: 24px 16px;
  }
  .home-centre {
    grid-column: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0;
    animation: menuFadeIn 0.25s ease;
  }

  /* ── patch notes panel ── */
  .patch-panel {
    grid-column: 3;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 14px;
    padding: 18px 16px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    animation: menuFadeIn 0.3s ease 0.05s both;
    align-self: center;
    user-select: none;
  }
  .patch-panel-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 6px;
  }
  .patch-panel-title {
    font-size: 11px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.45);
    font-family: Arial, sans-serif;
    font-weight: normal;
  }
  .patch-scroll-hint {
    font-size: 8px;
    letter-spacing: 1px;
    color: rgba(255,255,255,0.2);
    font-family: Arial, sans-serif;
    font-weight: normal;
    font-style: italic;
  }
  .patch-version-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .patch-ver-badge {
    font-family: 'Press Start 2P', monospace;
    font-size: 9px;
    color: #88ff44;
    background: rgba(136,255,68,0.1);
    border: 1px solid rgba(136,255,68,0.3);
    border-radius: 6px;
    padding: 3px 7px;
  }
  .patch-ver-label {
    font-size: 10px;
    color: rgba(255,255,255,0.5);
    font-family: Arial, sans-serif;
    font-weight: normal;
    letter-spacing: 1px;
  }
  .patch-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-height: 148px;
  }
  .patch-entry {
    font-family: Arial, sans-serif;
    font-weight: normal;
    font-size: 11px;
    color: rgba(255,255,255,0.65);
    padding: 6px 8px;
    border-radius: 7px;
    cursor: default;
    transition: background 0.12s, color 0.12s;
    line-height: 1.4;
  }
  .patch-entry:hover {
    background: rgba(255,255,255,0.07);
    color: #fff;
  }
  .patch-tip-box {
    font-family: Arial, sans-serif;
    font-weight: normal;
    font-size: 10px;
    color: rgba(180,255,140,0.85);
    background: rgba(136,255,68,0.07);
    border: 1px solid rgba(136,255,68,0.18);
    border-radius: 8px;
    padding: 0 10px;
    line-height: 1.5;
    max-height: 0;
    overflow: hidden;
    opacity: 0;
    transition: opacity 0.15s, max-height 0.2s, padding 0.15s;
  }
  .patch-tip-box.visible {
    opacity: 1;
    max-height: 70px;
    padding: 7px 10px;
  }
  .patch-dots {
    display: flex;
    justify-content: center;
    gap: 6px;
    padding-top: 4px;
    border-top: 1px solid rgba(255,255,255,0.07);
  }
  .patch-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: rgba(255,255,255,0.18);
    cursor: pointer;
    transition: background 0.15s, transform 0.15s;
  }
  .patch-dot:hover { background: rgba(255,255,255,0.45); transform: scale(1.2); }
  .patch-dot.active { background: #88ff44; transform: scale(1.15); }

  @media (max-width: 720px) {
    .home-layout { grid-template-columns: 1fr; }
    .home-centre { grid-column: 1; }
    .patch-panel { grid-column: 1; width: 100%; max-width: 320px; margin: 0 auto; }
  }
`;

function injectMenuStyles() {
  if (document.getElementById('menu-styles')) return;
  const s = document.createElement('style');
  s.id = 'menu-styles';
  s.textContent = MENU_STYLE;
  document.head.appendChild(s);
}

function escLobbyHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export class Menu {
  constructor(onPlay, onTutorial, onMultiplayer) {
    this.onPlay        = onPlay;
    this.onTutorial    = onTutorial;
    this.onMultiplayer = onMultiplayer;
    this._colorIdx    = 0;
    this._hat         = 'none';
    this._playerClass = 'brawler';
    this._playerName  = '';
    this._difficulty  = 'normal';

    injectMenuStyles();

    this._overlay = document.createElement('div');
    this._overlay.id = 'menu-overlay';
    document.body.appendChild(this._overlay);

    this._showHome();
  }

  // ── Home screen ────────────────────────────────────────────────
  _showHome() {
    this._overlay.innerHTML = `
      <div class="home-layout">
        <!-- centre: title + buttons -->
        <div class="menu-screen home-centre">
          <div class="menu-title">MONKEY<br>MASH</div>
          <div class="menu-subtitle">Top-Down Roguelike</div>

          <div class="home-btn-group">
            <button class="home-btn primary" id="btn-solo">Solo</button>

            <button class="home-btn" id="btn-multiplayer">Multiplayer</button>

            <button class="home-btn" id="btn-tutorial">Tutorial</button>
          </div>
        </div>

        <!-- right: patch notes -->
        <div class="patch-panel" id="patch-panel">
          <div class="patch-panel-header">
            <span class="patch-panel-title">📋 Patch Notes</span>
            <span class="patch-scroll-hint">scroll to browse</span>
          </div>
          <div class="patch-version-row">
            <span class="patch-ver-badge" id="patch-ver-badge"></span>
            <span class="patch-ver-label" id="patch-ver-label"></span>
          </div>
          <ul class="patch-list" id="patch-list"></ul>
          <div class="patch-tip-box" id="patch-tip"></div>
          <div class="patch-dots" id="patch-dots"></div>
        </div>
      </div>
    `;

    this._overlay.querySelector('#btn-solo').addEventListener('click', () => this._showSolo());
    this._overlay.querySelector('#btn-tutorial').addEventListener('click', () => {
      if (this.onTutorial) {
        this._overlay.remove();
        this.onTutorial();
      }
    });
    this._overlay.querySelector('#btn-multiplayer')?.addEventListener('click', () => {
      if (this.onMultiplayer) {
        this._overlay.remove();
        this.onMultiplayer();
      }
    });
    this._initPatchPanel();
  }

  _initPatchPanel() {
    let current = 0; // index 0 = newest patch (array is newest-first)

    const badge   = this._overlay.querySelector('#patch-ver-badge');
    const label   = this._overlay.querySelector('#patch-ver-label');
    const list    = this._overlay.querySelector('#patch-list');
    const tipBox  = this._overlay.querySelector('#patch-tip');
    const dotsEl  = this._overlay.querySelector('#patch-dots');
    const panel   = this._overlay.querySelector('#patch-panel');

    const render = (dir = 0) => {
      const p = PATCHES[current];

      // dots
      dotsEl.innerHTML = PATCHES.map((_, i) => `
        <span class="patch-dot${i === current ? ' active' : ''}" data-i="${i}"></span>
      `).join('');
      dotsEl.querySelectorAll('.patch-dot').forEach(d => {
        d.addEventListener('click', () => { const i = +d.dataset.i; if (i !== current) { dir = i > current ? 1 : -1; current = i; render(dir); } });
      });

      badge.textContent = p.version;
      label.textContent = p.label;

      // animate list out then in
      list.style.transition = 'none';
      list.style.opacity    = '0';
      list.style.transform  = dir === 0 ? 'none' : `translateY(${dir > 0 ? '-' : ''}12px)`;

      list.innerHTML = p.entries.map(e => `
        <li class="patch-entry" data-tip="${e.tip}">${e.text}</li>
      `).join('');

      tipBox.classList.remove('visible');

      list.querySelectorAll('.patch-entry').forEach(li => {
        li.addEventListener('mouseenter', () => { tipBox.textContent = li.dataset.tip; tipBox.classList.add('visible'); });
      });
      list.addEventListener('mouseleave', () => tipBox.classList.remove('visible'));

      requestAnimationFrame(() => {
        list.style.transition = 'opacity 0.2s, transform 0.2s';
        list.style.opacity    = '1';
        list.style.transform  = 'translateY(0)';
      });
    };

    panel.addEventListener('wheel', e => {
      e.preventDefault();
      const dir = e.deltaY > 0 ? 1 : -1; // scroll down → older (higher index), scroll up → newer (lower index)
      const next = current + dir;
      if (next >= 0 && next < PATCHES.length) { current = next; render(dir); }
    }, { passive: false });

    render();
  }

  // ── Solo customization screen ──────────────────────────────────
  _showSolo() {
    const classCards = PLAYER_CLASSES.map(p => `
      <div class="class-card${p.id === this._playerClass ? ' sel' : ''}" data-id="${p.id}">
        <div class="card-emoji">${p.emoji}</div>
        <div class="card-label">${p.label}</div>
        <div class="card-desc">${p.desc}</div>
      </div>
    `).join('');

    const colorSwatches = PLAYER_COLORS.map((c, i) => `
      <div class="color-swatch${i === this._colorIdx ? ' sel' : ''}"
           data-idx="${i}" title="${c.label}"
           style="background:${c.hex};"></div>
    `).join('');

    const hatCards = HATS.map(h => `
      <div class="hat-card${h.id === this._hat ? ' sel' : ''}" data-id="${h.id}">
        <div class="card-emoji">${h.emoji}</div>
        <div class="card-label">${h.label}</div>
      </div>
    `).join('');

    const diffCards = DIFFICULTIES.map(d => `
      <div class="diff-card${d.id === this._difficulty ? ' sel' : ''}"
           data-id="${d.id}"
           style="${d.id === this._difficulty
             ? `border-color:${d.color}; background:${d.color}22;`
             : ''}">
        <div class="diff-label" style="color:${d.color};">${d.label}</div>
        <div class="diff-desc">${d.desc}</div>
      </div>
    `).join('');

    this._overlay.innerHTML = `
      <div class="menu-screen">
        <div class="menu-title" style="font-size:clamp(18px,3.5vw,38px); margin-bottom:4px;">MONKEY MASH</div>
        <div class="menu-subtitle" style="margin-bottom:32px;">Choose Your Monkey</div>

        <div class="menu-section">
          <div class="menu-section-label">Class</div>
          <div class="card-row" id="class-cards">${classCards}</div>
        </div>

        <div class="menu-section">
          <div class="menu-section-label">Color</div>
          <div class="swatch-row" id="color-swatches">${colorSwatches}</div>
        </div>

        <div class="menu-section">
          <div class="menu-section-label">Hat</div>
          <div class="card-row" id="hat-cards">${hatCards}</div>
        </div>

        <div class="menu-section">
          <div class="menu-section-label">Difficulty</div>
          <div class="card-row" id="diff-cards">${diffCards}</div>
        </div>

        <div class="solo-actions">
          <button id="btn-back">← Back</button>
          <button id="btn-play">Play!</button>
        </div>

        <div class="controls-hint">
          WASD — Move &nbsp;|&nbsp; Mouse — Aim &nbsp;|&nbsp; LClick — Attack<br>
          Space — Dash &nbsp;|&nbsp; Shift — Special &nbsp;|&nbsp; RClick — Epic
        </div>
      </div>
    `;

    // Class cards
    this._overlay.querySelectorAll('.class-card').forEach(card => {
      card.addEventListener('click', () => {
        this._playerClass = card.dataset.id;
        this._overlay.querySelectorAll('.class-card').forEach(c =>
          c.classList.toggle('sel', c.dataset.id === this._playerClass)
        );
      });
    });

    // Color swatches
    this._overlay.querySelectorAll('.color-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        this._colorIdx = parseInt(sw.dataset.idx);
        this._overlay.querySelectorAll('.color-swatch').forEach((s, i) =>
          s.classList.toggle('sel', i === this._colorIdx)
        );
      });
    });

    // Hat cards
    this._overlay.querySelectorAll('.hat-card').forEach(card => {
      card.addEventListener('click', () => {
        this._hat = card.dataset.id;
        this._overlay.querySelectorAll('.hat-card').forEach(c =>
          c.classList.toggle('sel', c.dataset.id === this._hat)
        );
      });
    });

    // Difficulty cards
    this._overlay.querySelectorAll('.diff-card').forEach(card => {
      card.addEventListener('click', () => {
        this._difficulty = card.dataset.id;
        this._overlay.querySelectorAll('.diff-card').forEach(c => {
          const d = DIFFICULTIES.find(x => x.id === c.dataset.id);
          c.classList.toggle('sel', c.dataset.id === this._difficulty);
          c.style.borderColor = c.dataset.id === this._difficulty ? d.color : '';
          c.style.background  = c.dataset.id === this._difficulty ? d.color + '22' : '';
        });
      });
    });

    this._overlay.querySelector('#btn-back').addEventListener('click', () => this._showHome());
    this._overlay.querySelector('#btn-play').addEventListener('click', () => this._launch());
  }

  _launch() {
    this._overlay.style.opacity = '0';
    this._overlay.style.pointerEvents = 'none';
    setTimeout(() => this._overlay.remove(), 350);
    this.onPlay({
      color:       PLAYER_COLORS[this._colorIdx].value,
      hat:         this._hat,
      playerClass: this._playerClass,
      difficulty:  this._difficulty,
    });
  }

  _showMultiplayer() {
    if (!this._net) return;
    this._overlay.innerHTML = `
      <div class="menu-screen home-centre" style="gap:20px">
        <div class="menu-title" style="font-size:22px">MULTIPLAYER</div>
        <div class="home-btn-group">
          <button class="home-btn primary" id="btn-quick-play">⚡ Quick Play</button>
          <button class="home-btn" id="btn-create-room">🏠 Create Room</button>
          <div style="display:flex;gap:8px;width:100%">
            <input id="mp-code-input" placeholder="ROOM CODE" maxlength="5"
              style="flex:1;background:#111a0e;border:1px solid #335522;border-radius:6px;
              color:#ccffaa;font-family:'Press Start 2P',monospace;font-size:10px;padding:10px 12px;
              text-transform:uppercase;outline:none" />
            <button class="home-btn" id="btn-join-room" style="width:auto;padding:10px 16px">Join</button>
          </div>
          <button class="home-btn" id="btn-mp-back" style="background:transparent;border-color:#335522;color:#557744">← Back</button>
        </div>
        <div id="mp-error" style="font-family:'Press Start 2P',monospace;font-size:8px;color:#ff4444;display:none"></div>
        <div id="mp-status" style="font-family:'Press Start 2P',monospace;font-size:8px;color:#88ff44;display:none"></div>
      </div>
    `;

    const playerData = () => ({
      playerClass: this._playerClass,
      colour: PLAYER_COLORS[this._colorIdx]?.value ?? 0x7B3F00,
      hat: this._hat,
      name: this._playerName.trim() || 'Player',
    });

    this._overlay.querySelector('#btn-quick-play').addEventListener('click', () => {
      this._net.quickPlay(playerData());
      this._overlay.querySelector('#mp-status').textContent = 'Searching for players...';
      this._overlay.querySelector('#mp-status').style.display = 'block';
    });

    this._overlay.querySelector('#btn-create-room').addEventListener('click', () => {
      this._showCreateRoom(playerData);
    });

    this._overlay.querySelector('#btn-join-room').addEventListener('click', () => {
      const code = this._overlay.querySelector('#mp-code-input').value.trim().toUpperCase();
      if (code.length !== 5) { this._overlay.querySelector('#mp-error').textContent = 'Enter a 5-letter code'; this._overlay.querySelector('#mp-error').style.display = 'block'; return; }
      this._net.joinRoom(code, playerData());
    });

    this._overlay.querySelector('#btn-mp-back').addEventListener('click', () => this._showHome());
  }

  _showCreateRoom(playerData) {
    let selectedMode = 'coop';
    let selectedDiff = 'normal';

    const render = () => {
      this._overlay.innerHTML = `
        <div class="menu-screen home-centre" style="gap:20px;max-width:420px;width:100%">
          <div class="menu-title" style="font-size:18px">CREATE ROOM</div>

          <div style="display:flex;flex-direction:column;gap:10px;width:100%">
            <div style="font-family:'Press Start 2P',monospace;font-size:8px;color:#88ff44;margin-bottom:4px">Game Mode</div>
            <div style="display:flex;gap:8px;width:100%">
              <button id="mode-coop" class="home-btn${selectedMode==='coop'?' primary':''}" style="flex:1">🤝 Co-op</button>
              <button id="mode-pvp"  class="home-btn${selectedMode==='pvp' ?' primary':''}" style="flex:1">⚔️ PvP</button>
            </div>

            <div id="diff-section" style="display:${selectedMode==='coop'?'flex':'none'};flex-direction:column;gap:8px;margin-top:4px">
              <div style="font-family:'Press Start 2P',monospace;font-size:8px;color:#88ff44;margin-bottom:4px">Difficulty</div>
              <div style="display:flex;gap:8px;width:100%">
                <button id="diff-easy"   class="home-btn${selectedDiff==='easy'  ?' primary':''}" style="flex:1">Easy</button>
                <button id="diff-normal" class="home-btn${selectedDiff==='normal'?' primary':''}" style="flex:1">Normal</button>
                <button id="diff-hard"   class="home-btn${selectedDiff==='hard'  ?' primary':''}" style="flex:1">Hard</button>
              </div>
            </div>
          </div>

          <button class="home-btn primary" id="btn-confirm-create" style="width:100%;margin-top:8px">Create →</button>
          <button class="home-btn" id="btn-create-back" style="background:transparent;border-color:#335522;color:#557744">← Back</button>
        </div>
      `;

      this._overlay.querySelector('#mode-coop').addEventListener('click', () => { selectedMode = 'coop'; render(); });
      this._overlay.querySelector('#mode-pvp').addEventListener('click',  () => { selectedMode = 'pvp';  render(); });
      this._overlay.querySelector('#diff-easy')?.addEventListener('click',   () => { selectedDiff = 'easy';   render(); });
      this._overlay.querySelector('#diff-normal')?.addEventListener('click', () => { selectedDiff = 'normal'; render(); });
      this._overlay.querySelector('#diff-hard')?.addEventListener('click',   () => { selectedDiff = 'hard';   render(); });

      this._overlay.querySelector('#btn-confirm-create').addEventListener('click', () => {
        const data = { ...playerData(), mode: selectedMode, difficulty: selectedDiff };
        this._net.createRoom(data);
      });
      this._overlay.querySelector('#btn-create-back').addEventListener('click', () => this._showMultiplayer());
    };

    render();
  }

  _showLobby(lobbyData) {
    const myId = this._net.mySocketId;
    const me = lobbyData.players.find(p => p.socketId === myId);
    const isHost = me?.isHost;
    const modeLabel = lobbyData.mode === 'coop'
      ? `🤝 Co-op · ${lobbyData.difficulty || 'normal'}`
      : '⚔️ PvP';

    this._overlay.innerHTML = `
      <div class="menu-screen home-centre" style="gap:14px;max-width:520px;width:100%">
        <div style="font-family:'Press Start 2P',monospace;font-size:9px;color:#557744">
          Room: <span style="color:#88ff44">${lobbyData.id}</span>
          &nbsp;·&nbsp; ${modeLabel}
        </div>

        <div id="lobby-player-list" style="display:flex;flex-direction:column;gap:8px;width:100%"></div>

        <div id="lobby-customiser" style="display:none;width:100%"></div>

        <button class="home-btn primary" id="btn-lobby-ready" style="width:100%">
          ${me?.ready ? '✓ Unready' : 'Ready Up'}
        </button>
        <div style="font-family:'Press Start 2P',monospace;font-size:7px;color:#557744;text-align:center">
          Game starts automatically when all players are ready
        </div>
        <button class="home-btn" id="btn-lobby-leave" style="background:transparent;border-color:#335522;color:#557744;width:100%">← Leave</button>
      </div>
    `;

    // Render player rows
    const renderPlayers = (players) => {
      const currentMe = players.find(p => p.socketId === myId);
      const currentIsHost = currentMe?.isHost;

      this._overlay.querySelector('#lobby-player-list').innerHTML = players.map(p => {
        const isMe = p.socketId === myId;
        const canKick = currentIsHost && !isMe && !p.isHost;
        return `
          <div class="lobby-row${isMe ? ' mine' : ''}"
               data-sid="${escLobbyHtml(p.socketId)}"
               style="display:flex;align-items:center;gap:10px;background:rgba(0,0,0,0.6);
               border:1px solid ${isMe?'#44cc44':'#335522'};
               border-radius:8px;padding:8px 12px;cursor:${isMe?'pointer':'default'}">
            <div style="width:18px;height:18px;border-radius:50%;background:#${p.colour?.toString(16).padStart(6,'0')||'7B3F00'};border:1px solid #557744;flex-shrink:0"></div>
            <span style="font-size:16px">${{ brawler:'🥊', slinger:'🍌', trickster:'🎭' }[p.playerClass]||'🐒'}</span>
            <div style="flex:1;min-width:0">
              <div style="font-family:'Press Start 2P',monospace;font-size:8px;color:#ccffaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                ${escLobbyHtml(p.name || 'Player')}${p.isHost?' 👑':''}
              </div>
              <div style="font-family:'Press Start 2P',monospace;font-size:7px;color:#557744">
                ${escLobbyHtml(p.playerClass)} · ${escLobbyHtml(p.hat)}
              </div>
            </div>
            <div style="font-family:'Press Start 2P',monospace;font-size:7px;color:${p.ready?'#44ff44':'#557744'};flex-shrink:0">
              ${p.ready ? '✓ Ready' : 'waiting'}
            </div>
            ${canKick ? `<button class="kick-btn" data-sid="${escLobbyHtml(p.socketId)}"
              style="background:#330000;border:1px solid #882222;border-radius:4px;color:#ff4444;
              font-family:'Press Start 2P',monospace;font-size:7px;padding:3px 6px;cursor:pointer;flex-shrink:0">
              kick
            </button>` : ''}
          </div>
        `;
      }).join('');

      // Click own row to open customiser
      this._overlay.querySelectorAll('.lobby-row.mine').forEach(row => {
        row.addEventListener('click', (e) => {
          if (e.target.closest('.kick-btn')) return;
          this._toggleLobbyCustomiser();
        });
      });

      // Kick buttons
      this._overlay.querySelectorAll('.kick-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this._net.kickPlayer(btn.dataset.sid);
        });
      });

      // Update ready button text
      const readyBtn = this._overlay.querySelector('#btn-lobby-ready');
      if (readyBtn && currentMe) {
        readyBtn.textContent = currentMe.ready ? '✓ Unready' : 'Ready Up';
        readyBtn.style.background = currentMe.ready ? '#226611' : '';
      }
    };

    renderPlayers(lobbyData.players);

    this._overlay.querySelector('#btn-lobby-ready').addEventListener('click', () => {
      const currentMe = this._net.gameState
        ? null
        : lobbyData.players.find(p => p.socketId === myId);
      // Toggle — use the latest known ready state from last render
      const readyBtn = this._overlay.querySelector('#btn-lobby-ready');
      const currentlyReady = readyBtn?.textContent?.includes('Unready');
      this._net.setReady(!currentlyReady);
    });

    this._overlay.querySelector('#btn-lobby-leave')?.addEventListener('click', () => {
      this._net.onLobbyUpdate = null;
      this._net.destroy();
      this._net = null;
      this._showHome();
    });

    // Update when lobby state changes
    this._net.onLobbyUpdate = (data) => {
      renderPlayers(data.players);
    };
  }

  _toggleLobbyCustomiser() {
    const el = this._overlay.querySelector('#lobby-customiser');
    if (!el) return;
    if (el.style.display !== 'none') { el.style.display = 'none'; return; }
    el.style.display = 'block';
    this._renderLobbyCustomiser(el);
  }

  _renderLobbyCustomiser(el) {
    el.innerHTML = `
      <div style="background:rgba(0,0,0,0.6);border:1px solid #335522;border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:12px">
        <div style="font-family:'Press Start 2P',monospace;font-size:8px;color:#88ff44">Name</div>
        <input id="lc-name" maxlength="16" placeholder="Enter name..."
          value="${escLobbyHtml(this._playerName)}"
          style="background:#111a0e;border:1px solid #335522;border-radius:6px;color:#ccffaa;
          font-family:'Press Start 2P',monospace;font-size:9px;padding:8px 10px;outline:none;width:100%;box-sizing:border-box" />

        <div style="font-family:'Press Start 2P',monospace;font-size:8px;color:#88ff44">Class</div>
        <div style="display:flex;gap:6px">
          ${PLAYER_CLASSES.map(c => `
            <div class="lc-class" data-id="${c.id}"
              style="flex:1;text-align:center;padding:6px 4px;border-radius:6px;cursor:pointer;font-size:13px;
              background:${this._playerClass===c.id?'rgba(68,204,68,0.2)':'rgba(0,0,0,0.3)'};
              border:1px solid ${this._playerClass===c.id?'#44cc44':'#335522'}">
              ${c.emoji}<br><span style="font-family:'Press Start 2P',monospace;font-size:6px;color:#ccffaa">${c.label}</span>
            </div>
          `).join('')}
        </div>

        <div style="font-family:'Press Start 2P',monospace;font-size:8px;color:#88ff44">Colour</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${PLAYER_COLORS.map((c, i) => `
            <div class="lc-color" data-idx="${i}"
              style="width:24px;height:24px;border-radius:50%;background:${c.hex};cursor:pointer;
              border:2px solid ${this._colorIdx===i?'#ffffff':'#335522'};
              box-shadow:${this._colorIdx===i?'0 0 6px #fff':'none'}"></div>
          `).join('')}
        </div>

        <div style="font-family:'Press Start 2P',monospace;font-size:8px;color:#88ff44">Hat</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${HATS.map(h => `
            <div class="lc-hat" data-id="${h.id}"
              style="padding:5px 8px;border-radius:6px;cursor:pointer;text-align:center;font-size:12px;
              background:${this._hat===h.id?'rgba(68,204,68,0.2)':'rgba(0,0,0,0.3)'};
              border:1px solid ${this._hat===h.id?'#44cc44':'#335522'}">
              ${h.emoji}<br><span style="font-family:'Press Start 2P',monospace;font-size:6px;color:#ccffaa">${h.label}</span>
            </div>
          `).join('')}
        </div>

        <button id="lc-close" class="home-btn" style="width:100%;padding:7px;font-size:8px">Done ✓</button>
      </div>
    `;

    el.querySelectorAll('.lc-class').forEach(card => {
      card.addEventListener('click', () => {
        this._playerClass = card.dataset.id;
        this._net.updateCustomisation({ playerClass: this._playerClass });
        this._renderLobbyCustomiser(el);
      });
    });

    el.querySelectorAll('.lc-color').forEach(swatch => {
      swatch.addEventListener('click', () => {
        this._colorIdx = +swatch.dataset.idx;
        this._net.updateCustomisation({ colour: PLAYER_COLORS[this._colorIdx].value });
        this._renderLobbyCustomiser(el);
      });
    });

    el.querySelectorAll('.lc-hat').forEach(card => {
      card.addEventListener('click', () => {
        this._hat = card.dataset.id;
        this._net.updateCustomisation({ hat: this._hat });
        this._renderLobbyCustomiser(el);
      });
    });

    const nameInput = el.querySelector('#lc-name');
    nameInput.addEventListener('input', () => {
      this._playerName = nameInput.value;
      this._net.updateCustomisation({ name: this._playerName.trim() || 'Player' });
    });

    el.querySelector('#lc-close').addEventListener('click', () => {
      el.style.display = 'none';
    });
  }
}
