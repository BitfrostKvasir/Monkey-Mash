// src/multiplayer-hud.js
export class MultiplayerHUD {
  constructor(mode) {
    this.mode = mode; // 'coop' | 'pvp'
    this._el = document.createElement('div');
    this._el.id = 'mp-hud';
    this._el.style.cssText = `
      position: fixed; top: 12px; left: 12px; z-index: 30;
      display: flex; flex-direction: column; gap: 6px;
      pointer-events: none;
    `;
    document.body.appendChild(this._el);

    if (mode === 'pvp') {
      this._scoreEl = document.createElement('div');
      this._scoreEl.style.cssText = `
        position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
        background: rgba(0,0,0,0.75); border: 1px solid #44cc44;
        border-radius: 8px; padding: 6px 18px;
        font-family: 'Press Start 2P', monospace; font-size: 10px; color: #88ff44;
        z-index: 30; pointer-events: none;
      `;
      document.body.appendChild(this._scoreEl);

      this._timerEl = document.createElement('div');
      this._timerEl.style.cssText = `
        position: fixed; top: 48px; left: 50%; transform: translateX(-50%);
        font-family: 'Press Start 2P', monospace; font-size: 9px; color: #ffcc44;
        z-index: 30; pointer-events: none;
      `;
      document.body.appendChild(this._timerEl);
    }
  }

  update(state, mySocketId) {
    const players = state.players || [];

    // Portrait rows
    this._el.innerHTML = players.map(p => {
      const hpPct = Math.max(0, (p.hp / (p.maxHp || 100)) * 100).toFixed(0);
      const isMe  = p.socketId === mySocketId;
      const col   = isMe ? '#88ff44' : '#aaaaaa';
      return `
        <div style="display:flex;align-items:center;gap:6px;background:rgba(0,0,0,0.65);
          border:1px solid ${col};border-radius:6px;padding:4px 8px;min-width:140px">
          <span style="font-size:14px">${{ brawler:'🥊', slinger:'🍌', trickster:'🎭' }[p.playerClass] || '🐒'}</span>
          <div style="flex:1">
            <div style="font-family:'Press Start 2P',monospace;font-size:7px;color:${col};margin-bottom:2px">
              ${isMe ? 'YOU' : p.name || 'Player'}${p.isDown ? ' 💀' : ''}
            </div>
            <div style="background:#333;border-radius:3px;height:5px;width:100px">
              <div style="background:${hpPct > 50 ? '#44cc44' : hpPct > 25 ? '#ffcc00' : '#ff4444'};
                height:100%;width:${hpPct}%;border-radius:3px;transition:width 0.1s"></div>
            </div>
          </div>
          ${this.mode === 'pvp' ? `<span style="font-family:'Press Start 2P',monospace;font-size:8px;color:#ffcc44">
            ${state.scores?.[p.socketId] || 0}W</span>` : ''}
        </div>
      `;
    }).join('');

    // PvP score + timer
    if (this.mode === 'pvp') {
      const entries = Object.entries(state.scores || {});
      this._scoreEl.textContent = entries.map(([sid, w]) => {
        const p = players.find(pl => pl.socketId === sid);
        return `${p?.name || 'P'}: ${w}`;
      }).join('  ·  ');
      if (this._timerEl && state.roundTimer !== undefined) {
        this._timerEl.textContent = `⏱ ${state.roundTimer}s`;
      }
    }
  }

  updatePool(pool) {
    // Called in co-op when shared pool changes
    const el = document.getElementById('banana-count');
    if (el) el.textContent = `🍌 ${pool} (shared)`;
  }

  destroy() {
    this._el.remove();
    this._scoreEl?.remove();
    this._timerEl?.remove();
  }
}
