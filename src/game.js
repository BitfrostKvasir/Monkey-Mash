import { Ball } from './ball.js';
import { Player } from './player.js';
import { buildCourt } from './court.js';

const WIN_SCORE = 25;
const RESET_DELAY = 2.0; // seconds before next serve after a point

export class Game {
  constructor(scene, input) {
    this.scene = scene;
    this.input = input;

    this.scores = { left: 0, right: 0 }; // left = opponent (AI), right = player
    this._resetTimer = 0;
    this._pendingServe = false;
    this._serveSide = 1;
    this._over = false;

    buildCourt(scene);

    this.ball = new Ball(scene);

    // Player is on positive Z (right/south side), side=1
    this.player = new Player(scene, { side: 1, isHuman: true, input });
    // AI on negative Z (left/north side), side=-1
    this.opponent = new Player(scene, { side: -1, isHuman: false });

    // Serve to start
    this._startServe(1);

    this._scoreEl = {
      left: document.getElementById('score-left'),
      right: document.getElementById('score-right'),
    };
    this._msgEl = document.getElementById('message');
  }

  _startServe(side) {
    this.ball.reset(side);
    this.ball.serve(side);
  }

  update(dt, now) {
    if (this._over) return;

    if (this._pendingServe) {
      this._resetTimer -= dt;
      if (this._resetTimer <= 0) {
        this._pendingServe = false;
        this._startServe(this._serveSide);
      }
      return;
    }

    this.player.update(dt, now, this.ball);
    this.opponent.update(dt, now, this.ball);

    const scored = this.ball.update(dt, [this.player, this.opponent]);

    if (scored) {
      // 'left' means the ball landed on left/opponent side → player scores
      // 'right' means ball landed on right/player side → opponent scores
      if (scored === 'left') {
        this.scores.right++;
        this._showMessage('Point!');
        this._serveSide = -1;
      } else {
        this.scores.left++;
        this._showMessage('Opponent scores!');
        this._serveSide = 1;
      }

      this._updateScoreUI();

      if (this.scores.right >= WIN_SCORE || this.scores.left >= WIN_SCORE) {
        const winner = this.scores.right >= WIN_SCORE ? 'You Win!' : 'Opponent Wins!';
        this._showMessage(winner, true);
        this._over = true;
        return;
      }

      this._pendingServe = true;
      this._resetTimer = RESET_DELAY;
    }
  }

  _updateScoreUI() {
    if (this._scoreEl.left) this._scoreEl.left.textContent = this.scores.left;
    if (this._scoreEl.right) this._scoreEl.right.textContent = this.scores.right;
  }

  _showMessage(text, persist = false) {
    if (!this._msgEl) return;
    this._msgEl.textContent = text;
    this._msgEl.style.opacity = '1';
    if (!persist) {
      clearTimeout(this._msgTimeout);
      this._msgTimeout = setTimeout(() => {
        this._msgEl.style.opacity = '0';
      }, 1200);
    }
  }
}
