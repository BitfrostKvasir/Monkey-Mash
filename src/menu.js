/**
 * Menu state machine: title → difficulty → customization → game
 * All UI is HTML overlaid on the Three.js canvas.
 */

export const DIFFICULTIES = {
  easy:   { speedMult: 0.5, reactionDist: 3.0, spikeChance: 0.3 },
  medium: { speedMult: 0.8, reactionDist: 2.0, spikeChance: 0.6 },
  hard:   { speedMult: 1.1, reactionDist: 1.0, spikeChance: 0.95 },
};

export const PLAYER_COLORS = [
  { label: 'Orange',  hex: '#c8860a', value: 0xc8860a },
  { label: 'Red',     hex: '#cc2222', value: 0xcc2222 },
  { label: 'Green',   hex: '#22aa44', value: 0x22aa44 },
  { label: 'Purple',  hex: '#8833cc', value: 0x8833cc },
  { label: 'Pink',    hex: '#dd44aa', value: 0xdd44aa },
  { label: 'Cyan',    hex: '#11aacc', value: 0x11aacc },
  { label: 'White',   hex: '#dddddd', value: 0xdddddd },
  { label: 'Black',   hex: '#333333', value: 0x333333 },
];

export const HATS = [
  { id: 'none',    label: 'None',       emoji: '🐵' },
  { id: 'tophat',  label: 'Top Hat',    emoji: '🎩' },
  { id: 'party',   label: 'Party Hat',  emoji: '🎉' },
  { id: 'cowboy',  label: 'Cowboy Hat', emoji: '🤠' },
  { id: 'crown',   label: 'Crown',      emoji: '👑' },
];

export class Menu {
  /**
   * @param {(config: {difficulty: string, color: number, hat: string}) => void} onPlay
   */
  constructor(onPlay) {
    this.onPlay = onPlay;
    this._selectedDifficulty = 'medium';
    this._selectedColorIdx = 0;
    this._selectedHat = 'none';

    this._overlay = this._createOverlay();
    document.body.appendChild(this._overlay);

    this._showTitle();
  }

  _createOverlay() {
    const el = document.createElement('div');
    el.id = 'menu-overlay';
    el.style.cssText = `
      position: fixed; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      z-index: 100;
      font-family: 'Arial Black', 'Impact', sans-serif;
      color: #fff;
      background: linear-gradient(160deg, #0a1a3a 0%, #1a3a1a 50%, #3a1a0a 100%);
      transition: opacity 0.4s;
    `;
    return el;
  }

  _clear() {
    this._overlay.innerHTML = '';
  }

  // ── Screen 1: Title ──────────────────────────────────────────────
  _showTitle() {
    this._clear();
    this._overlay.innerHTML = `
      <div style="text-align:center; user-select:none;">
        <div style="
          font-size: clamp(48px, 10vw, 96px);
          letter-spacing: 4px;
          text-transform: uppercase;
          background: linear-gradient(135deg, #ffdd00, #ff8800, #ff4400);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          filter: drop-shadow(0 4px 16px rgba(255,140,0,0.6));
          margin-bottom: 8px;
          line-height: 1;
        ">Monkey<br>Mash</div>

        <div style="
          font-size: 18px;
          opacity: 0.6;
          letter-spacing: 6px;
          text-transform: uppercase;
          margin-bottom: 60px;
          font-family: Arial, sans-serif;
          font-weight: normal;
          -webkit-text-fill-color: #aaa;
        ">3D Volleyball</div>

        <button id="btn-start" style="
          font-family: 'Arial Black', sans-serif;
          font-size: 22px;
          letter-spacing: 3px;
          text-transform: uppercase;
          padding: 18px 56px;
          border: none;
          border-radius: 50px;
          cursor: pointer;
          background: linear-gradient(135deg, #ff8800, #ff4400);
          color: #fff;
          box-shadow: 0 6px 32px rgba(255,100,0,0.5);
          transition: transform 0.1s, box-shadow 0.1s;
        ">Play</button>
      </div>
    `;

    const btn = this._overlay.querySelector('#btn-start');
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.08)';
      btn.style.boxShadow = '0 8px 40px rgba(255,100,0,0.8)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = '0 6px 32px rgba(255,100,0,0.5)';
    });
    btn.addEventListener('click', () => this._showDifficulty());
  }

  // ── Screen 2: Difficulty ─────────────────────────────────────────
  _showDifficulty() {
    this._clear();

    const difficulties = [
      { id: 'easy',   label: 'Easy',   desc: 'Chill monkey',  color: '#44cc44' },
      { id: 'medium', label: 'Medium', desc: 'Feisty monkey', color: '#ffaa00' },
      { id: 'hard',   label: 'Hard',   desc: 'Mega monkey',   color: '#ff3333' },
    ];

    const cards = difficulties.map(d => `
      <div class="diff-card" data-id="${d.id}" style="
        cursor: pointer;
        border: 3px solid ${d.id === this._selectedDifficulty ? d.color : 'transparent'};
        border-radius: 16px;
        padding: 28px 36px;
        background: rgba(255,255,255,0.05);
        text-align: center;
        transition: border-color 0.15s, transform 0.15s, background 0.15s;
        min-width: 140px;
      ">
        <div style="font-size: 36px; margin-bottom: 8px;">${d.id === 'easy' ? '🐒' : d.id === 'medium' ? '🦍' : '💀'}</div>
        <div style="font-size: 20px; color: ${d.color}; margin-bottom: 4px;">${d.label}</div>
        <div style="font-size: 13px; opacity: 0.55; font-family: Arial, sans-serif; font-weight: normal;">${d.desc}</div>
      </div>
    `).join('');

    this._overlay.innerHTML = `
      <div style="text-align:center; user-select:none;">
        <div style="font-size: 32px; margin-bottom: 8px; letter-spacing: 3px; opacity:0.9;">Choose Difficulty</div>
        <div style="font-size: 14px; opacity: 0.4; font-family:Arial,sans-serif; font-weight:normal; margin-bottom: 40px; letter-spacing:2px;">HOW TOUGH IS YOUR OPPONENT?</div>
        <div style="display:flex; gap: 20px; justify-content:center; margin-bottom: 48px;" id="diff-cards">
          ${cards}
        </div>
        <div style="display:flex; gap: 16px; justify-content:center;">
          <button id="btn-back-diff" style="${this._secondaryBtnStyle()}">Back</button>
          <button id="btn-next-diff" style="${this._primaryBtnStyle()}">Next →</button>
        </div>
      </div>
    `;

    this._overlay.querySelectorAll('.diff-card').forEach(card => {
      card.addEventListener('click', () => {
        this._selectedDifficulty = card.dataset.id;
        this._overlay.querySelectorAll('.diff-card').forEach(c => {
          const col = difficulties.find(d => d.id === c.dataset.id).color;
          c.style.borderColor = c.dataset.id === this._selectedDifficulty ? col : 'transparent';
          c.style.background = c.dataset.id === this._selectedDifficulty ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)';
        });
      });
      card.addEventListener('mouseenter', () => { card.style.transform = 'scale(1.05)'; });
      card.addEventListener('mouseleave', () => { card.style.transform = 'scale(1)'; });
    });

    this._overlay.querySelector('#btn-back-diff').addEventListener('click', () => this._showTitle());
    this._overlay.querySelector('#btn-next-diff').addEventListener('click', () => this._showCustomize());
  }

  // ── Screen 3: Customization ───────────────────────────────────────
  _showCustomize() {
    this._clear();

    const colorSwatches = PLAYER_COLORS.map((c, i) => `
      <div class="color-swatch" data-idx="${i}" title="${c.label}" style="
        width: 36px; height: 36px;
        border-radius: 50%;
        background: ${c.hex};
        cursor: pointer;
        border: 3px solid ${i === this._selectedColorIdx ? '#fff' : 'transparent'};
        box-shadow: ${i === this._selectedColorIdx ? '0 0 12px rgba(255,255,255,0.7)' : 'none'};
        transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
      "></div>
    `).join('');

    const hatCards = HATS.map(h => `
      <div class="hat-card" data-id="${h.id}" style="
        cursor: pointer;
        border: 2px solid ${h.id === this._selectedHat ? '#ffdd00' : 'rgba(255,255,255,0.15)'};
        border-radius: 12px;
        padding: 14px 18px;
        background: ${h.id === this._selectedHat ? 'rgba(255,221,0,0.12)' : 'rgba(255,255,255,0.04)'};
        text-align: center;
        transition: border-color 0.15s, background 0.15s, transform 0.15s;
        min-width: 80px;
      ">
        <div style="font-size: 28px; margin-bottom: 4px;">${h.emoji}</div>
        <div style="font-size: 11px; opacity: 0.7; font-family:Arial,sans-serif; font-weight:normal; letter-spacing:1px;">${h.label}</div>
      </div>
    `).join('');

    this._overlay.innerHTML = `
      <div style="text-align:center; user-select:none; max-width: 520px; width: 90%;">
        <div style="font-size: 32px; margin-bottom: 8px; letter-spacing: 3px; opacity:0.9;">Customize Monkey</div>
        <div style="font-size: 14px; opacity: 0.4; font-family:Arial,sans-serif; font-weight:normal; margin-bottom: 36px; letter-spacing:2px;">MAKE IT YOURS</div>

        <div style="margin-bottom: 32px;">
          <div style="font-size: 14px; letter-spacing: 3px; opacity: 0.6; margin-bottom: 16px; font-family:Arial,sans-serif; font-weight:normal;">COLOR</div>
          <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;" id="color-swatches">
            ${colorSwatches}
          </div>
        </div>

        <div style="margin-bottom: 44px;">
          <div style="font-size: 14px; letter-spacing: 3px; opacity: 0.6; margin-bottom: 16px; font-family:Arial,sans-serif; font-weight:normal;">HAT</div>
          <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;" id="hat-cards">
            ${hatCards}
          </div>
        </div>

        <div style="display:flex; gap: 16px; justify-content:center;">
          <button id="btn-back-cust" style="${this._secondaryBtnStyle()}">Back</button>
          <button id="btn-play" style="${this._primaryBtnStyle()}">Let's Play!</button>
        </div>
      </div>
    `;

    this._overlay.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        this._selectedColorIdx = parseInt(swatch.dataset.idx);
        this._overlay.querySelectorAll('.color-swatch').forEach((s, i) => {
          s.style.borderColor = i === this._selectedColorIdx ? '#fff' : 'transparent';
          s.style.boxShadow = i === this._selectedColorIdx ? '0 0 12px rgba(255,255,255,0.7)' : 'none';
        });
      });
      swatch.addEventListener('mouseenter', () => { swatch.style.transform = 'scale(1.2)'; });
      swatch.addEventListener('mouseleave', () => { swatch.style.transform = 'scale(1)'; });
    });

    this._overlay.querySelectorAll('.hat-card').forEach(card => {
      card.addEventListener('click', () => {
        this._selectedHat = card.dataset.id;
        this._overlay.querySelectorAll('.hat-card').forEach(c => {
          c.style.borderColor = c.dataset.id === this._selectedHat ? '#ffdd00' : 'rgba(255,255,255,0.15)';
          c.style.background = c.dataset.id === this._selectedHat ? 'rgba(255,221,0,0.12)' : 'rgba(255,255,255,0.04)';
        });
      });
      card.addEventListener('mouseenter', () => { card.style.transform = 'scale(1.08)'; });
      card.addEventListener('mouseleave', () => { card.style.transform = 'scale(1)'; });
    });

    this._overlay.querySelector('#btn-back-cust').addEventListener('click', () => this._showDifficulty());
    this._overlay.querySelector('#btn-play').addEventListener('click', () => this._launch());
  }

  _launch() {
    this._overlay.style.opacity = '0';
    this._overlay.style.pointerEvents = 'none';
    setTimeout(() => this._overlay.remove(), 400);

    this.onPlay({
      difficulty: this._selectedDifficulty,
      color: PLAYER_COLORS[this._selectedColorIdx].value,
      hat: this._selectedHat,
    });
  }

  _primaryBtnStyle() {
    return `
      font-family: 'Arial Black', sans-serif;
      font-size: 18px;
      letter-spacing: 2px;
      text-transform: uppercase;
      padding: 14px 44px;
      border: none;
      border-radius: 50px;
      cursor: pointer;
      background: linear-gradient(135deg, #ff8800, #ff4400);
      color: #fff;
      box-shadow: 0 4px 24px rgba(255,100,0,0.5);
    `;
  }

  _secondaryBtnStyle() {
    return `
      font-family: 'Arial Black', sans-serif;
      font-size: 16px;
      letter-spacing: 2px;
      text-transform: uppercase;
      padding: 14px 32px;
      border: 2px solid rgba(255,255,255,0.3);
      border-radius: 50px;
      cursor: pointer;
      background: transparent;
      color: rgba(255,255,255,0.7);
    `;
  }
}
