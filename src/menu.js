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

export class Menu {
  constructor(onPlay) {
    this.onPlay = onPlay;
    this._colorIdx = 0;
    this._hat      = 'none';

    this._overlay = document.createElement('div');
    this._overlay.id = 'menu-overlay';
    this._overlay.style.cssText = `
      position: fixed; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      z-index: 100;
      font-family: 'Arial Black', Impact, sans-serif;
      color: #fff;
      background: linear-gradient(160deg, #0a1a0a 0%, #1a3a0a 50%, #0a2a0a 100%);
      transition: opacity 0.4s;
    `;
    document.body.appendChild(this._overlay);
    this._show();
  }

  _show() {
    const colorSwatches = PLAYER_COLORS.map((c, i) => `
      <div class="color-swatch" data-idx="${i}" title="${c.label}" style="
        width: 34px; height: 34px; border-radius: 50%;
        background: ${c.hex}; cursor: pointer;
        border: 3px solid ${i === this._colorIdx ? '#fff' : 'transparent'};
        box-shadow: ${i === this._colorIdx ? '0 0 10px rgba(255,255,255,0.7)' : 'none'};
        transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
      "></div>
    `).join('');

    const hatCards = HATS.map(h => `
      <div class="hat-card" data-id="${h.id}" style="
        cursor: pointer;
        border: 2px solid ${h.id === this._hat ? '#88ff44' : 'rgba(255,255,255,0.15)'};
        border-radius: 10px;
        padding: 10px 14px;
        background: ${h.id === this._hat ? 'rgba(136,255,68,0.12)' : 'rgba(255,255,255,0.04)'};
        text-align: center;
        transition: all 0.15s;
        min-width: 68px;
      ">
        <div style="font-size: 24px; margin-bottom: 3px;">${h.emoji}</div>
        <div style="font-size: 10px; opacity: 0.7; font-family: Arial, sans-serif; font-weight: normal; letter-spacing: 1px;">${h.label}</div>
      </div>
    `).join('');

    this._overlay.innerHTML = `
      <div style="text-align:center; user-select:none; max-width: 480px; width: 90%;">
        <div style="
          font-size: clamp(48px, 10vw, 88px);
          letter-spacing: 4px;
          text-transform: uppercase;
          background: linear-gradient(135deg, #88ff44, #44ff88, #ffdd00);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          filter: drop-shadow(0 4px 16px rgba(100,255,100,0.5));
          margin-bottom: 6px;
          line-height: 1;
        ">Monkey<br>Mash</div>

        <div style="
          font-size: 15px;
          opacity: 0.55;
          letter-spacing: 6px;
          text-transform: uppercase;
          margin-bottom: 40px;
          font-family: Arial, sans-serif;
          font-weight: normal;
          -webkit-text-fill-color: #aaffaa;
        ">Top-Down Roguelike</div>

        <div style="margin-bottom: 24px;">
          <div style="font-size: 12px; letter-spacing: 3px; opacity: 0.5; margin-bottom: 12px; font-family: Arial, sans-serif; font-weight: normal;">COLOR</div>
          <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;" id="color-swatches">
            ${colorSwatches}
          </div>
        </div>

        <div style="margin-bottom: 36px;">
          <div style="font-size: 12px; letter-spacing: 3px; opacity: 0.5; margin-bottom: 12px; font-family: Arial, sans-serif; font-weight: normal;">HAT</div>
          <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;" id="hat-cards">
            ${hatCards}
          </div>
        </div>

        <button id="btn-play" style="
          font-family: 'Arial Black', sans-serif;
          font-size: 20px;
          letter-spacing: 3px;
          text-transform: uppercase;
          padding: 16px 52px;
          border: none;
          border-radius: 50px;
          cursor: pointer;
          background: linear-gradient(135deg, #44cc22, #22aa44);
          color: #fff;
          box-shadow: 0 6px 28px rgba(68,200,34,0.5);
          transition: transform 0.1s, box-shadow 0.1s;
        ">Play!</button>

        <div style="margin-top: 28px; font-family: Arial, sans-serif; font-weight: normal; font-size: 11px; opacity: 0.35; letter-spacing: 1px; line-height: 1.8;">
          WASD — Move &nbsp;|&nbsp; Mouse — Aim &nbsp;|&nbsp; LClick — Attack &nbsp;|&nbsp; Space — Dash
        </div>
      </div>
    `;

    // Color swatches
    this._overlay.querySelectorAll('.color-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        this._colorIdx = parseInt(sw.dataset.idx);
        this._overlay.querySelectorAll('.color-swatch').forEach((s, i) => {
          s.style.borderColor = i === this._colorIdx ? '#fff' : 'transparent';
          s.style.boxShadow   = i === this._colorIdx ? '0 0 10px rgba(255,255,255,0.7)' : 'none';
        });
      });
      sw.addEventListener('mouseenter', () => { sw.style.transform = 'scale(1.2)'; });
      sw.addEventListener('mouseleave', () => { sw.style.transform = 'scale(1)'; });
    });

    // Hat cards
    this._overlay.querySelectorAll('.hat-card').forEach(card => {
      card.addEventListener('click', () => {
        this._hat = card.dataset.id;
        this._overlay.querySelectorAll('.hat-card').forEach(c => {
          c.style.borderColor = c.dataset.id === this._hat ? '#88ff44' : 'rgba(255,255,255,0.15)';
          c.style.background  = c.dataset.id === this._hat ? 'rgba(136,255,68,0.12)' : 'rgba(255,255,255,0.04)';
        });
      });
      card.addEventListener('mouseenter', () => { card.style.transform = 'scale(1.06)'; });
      card.addEventListener('mouseleave', () => { card.style.transform = 'scale(1)'; });
    });

    const btn = this._overlay.querySelector('#btn-play');
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.07)';
      btn.style.boxShadow = '0 8px 36px rgba(68,200,34,0.8)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = '0 6px 28px rgba(68,200,34,0.5)';
    });
    btn.addEventListener('click', () => this._launch());
  }

  _launch() {
    this._overlay.style.opacity = '0';
    this._overlay.style.pointerEvents = 'none';
    setTimeout(() => this._overlay.remove(), 400);
    this.onPlay({
      color: PLAYER_COLORS[this._colorIdx].value,
      hat:   this._hat,
    });
  }
}
