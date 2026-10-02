'use strict';
// ---------------------------------------------------------------------------
// Native peoples strike back: war parties on the map, raids on colonies,
// counter-offensives after a city falls, and colonial revolts.
// ---------------------------------------------------------------------------

const Raids = {
  MAX_PARTIES: 5,

  list() {
    const s = Game.s;
    if (!s.warParties) s.warParties = [];
    return s.warParties;
  },
  at(x, y) { return this.list().find((w) => w.x === x && w.y === y) || null; },
  targetName(w) {
    if (w.target.kind === 'party') return 'your expedition';
    const st = Game.s.settlements[w.target.id];
    return st ? st.name : 'your lands';
  },
  lostTowns(culture) { return Game.s.settlements.filter((st) => st.culture === culture && st.conquered).length; },

  // ---------------------------------------------------------------- spawning
  monthly() {
    const s = Game.s;
    if (this.list().length >= this.MAX_PARTIES) return;
    for (const [id, cs] of Object.entries(s.cultures)) {
      if (cs.rel > -30 || this.list().length >= this.MAX_PARTIES) continue;
      if (this.list().some((w) => w.culture === id)) continue; // one at a time per people
      const lost = this.lostTowns(id);
      const p = Math.min(0.45, 0.06 + 0.05 * lost + (cs.rel <= -60 ? 0.08 : 0));
      if (Math.random() >= p) continue;
      this.launch(id, null, rand(0.25, 0.45));
    }
    this.revolts();
  },

  // find a target for a people: a colony (preferably one taken from them) or the expedition
  pickTarget(culture, src) {
    const s = Game.s;
    const comp = World.landComp[World.idx(src.x, src.y)];
    let best = null, bd = 32;
    for (const st of Game.colonies()) {
      if (World.landComp[World.idx(st.x, st.y)] !== comp) continue;
      const d = Math.hypot(st.x - src.x, st.y - src.y) * (st.culture === culture ? 0.6 : 1);
      if (d < bd) { bd = d; best = { kind: 'colony', id: st.id }; }
    }
    if (s.party && World.landComp[World.idx(s.party.x, s.party.y)] === comp) {
      const d = Math.hypot(s.party.x - src.x, s.party.y - src.y);
      if (d < 22 && d < bd) best = { kind: 'party' };
    }
    return best;
  },

  // launch a war party from the people's strongest town in reach
  launch(culture, targetSt, frac, counter) {
    const s = Game.s;
    let src = null, target = null, bestW = 0;
    for (const st of s.settlements) {
      if (st.culture !== culture || st.conquered) continue;
      const t = targetSt ? { kind: 'colony', id: targetSt.id } : this.pickTarget(culture, st);
      if (!t) continue;
      if (targetSt && (World.landComp[World.idx(st.x, st.y)] !== World.landComp[World.idx(targetSt.x, targetSt.y)] || Math.hypot(st.x - targetSt.x, st.y - targetSt.y) > 32)) continue;
      const w = Game.warriors(st);
      if (w > bestW) { bestW = w; src = st; target = t; }
    }
    if (!src || bestW < 20) return null;
    const warriors = Math.max(20, Math.round(bestW * frac));
    src.pop = Math.max(50, src.pop - Math.round(warriors * 0.2)); // some never come home
    s.nextWp = (s.nextWp || 0) + 1;
    const w = { id: s.nextWp, culture, from: src.id, x: src.x, y: src.y, warriors, target, budget: 0, path: null, dir: 1, counter: !!counter };
    this.list().push(w);
    const visible = Game.isExplored(src.x, src.y);
    const msg = `${counter ? 'COUNTER-OFFENSIVE! ' : ''}A war party of ${fmt(warriors)} ${CULTURES[culture].name} warriors marches from ${src.name} against ${this.targetName(w)}!`;
    Game.log(msg, 'bad');
    if (visible) UI.toast(msg);
    return w;
  },

  // after a city or capital falls, its people may strike back at once
  counterOffensive(st) {
    if (st.type !== 'city' && st.type !== 'capital') return;
    if (Math.random() > (st.type === 'capital' ? 0.8 : 0.5)) return;
    // the people gather warriors from several towns
    const total = Game.s.settlements.filter((o) => o.culture === st.culture && !o.conquered && Math.hypot(o.x - st.x, o.y - st.y) < 30)
      .reduce((a, o) => a + Game.warriors(o), 0);
    if (total < 100) return;
    const w = this.launch(st.culture, st, 0.4, true);
    if (w) w.warriors = Math.max(w.warriors, Math.round(total * 0.3));
  },

  // ---------------------------------------------------------------- movement
  targetPos(w) {
    const s = Game.s;
    if (w.target.kind === 'party') return s.party ? { x: s.party.x, y: s.party.y } : null;
    const st = s.settlements[w.target.id];
    return st && st.conquered ? { x: st.x, y: st.y } : null;
  },

  advance(days) {
    const s = Game.s;
    for (const w of this.list().slice()) {
      let goal = this.targetPos(w);
      if (!goal) {
        // the expedition sailed away or the colony is gone: look for another target or go home
        const t = this.pickTarget(w.culture, w);
        if (!t) { this.remove(w); Game.log(`The ${CULTURES[w.culture].name} war party returns home.`, ''); continue; }
        w.target = t; w.path = null; goal = this.targetPos(w);
      }
      w.budget += days;
      let guard = 0;
      while (guard++ < 60) {
        if (Math.max(Math.abs(w.x - goal.x), Math.abs(w.y - goal.y)) <= 1) { this.arrive(w); break; }
        const end = w.path && w.path[w.path.length - 1];
        if (!w.path || !w.path.length || !end || end.x !== goal.x || end.y !== goal.y) {
          w.path = World.findPath(w.x, w.y, goal.x, goal.y, (x, y) => World.landOK(x, y), (x, y) => Game.landCost(x, y), 20000);
          if (!w.path || !w.path.length) { this.remove(w); break; }
        }
        const next = w.path[0];
        const cost = (TERRAIN[World.t(next.x, next.y)].cost || 2) * 0.8; // they know the land
        if (w.budget < cost) break;
        w.budget -= cost;
        w.path.shift();
        if (next.x !== w.x) w.dir = Math.sign(next.x - w.x);
        w.fx = w.x; w.fy = w.y; w.movedAt = performance.now();
        w.x = next.x; w.y = next.y;
      }
      if (s.over) return;
    }
  },

  remove(w) {
    const l = this.list(), i = l.indexOf(w);
    if (i >= 0) l.splice(i, 1);
  },

  // ---------------------------------------------------------------- combat
  arrive(w) {
    const s = Game.s;
    this.remove(w);
    if (w.target.kind === 'party') {
      Game.pendingBattle = { title: `${CULTURES[w.culture].name} war party attacks!`, culture: w.culture, warriors: w.warriors };
      return;
    }
    const st = s.settlements[w.target.id];
    // if the expedition is at the colony, the player fights the defence
    if (s.party && Math.max(Math.abs(s.party.x - st.x), Math.abs(s.party.y - st.y)) <= 2) {
      const pre = Math.min(Math.round(w.warriors * 0.5), Math.round(Game.garrisonStrength(st) * 1.5));
      Game.pendingBattle = {
        title: `Defence of ${st.name}`, culture: w.culture, warriors: Math.max(10, w.warriors - pre),
        intro: pre > 0 ? `The garrison's fire from the walls cuts down ${fmt(pre)} attackers before they reach you.` : null,
        onFinish: (won) => { if (!won) this.sack(st, w.culture, true); else Game.log(`${st.name} is saved.`, 'good'); },
      };
      return;
    }
    this.resolveRaid(st, w.culture, w.warriors, false);
  },

  // auto-resolve an attack on a colony against its garrison and walls
  resolveRaid(st, culture, warriors, revolt) {
    const s = Game.s, g = st.garrison;
    const militia = 8 + st.buildings.cabildo * 6; // armed settlers
    let def = Game.garrisonStrength(st) + militia * (1 + 0.25 * st.buildings.walls);
    if (revolt) def *= 0.75; // the enemy is already inside the walls
    const att = warriors * CULTURES[culture].t * 0.3;
    const roll = def * rand(0.7, 1.3) - att * rand(0.7, 1.3);
    const what = revolt ? `The people of ${st.name} rise in revolt` : `${fmt(warriors)} ${CULTURES[culture].name} warriors attack ${st.name}`;
    if (roll >= 0) {
      const loss = clamp(att / Math.max(1, def) * 0.25, 0.03, 0.5);
      const ls = Math.round(g.soldiers * loss), la = Math.round(g.aux * loss);
      g.soldiers -= ls; g.aux -= la;
      const killed = Math.round(warriors * rand(0.25, 0.5));
      s.stats.warDeaths += killed;
      if (revolt) st.pop = Math.max(50, st.pop - killed);
      Game.log(`${what}, but the garrison holds${st.buildings.walls ? ' behind the walls' : ''}. Defenders lost: ${ls} soldiers, ${la} auxiliaries. Attackers killed: ${fmt(killed)}.`, 'warn');
      UI.banner(`${st.name} holds!`, revolt ? 'The revolt is crushed.' : `The ${CULTURES[culture].name} attack is driven off.`);
      return true;
    }
    this.sack(st, culture, false, what, att > def * 2 && g.soldiers + g.aux < 5, revolt);
    return false;
  },

  sack(st, culture, fought, what, lost, revolt) {
    const s = Game.s, g = st.garrison;
    const casualties = `${g.soldiers} soldiers and ${fmt(g.aux)} auxiliaries`;
    g.soldiers = Math.round(g.soldiers * 0.3); g.aux = Math.round(g.aux * 0.3);
    const gold = st.treasury; st.treasury = 0; st.store = 0;
    // a building is burned
    const built = Object.keys(st.buildings).filter((k) => st.buildings[k] > 0);
    let burned = '';
    if (built.length) { const k = built[Math.floor(Math.random() * built.length)]; st.buildings[k]--; burned = ` The ${BUILDINGS[k].name.toLowerCase()} is burned.`; }
    st.queue = [];
    if (lost || (fought && g.soldiers + g.aux === 0 && Math.random() < 0.3)) {
      // the town is lost
      st.conquered = false;
      for (const k of Object.keys(st.buildings)) st.buildings[k] = Math.floor(st.buildings[k] / 2);
      st.garrison = { soldiers: 0, aux: 0 };
      st.gold = Math.round(gold * 0.8);
      Game.changeRel(culture, 10);
      const msg = revolt ? `The people of ${st.name} drive out the Spanish. The town is free again.` : `${st.name} is overrun by the ${CULTURES[culture].name}. The colony is lost.`;
      Game.log(msg, 'bad');
      UI.banner(`${st.name} is lost!`, msg);
      return;
    }
    const msg = `${what ? what + '. ' : ''}${st.name} is sacked! Of the garrison of ${casualties}, most are killed. ${fmt(gold)} gold is carried off and the granary emptied.${burned}`;
    Game.log(msg, 'bad');
    UI.banner(`${st.name} is sacked!`, 'Strengthen its walls and garrison.');
  },

  // colonies with few converts, harsh mines and a weak garrison may rise up
  revolts() {
    const s = Game.s;
    for (const st of Game.colonies()) {
      const risk = this.revoltRisk(st);
      if (risk > 0 && Math.random() < risk) {
        const rebels = Math.max(20, Math.round(Game.warriors(st) * rand(0.3, 0.5)));
        this.resolveRaid(st, st.culture, rebels, true);
      }
    }
    void s;
  },
  revoltRisk(st) {
    const b = st.buildings;
    const rebels = Game.warriors(st) * 0.4 * CULTURES[st.culture].t * 0.3;
    if (Game.garrisonStrength(st) >= rebels) return 0;
    const angry = Game.s.cultures[st.culture].rel <= -50 ? 0.03 : 0;
    return clamp(0.02 + 0.025 * b.mine + angry - 0.01 * b.church - st.converted / 2500, 0, 0.15);
  },
  threatsTo(st) { return this.list().filter((w) => w.target.kind === 'colony' && w.target.id === st.id); },
};
