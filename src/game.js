import { Ball } from './ball.js';
import { Player } from './player.js';
import { buildCourt } from './court.js';
import { DIFFICULTIES } from './menu.js';

const WIN_SCORE = 25;
const RESET_DELAY = 2.0;

export class Game {
  constructor(scene, input, config = {}) {
    this.scene = scene;
    this.input = input;

    const { difficulty = 'medium', color, hat = 'none' } = config;
    const aiConfig = DIFFICULTIES[difficulty] ?? DIFFICULTIES.medium;

    this.scores = { player: 0, opponent: 0 };
    this._resetTimer = 0;
    this._pendingServe = false;
    this._over = false;

    // Track who is currently serving: 1 = player, -1 = opponent
    // Serve only switches when the RECEIVER wins the rally (side-out rule)
    this._servingSide = 1;

    buildCourt(scene);

    this.ball = new Ball(scene);
    this.player   = new Player(scene, { side:  1, isHuman: true,  input, color, hat });
    this.opponent = new Player(scene, { side: -1, isHuman: false, aiConfig });

    // Initialise per-player hit cooldowns (used by ball.js)
    this.player._hitCooldown   = 0;
    this.opponent._hitCooldown = 0;

    this._startServe();

    this._scoreEl = {
      player:   document.getElementById('score-right'),
      opponent: document.getElementById('score-left'),
    };
    this._msgEl = document.getElementById('message');
  }

  _startServe() {
    this.ball.reset(this._servingSide);
    this.ball.serve(this._servingSide);
  }

  update(dt, now) {
    if (this._over) return;

    if (this._pendingServe) {
      this._resetTimer -= dt;
      if (this._resetTimer <= 0) {
        this._pendingServe = false;
        this._startServe();
      }
      return;
    }

    this.player.update(dt, now, this.ball);
    this.opponent.update(dt, now, this.ball);

    // loser: 'right' = player side lost, 'left' = opponent side lost
    const loser = this.ball.update(dt, [this.player, this.opponent]);

    if (loser) {
      if (loser === 'right') {
        // Player's side lost → opponent scores
        this.scores.opponent++;
        this._showMessage('Opponent scores!');
        // If player was serving → opponent wins serve (side-out)
        if (this._servingSide === 1) this._servingSide = -1;
        // else opponent was already serving → keep
      } else {
        // Opponent's side lost → player scores
        this.scores.player++;
        this._showMessage('Point!');
        // If opponent was serving → player wins serve (side-out)
        if (this._servingSide === -1) this._servingSide = 1;
        // else player was already serving → keep
      }

      this._updateScoreUI();

      if (this.scores.player >= WIN_SCORE || this.scores.opponent >= WIN_SCORE) {
        const msg = this.scores.player >= WIN_SCORE ? 'You Win!' : 'Opponent Wins!';
        this._showMessage(msg, true);
        this._over = true;
        return;
      }

      this._pendingServe = true;
      this._resetTimer = RESET_DELAY;
    }
  }

  _updateScoreUI() {
    if (this._scoreEl.player)   this._scoreEl.player.textContent   = this.scores.player;
    if (this._scoreEl.opponent) this._scoreEl.opponent.textContent = this.scores.opponent;
  }

  _showMessage(text, persist = false) {
    if (!this._msgEl) return;
    this._msgEl.textContent = text;
    this._msgEl.style.opacity = '1';
    if (!persist) {
      clearTimeout(this._msgTimeout);
      this._msgTimeout = setTimeout(() => {
        this._msgEl.style.opacity = '0';
      }, 1500);
    }
  }
}
