// src/multiplayer-hud.js
function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const CLASS_EMOJI = { brawler: '🥊', slinger: '🍌', trickster: '🎭' };

export class MultiplayerHUD {
  constructor(mode) {
    this.mode = mode;
    this._nodes = []; // all appended DOM nodes for cleanup

    if (mode === 'coop') {
      // ── Co-op: compact right-side panel, keeps existing HP bar clear ──
      this._el = document.createElement('div');
      this._el.id = 'mp-hud';
      this._el.style.cssText = `
        position: fixed; top: 12px; right: 12px; z-index: 30;
        display: flex; flex-direction: column; gap: 6px;
        pointer-events: none;
      `;
      document.body.appendChild(this._el);
      this._nodes.push(this._el);

    } else {
      // ── PvP: fighting-game layout ──────────────────────────────────
      // Top-center: round info + timer + score
      this._topBar = document.createElement('div');
      this._topBar.id = 'pvp-top-bar';
      this._topBar.style.cssText = `
        position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
        z-index: 30; pointer-events: none;
        display: flex; flex-direction: column; align-items: center; gap: 4px;
      `;
      document.body.appendChild(this._topBar);
      this._nodes.push(this._topBar);

      // Bottom player bars (above the ability HUD which is at bottom: 20px + ~80px tall)
      this._p1Bar = this._makePlayerBar('left');
      this._p2Bar = this._makePlayerBar('right');
      this._nodes.push(this._p1Bar, this._p2Bar);
    }
  }

  _makePlayerBar(side) {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed; bottom: 120px; ${side === 'left' ? 'left: 16px' : 'right: 16px'};
      z-index: 30; pointer-events: none;
      background: rgba(0,0,0,0.80); border: 2px solid rgba(255,255,255,0.18);
      border-radius: 10px; padding: 10px 14px; min-width: 190px;
    `;
    document.body.appendChild(el);
    return el;
  }

  update(state, mySocketId) {
    const players = state.players || [];
    const scores  = state.scores  || {};

    if (this.mode === 'coop') {
      this._renderCoop(players, mySocketId);
    } else {
      this._renderPvp(players, mySocketId, scores, state);
    }
  }

  _renderCoop(players, mySocketId) {
    // Show all players in the right panel (local player highlighted)
    this._el.innerHTML = players.map(p => {
      const hpPct = Math.max(0, (p.hp / (p.maxHp || 100)) * 100).toFixed(0);
      const isMe  = p.socketId === mySocketId;
      const borderCol = isMe ? '#44cc44' : '#557755';
      const nameCol   = isMe ? '#88ff44' : '#aaaaaa';
      const hpCol     = hpPct > 50 ? '#44cc44' : hpPct > 25 ? '#ffcc00' : '#ff4444';
      return `
        <div style="display:flex;align-items:center;gap:7px;
          background:rgba(0,0,0,0.72);border:1px solid ${borderCol};
          border-radius:7px;padding:5px 9px;min-width:160px">
          <span style="font-size:16px">${CLASS_EMOJI[p.playerClass] || '🐒'}</span>
          <div style="flex:1;min-width:0">
            <div style="font-family:'Press Start 2P',monospace;font-size:7px;
              color:${nameCol};margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${isMe ? 'YOU' : escHtml(p.name || 'Player')}${p.isDown ? ' 💀' : ''}
            </div>
            <div style="background:#222;border-radius:3px;height:6px;width:110px">
              <div style="background:${hpCol};height:100%;width:${hpPct}%;
                border-radius:3px;transition:width 0.1s"></div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  _renderPvp(players, mySocketId, scores, state) {
    const me    = players.find(p => p.socketId === mySocketId);
    const other = players.find(p => p.socketId !== mySocketId);

    // Top bar: round indicator + score + timer
    const round = state.roundTimer !== undefined ? state.roundTimer : '';
    const myWins = scores[mySocketId] || 0;
    const theirWins = other ? (scores[other.socketId] || 0) : 0;
    const myName = me ? (me.name || 'YOU') : 'YOU';
    const theirName = other ? escHtml(other.name || 'Opponent') : 'Opponent';

    this._topBar.innerHTML = `
      <div style="display:flex;align-items:center;gap:16px;
        background:rgba(0,0,0,0.80);border:2px solid #44cc44;
        border-radius:10px;padding:6px 20px">
        <span style="font-family:'Press Start 2P',monospace;font-size:10px;color:#88ff44">
          ${escHtml(myName)}
        </span>
        <span style="font-family:'Press Start 2P',monospace;font-size:14px;color:#ffcc44;letter-spacing:4px">
          ${myWins} — ${theirWins}
        </span>
        <span style="font-family:'Press Start 2P',monospace;font-size:10px;color:#aaaaaa">
          ${theirName}
        </span>
      </div>
      ${round !== '' ? `<div style="font-family:'Press Start 2P',monospace;font-size:9px;color:#ffcc44">
        ⏱ ${round}s
      </div>` : ''}
    `;

    // Bottom-left: local player
    if (me) {
      const hpPct = Math.max(0, (me.hp / (me.maxHp || 100)) * 100).toFixed(0);
      const hpCol = hpPct > 50 ? '#44cc44' : hpPct > 25 ? '#ffcc00' : '#ff4444';
      this._p1Bar.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
          <span style="font-size:20px">${CLASS_EMOJI[me.playerClass] || '🐒'}</span>
          <span style="font-family:'Press Start 2P',monospace;font-size:8px;color:#88ff44">YOU</span>
          ${me.isDown ? '<span style="font-size:13px">💀</span>' : ''}
        </div>
        <div style="background:#222;border-radius:4px;height:10px;width:180px;border:1px solid #333">
          <div style="background:${hpCol};height:100%;width:${hpPct}%;
            border-radius:4px;transition:width 0.1s"></div>
        </div>
        <div style="font-family:'Press Start 2P',monospace;font-size:7px;color:#888;margin-top:4px">
          ${me.hp} / ${me.maxHp}
        </div>
      `;
      this._p1Bar.style.borderColor = me.isDown ? 'rgba(255,60,60,0.5)' : 'rgba(100,255,100,0.4)';
    }

    // Bottom-right: opponent
    if (other) {
      const hpPct = Math.max(0, (other.hp / (other.maxHp || 100)) * 100).toFixed(0);
      const hpCol = hpPct > 50 ? '#44cc44' : hpPct > 25 ? '#ffcc00' : '#ff4444';
      this._p2Bar.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px;justify-content:flex-end">
          ${other.isDown ? '<span style="font-size:13px">💀</span>' : ''}
          <span style="font-family:'Press Start 2P',monospace;font-size:8px;color:#aaaaaa">
            ${escHtml(other.name || 'Opponent')}
          </span>
          <span style="font-size:20px">${CLASS_EMOJI[other.playerClass] || '🐒'}</span>
        </div>
        <div style="background:#222;border-radius:4px;height:10px;width:180px;border:1px solid #333">
          <div style="background:${hpCol};height:100%;width:${hpPct}%;
            border-radius:4px;transition:width 0.1s;float:right"></div>
        </div>
        <div style="font-family:'Press Start 2P',monospace;font-size:7px;color:#888;margin-top:4px;text-align:right">
          ${other.hp} / ${other.maxHp}
        </div>
      `;
      this._p2Bar.style.borderColor = other.isDown ? 'rgba(255,60,60,0.5)' : 'rgba(180,180,255,0.4)';
    }
  }

  updatePool(pool) {
    const el = document.getElementById('banana-count');
    if (el) el.textContent = `🍌 ${pool} (shared)`;
  }

  destroy() {
    for (const n of this._nodes) n.remove();
    this._nodes = [];
  }
}
