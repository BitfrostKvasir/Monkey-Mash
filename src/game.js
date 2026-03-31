import { Ball } from './ball.js';
import { Player } from './player.js';
import { buildCourt } from './court.js';
import { DIFFICULTIES } from './menu.js';

const WIN_SCORE = 25;
const POINT_MSG_DURATION = 1.5; // seconds to show "Point!" before entering serve phase
const AI_SERVE_DELAY = 1.2;     // seconds before AI tosses

export class Game {
  constructor(scene, input, config = {}) {
    this.scene = scene;
    this.input = input;

    const { difficulty = 'medium', color, hat = 'none' } = config;
    const aiConfig = DIFFICULTIES[difficulty] ?? DIFFICULTIES.medium;

    this.scores = { player: 0, opponent: 0 };
    this._over = false;

    // 'point'   — showing point message, waiting before serve phase
    // 'serving' — server at baseline, waiting for G (or AI timer)
    // 'rally'   — ball in play
    this._state = 'serving';

    this._pointTimer = 0;
    this._aiServeTimer = 0;
    this._gPressedLast = false;

    // 1 = player serves, -1 = opponent serves
    this._servingSide = 1;

    buildCourt(scene);

    this.ball = new Ball(scene);
    this.player   = new Player(scene, { side:  1, isHuman: true,  input, color, hat });
    this.opponent = new Player(scene, { side: -1, isHuman: false, aiConfig });

    this.player._hitCooldown   = 0;
    this.opponent._hitCooldown = 0;

    this._scoreEl = {
      player:   document.getElementById('score-right'),
      opponent: document.getElementById('score-left'),
    };
    this._msgEl = document.getElementById('message');

    // Start game in serve phase
    this._enterServingPhase();
  }

  // ── State transitions ────────────────────────────────────────────

  _enterServingPhase() {
    this._state = 'serving';
    this._gPressedLast = false;
    this._aiServeTimer = AI_SERVE_DELAY;
    this.ball.inPlay = false;

    // Teleport server to back baseline centre, receiver to mid-court
    const server   = this._servingSide === 1 ? this.player   : this.opponent;
    const receiver = this._servingSide === 1 ? this.opponent : this.player;

    server.mesh.position.set(0, 0, this._servingSide * 8.5);
    server.velocity.set(0, 0, 0);
    server.isAirborne = false;

    receiver.mesh.position.set(0, 0, -this._servingSide * 4);
    receiver.velocity.set(0, 0, 0);
    receiver.isAirborne = false;

    if (this._servingSide === 1) {
      this._showMessage('Press G to serve', true);
    } else {
      this._showMessage('Opponent serving…', true);
    }
  }

  _toss() {
    const server = this._servingSide === 1 ? this.player : this.opponent;
    this.ball.tossFrom(server.mesh.position, this._servingSide);
    this._state = 'rally';
    this._hideMessage();
  }

  // ── Main update ──────────────────────────────────────────────────

  update(dt, now, camAzimuth = 0) {
    if (this._over) return;

    if (this._state === 'point') {
      this._pointTimer -= dt;
      if (this._pointTimer <= 0) {
        this._enterServingPhase();
      }
      return;
    }

    if (this._state === 'serving') {
      // Both players can move freely while waiting for serve
      this.player.update(dt, now, null, camAzimuth);
      this.opponent.update(dt, now, null);

      if (this._servingSide === 1) {
        const g = this.input.isDown('KeyG');
        if (g && !this._gPressedLast) this._toss();
        this._gPressedLast = g;
      } else {
        this._aiServeTimer -= dt;
        if (this._aiServeTimer <= 0) this._toss();
      }
      return;
    }

    // ── Rally ──
    this.player.update(dt, now, this.ball, camAzimuth);
    this.opponent.update(dt, now, this.ball);

    const loser = this.ball.update(dt, [this.player, this.opponent]);

    if (loser) {
      if (loser === 'right') {
        this.scores.opponent++;
        this._showMessage('Opponent scores!');
        if (this._servingSide === 1) this._servingSide = -1;
      } else {
        this.scores.player++;
        this._showMessage('Point!');
        if (this._servingSide === -1) this._servingSide = 1;
      }

      this._updateScoreUI();

      if (this.scores.player >= WIN_SCORE || this.scores.opponent >= WIN_SCORE) {
        const msg = this.scores.player >= WIN_SCORE ? 'You Win!' : 'Opponent Wins!';
        this._showMessage(msg, true);
        this._over = true;
        return;
      }

      this._state = 'point';
      this._pointTimer = POINT_MSG_DURATION;
    }
  }

  // ── UI helpers ───────────────────────────────────────────────────

  _updateScoreUI() {
    if (this._scoreEl.player)   this._scoreEl.player.textContent   = this.scores.player;
    if (this._scoreEl.opponent) this._scoreEl.opponent.textContent = this.scores.opponent;
  }

  _showMessage(text, persist = false) {
    if (!this._msgEl) return;
    clearTimeout(this._msgTimeout);
    this._msgEl.textContent = text;
    this._msgEl.style.opacity = '1';
    if (!persist) {
      this._msgTimeout = setTimeout(() => { this._msgEl.style.opacity = '0'; }, 1500);
    }
  }

  _hideMessage() {
    if (!this._msgEl) return;
    clearTimeout(this._msgTimeout);
    this._msgEl.style.opacity = '0';
  }
}
