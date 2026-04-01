import { ThunderPrimateEpic, BananaBarrageEpic, PrimalFuryEpic, TimeEchoEpic, MonkeyMeteorEpic } from './epic-abilities.js';

export const UPGRADES = [
  // ── Generic — Cost 1 ─────────────────────────────────────────────
  { id:'dmg1',      cost:1, label:'+15% Damage',      icon:'⚔️',  desc:'Your attacks hit harder.',
    apply: p => { p.stats.damageMult += 0.15; } },
  { id:'spd1',      cost:1, label:'+8% Speed',         icon:'💨',  desc:'Move through the arena faster.',
    apply: p => { p.stats.speedMult  += 0.08; } },
  { id:'dashcd1',   cost:1, label:'Quick Dash',         icon:'🌀',  desc:'Dash cooldown reduced by 15%.',
    apply: p => { p.stats.dashCdMult = Math.max(0.2, p.stats.dashCdMult - 0.15); } },
  { id:'hp1',       cost:1, label:'+15 Max HP',         icon:'❤️',  desc:'Toughen up your monkey.',
    apply: p => { p.stats.bonusMaxHp += 15; p.hp = Math.min(p.hp + 15, p.maxHp); } },
  { id:'bananacure',cost:1, label:'Banana Cure',        icon:'🍌',  desc:'Every 20 bananas collected heals 3% max HP.',
    apply: p => { p.stats.bananaCure = (p.stats.bananaCure || 0) + 1; } },
  { id:'kb1',       cost:1, label:'More Knockback',     icon:'💥',  desc:'Send enemies flying further.',
    apply: p => { p.stats.knockbackMult += 0.4; } },

  // ── Generic — Cost 2 ─────────────────────────────────────────────
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

  // ── Generic — Cost 3 ─────────────────────────────────────────────
  { id:'lifesteal', cost:3, noStack:true, label:'Lifesteal', icon:'🩸', desc:'Attacks heal 5% of damage dealt.',
    apply: p => { p.stats.lifesteal += 0.05; } },
  { id:'chain',     cost:3, label:'Chain Hit',          icon:'⛓️',  desc:'Hits chain to nearest other enemy for 50% damage.',
    apply: p => { p.stats.chain = true; } },
  { id:'bananade',  cost:3, label:'Bananade',           icon:'🍌',  desc:'Collecting bananas explodes for 20 damage nearby.',
    apply: p => { p.stats.bananaExplosion = true; } },
  { id:'dashdmg',   cost:3, label:'Dash Damage',        icon:'🌪️',  desc:'Dash deals 30 damage at start and end.',
    apply: p => { p.stats.dashDmgHeavy = true; } },
  { id:'double',    cost:3, label:'Double Strike',      icon:'✌️',  desc:'Every 5th attack hits twice instantly.',
    apply: p => { p.stats.doubleStrike = true; } },

  // ── Brawler — Cost 1 ─────────────────────────────────────────────
  { id:'b_heavy',   cost:1, classes:['brawler'], label:'Heavy Knuckles', icon:'🦴',
    desc:'3rd combo hit deals +15% damage and knocks back harder.',
    apply: p => { p.stats.brawlerHeavyKnuckles = true; } },

  // ── Brawler — Cost 2 ─────────────────────────────────────────────
  { id:'b_adrenaline', cost:2, classes:['brawler'], label:'Adrenaline Rush', icon:'💉',
    desc:'Taking damage boosts your speed by 30% for 2 seconds.',
    apply: p => { p.stats.brawlerAdrenaline = true; } },
  { id:'b_shockwave',  cost:2, classes:['brawler'], label:'Ground Slam', icon:'🌋',
    desc:'3rd combo hit sends a shockwave that slows all nearby enemies.',
    apply: p => { p.stats.brawlerShockwave = true; } },

  // ── Brawler — Cost 3 ─────────────────────────────────────────────
  { id:'b_lifesteal',  cost:3, noStack:true, classes:['brawler'], label:'Lifesteal Strikes', icon:'🩸',
    desc:'Attacks heal 3% of all damage dealt.',
    apply: p => { p.stats.lifesteal += 0.03; } },
  { id:'b_rage',       cost:3, classes:['brawler'], label:'Extended Rage', icon:'🔥',
    desc:'Rage Mode lasts 2 extra seconds and deals 10% more damage.',
    apply: p => { p.stats.brawlerRageDurationBonus += 2; p.stats.brawlerRageDmgBonus += 0.10; } },

  // ── Slinger — Cost 1 ─────────────────────────────────────────────
  { id:'s_sharp',  cost:1, classes:['slinger'], label:'Sharpened Bananas', icon:'🍌',
    desc:'+20% projectile damage.',
    apply: p => { p.stats.damageMult += 0.20; } },

  // ── Slinger — Cost 2 ─────────────────────────────────────────────
  { id:'s_split',  cost:2, classes:['slinger'], label:'Split Shot', icon:'🍃',
    desc:'Each attack fires 2 bananas in a slight spread.',
    apply: p => { p.stats.slingerSplitShot = true; } },
  { id:'s_pierce', cost:2, classes:['slinger'], label:'Piercing Toss', icon:'📌',
    desc:'Projectiles pierce through the first enemy they hit.',
    apply: p => { p.stats.slingerPierce = true; } },

  // ── Slinger — Cost 3 ─────────────────────────────────────────────
  { id:'s_barrage',cost:3, classes:['slinger'], label:'Banana Barrage', icon:'🌩️',
    desc:'Rapid Volley fires 3 additional bananas.',
    apply: p => { p.stats.slingerVolleyBonus += 3; } },
  { id:'s_critaim',cost:3, classes:['slinger'], label:'Critical Aim', icon:'🎯',
    desc:'+30% crit chance. Critical hits leave enemies slowed for 1 second.',
    apply: p => { p.stats.critChance += 0.30; p.stats.slingerCritSlow = true; } },

  // ── Trickster — Cost 1 ───────────────────────────────────────────
  { id:'t_spin',   cost:1, classes:['trickster'], label:'Extended Spin', icon:'🌀',
    desc:'Tail Whip range increased by 30%.',
    apply: p => { p.stats.rangeMult += 0.30; } },

  // ── Trickster — Cost 2 ───────────────────────────────────────────
  { id:'t_burst',  cost:2, classes:['trickster'], label:'Decoy Burst', icon:'💣',
    desc:'When your decoy expires it explodes for 25 damage.',
    apply: p => { p.stats.tricksterDecoyBurst = true; } },
  { id:'t_momentum',cost:2,classes:['trickster'], label:'Momentum Boost', icon:'⚡',
    desc:'After teleporting, gain 50% speed for 2 seconds.',
    apply: p => { p.stats.tricksterMomentumBoost = true; } },

  // ── Trickster — Cost 3 ───────────────────────────────────────────
  { id:'t_quickswap',cost:3,classes:['trickster'], label:'Quick Swap', icon:'🎭',
    desc:'Decoy Swap cooldown reduced by 3 seconds.',
    apply: p => { p.stats.tricksterDecoyCdBonus -= 3; } },
  { id:'t_confuse',cost:3, classes:['trickster'], label:'Confusion Tactics', icon:'😵',
    desc:'Enemies hit by Tail Whip have a 25% chance to be confused for 2 seconds.',
    apply: p => { p.stats.tricksterConfusion = true; } },

  // ── Epic — Cost 6-7 ──────────────────────────────────────────────
  { id:'epic_thunder', cost:6, epic:true, label:'Thunder Primate', icon:'🌩️',
    desc:'Call a 4-unit lightning strike at your cursor. Stuns and slows all enemies hit.',
    apply: p => { p._epic = new ThunderPrimateEpic(p); } },
  { id:'epic_barrage', cost:7, epic:true, label:'Banana Barrage', icon:'🍌',
    desc:'Rain 6-8 explosive bananas across the arena, each dealing 20 damage.',
    apply: p => { p._epic = new BananaBarrageEpic(p); } },
  { id:'epic_fury',    cost:6, epic:true, label:'Primal Fury', icon:'🔥',
    desc:'+50% damage and faster attacks for 10s. Attacks emit mini shockwaves.',
    apply: p => { p._epic = new PrimalFuryEpic(p); } },
  { id:'epic_echo',    cost:7, epic:true, label:'Time-Swap Echo', icon:'👥',
    desc:'A blue clone mirrors your attacks at 50% damage for 5 seconds.',
    apply: p => { p._epic = new TimeEchoEpic(p); } },
  { id:'epic_meteor',  cost:6, epic:true, label:'Monkey Meteor', icon:'☄️',
    desc:'Strike a 6×2 unit line for 65 damage. Slows and confuses all enemies hit.',
    apply: p => { p._epic = new MonkeyMeteorEpic(p); } },
];

export function generateOffers(playerBananas, roomNum = 1, playerClass = 'brawler', isBossRoom = false, hasEpic = false, purchasedIds = []) {
  const eligible = u =>
    !u.epic &&
    (!u.classes || u.classes.includes(playerClass)) &&
    !(u.noStack && purchasedIds.includes(u.id));
  const t1       = UPGRADES.filter(u => u.cost === 1 && eligible(u));
  const t2       = UPGRADES.filter(u => u.cost === 2 && eligible(u));
  const t3       = UPGRADES.filter(u => u.cost === 3 && eligible(u));
  // Class-specific cost-3 upgrades for boss room guarantee
  const t3class  = UPGRADES.filter(u => u.cost === 3 && u.classes && u.classes.includes(playerClass));
  const pick     = arr => arr[Math.floor(Math.random() * arr.length)];

  const offers = [];
  const addUnique = (candidate, fallbackPool) => {
    if (!offers.find(o => o.id === candidate.id)) {
      offers.push(candidate);
    } else {
      const alt = fallbackPool.find(u => !offers.find(o => o.id === u.id));
      offers.push(alt ?? candidate);
    }
  };

  addUnique(pick(t1), t1);
  addUnique(pick(t2), t2);

  if (isBossRoom && t3class.length > 0) {
    // Boss room: guarantee a class-specific rare upgrade
    addUnique(pick(t3class), t3);
  } else {
    const highChance = Math.min(0.25 + roomNum * 0.06, 0.65);
    addUnique(Math.random() < highChance ? pick(t3) : pick(t2), t2);
  }

  // 4th slot: epic ability, unlocked after wave 9, only if none purchased yet
  if (roomNum >= 10 && !hasEpic) {
    const epics = UPGRADES.filter(u => u.epic === true);
    if (epics.length > 0) offers.push(pick(epics));
  }

  return offers;
}
