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

const Battle = {
  B: null,

  start(opts) {
    const s = Game.s;
    const cul = CULTURES[opts.culture];
    const st = opts.settlement;
    const defense = !opts.ambush && st && (st.type === 'city' || st.type === 'capital') ? 1.25 : 1;
    this.B = {
      ...opts, cul, defense,
      W0: opts.warriors, W: opts.warriors,
      S0: s.soldiers, L0: s.allies,
      morale: st && st.type === 'capital' && !opts.ambush ? 120 : 100,
      round: 0, kills: 0, lost: 0, alliesLost: 0, horsesLost: 0, lines: [], done: false,
    };
    s.stats.battles++;
    Game.s.cultures[opts.culture].met = true;
    if (opts.ambush) {
      this.B.lines.push('<span class="bad">Arrows and darts rain down from cover before your men can form up!</span>');
      this.enemyStrike(1.2);
      if (s.soldiers <= 0) { this.finish(false); return; }
    }
    this.render();
  },

  enemyStrike(mult) {
    const s = Game.s, B = this.B;
    const pts = B.W * 0.03 * B.cul.t * B.defense * rand(0.7, 1.3) * mult;
    let soldierPts = pts;
    if (s.allies > 0) {
      const al = Math.min(s.allies, Math.round(pts * 0.7));
      s.allies -= al; B.alliesLost += al;
      soldierPts = pts * 0.3;
    }
    const x = soldierPts * 0.25;
    const dead = Math.min(s.soldiers, Math.floor(x) + (Math.random() < x % 1 ? 1 : 0));
    const hl = Math.min(s.horses, Math.round(dead * (s.horses / Math.max(1, s.soldiers)) * (B.lastTactic === 'charge' ? 1.6 : 0.6)));
    s.soldiers -= dead; s.horses -= hl;
    B.lost += dead; B.horsesLost += hl;
    s.stats.soldiersLost += dead;
    Game.clampArmy();
    return { dead, hl };
  },

  round(tactic) {
    const s = Game.s, B = this.B;
    if (B.done) return;
    B.round++; B.lastTactic = tactic;
    const S = s.soldiers, A = s.arquebuses, H = s.horses, C = s.cannons, L = s.allies;
    let dmg, shock = 0, enemyMult = 1;
    switch (tactic) {
      case 'volley': dmg = S * 0.3 + A * 1.0 + C * 6 + L * 0.25; shock = (A > 0 || C > 0) ? 25 * Math.min(1, (A + C * 4) / Math.max(1, S) + 0.3) : 0; break;
      case 'charge': dmg = S * 0.5 + H * 2.5 + L * 0.3; shock = H > 0 ? 22 * Math.min(1, H / 10 + 0.3) : 0; enemyMult = 1.2; break;
      case 'melee': dmg = S * 0.8 + H * 0.8 + A * 0.3 + L * 0.35; break;
      default: dmg = S * 0.35 + A * 0.6 + C * 3 + L * 0.15; enemyMult = 0.5;
    }
    shock *= Game.s.cultures[B.culture].shock;
    const kills = Math.min(B.W, Math.round(dmg * rand(0.75, 1.25)));
    B.W -= kills; B.kills += kills;
    const moraleLoss = (kills / B.W0) * 250 + shock;
    B.morale -= moraleLoss;
    const { dead, hl } = this.enemyStrike(enemyMult);
    let line = `<b>Round ${B.round}</b> — ${TACTICS[tactic].icon} ${TACTICS[tactic].name}: ${fmt(kills)} warriors fall`;
    if (shock > 8) line += ', <i>panic spreads at the noise and the beasts</i>';
    line += `. You lose ${dead} soldier${dead === 1 ? '' : 's'}`;
    if (hl) line += ` and ${hl} horse${hl === 1 ? '' : 's'}`;
    line += '.';
    B.lines.push(line);
    if (B.W <= 0 || B.morale <= 0) { this.finish(true); return; }
    if (s.soldiers <= 0) { this.finish(false); return; }
    if (s.soldiers < B.S0 * 0.3) { B.lines.push('<span class="bad">Your men break and flee!</span>'); this.finish(false); return; }
    this.render();
  },

  retreat() {
    const s = Game.s, B = this.B;
    const { dead } = this.enemyStrike(0.6);
    B.lines.push(`You sound the retreat. ${dead} soldiers are cut down covering the withdrawal.`);
    this.finish(false);
  },

  finish(won) {
    const s = Game.s, B = this.B;
    B.done = true;
    const st = B.settlement;
    s.stats.warDeaths += B.kills;
    const cs = s.cultures[B.culture];
    cs.shock = Math.max(0.15, cs.shock * 0.7); // they learn to fight horses and guns
    if (st) st.pop = Math.max(50, st.pop - B.kills);
    if (won) s.stats.won++;
    const summary = `Warriors killed: ${fmt(B.kills)} · Soldiers lost: ${B.lost}${B.horsesLost ? ` · Horses lost: ${B.horsesLost}` : ''}${B.alliesLost ? ` · Allies lost: ${fmt(B.alliesLost)}` : ''}`;
    if (s.soldiers <= 0) {
      UI.close();
      Game.gameOver('Annihilated', `Your expedition was destroyed by the ${B.cul.name}. Like Narváez and so many others, your name is soon forgotten.`);
      return;
    }
    if (won) {
      Game.log(`Victory over the ${B.cul.name}! ${summary}`, 'good');
      if (st && !B.ambush) { UI.close(); Game.conquer(st, 0); return; }
      UI.dialog('Victory', `<div class="battle-log">${B.lines.map((l) => `<p>${l}</p>`).join('')}</div><p><b>The warriors scatter.</b></p><p class="small">${summary}</p>`, [['Continue', () => UI.close()]]);
    } else {
      Game.log(`Defeat against the ${B.cul.name}. ${summary}`, 'bad');
      UI.dialog('Defeat', `<div class="battle-log">${B.lines.map((l) => `<p>${l}</p>`).join('')}</div><p><b>Your expedition falls back.</b></p><p class="small">${summary}</p>`, [['Continue', () => UI.close()]]);
    }
    UI.refresh();
  },

  render() {
    const s = Game.s, B = this.B;
    const mor = clamp(B.morale, 0, 120);
    const html = `
      <div class="battle">
        <div class="side">
          <h4>Your expedition</h4>
          <div>⚔️ Soldiers: <b>${s.soldiers}</b> / ${B.S0}</div>
          <div>🐎 Horses: <b>${s.horses}</b> · 🔫 Arquebuses: <b>${s.arquebuses}</b> · 💣 Cannon: <b>${s.cannons}</b></div>
          <div>🏹 Native allies: <b>${fmt(s.allies)}</b></div>
          <div class="bar"><div style="width:${(s.soldiers / Math.max(1, B.S0)) * 100}%;background:#c9a227"></div></div>
        </div>
        <div class="vs">VS</div>
        <div class="side">
          <h4>${B.cul.name}</h4>
          <div>Warriors: <b>${fmt(B.W)}</b> / ${fmt(B.W0)}</div>
          <div>Morale</div>
          <div class="bar"><div style="width:${(mor / 120) * 100}%;background:#b5403a"></div></div>
          <div class="small">Fear of horses & guns: ${Math.round(s.cultures[B.culture].shock * 100)}%</div>
        </div>
      </div>
      <div class="battle-log">${B.lines.slice(-6).map((l) => `<p>${l}</p>`).join('') || '<p><i>The two forces face each other. Choose your tactic.</i></p>'}</div>
      <div class="tactics">${Object.entries(TACTICS).map(([k, t]) => `<button class="tactic" data-t="${k}" title="${t.desc}"><span>${t.icon}</span>${t.name}<small>${t.desc}</small></button>`).join('')}</div>`;
    UI.dialog(`⚔️ ${B.title}`, html, [['🏳️ Retreat', () => this.retreat()]], true);
    document.querySelectorAll('.tactic').forEach((b) => b.addEventListener('click', () => this.round(b.dataset.t)));
  },
};
