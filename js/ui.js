'use strict';
// ---------------------------------------------------------------------------
// HUD, log, dialogs
// ---------------------------------------------------------------------------

const $ = (sel) => document.querySelector(sel);

const UI = {
  open: false,

  init() {
    $('#btn-land').addEventListener('click', () => Input.landOrEmbark());
    $('#btn-center').addEventListener('click', () => { Render.free = false; });
    $('#btn-codex').addEventListener('click', () => this.codex());
    $('#btn-disc').addEventListener('click', () => this.discoveriesDialog());
    $('#btn-careen').addEventListener('click', () => this.careen());
    $('#btn-forage').addEventListener('click', () => Game.forage());
    $('#btn-help').addEventListener('click', () => this.help());
    $('#btn-save').addEventListener('click', () => Game.save(false));
    $('#btn-zin').addEventListener('click', () => Render.zoomBy(1.25));
    $('#btn-zout').addEventListener('click', () => Render.zoomBy(0.8));
    $('#btn-log').addEventListener('click', () => $('#log').classList.toggle('hidden'));
    $('#modal-bg').addEventListener('click', (e) => { if (e.target.id === 'modal-bg' && this.closable) this.close(); });
  },

  refresh() {
    const s = Game.s;
    if (!s) return;
    const sh = Game.ship();
    const pos = Game.active();
    const wind = Game.windAt(World.lat(pos.y));
    const items = [
      ['📅', Game.dateStr(), Game.monarch()],
      ['🎖️', `${Game.title()} ${s.captain}`, `Fame ${fmt(s.fame)}`],
      ['💰', fmt(s.ducats), 'Ducats (your money)'],
      ['🪙', fmt(s.treasure), 'Treasure carried (gold & silver). Deliver to Sevilla for fame.'],
      ['⚔️', s.soldiers, `Soldiers (ship holds ${sh.men})`],
      ['🐎', s.horses, 'Horses'],
      ['🔫', s.arquebuses, 'Arquebuses'],
      ['💣', s.cannons, `Cannon (max ${sh.cannons})`],
      ['🏹', fmt(s.allies), 'Native allies (leave when you re-embark)'],
      ['🪶', fmt(s.auxiliaries), 'Native auxiliaries in your service (paid monthly, sail with you)'],
      ['✝️', s.priests, 'Friars: send them to preach in native towns and colonies'],
      ['🍖', `${fmt(s.food)}`, `Provisions (${Math.floor(s.food / (1 + s.soldiers / 20 + s.allies / 40))} days)`],
      ['📦', s.goods, 'Trade goods: beads, cloth, iron tools'],
      ['⚓', `${s.hull}/${sh.hull}`, `${sh.name} hull`],
      ['⭐', fmt(s.fame), 'Fame'],
    ];
    $('#hud').innerHTML = items.map(([i, v, t]) => `<div class="hud-item${(i === '🍖' && s.food < 60) || (i === '⚓' && s.hull < 35) ? ' alert' : ''}" title="${t}"><span>${i}</span>${v}</div>`).join('')
      + `<div class="hud-item wind" title="Wind at your latitude">🌬️ ${wind.name} ${wind.dir < 0 ? '←' : wind.dir > 0 ? '→' : '·'}</div>`;
    $('#btn-land').textContent = s.party ? '⛵ Embark' : '🚣 Land';
    $('#btn-careen').style.display = (!s.party && s.hull < sh.hull * 0.6) ? '' : 'none';
    $('#btn-forage').style.display = s.party ? '' : 'none';
    $('#mode').textContent = s.party ? 'Expedition on land — click to march, click the ship to re-embark' : 'At sea — click to sail, click land to send an expedition ashore';
  },

  addLog(msg, cls) {
    const el = document.createElement('div');
    el.className = 'log-line ' + cls;
    el.innerHTML = msg;
    const log = $('#log-lines');
    log.appendChild(el);
    while (log.children.length > 80) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  },
  rebuildLog() {
    $('#log-lines').innerHTML = '';
    for (const l of Game.s.log) this.addLog(l.msg, l.cls);
  },

  toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast'; t.innerHTML = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => t.classList.add('fade'), 3200);
    setTimeout(() => t.remove(), 4000);
  },
  banner(title, text) {
    const b = $('#banner');
    b.innerHTML = `<div class="b-title">${title}</div><div class="b-text">${text}</div>`;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  },

  dialog(title, html, buttons = [], noBgClose = false, actions = {}) {
    this.open = true;
    this.closable = !noBgClose;
    Input.stop();
    const m = $('#modal');
    m.innerHTML = `<h2>${title}</h2><div class="modal-body">${html}</div><div class="modal-buttons"></div>`;
    const bar = m.querySelector('.modal-buttons');
    for (const [label, fn, disabled, tip] of buttons) {
      const b = document.createElement('button');
      b.innerHTML = label; b.disabled = !!disabled;
      if (tip) b.title = tip;
      b.addEventListener('click', fn);
      bar.appendChild(b);
    }
    m.querySelectorAll('[data-act]').forEach((el) => el.addEventListener('click', () => actions[el.dataset.act] && actions[el.dataset.act]()));
    $('#modal-bg').classList.add('show');
  },
  close() {
    this.open = false;
    $('#modal-bg').classList.remove('show');
    this.refresh();
  },

  // ------------------------------------------------------------ encounters
  encounterDialog(st) {
    const s = Game.s, c = CULTURES[st.culture], cs = s.cultures[st.culture];
    const [rl, rc] = Game.relLabel(cs.rel);
    const T = SETTLEMENT_TYPES[st.type];
    const W = Game.warriors(st);
    const ratio = Game.strengthRatio(st);
    const odds = ratio > 2 ? 'Your captains are confident.' : ratio > 1 ? 'A hard fight, but winnable.' : ratio > 0.5 ? 'Your captains urge caution.' : 'Attacking would be suicide without allies.';
    let dis = '';
    if (st.infection) dis = `<p class="disease">☠️ ${DISEASES.find((d) => d.id === st.infection.d).name} is ravaging the ${T.label.toLowerCase()}. The sick lie untended in the streets.</p>`;
    else if (st.pop < st.pop0 * 0.8) dis = `<p class="disease">The ${T.label.toLowerCase()} is half-empty — epidemics have killed ${fmt(st.pop0 - st.pop)} people.</p>`;
    const wealth = st.gold > 5000 ? 'immense wealth' : st.gold > 1500 ? 'great wealth' : st.gold > 400 ? 'some gold' : 'little gold';
    const hostile = cs.rel <= -60;
    const html = `
      <p class="sub">${T.label} of the ${c.name}</p>
      <p class="flavor">${c.desc}</p>
      <div class="stats">
        <div>Population: <b>${fmt(st.pop)}</b></div><div>Warriors: <b>~${fmt(Math.round(W / 50) * 50 || W)}</b></div>
        <div>Attitude: <b class="${rc}">${rl}</b> (${Math.round(cs.rel)})</div><div>Rumoured: <b>${wealth}</b></div>
        <div>Christians: <b>${st.converted}%</b>${st.converted >= 50 ? ' ✝️ mission' : ''}</div><div>Your friars: <b>${s.priests}</b></div>
      </div>
      ${dis}
      <p class="odds">${odds}</p>
      ${hostile ? '<p class="bad"><b>The warriors rush out to attack you!</b></p>' : ''}`;
    const actions = [];
    const enc = () => this.encounterDialog(st);
    if (hostile) {
      actions.push(['⚔️ Fight', () => Battle.start({ title: `Battle at ${st.name}`, culture: st.culture, warriors: W, settlement: st })]);
      actions.push(['🏃 Flee', () => {
        const lost = Math.max(1, Math.round(s.soldiers * 0.05));
        s.soldiers -= lost; s.stats.soldiersLost += lost; Game.clampArmy();
        Game.log(`You flee from ${st.name}, losing ${lost} men.`, 'bad');
        if (s.soldiers <= 0) return Game.gameOver('Annihilated', 'None of your men escaped.');
        this.close();
      }]);
      this.dialog(`${st.name}`, html, actions, true);
      return;
    }
    actions.push(['🎁 Offer gifts (10 goods)', () => {
      s.goods -= 10; Game.changeRel(st.culture, 12);
      let msg = `The ${c.name} accept your gifts. Relations improve.`;
      const r = Math.random() < 0.6 ? Game.rumor(st) : null;
      if (r) msg += ' ' + r;
      Game.log(msg, 'good'); this.toast(msg); enc();
    }, s.goods < 10]);
    actions.push(['🤝 Trade goods for gold', () => {
      s.goods -= 10;
      const g = Math.min(st.gold, Math.round(rand(15, 30) * ({ village: 1, town: 2, city: 3, capital: 4 })[st.type]));
      st.gold -= g; s.treasure += g; Game.changeRel(st.culture, 4);
      Game.log(`Traded 10 goods at ${st.name} for ${g} in gold.`, 'good'); enc();
    }, s.goods < 10 || cs.rel < -20 || st.gold <= 0, 'Requires 10 trade goods and a non-hostile attitude']);
    const mission = st.converted >= 50;
    actions.push(['🌽 Trade for provisions (3 goods)', () => {
      s.goods -= 3;
      const f = Game.addFood(randi(90, 150) * (mission ? 1.5 : 1));
      Game.changeRel(st.culture, 2);
      Game.log(`Traded 3 goods at ${st.name} for ${f} provisions of maize, cassava and fish.`, 'good'); enc();
    }, s.goods < 3 || cs.rel < -20 || s.food >= Game.ship().food]);
    actions.push(['🍞 Ask for food', () => {
      const f = Game.addFood(randi(50, 100) * (mission ? 1.5 : 1));
      st.foodReadyDay = s.day + 60;
      Game.log(`The people of ${st.name} share their food with you: +${f} provisions.`, 'good'); enc();
    }, cs.rel < (mission ? 0 : 20) || s.day < st.foodReadyDay || s.food >= Game.ship().food, 'Requires a Neutral-to-Friendly attitude (20+); once every two months']);
    actions.push([`✝️ Send friars to preach`, () => {
      const html = Game.preach(st);
      if (html === null) return;
      if (Game.s.over) return;
      this.dialog(`✝️ ${st.name}`, html, [['Continue', () => this.encounterDialog(st)]]);
    }, s.priests <= 0 || cs.rel < -20 || st.converted >= 100, s.priests <= 0 ? 'Hire friars in Sevilla' : 'Takes 10 days. Requires an attitude above -20']);
    const allyReady = s.day >= st.allyReadyDay;
    const hasEnemy = c.rivals.length > 0;
    actions.push(['🏹 Ask for warriors', () => {
      const n = Math.round(W * (hasEnemy ? 0.6 : 0.25));
      s.allies += n; st.allyReadyDay = s.day + 365;
      Game.log(`${fmt(n)} ${c.name} warriors join your expedition${hasEnemy && c.rivals.length ? ', eager to fight their old enemies' : ''}.`, 'good');
      enc();
    }, cs.rel < (mission ? 20 : 40) || !allyReady || !s.party, !s.party ? 'Allies only march with an expedition on land' : 'Requires Friendly attitude (40+, or 20+ with a mission), once per year']);
    actions.push(['📜 Demand tribute', () => {
      const p = clamp(ratio - 0.3, 0.05, 0.95);
      if (Math.random() < p) {
        const g = Math.round(st.gold * 0.35); st.gold -= g; s.treasure += g;
        Game.changeRel(st.culture, -20);
        Game.log(`Intimidated, ${st.name} hands over ${g} in gold. They will not forget this.`, 'warn'); enc();
      } else {
        Game.changeRel(st.culture, -25);
        Game.log(`${st.name} refuses your demands and attacks!`, 'bad');
        Battle.start({ title: `Battle at ${st.name}`, culture: st.culture, warriors: W, settlement: st });
      }
    }, false, `Chance of success: ${Math.round(clamp(ratio - 0.3, 0.05, 0.95) * 100)}%`]);
    actions.push(['⚔️ Attack', () => {
      Game.attacked(st.culture);
      Game.log(`You attack ${st.name}.`, 'warn');
      Battle.start({ title: `Assault on ${st.name}`, culture: st.culture, warriors: W, settlement: st });
    }]);
    actions.push(['Leave', () => this.close()]);
    this.dialog(`${st.name}`, html, actions);
  },

  buildingEffect(st, id, lvl) {
    if (!lvl) return 'Not built';
    const T = SETTLEMENT_TYPES[st.type];
    switch (id) {
      case 'cabildo': return `+${lvl * 25}% tribute · other buildings up to level ${Math.min(5, lvl + 1)}`;
      case 'barracks': return `+${1 + lvl} settlers/month · ${5 * lvl} auxiliaries/month`;
      case 'walls': return `Garrison +${lvl * 25}% stronger`;
      case 'church': return `+${lvl}% Christians/month · faster preaching`;
      case 'fields': return `+${30 * lvl} provisions/month (store ${150 * lvl})`;
      case 'mine': return `+${[0, 25, 55, 95, 150, 220][lvl]} gold/month · ${(0.4 * lvl).toFixed(1)}% of workers die each month`;
      case 'harbor': return `Repairs 1 per point${lvl >= 3 ? ' · builds naos' : ''}${lvl >= 5 ? ' & galleons' : ''}`;
      case 'stables': return `+${lvl} horses/month (up to ${4 * lvl})`;
      default: return T ? '' : '';
    }
  },

  colonyDialog(st, fromShip) {
    const s = Game.s, sh = Game.ship();
    Game.ensureColony(st);
    const b = st.buildings, g = st.garrison;
    const coastal = !!Game.adjacentWater(st.x, st.y);
    const shipHere = Math.abs(s.ship.x - st.x) <= 1 && Math.abs(s.ship.y - st.y) <= 1;
    const re = () => this.colonyDialog(st, fromShip);
    const act = {};
    // construction queue
    const queue = st.queue.map((q, i) => {
      const B = BUILDINGS[q.b];
      if (i === 0) {
        const left = Math.max(0, Math.ceil(q.done - s.day));
        const pct = Math.round((1 - left / q.days) * 100);
        return `<div class="q-item"><span>${B.icon} ${B.name} → level ${q.level}</span><div class="bar"><div style="width:${pct}%;background:#c9a227"></div></div><small>${left} days left</small></div>`;
      }
      return `<div class="q-item"><span>${B.icon} ${B.name} → level ${q.level}</span><small>waiting · ${q.days} days</small></div>`;
    }).join('') || '<div class="small">No construction under way. Choose a building below.</div>';
    // building cards
    const cards = Object.entries(BUILDINGS).map(([id, B]) => {
      const lvl = b[id], next = Game.queuedLevel(st, id) + 1;
      const block = Game.buildBlock(st, id);
      const cost = next <= 5 ? Game.buildCost(id, next) : null;
      act['build-' + id] = () => { Game.startBuild(st, id); re(); };
      const pips = [1, 2, 3, 4, 5].map((n) => `<i class="${n <= lvl ? 'on' : n < next ? 'q' : ''}"></i>`).join('');
      const btn = cost && block !== 'Maximum level' && block !== 'Needs a coast'
        ? `<button data-act="build-${id}" ${block ? 'disabled' : ''} title="${block || ''}">${next > 1 ? 'Upgrade' : 'Build'} to ${next} · ${fmt(cost.gold)} · ${cost.days}d</button>${block ? `<small class="why">${block}</small>` : ''}`
        : `<small class="why">${block}</small>`;
      return `<div class="bcard${lvl ? ' built' : ''}"><div class="bhead"><span class="bicon">${B.icon}</span><b>${B.name}</b><span class="pips">${pips}</span></div>
        <p>${B.desc}</p><div class="beff">${this.buildingEffect(st, id, lvl)}</div>${btn}</div>`;
    }).join('');
    // services
    const room = sh.men - s.soldiers;
    const repairPrice = b.harbor ? 1 : 3;
    const svc = [];
    const add = (key, label, fn, disabled, tip) => { act[key] = () => { fn(); re(); }; svc.push(`<button data-act="${key}" ${disabled ? 'disabled' : ''} title="${tip || ''}">${label}</button>`); };
    add('tribute', `🪙 Collect tribute (${fmt(st.treasury)})`, () => { s.treasure += st.treasury; Game.log(`Collected ${fmt(st.treasury)} tribute at ${st.name}.`, 'good'); st.treasury = 0; }, st.treasury <= 0);
    add('store', `🌽 Collect provisions (${fmt(st.store)})`, () => { const got = Game.addFood(st.store); st.store -= got; }, st.store <= 0 || s.food >= sh.food);
    add('food', '🍖 Buy 150 provisions (80)', () => { if (Game.spend(80)) Game.addFood(150); }, !Game.canAfford(80) || s.food >= sh.food);
    add('settlers', `⚔️ Enlist 5 settlers (175) · ${st.recruits} willing`, () => { if (Game.spend(175)) { s.soldiers += 5; st.recruits -= 5; } }, st.recruits < 5 || !Game.canAfford(175) || room < 5);
    add('aux', `🪶 Hire 10 auxiliaries (100) · ${st.auxPool} trained`, () => { if (Game.spend(100)) { s.auxiliaries += 10; st.auxPool -= 10; } }, st.auxPool < 10 || !Game.canAfford(100), 'Needs Barracks');
    add('horse', `🐎 Buy a horse (50) · ${st.horsesAvail} for sale`, () => { if (Game.spend(50)) { s.horses++; st.horsesAvail--; } }, st.horsesAvail < 1 || !Game.canAfford(50) || s.horses >= s.soldiers, 'Needs Stables');
    add('preach', '✝️ Send friars to preach', () => {}, s.priests <= 0 || st.converted >= 100, 'Takes 10 days');
    act.preach = () => {
      const html = Game.preach(st, b.church);
      if (html === null || Game.s.over) return;
      this.dialog(`✝️ ${st.name}`, html, [['Back to the city', re]]);
    };
    add('repair', `🔧 Repair ship (${repairPrice}/pt)`, () => {
      const n = Math.min(sh.hull - s.hull, Math.floor((s.ducats + s.treasure) / repairPrice));
      if (n > 0 && Game.spend(n * repairPrice)) { s.hull += n; Game.log(`Ship repaired at ${st.name}.`, 'good'); }
    }, !(coastal && shipHere) || s.hull >= sh.hull, 'The ship must be anchored next to this colony');
    for (const [k, v] of Object.entries(SHIPS)) {
      const need = k === 'nao' ? 3 : k === 'galleon' ? 5 : 99;
      if (k === s.shipType || need > 5) continue;
      const cost = Math.max(0, Math.round(v.cost * 1.2) - Math.round(sh.cost / 2));
      add('ship-' + k, `⛵ Build a ${v.name} (${fmt(cost)})`, () => {
        if (s.soldiers > v.men || !Game.spend(cost)) return;
        s.shipType = k; s.hull = v.hull; s.food = Math.min(s.food, v.food); s.cannons = Math.min(s.cannons, v.cannons);
        Game.log(`The shipwrights of ${st.name} launch your new ${v.name}.`, 'good');
      }, b.harbor < need || !shipHere || !Game.canAfford(cost), `Needs Harbour level ${need} and your ship in port`);
    }
    // garrison
    const gar = [];
    const gadd = (key, label, fn, disabled) => { act[key] = () => { fn(); re(); }; gar.push(`<button data-act="${key}" ${disabled ? 'disabled' : ''}>${label}</button>`); };
    gadd('g-s-in', '⬇ Station 10 soldiers', () => { s.soldiers -= 10; g.soldiers += 10; Game.clampArmy(); }, s.soldiers <= 10);
    gadd('g-s-out', '⬆ Take 10 soldiers', () => { g.soldiers -= 10; s.soldiers += 10; }, g.soldiers < 10 || room < 10);
    gadd('g-a-in', '⬇ Station 50 auxiliaries', () => { const n = Math.min(50, s.auxiliaries); s.auxiliaries -= n; g.aux += n; }, s.auxiliaries <= 0);
    gadd('g-a-out', '⬆ Take 50 auxiliaries', () => { const n = Math.min(50, g.aux); g.aux -= n; s.auxiliaries += n; }, g.aux <= 0);
    const strength = Math.round(Game.garrisonStrength(st));
    const html = `<p class="sub">Spanish colony · formerly a ${SETTLEMENT_TYPES[st.type].label.toLowerCase()} of the ${CULTURES[st.culture].name}</p>
      <div class="stats">
        <div>Population: <b>${fmt(st.pop)}</b> <small>(${fmt(st.pop0)} before the conquest)</small></div><div>Christians: <b>${st.converted}%</b>${st.converted >= 50 ? ' ✝️' : ''}</div>
        <div>Treasury: <b>${fmt(st.treasury)}</b> gold</div><div>Granary: <b>${fmt(st.store)}</b> provisions</div>
        <div>Garrison: <b>${g.soldiers}</b> soldiers, <b>${fmt(g.aux)}</b> auxiliaries</div><div>Defence strength: <b>${fmt(strength)}</b>${b.walls ? ` (walls +${b.walls * 25}%)` : ''}</div>
      </div>
      ${Raids.threatsTo(st).map((w) => `<p class="bad">⚔ A war party of <b>${fmt(w.warriors)}</b> ${CULTURES[w.culture].name} warriors is marching on ${st.name}!</p>`).join('')}
      ${Raids.revoltRisk(st) > 0 ? `<p class="warn">Unrest: the garrison is too weak to overawe the townspeople. Risk of revolt each month: <b>${Math.round(Raids.revoltRisk(st) * 100)}%</b>. Mines raise it; a church, converts and a stronger garrison lower it.</p>` : ''}
      <h3>Construction</h3><div class="queue">${queue}</div>
      <h3>Buildings</h3><div class="bgrid">${cards}</div>
      <h3>Services</h3><div class="svc">${svc.join('')}</div>
      <h3>Garrison</h3><div class="svc">${gar.join('')}</div>
      <p class="small">Building costs are paid from the city treasury first, then your purse. Upgrades continue while you are away.</p>
      ${b.mine ? `<p class="flavor">Under the encomienda and the mita, the people of ${st.name} are forced to dig in the mines. ${fmt(Game.s.stats.labourDeaths)} have died in forced labour across your colonies.</p>` : ''}`;
    this.dialog(`🏰 ${st.name}`, html, [['Leave', () => this.close()]], false, act);
  },

  // ------------------------------------------------------------ Sevilla
  portDialog() {
    const s = Game.s, sh = Game.ship();
    const re = () => this.portDialog();
    const buy = (what, n, price, cap) => {
      n = Math.max(0, Math.min(n, cap));
      if (n <= 0) return;
      const cost = n * price;
      if (!Game.spend(cost)) { this.toast('Not enough money.'); return; }
      s[what] += n; re();
    };
    const row = (label, what, price, opts, cap, note) => `<div class="shop-row"><span class="lbl">${label} <small>${price} each${note ? ' · ' + note : ''}</small></span>
      <span class="have">${fmt(s[what])}</span>${opts.map((n) => `<button data-act="${what}-${n}" ${cap <= 0 || !Game.canAfford(price) ? 'disabled' : ''}>+${n === 9999 ? 'Max' : n}</button>`).join('')}</div>`;
    const caps = {
      soldiers: sh.men - s.soldiers - s.auxiliaries,
      horses: Math.min(Math.floor(sh.men / 4), s.soldiers) - s.horses,
      arquebuses: s.soldiers - s.arquebuses,
      cannons: sh.cannons - s.cannons,
      priests: 10 - s.priests,
      food: sh.food - s.food,
      goods: 200 - s.goods,
    };
    const prices = { priests: PRICES.priest, soldiers: PRICES.soldier, horses: PRICES.horse, arquebuses: PRICES.arquebus, cannons: PRICES.cannon, food: PRICES.food, goods: PRICES.goods };
    const opts = { priests: [1, 3], soldiers: [5, 20], horses: [1, 5], arquebuses: [5, 20], cannons: [1], food: [100, 9999], goods: [20, 9999] };
    const actions = {};
    for (const [w, list] of Object.entries(opts)) for (const n of list) actions[`${w}-${n}`] = () => buy(w, n === 9999 ? Math.floor((s.ducats + s.treasure) / prices[w]) : n, prices[w], caps[w]);
    const repairCost = (sh.hull - s.hull) * PRICES.repair;
    actions.repair = () => { const n = Math.min(sh.hull - s.hull, Math.floor((s.ducats + s.treasure) / PRICES.repair)); if (n > 0 && Game.spend(n * PRICES.repair)) s.hull += n; re(); };
    actions.deliver = () => { Game.deliverTreasure(); re(); };
    const shipRows = Object.entries(SHIPS).filter(([k]) => k !== s.shipType).map(([k, v]) => {
      const cost = Math.max(0, v.cost - Math.round(sh.cost / 2));
      actions['ship-' + k] = () => {
        if (s.soldiers > v.men) { this.toast(`Too many soldiers for a ${v.name}.`); return; }
        if (!Game.spend(cost)) { this.toast('Not enough money.'); return; }
        s.shipType = k; s.hull = v.hull; s.food = Math.min(s.food, v.food); s.cannons = Math.min(s.cannons, v.cannons);
        Game.log(`You take command of a ${v.name}.`, 'good'); re();
      };
      return `<div class="shop-row"><span class="lbl">${v.name} <small>${v.men} men · ${v.food} provisions · hull ${v.hull} · ${v.cannons} cannon · speed ${Math.round(v.speed * 100)}%</small></span><button data-act="ship-${k}" ${Game.canAfford(cost) ? '' : 'disabled'}>Buy (${fmt(cost)})</button></div>`;
    }).join('');
    actions.retire = () => {
      this.dialog('Retire?', `<p>Retire to your estates and end the game with a score of <b>${fmt(Game.score())}</b>?</p>`, [['Retire', () => { this.close(); Game.endGame(`${Game.title()} ${s.captain} retires to an estate in Castile.`); }], ['Not yet', () => this.portDialog()]]);
    };
    const html = `<p class="sub">Casa de Contratación · Reign of ${Game.monarch()}</p>
      <div class="section"><h3>Royal Treasury</h3>
        <div class="shop-row"><span class="lbl">Treasure in your hold <small>The Crown takes the royal fifth (20%) — and rewards you with fame</small></span><span class="have">${fmt(s.treasure)}</span><button data-act="deliver" ${s.treasure > 0 ? '' : 'disabled'}>Deliver</button></div>
        <div class="small">Money: ${fmt(s.ducats)} ducats. Purchases use ducats first, then treasure. Royal fifth paid so far: ${fmt(s.crownGold)}.</div></div>
      <div class="section"><h3>Recruit & Arm</h3>
        ${row('⚔️ Soldiers', 'soldiers', prices.soldiers, opts.soldiers, caps.soldiers, `ship holds ${sh.men}`)}
        ${row('🐎 Horses', 'horses', prices.horses, opts.horses, caps.horses, 'max ¼ of ship berths')}
        ${row('🔫 Arquebuses', 'arquebuses', prices.arquebuses, opts.arquebuses, caps.arquebuses, 'one per soldier')}
        ${row('💣 Cannon', 'cannons', prices.cannons, opts.cannons, caps.cannons, `max ${sh.cannons}`)}</div>
      <div class="section"><h3>The Church</h3>
        ${row(Game.year() >= 1540 ? '✝️ Friars & Jesuit fathers' : '✝️ Franciscan & Dominican friars', 'priests', prices.priests, opts.priests, caps.priests, 'max 10 · they preach, baptise and tend the wounded')}</div>
      <div class="section"><h3>Market</h3>
        ${row('🍖 Provisions', 'food', prices.food, opts.food, caps.food, `hold ${sh.food}`)}
        ${row('📦 Trade goods', 'goods', prices.goods, opts.goods, caps.goods, 'max 200')}</div>
      <div class="section"><h3>Shipyard</h3>
        <div class="shop-row"><span class="lbl">🔧 Repair the ${sh.name} <small>hull ${s.hull}/${sh.hull}</small></span><button data-act="repair" ${s.hull < sh.hull && Game.canAfford(PRICES.repair) ? '' : 'disabled'}>Repair (${fmt(repairCost)})</button></div>
        ${shipRows}<div class="small">Your current ship is traded in for half its value.</div></div>`;
    this.dialog('🏰 Sevilla', html, [['🎖️ Retire', actions.retire], ['Set sail', () => { Game.save(true); this.close(); }]], false, actions);
    this.refresh();
  },

  careen() {
    const s = Game.s, sh = Game.ship();
    if (s.party) return;
    let nearLand = false;
    for (const [dx, dy] of DIRS8) if (World.landOK(s.ship.x + dx, s.ship.y + dy)) nearLand = true;
    if (!nearLand) { this.toast('You must be next to a New World shore to careen the ship.'); return; }
    const gain = Math.min(sh.hull - s.hull, Math.round(sh.hull * 0.3));
    Game.advance(20);
    if (Game.s.over) return;
    s.hull += gain;
    Game.log(`You beach the ship and scrape and patch her hull for 20 days (+${gain} hull).`, 'good');
    this.refresh();
  },

  // ------------------------------------------------------------ info screens
  codex() {
    const s = Game.s;
    const ids = Object.keys(ARTIFACTS);
    const html = `<p class="sub">${s.artifacts.length} of ${ids.length} artifacts collected</p><div class="codex">${ids.map((id) => {
      const a = ARTIFACTS[id], has = s.artifacts.includes(id);
      return has ? `<div class="card"><div class="big-icon">${a.icon}</div><b>${a.name}</b><p>${a.desc}</p><small>Fame ${a.fame} · worth ${a.value}</small></div>`
        : '<div class="card unknown"><div class="big-icon">❔</div><b>Undiscovered</b><p>Somewhere in the ruins and cities of the Americas…</p></div>';
    }).join('')}</div>`;
    this.dialog('📜 Codex of Artifacts', html, [['Close', () => this.close()]]);
  },
  discoveriesDialog() {
    const s = Game.s;
    const html = `<p class="sub">${s.discoveries.length} of ${DISCOVERIES.length} discoveries</p><div class="disc-list">${DISCOVERIES.map(([id, name, , , , fame, text]) => s.discoveries.includes(id)
      ? `<div class="disc done">🧭 <b>${name}</b> <small>+${fame}</small><br><i>${text}</i></div>` : '<div class="disc">❔ <i>Undiscovered</i></div>').join('')}</div>
      <h3>Peoples met</h3><div class="disc-list">${Object.entries(s.cultures).filter(([, c]) => c.met).map(([id, c]) => {
        const [l, cls] = Game.relLabel(c.rel);
        return `<div class="disc done"><b>${CULTURES[id].name}</b> — <span class="${cls}">${l}</span><br><small>${CULTURES[id].desc}</small></div>`;
      }).join('') || '<i>None yet.</i>'}</div>`;
    this.dialog('🧭 Discoveries & Peoples', html, [['Close', () => this.close()]]);
  },
  help() {
    const html = `
      <p><b>The year is 1492.</b> You command a small expedition sailing from Sevilla into the unknown west. Explore, conquer, find ancient artifacts and win fame before the century ends in 1600.</p>
      <h3>Controls</h3>
      <ul><li><b>Click / tap</b> on the map to sail or march there. Drag to pan, scroll or +/− to zoom.</li>
      <li><b>Arrow keys / WASD</b> move one tile (Q/E/Z/C diagonals). <b>Space</b> recentres. <b>L</b> lands or re-embarks.</li>
      <li>Click a <b>land tile</b> while at sea to sail to the nearest shore and send an expedition ashore. Click your <b>ship</b> to re-embark.</li></ul>
      <h3>Sailing</h3>
      <ul><li>Winds matter: the <b>trade winds</b> push you west between 8° and 30° N; the <b>westerlies</b> carry you home further north. This is the historical <i>volta do mar</i>.</li>
      <li>Watch your <b>provisions</b>. Starving men die. Buy food in Sevilla, trade with natives, or at your colonies.</li>
      <li>Hurricanes strike the Caribbean from August to October. Repair in Sevilla, at coastal colonies, or <b>careen</b> on any New World beach.</li></ul>
      <h3>Peoples</h3>
      <ul><li>Each people has an attitude toward you. Gifts and trade improve it; attacks and tribute make enemies — and make their rivals your friends.</li>
      <li>Friendly peoples may lend <b>warriors</b>. Like Cortés with the Tlaxcalteca, you cannot topple an empire without native allies.</li>
      <li><b>Disease</b>: your men unknowingly carry smallpox, measles and typhus. Epidemics spread from town to town ahead of you, killing a large share of the population. This was the deadliest force of the conquest.</li></ul>
      <h3>Battle</h3>
      <ul><li>Choose a tactic each round. Guns and horses cause panic among peoples who have never seen them, but each battle teaches them to fight back.</li>
      <li>Conquered settlements become colonies. Open a colony to build and upgrade its Cabildo, barracks, walls, church, fields, mines, harbour and stables (levels 1–5). Construction takes gold and time and continues while you are away.</li>
      <li>Peoples you anger send <b>war parties</b> against your expedition and colonies. You can see them on the map and attack them first. Raids on colonies are fought by the garrison and walls; if you are there, you lead the defence. Losing a city can trigger a counter-offensive, and colonies with weak garrisons, harsh mines and few converts may revolt.</li>
      <li>After a conquest, choose what to do with the defeated warriors: press them into service as <b>auxiliaries</b> who stay with you, make them the city's garrison, or release them.</li>
      <li>Battles depend on the ground: horses rule open plains but flounder in jungle and mountains, and rain fouls powder. Your men tire as a fight drags on. Wounded men may recover afterwards. Each people fights its own way: Aztecs take captives, Inca slingers strike from afar, Caribs use poisoned arrows, and Mapuche pikemen stop cavalry.</li></ul>
      <h3>Food</h3>
      <ul><li>Your crew fishes in coastal waters and rivers, and your expedition lives partly off the land as it marches. Grassland, forest and rivers are rich; deserts and mountains are poor.</li>
      <li>Press <b>🌿 Forage</b> (or F) on land to spend five days hunting and gathering.</li>
      <li>Friendly peoples greet you with food, share it when asked, and trade generously for a few trade goods. Conquered granaries and colonies also feed you.</li></ul>
      <h3>Friars</h3>
      <ul><li>Hire friars in Sevilla and send them to preach in native towns and in your colonies. Each mission takes ten days. Above 50% Christian, a town gets a mission church: it trades and shares food more generously, provides allies more readily, and as a colony pays more tribute. Friars also tend your wounded after battle.</li>
      <li>Preaching among peoples who distrust you is dangerous, and a friar may be killed.</li></ul>
      <h3>Fame</h3>
      <p>Fame comes from discoveries, artifacts, conquests and the royal fifth of treasure delivered to Sevilla. Titles: Hidalgo → Capitán → Adelantado → Gobernador → Marqués → Virrey.</p>`;
    this.dialog('❓ How to play', html, [['Close', () => this.close()]]);
  },

  endScreen(cause, text, peaceful) {
    const s = Game.s;
    this.refresh();
    const met = Object.values(s.cultures).filter((c) => c.met).length;
    const html = `<p class="flavor">${text}</p>
      <div class="stats">
        <div>Final title: <b>${Game.title()}</b></div><div>Score: <b>${fmt(Game.score())}</b></div>
        <div>Fame: <b>${fmt(s.fame)}</b></div><div>Ducats: <b>${fmt(s.ducats)}</b></div>
        <div>Discoveries: <b>${s.discoveries.length}/${DISCOVERIES.length}</b></div><div>Artifacts: <b>${s.artifacts.length}/${Object.keys(ARTIFACTS).length}</b></div>
        <div>Settlements conquered: <b>${s.stats.conquered}</b></div><div>Battles won: <b>${s.stats.won}/${s.stats.battles}</b></div>
        <div>Peoples met: <b>${met}</b></div><div>Spaniards lost: <b>${fmt(s.stats.soldiersLost)}</b></div>
        <div>Baptisms: <b>${fmt(s.stats.converts || 0)}</b></div><div>Missions founded: <b>${s.settlements.filter((x) => x.converted >= 50).length}</b></div>
        <div>Native people killed in war: <b>${fmt(s.stats.warDeaths)}</b></div><div>Native people killed in forced labour: <b>${fmt(s.stats.labourDeaths || 0)}</b></div><div>Native people killed by epidemics: <b>${fmt(s.stats.diseaseDeaths)}</b></div>
      </div>
      <p class="history">Historians estimate that the Indigenous population of the Americas fell by as much as 90% in the century after 1492 — mostly from Old World diseases such as smallpox, measles and typhus, compounded by war, forced labour and famine. Many of the peoples in this game survive today: millions of people speak Maya languages, Quechua, Guaraní, Nahuatl, Mapudungun and Aymara.</p>`;
    this.dialog(peaceful ? '🏰 The End' : `☠️ ${cause}`, html, [['New game', () => location.reload()]], true);
  },
};
