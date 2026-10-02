'use strict';
// ---------------------------------------------------------------------------
// Turn-based battles between the expedition and native warriors
// ---------------------------------------------------------------------------

const TACTICS = {
  volley: { name: 'Arquebus & Cannon Volley', icon: '💥', desc: 'Gunpowder terrifies those who have never heard it. Strong with many arquebuses and cannon.' },
  charge: { name: 'Cavalry Charge', icon: '🐎', desc: 'Horses were unknown in the Americas. Devastating, but riders are exposed.' },
  melee: { name: 'Steel & Shield', icon: '⚔️', desc: 'Close combat with Toledo steel and armour. Your allies fight beside you.' },
  hold: { name: 'Hold Formation', icon: '🛡️', desc: 'Defend in tight ranks. Halves your losses but deals less damage.' },
};

// How each people makes war
const WAR_STYLES = {
  capture: {
    cultures: ['mexica', 'tlaxcala', 'purepecha', 'totonac', 'zapotec', 'mixtec'],
    note: 'They fight to seize captives alive for sacrifice. Fewer of your men die outright, but those taken are dragged away.',
    killMult: 0.75, capture: 0.4,
  },
  slings: {
    cultures: ['inca', 'canari', 'huanca'],
    note: 'Massed slingers hurl stones from a distance and throw bolas at the horses. Even a tight formation is not safe.',
    holdMult: 0.75, bolas: true,
  },
  poison: {
    cultures: ['kalinago', 'calusa', 'apalachee', 'cumanagoto', 'tupi', 'omagua', 'tairona'],
    note: 'Their arrows are tipped with poison. Wounds fester, and many wounded men will not recover.',
    woundDeath: 0.6,
  },
  pikes: {
    cultures: ['mapuche'],
    note: 'They meet horsemen with long pikes and fight in disciplined squadrons, replacing tired warriors with fresh ones.',
    chargeMult: 0.55, horseLoss: 2, fresh: true,
  },
  default: { cultures: [], note: 'They fight with spears, clubs, bows and darts thrown from atlatls.' },
};
function warStyle(culture) {
  for (const st of Object.values(WAR_STYLES)) if (st.cultures.includes(culture)) return st;
  return WAR_STYLES.default;
}

function battleGround(t, inTown) {
  if (inTown) return { name: 'streets and plazas', note: 'Fighting among houses and temples. Horses cannot manoeuvre and the defenders know every street.', cav: 0.65, arq: 1, enemy: 1.1 };
  switch (t) {
    case TT.GRASS: case TT.SAVANNA: case TT.STEPPE: case TT.DESERT:
      return { name: 'open ground', note: 'Flat open country, ideal for cavalry.', cav: 1.3, arq: 1, enemy: 1 };
    case TT.FOREST: return { name: 'forest', note: 'Trees break up your formation and slow the horses.', cav: 0.8, arq: 0.9, enemy: 1.05 };
    case TT.JUNGLE: return { name: 'jungle', note: 'Dense, humid jungle. Horses flounder, powder grows damp, and the enemy strikes from cover.', cav: 0.5, arq: 0.75, enemy: 1.15, rain: 0.3 };
    case TT.MOUNTAIN: return { name: 'mountain slopes', note: 'The defenders hold the heights. Horses struggle on the steep ground and your men gasp in the thin air.', cav: 0.5, arq: 1, enemy: 1.2 };
    case TT.RIVER: return { name: 'river crossing', note: 'Wading through the shallows, your men are slow and exposed.', cav: 0.7, arq: 0.85, enemy: 1.15 };
    default: return { name: 'the shore', note: 'A beach with your ship behind you.', cav: 0.9, arq: 1, enemy: 1 };
  }
}

const Battle = {
  B: null,

  start(opts) {
    const s = Game.s;
    const cul = CULTURES[opts.culture];
    const st = opts.settlement;
    const inTown = !opts.ambush && !!st;
    const where = s.party || (st ? { x: st.x, y: st.y } : s.ship);
    const ground = battleGround(World.t(where.x, where.y), inTown);
    const defense = inTown && (st.type === 'city' || st.type === 'capital') ? 1.25 : 1;
    this.B = {
      ...opts, cul, defense, ground, style: warStyle(opts.culture),
      W0: opts.warriors, W: opts.warriors,
      S0: s.soldiers, L0: s.allies,
      morale: st && st.type === 'capital' && inTown ? 120 : 100,
      round: 0, kills: 0, lost: 0, captured: 0, wounded: 0, alliesLost: 0, horsesLost: 0,
      chiefDown: false, lines: [], done: false, lastTactic: null,
    };
    s.stats.battles++;
    s.cultures[opts.culture].met = true;
    if (opts.intro) this.B.lines.push(`<span class="good">${opts.intro}</span>`);
    if (opts.ambush) {
      this.B.lines.push('<span class="bad">Arrows and darts rain down from cover before your men can form up!</span>');
      this.enemyStrike(1.2);
      if (s.soldiers <= 0) { this.finish(false); return; }
    }
    this.render();
  },

  // the enemy's attack: returns soldiers killed, wounded, captured and horses lost
  enemyStrike(mult) {
    const s = Game.s, B = this.B, sty = B.style;
    let pts = B.W * 0.03 * B.cul.t * B.defense * B.ground.enemy * rand(0.7, 1.3) * mult;
    if (sty.fresh && B.round > 2) pts *= 1.1; // fresh squadrons rotate in
    let soldierPts = pts;
    const natives = s.allies + s.auxiliaries;
    if (natives > 0) {
      const al = Math.min(natives, Math.round(pts * 0.7));
      const fromAllies = Math.min(s.allies, Math.round(al * (s.allies / natives)));
      s.allies -= fromAllies; s.auxiliaries -= al - fromAllies;
      B.alliesLost += al;
      soldierPts = pts * 0.3;
    }
    // steel armour turns most blows: only some hits strike home
    const x = soldierPts * 0.3;
    let hits = Math.min(s.soldiers, Math.floor(x) + (Math.random() < x % 1 ? 1 : 0));
    let dead = Math.round(hits * 0.55 * (sty.killMult || 1));
    let captured = 0;
    if (sty.capture) { captured = Math.round(hits * sty.capture * 0.5); }
    dead = Math.min(dead, hits);
    captured = Math.min(captured, hits - dead);
    const wounded = hits - dead - captured;
    let horseFactor = B.lastTactic === 'charge' ? 1.6 : 0.6;
    if (B.lastTactic === 'charge' && sty.horseLoss) horseFactor *= sty.horseLoss;
    if (B.lastTactic === 'charge' && sty.bolas) horseFactor *= 1.5;
    const hl = Math.min(s.horses, Math.round((dead + wounded) * (s.horses / Math.max(1, s.soldiers)) * horseFactor));
    s.soldiers -= hits; s.horses -= hl;
    B.lost += dead + captured; B.captured += captured; B.wounded += wounded; B.horsesLost += hl;
    s.stats.soldiersLost += dead + captured;
    Game.clampArmy();
    return { dead, wounded, captured, hl };
  },

  round(tactic) {
    const s = Game.s, B = this.B, g = B.ground, sty = B.style;
    if (B.done) return;
    B.round++;
    const repeatVolley = tactic === 'volley' && B.lastTactic === 'volley';
    B.lastTactic = tactic;
    const S = s.soldiers, H = s.horses, C = s.cannons, L = s.allies + s.auxiliaries;
    let A = Math.min(s.arquebuses, S);
    const events = [];
    let dmg, shock = 0, enemyMult = 1;
    // fatigue: armour is heavy and the sun is hot
    const fatigue = Math.max(0.6, 1 - 0.07 * (B.round - 1));
    if (tactic === 'volley') {
      let arq = A * 1.0 * g.arq, can = C * 6;
      if (g.rain && Math.random() < g.rain) { arq *= 0.4; can *= 0.5; events.push('<i>A downpour soaks the powder. Half the arquebuses misfire.</i>'); }
      if (repeatVolley) { arq *= 0.55; can *= 0.55; events.push('<i>Smoke hangs over the field. Your arquebusiers struggle to reload.</i>'); }
      dmg = S * 0.3 + arq + can + L * 0.25;
      shock = (A > 0 || C > 0) ? 25 * Math.min(1, (A + C * 4) / Math.max(1, S) + 0.3) : 0;
      if (repeatVolley) shock *= 0.5;
    } else if (tactic === 'charge') {
      const cav = g.cav * (sty.chargeMult || 1);
      dmg = S * 0.5 + H * 2.5 * cav + L * 0.3;
      shock = H > 0 ? 22 * Math.min(1, H / 10 + 0.3) * Math.min(1, cav) : 0;
      enemyMult = 1.2;
      if (sty.chargeMult && H > 0) events.push('<i>A hedge of long pikes meets your riders.</i>');
      else if (g.cav < 0.7 && H > 0) events.push(`<i>The horses flounder in the ${g.name}.</i>`);
    } else if (tactic === 'melee') {
      dmg = S * 0.8 + H * 0.8 * g.cav + A * 0.3 + L * 0.35;
    } else {
      dmg = S * 0.35 + A * 0.6 * g.arq + C * 3 + L * 0.15;
      enemyMult = sty.holdMult || 0.5;
      if (sty.holdMult) events.push('<i>Sling-stones rattle off helmets and shields.</i>');
    }
    dmg *= fatigue;
    shock *= s.cultures[B.culture].shock;
    const kills = Math.min(B.W, Math.round(dmg * rand(0.75, 1.25)));
    B.W -= kills; B.kills += kills;
    B.morale -= (kills / B.W0) * 250 + shock;
    // a war leader may fall
    if (!B.chiefDown && B.W > 0) {
      const p = 0.06 + (tactic === 'charge' && H > 0 ? 0.1 : 0) + (tactic === 'volley' && C > 0 ? 0.05 : 0);
      if (Math.random() < p) {
        B.chiefDown = true; B.morale -= 30;
        events.push('<span class="good">Their war leader is struck down! His standard falls and the ranks waver.</span>');
      }
    }
    const { dead, wounded, captured, hl } = this.enemyStrike(enemyMult);
    let line = `<b>Round ${B.round}</b> — ${TACTICS[tactic].icon} ${TACTICS[tactic].name}: ${fmt(kills)} warriors fall`;
    if (shock > 8) line += ', <i>panic spreads at the noise and the beasts</i>';
    line += `. You lose ${dead} soldier${dead === 1 ? '' : 's'}`;
    if (hl) line += ` and ${hl} horse${hl === 1 ? '' : 's'}`;
    line += '.';
    if (wounded) line += ` ${wounded} more ${wounded === 1 ? 'is' : 'are'} wounded.`;
    if (captured) line += ` <span class="bad">${captured} ${captured === 1 ? 'is' : 'are'} dragged away alive.</span>`;
    B.lines.push(line, ...events);
    if (fatigue <= 0.75 && B.round === 5) B.lines.push('<i>Your men are exhausted in their heavy armour.</i>');
    if (B.W <= 0 || B.morale <= 0) { this.finish(true); return; }
    if (s.soldiers <= 0) { this.finish(false); return; }
    if (s.soldiers < B.S0 * 0.3) { B.lines.push('<span class="bad">Your men break and flee!</span>'); this.finish(false); return; }
    this.render();
  },

  retreat() {
    const B = this.B;
    const { dead } = this.enemyStrike(0.6);
    B.lines.push(`You sound the retreat. ${dead} soldiers are cut down covering the withdrawal.`);
    this.finish(false);
  },

  finish(won) {
    const s = Game.s, B = this.B;
    B.done = true;
    const st = B.settlement;
    // cavalry ride down a broken enemy
    if (won && s.horses > 0 && B.W > 0) {
      const rout = Math.min(B.W, Math.round(s.horses * 3 * B.ground.cav * rand(0.7, 1.3)));
      if (rout > 0) { B.kills += rout; B.W -= rout; B.lines.push(`Your horsemen ride down the fleeing warriors: ${fmt(rout)} more fall.`); }
    }
    // the wounded: some recover, some die. A beaten army leaves some behind.
    const deathRate = Math.max(0.05, (B.style.woundDeath || 0.2) + (won ? 0 : 0.25) - (s.priests > 0 ? 0.05 : 0));
    const woundDead = Math.round(B.wounded * deathRate);
    const recovered = B.wounded - woundDead;
    s.soldiers += recovered;
    B.lost += woundDead; s.stats.soldiersLost += woundDead;
    Game.clampArmy();
    s.stats.warDeaths += B.kills;
    const cs = s.cultures[B.culture];
    cs.shock = Math.max(0.15, cs.shock * 0.7); // they learn to fight horses and guns
    if (st) st.pop = Math.max(50, st.pop - B.kills);
    if (won) s.stats.won++;
    if (B.onFinish) B.onFinish(won);
    let woundNote = '';
    if (B.wounded) woundNote = `<p>Of your ${B.wounded} wounded, ${recovered} recover${recovered === 1 ? 's' : ''} under the surgeon's care${woundDead ? ` and ${woundDead} die${woundDead === 1 ? 's' : ''} of ${B.style.woundDeath ? 'poisoned wounds' : 'their wounds'}${won ? '' : ' or are left behind'}` : ''}.</p>`;
    const summary = `Warriors killed: ${fmt(B.kills)} · Soldiers lost: ${B.lost}${B.captured ? ` (${B.captured} taken captive)` : ''}${B.horsesLost ? ` · Horses lost: ${B.horsesLost}` : ''}${B.alliesLost ? ` · Allies lost: ${fmt(B.alliesLost)}` : ''}`;
    if (s.soldiers <= 0) {
      UI.close();
      Game.gameOver('Annihilated', `Your expedition was destroyed by the ${B.cul.name}. Like Narváez and so many others, your name is soon forgotten.`);
      return;
    }
    const log = `<div class="battle-log">${B.lines.map((l) => `<p>${l}</p>`).join('')}</div>`;
    if (won) {
      Game.log(`Victory over the ${B.cul.name}! ${summary}`, 'good');
      if (st && !B.ambush) {
        UI.dialog('Victory', `${log}<p><b>The defenders' resistance collapses.</b></p>${woundNote}<p class="small">${summary}</p>`, [['Enter the city', () => { UI.close(); Game.conquer(st, 0); }]], true);
        UI.refresh();
        return;
      }
      UI.dialog('Victory', `${log}<p><b>The warriors scatter.</b></p>${woundNote}<p class="small">${summary}</p>`, [['Continue', () => UI.close()]]);
    } else {
      Game.log(`Defeat against the ${B.cul.name}. ${summary}`, 'bad');
      UI.dialog('Defeat', `${log}<p><b>Your expedition falls back.</b></p>${woundNote}<p class="small">${summary}</p>`, [['Continue', () => UI.close()]]);
    }
    UI.refresh();
  },

  render() {
    const s = Game.s, B = this.B;
    const mor = clamp(B.morale, 0, 120);
    const fatigue = Math.round(Math.max(0.6, 1 - 0.07 * B.round) * 100);
    const html = `
      <p class="small"><b>Battlefield: ${B.ground.name}.</b> ${B.ground.note}</p>
      <div class="battle">
        <div class="side">
          <h4>Your expedition</h4>
          <div>⚔️ Soldiers: <b>${s.soldiers}</b> / ${B.S0}${B.wounded ? ` <span class="small">(${B.wounded} wounded out of the fight)</span>` : ''}</div>
          <div>🐎 Horses: <b>${s.horses}</b> · 🔫 Arquebuses: <b>${s.arquebuses}</b> · 💣 Cannon: <b>${s.cannons}</b></div>
          <div>🏹 Native allies: <b>${fmt(s.allies)}</b> · 🪶 Auxiliaries: <b>${fmt(s.auxiliaries)}</b></div>
          <div class="bar"><div style="width:${(s.soldiers / Math.max(1, B.S0)) * 100}%;background:#c9a227"></div></div>
          <div class="small">Strength of your men: ${fatigue}%</div>
        </div>
        <div class="vs">VS</div>
        <div class="side">
          <h4>${B.cul.name}</h4>
          <div>Warriors: <b>${fmt(B.W)}</b> / ${fmt(B.W0)}</div>
          <div>Morale</div>
          <div class="bar"><div style="width:${(mor / 120) * 100}%;background:#b5403a"></div></div>
          <div class="small">Fear of horses & guns: ${Math.round(s.cultures[B.culture].shock * 100)}%</div>
          <div class="small"><i>${B.style.note}</i></div>
        </div>
      </div>
      <div class="battle-log">${B.lines.slice(-8).map((l) => `<p>${l}</p>`).join('') || '<p><i>The two forces face each other. Choose your tactic.</i></p>'}</div>
      <div class="tactics">${Object.entries(TACTICS).map(([k, t]) => `<button class="tactic" data-t="${k}" title="${t.desc}"><span>${t.icon}</span>${t.name}<small>${t.desc}</small></button>`).join('')}</div>`;
    UI.dialog(`⚔️ ${B.title}`, html, [['🏳️ Retreat', () => this.retreat()]], true);
    document.querySelectorAll('.tactic').forEach((b) => b.addEventListener('click', () => this.round(b.dataset.t)));
    const bl = document.querySelector('.battle-log'); if (bl) bl.scrollTop = bl.scrollHeight;
  },
};
