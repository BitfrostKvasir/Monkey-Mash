import * as THREE from 'three';

const _active = [];
let _container = null;
let _classColor = '#ffffff';

const _vec = new THREE.Vector3();

export function initDamageNumbers(container) {
  _container = container;
}

export function setDmgNumColor(cssColor) {
  _classColor = cssColor;
}

export function spawnDmgNum(amount, worldPos, isCrit = false) {
  if (!_container) return;
  const rounded = Math.round(amount);
  if (rounded <= 0) return;

  const el = document.createElement('div');
  el.className = 'dmg-num' + (isCrit ? ' dmg-crit' : '');
  el.textContent = isCrit ? '!' + rounded : rounded;
  el.style.setProperty('--dmg-color', _classColor);
  _container.appendChild(el);

  _active.push({
    el,
    wx: worldPos.x,
    wy: worldPos.y + 1.4,
    wz: worldPos.z,
    age: 0,
    dur: isCrit ? 1.1 : 0.8,
    isCrit,
  });
}

export function updateDmgNums(dt, camera) {
  if (!_container || _active.length === 0) return;

  const W = window.innerWidth;
  const H = window.innerHeight;

  for (let i = _active.length - 1; i >= 0; i--) {
    const d = _active[i];
    d.age += dt;

    // World → screen with upward drift
    _vec.set(d.wx, d.wy + d.age * 1.8, d.wz);
    _vec.project(camera);

    const sx = (_vec.x * 0.5 + 0.5) * W;
    const sy = (-_vec.y * 0.5 + 0.5) * H;

    const t     = d.age / d.dur;
    const alpha = Math.max(0, 1 - t * 1.4).toFixed(2);
    const pop   = t < 0.12 ? (0.3 + t / 0.12 * 0.7) : 1.0;
    const scale = (d.isCrit ? 1.0 + t * 0.25 : 1.0) * pop;

    d.el.style.left      = sx + 'px';
    d.el.style.top       = sy + 'px';
    d.el.style.opacity   = alpha;
    d.el.style.transform = `translate(-50%,-50%) scale(${scale.toFixed(2)})`;

    if (d.age >= d.dur) {
      _container.removeChild(d.el);
      _active.splice(i, 1);
    }
  }
}
