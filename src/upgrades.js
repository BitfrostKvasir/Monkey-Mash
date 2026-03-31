export const UPGRADES = [
  // Cost 1 — Common
  { id:'dmg1',      cost:1, label:'+15% Damage',      icon:'⚔️',  desc:'Your attacks hit harder.',
    apply: p => { p.stats.damageMult += 0.15; } },
  { id:'spd1',      cost:1, label:'+8% Speed',         icon:'💨',  desc:'Move through the arena faster.',
    apply: p => { p.stats.speedMult  += 0.08; } },
  { id:'dashcd1',   cost:1, label:'Quick Dash',         icon:'🌀',  desc:'Dash cooldown reduced by 15%.',
    apply: p => { p.stats.dashCdMult = Math.max(0.2, p.stats.dashCdMult - 0.15); } },
  { id:'hp1',       cost:1, label:'+15 Max HP',         icon:'❤️',  desc:'Toughen up your monkey.',
    apply: p => { p.stats.bonusMaxHp += 15; p.hp = Math.min(p.hp + 15, p.maxHp); } },
  { id:'kb1',       cost:1, label:'More Knockback',     icon:'💥',  desc:'Send enemies flying further.',
    apply: p => { p.stats.knockbackMult += 0.4; } },

  // Cost 2 — Uncommon
  { id:'atkspd',    cost:2, label:'+25% Attack Speed', icon:'🥊',  desc:'Strike much faster.',
    apply: p => { p.stats.atkCdMult = Math.max(0.3, p.stats.atkCdMult - 0.25); } },
  { id:'crit',      cost:2, label:'Critical Strikes',  icon:'💢',  desc:'+20% crit chance — crits deal 2× damage.',
    apply: p => { p.stats.critChance += 0.20; } },
  { id:'wide',      cost:2, label:'Wide Swing',         icon:'🌊',  desc:'Attack arc is 50% wider.',
    apply: p => { p.stats.arcMult   += 0.50; } },
  { id:'reach',     cost:2, label:'Long Reach',         icon:'📏',  desc:'Attack range increased by 40%.',
    apply: p => { p.stats.rangeMult  += 0.40; } },
  { id:'dashstrike',cost:2, label:'Dash Strike',        icon:'⚡',  desc:'Dashing through enemies deals 15 damage.',
    apply: p => { p.stats.dashDmgLight = true; } },

  // Cost 3 — Rare
  { id:'lifesteal', cost:3, label:'Lifesteal',          icon:'🩸',  desc:'Attacks heal 20% of damage dealt.',
    apply: p => { p.stats.lifesteal += 0.20; } },
  { id:'chain',     cost:3, label:'Chain Hit',          icon:'⛓️',  desc:'Hits chain to nearest other enemy for 50% damage.',
    apply: p => { p.stats.chain = true; } },
  { id:'bananade',  cost:3, label:'Bananade',           icon:'🍌',  desc:'Collecting bananas explodes for 20 damage nearby.',
    apply: p => { p.stats.bananaExplosion = true; } },
  { id:'dashdmg',   cost:3, label:'Dash Damage',        icon:'🌪️',  desc:'Dash deals 30 damage at start and end.',
    apply: p => { p.stats.dashDmgHeavy = true; } },
  { id:'double',    cost:3, label:'Double Strike',      icon:'✌️',  desc:'Every 5th attack hits twice instantly.',
    apply: p => { p.stats.doubleStrike = true; } },
];

export function generateOffers(playerBananas, roomNum = 1) {
  const t1 = UPGRADES.filter(u => u.cost === 1);
  const t2 = UPGRADES.filter(u => u.cost === 2);
  const t3 = UPGRADES.filter(u => u.cost === 3);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  const offers = [];
  const addUnique = (candidate, fallbackPool) => {
    if (!offers.find(o => o.id === candidate.id)) {
      offers.push(candidate);
    } else {
      const alt = fallbackPool.find(u => !offers.find(o => o.id === u.id));
      offers.push(alt ?? candidate);
    }
  };

  addUnique(pick(t1), t1);                                            // slot 1: always affordable
  addUnique(pick(t2), t2);                                            // slot 2: mid-tier
  const highChance = Math.min(0.25 + roomNum * 0.06, 0.65);
  addUnique(Math.random() < highChance ? pick(t3) : pick(t2), t2);   // slot 3: mid or rare

  return offers.slice(0, 3);
}
