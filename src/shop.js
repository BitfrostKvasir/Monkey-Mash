export class Shop {
  constructor() {
    this._overlay  = null;
    this._timer    = 0;
    this._timerEl  = null;
    this._onClose  = null;
    this._closed   = true;
  }

  get isOpen() { return !this._closed; }

  open(offers, playerBananas, onClose) {
    this._onClose = onClose;
    this._closed  = false;
    this._timer   = 3.0;

    const costColor = c => c === 1 ? '#88ff44' : c === 2 ? '#ffcc00' : '#ff7755';
    const costLabel = c => c === 1 ? 'Common'  : c === 2 ? 'Uncommon' : 'Rare';

    const overlay = document.createElement('div');
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
        <div style="font-size:15px; color:#ffe135; margin-top:6px;">🍌 ${playerBananas} banana${playerBananas!==1?'s':''}</div>
      </div>

      <div style="display:flex; gap:14px; margin-bottom:26px; user-select:none;" id="shop-cards">
        ${offers.map((u,i) => {
          const can = playerBananas >= u.cost;
          return `
            <div class="shop-card" data-idx="${i}" style="
              cursor:${can?'pointer':'default'};
              opacity:${can?'1':'0.4'};
              border:2px solid ${costColor(u.cost)};
              border-radius:14px;
              padding:18px 14px;
              width:150px;
              text-align:center;
              background:rgba(255,255,255,0.06);
              transition:transform .12s, background .12s;
            ">
              <div style="font-size:30px; margin-bottom:5px;">${u.icon}</div>
              <div style="font-size:10px; letter-spacing:2px; color:${costColor(u.cost)}; margin-bottom:5px; text-transform:uppercase;">${costLabel(u.cost)}</div>
              <div style="font-size:14px; margin-bottom:7px; line-height:1.2;">${u.label}</div>
              <div style="font-size:10px; opacity:.6; font-family:Arial,sans-serif; font-weight:normal; margin-bottom:10px; line-height:1.4;">${u.desc}</div>
              <div style="font-size:13px; color:${can?'#ffe135':'#666'};">🍌 ${u.cost}</div>
            </div>`;
        }).join('')}
      </div>

      <button id="shop-skip" style="
        font-family:'Arial Black',sans-serif;
        font-size:12px; letter-spacing:2px; text-transform:uppercase;
        padding:9px 26px;
        border:1px solid rgba(255,255,255,0.22); border-radius:30px;
        cursor:pointer; background:transparent; color:rgba(255,255,255,0.45);
      ">Skip <span id="shop-timer">3</span>s</button>
    `;

    document.body.appendChild(overlay);
    this._overlay = overlay;
    this._timerEl = overlay.querySelector('#shop-timer');

    overlay.querySelectorAll('.shop-card').forEach((card, i) => {
      const offer = offers[i];
      if (playerBananas < offer.cost) return;
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'scale(1.05)';
        card.style.background = 'rgba(255,255,255,0.13)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'scale(1)';
        card.style.background = 'rgba(255,255,255,0.06)';
      });
      card.addEventListener('click', () => this._close(offer));
    });

    overlay.querySelector('#shop-skip').addEventListener('click', () => this._close(null));
  }

  update(dt) {
    if (this._closed) return;
    this._timer -= dt;
    if (this._timerEl) this._timerEl.textContent = Math.max(0, Math.ceil(this._timer));
    if (this._timer <= 0) this._close(null);
  }

  _close(upgrade) {
    if (this._closed) return;
    this._closed = true;
    if (this._overlay) {
      this._overlay.style.transition = 'opacity 0.2s';
      this._overlay.style.opacity = '0';
      setTimeout(() => { this._overlay?.remove(); this._overlay = null; }, 220);
    }
    if (this._onClose) this._onClose(upgrade);
  }
}
