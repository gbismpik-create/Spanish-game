'use strict';
// ---------------------------------------------------------------------------
// Game state and rules
// ---------------------------------------------------------------------------

const START_DATE = Date.UTC(1492, 7, 3);
const END_YEAR = 1600;
const SAVE_KEY = 'conquista-save-v1';

const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (n) => Math.round(n).toLocaleString('en-US');

const Game = {
  s: null,
  siteAt: new Map(), // tile index -> {kind, ref}

  // ------------------------------------------------------------ setup
  newGame(captain) {
    const s = {
      captain: captain || 'Capitán',
      day: 0, lastMonth: null,
      ducats: 500, treasure: 0,
      soldiers: 40, horses: 4, arquebuses: 10, cannons: 1, allies: 0,
      food: 260, goods: 60, priests: 1,
      shipType: 'caravel', hull: 100,
      ship: { x: 0, y: 0, dir: -1 }, party: null,
      fame: 0, crownGold: 0,
      settlements: [], ruins: [], cultures: {},
      artifacts: [], discoveries: [],
      log: [], chronicleShown: [],
      stats: { battles: 0, won: 0, warDeaths: 0, diseaseDeaths: 0, soldiersLost: 0, conquered: 0, tiles: 0, converts: 0 },
      starveWarned: 0, tordesillas: false, over: false,
    };
    for (const [id, c] of Object.entries(CULTURES)) s.cultures[id] = { rel: c.rel, shock: 1, met: false };

    const rng = mulberry32(1492);
    const taken = new Set();
    for (const [name, culture, type, lon, lat, extra = {}] of SETTLEMENTS) {
      const p = World.nearestLand(lon, lat, taken);
      if (!p) { console.warn('no land for', name); continue; }
      taken.add(World.idx(p.x, p.y));
      const T = SETTLEMENT_TYPES[type];
      const pop = Math.round(T.pop[0] + rng() * (T.pop[1] - T.pop[0]));
      s.settlements.push({
        id: s.settlements.length, name, culture, type, x: p.x, y: p.y,
        pop, pop0: pop, gold: extra.gold != null ? extra.gold : Math.round(T.gold[0] + rng() * (T.gold[1] - T.gold[0])),
        artifact: extra.artifact || null, cibola: !!extra.cibola,
        met: false, conquered: false, treasury: 0, recruits: 6,
        infection: null, hadDiseases: [], allyReadyDay: 0, converted: 0, foodReadyDay: 0,
      });
    }
    for (const [name, lon, lat, art] of RUIN_SITES) {
      const p = World.nearestLand(lon, lat, taken);
      if (!p) continue;
      taken.add(World.idx(p.x, p.y));
      s.ruins.push({ name, x: p.x, y: p.y, artifact: art, named: true, explored: false });
    }
    // procedural ruins hidden in the wilderness
    const generic = GENERIC_ARTIFACTS.slice();
    let tries = 0, made = 0;
    while (made < 16 && tries++ < 5000) {
      const x = Math.floor(rng() * World.W), y = Math.floor(rng() * World.H);
      const t = World.t(x, y);
      if (![TT.JUNGLE, TT.MOUNTAIN, TT.FOREST, TT.DESERT].includes(t) || !World.landOK(x, y)) continue;
      let near = false;
      for (const i of taken) { const ox = i % World.W, oy = (i / World.W) | 0; if (Math.abs(ox - x) < 4 && Math.abs(oy - y) < 4) { near = true; break; } }
      if (near) continue;
      taken.add(World.idx(x, y));
      const art = made < generic.length ? generic[made] : null;
      s.ruins.push({ name: RANDOM_RUIN_NAMES[made % RANDOM_RUIN_NAMES.length], x, y, artifact: art, named: false, explored: false });
      made++;
    }
    // home port: Sevilla (Sanlúcar de Barrameda)
    const port = this.coastalLand(-6.3, 36.7);
    s.port = port;
    const dock = this.adjacentWater(port.x, port.y);
    s.ship.x = dock.x; s.ship.y = dock.y;
    this.s = s;
    this.explored = new Uint8Array(World.W * World.H);
    // the Old World is already known
    for (let y = 0; y < World.H; y++) for (let x = 0; x < World.W; x++) if (World.lon(x) > -19 && World.lat(y) > 10) this.explored[World.idx(x, y)] = 1;
    this.buildSiteIndex();
    this.reveal(s.ship.x, s.ship.y, 5);
    this.log(`${this.dateStr()}: ${s.captain} receives a royal charter to sail west across the Ocean Sea in search of new lands.`, 'big');
    this.log('Sail west from Sevilla. The trade winds blow westward south of 30° latitude.', 'hint');
    return s;
  },

  coastalLand(lon, lat) {
    const fx = World.tx(lon), fy = World.ty(lat);
    let best = null, bd = Infinity;
    for (let y = fy - 6; y <= fy + 6; y++) for (let x = fx - 6; x <= fx + 6; x++) {
      if (!World.isLandTile(x, y) || !this.adjacentWater(x, y)) continue;
      const d = (x - fx) ** 2 + (y - fy) ** 2;
      if (d < bd) { bd = d; best = { x, y }; }
    }
    return best;
  },
  adjacentWater(x, y) {
    for (const [dx, dy] of DIRS8) if (World.shipOK(x + dx, y + dy) && World.t(x + dx, y + dy) !== TT.RIVER) return { x: x + dx, y: y + dy };
    for (const [dx, dy] of DIRS8) if (World.shipOK(x + dx, y + dy)) return { x: x + dx, y: y + dy };
    return null;
  },

  buildSiteIndex() {
    this.siteAt.clear();
    for (const st of this.s.settlements) this.siteAt.set(World.idx(st.x, st.y), { kind: 'settlement', ref: st });
    for (const r of this.s.ruins) this.siteAt.set(World.idx(r.x, r.y), { kind: 'ruin', ref: r });
    this.siteAt.set(World.idx(this.s.port.x, this.s.port.y), { kind: 'port', ref: this.s.port });
  },
  site(x, y) { return this.siteAt.get(World.idx(x, y)) || null; },

  // ------------------------------------------------------------ helpers
  date() { return new Date(START_DATE + this.s.day * 86400000); },
  dateStr() {
    const d = this.date();
    return `${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  },
  year() { return this.date().getUTCFullYear(); },
  monarch() { const y = this.year(); let m = MONARCHS[0][1]; for (const [yy, n] of MONARCHS) if (y >= yy) m = n; return m; },
  title() { let t = TITLES[0][1]; for (const [f, n] of TITLES) if (this.s.fame >= f) t = n; return t; },
  ship() { return SHIPS[this.s.shipType]; },
  active() { return this.s.party || this.s.ship; },
  onLand() { return !!this.s.party; },
  log(msg, cls = '') {
    this.s.log.push({ msg, cls });
    if (this.s.log.length > 120) this.s.log.shift();
    UI.addLog(msg, cls);
  },
  relLabel(rel) {
    if (rel >= 40) return ['Friendly', 'good'];
    if (rel >= 0) return ['Neutral', 'neutral'];
    if (rel > -50) return ['Wary', 'warn'];
    return ['Hostile', 'bad'];
  },
  warriors(st) { return Math.max(0, Math.floor(st.pop * 0.1)); },
  spend(cost) {
    const s = this.s;
    if (s.ducats + s.treasure < cost) return false;
    const fromD = Math.min(s.ducats, cost);
    s.ducats -= fromD; s.treasure -= cost - fromD;
    return true;
  },
  canAfford(cost) { return this.s.ducats + this.s.treasure >= cost; },
  addFame(n, why) { this.s.fame += n; if (why) this.log(`+${n} fame — ${why}`, 'fame'); },

  dailyFood() { return 1 + this.s.soldiers / 20 + this.s.allies / 40; },
  addFood(n) {
    const s = this.s;
    const add = Math.max(0, Math.min(Math.round(n), this.ship().food - s.food));
    s.food += add;
    return add;
  },

  reveal(cx, cy, r) {
    let changed = false;
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (!World.inb(x, y)) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 > r * r + r) continue;
      const i = World.idx(x, y);
      if (!this.explored[i]) { this.explored[i] = 1; changed = true; }
    }
    if (changed) Render.fogDirty = true;
  },
  isExplored(x, y) { return World.inb(x, y) && this.explored[World.idx(x, y)] === 1; },

  // ------------------------------------------------------------ time
  advance(days) {
    const s = this.s;
    const before = this.date();
    s.day += days;
    // provisions
    const eat = this.dailyFood() * days;
    s.food -= eat;
    if (s.food <= 0) {
      s.food = 0;
      const lost = Math.min(s.soldiers, Math.ceil(s.soldiers * 0.015 * days));
      if (lost > 0) {
        s.soldiers -= lost; s.stats.soldiersLost += lost;
        this.clampArmy();
        if (s.day - s.starveWarned > 10) { this.log(`Your men are starving! ${lost} have died. Find provisions!`, 'bad'); s.starveWarned = s.day; }
      }
      if (s.allies > 0) { s.allies = 0; this.log('Without food, your native allies desert you.', 'warn'); }
      if (s.soldiers <= 0) return this.gameOver('Starvation', 'The last of your men perished from hunger in an unknown land.');
    }
    const after = this.date();
    const m0 = before.getUTCFullYear() * 12 + before.getUTCMonth();
    const m1 = after.getUTCFullYear() * 12 + after.getUTCMonth();
    for (let m = m0 + 1; m <= m1; m++) this.monthly(Math.floor(m / 12), m % 12);
    if (this.year() >= END_YEAR && !s.over) this.endGame('The sixteenth century has ended.');
  },

  monthly(year, month) {
    const s = this.s;
    // chronicle of world events
    for (const [y, m, text] of CHRONICLE) {
      const key = `${y}-${m}`;
      if (year === y && month + 1 === m && !s.chronicleShown.includes(key)) {
        s.chronicleShown.push(key);
        this.log(`Chronicle, ${y}: ${text}`, 'chron');
        if (y === 1494) s.tordesillas = true;
      }
    }
    if (month === 0) { this.save(true); }
    // epidemics
    const sts = s.settlements;
    const newly = [];
    for (const st of sts) {
      if (!st.infection) { if (st.pop < st.pop0) st.pop = Math.min(st.pop0, Math.round(st.pop * 1.001)); continue; }
      const D = DISEASES.find((d) => d.id === st.infection.d);
      const dead = Math.round(st.pop * D.rate * rand(0.7, 1.3));
      st.pop -= dead; s.stats.diseaseDeaths += dead;
      st.infection.m++;
      if (st.infection.m === 1 && this.isExplored(st.x, st.y) && st.met) this.log(`${D.name} is spreading through ${st.name}.`, 'disease');
      // spread to neighbours
      for (const o of sts) {
        if (o === st || o.infection || o.hadDiseases.includes(D.id)) continue;
        const dist = Math.hypot(o.x - st.x, o.y - st.y);
        const p = (o.culture === st.culture && dist <= 30) ? 0.14 : (dist <= 14 ? 0.08 : 0);
        if (p && Math.random() < p) newly.push([o, D.id]);
      }
      if (st.infection.m >= D.months) {
        st.infection = null;
        if (st.met) this.log(`The ${D.name.toLowerCase()} epidemic in ${st.name} has burned out. ${fmt(st.pop0 - st.pop)} people have died since contact.`, 'disease');
      }
    }
    for (const [o, d] of newly) this.infect(o, d, true);
    // colonies
    for (const st of sts) if (st.conquered) {
      const T = SETTLEMENT_TYPES[st.type];
      st.treasury += Math.round(T.income * Math.max(0.3, st.pop / st.pop0) * (st.converted >= 50 ? 1.25 : 1));
      st.recruits = Math.min(20, st.recruits + 1);
    }
    // relations slowly cool towards neutral
    for (const c of Object.values(s.cultures)) if (c.rel < -20) c.rel = Math.min(-20, c.rel + 0.5);
  },

  infect(st, diseaseId, spread) {
    if (st.infection || st.hadDiseases.includes(diseaseId)) return false;
    st.infection = { d: diseaseId, m: 0 };
    st.hadDiseases.push(diseaseId);
    const D = DISEASES.find((d) => d.id === diseaseId);
    if (!spread) this.log(`Your men unknowingly carry ${D.name.toLowerCase()} to ${st.name}. The people there have no immunity.`, 'disease');
    return true;
  },
  contactDisease(st, chance) {
    const next = DISEASES.find((d) => !st.hadDiseases.includes(d.id));
    if (!next || st.infection) return;
    const p = next.id === 'smallpox' ? chance : chance * 0.4;
    if (Math.random() < p) this.infect(st, next.id, false);
  },

  // ------------------------------------------------------------ movement
  windAt(lat) {
    if (lat >= 30) return { dir: 1, s: 0.35, name: 'Westerlies' };
    if (lat >= 8) return { dir: -1, s: 0.45, name: 'NE Trade Winds' };
    if (lat >= -5) return { dir: 0, s: 0, name: 'Doldrums', slow: 0.7 };
    if (lat >= -30) return { dir: -1, s: 0.35, name: 'SE Trade Winds' };
    if (lat >= -40) return { dir: 0, s: 0, name: 'Variable Winds' };
    return { dir: 1, s: 0.45, name: 'Roaring Forties' };
  },
  landCost(x, y) {
    const t = World.t(x, y);
    const site = this.site(x, y);
    if (site && site.kind === 'settlement' && !site.ref.conquered) return 30;
    return (TERRAIN[t].cost || 2);
  },

  // A step of the active unit onto (nx, ny). Returns false if movement must stop.
  step(nx, ny) {
    const s = this.s;
    if (s.over) return false;
    if (s.party) return this.partyStep(nx, ny);
    return this.shipStep(nx, ny);
  },

  shipStep(nx, ny) {
    const s = this.s, ship = s.ship;
    const site = this.site(nx, ny);
    if (site) { this.interact(site, true); return false; }
    if (!World.shipOK(nx, ny)) {
      if (World.landOK(nx, ny)) { this.disembark(nx, ny); return false; }
      if (World.isLandTile(nx, ny)) UI.toast('Your men have no business wandering the Old World. Sail west!');
      return false;
    }
    const dx = nx - ship.x;
    if (dx) ship.dir = Math.sign(dx);
    const days = (0.3 / this.ship().speed) / this.windFactor(dx, ny) * (dx && ny !== ship.y ? 1.414 : 1);
    ship.x = nx; ship.y = ny;
    s.stats.tiles++;
    this.reveal(nx, ny, 6);
    this.advance(days);
    if (s.over) return false;
    // the crew fishes in coastal waters and rivers
    const wt = World.t(nx, ny);
    if (wt === TT.SEA || wt === TT.RIVER) this.addFood(this.dailyFood() * days * 0.6);
    this.checkDiscoveries(nx, ny);
    return this.seaEvents(nx, ny);
  },
  windFactor(dx, y) {
    const w = this.windAt(World.lat(y));
    let f = 1 + w.s * w.dir * Math.sign(dx);
    if (w.slow) f *= w.slow;
    if (World.t(this.s.ship.x, this.s.ship.y) === TT.RIVER) f *= 0.6;
    return f;
  },

  seaEvents(x, y) {
    const s = this.s;
    const lat = World.lat(y), lon = World.lon(x);
    const month = this.date().getUTCMonth();
    const hurricaneZone = lat > 10 && lat < 30 && lon > -98 && lon < -58 && month >= 7 && month <= 9;
    const p = hurricaneZone ? 0.012 : (lat < -40 ? 0.008 : 0.0018);
    if (World.t(x, y) !== TT.RIVER && Math.random() < p) {
      const dmg = hurricaneZone ? randi(20, 45) : randi(8, 28);
      s.hull -= dmg;
      const lostFood = Math.round(s.food * 0.12);
      s.food -= lostFood;
      let msg = `${hurricaneZone ? 'A HURRICANE' : 'A violent storm'} strikes! The hull takes ${dmg} damage and ${lostFood} provisions are spoiled.`;
      if (s.hull <= 0) {
        this.gameOver('Shipwreck', `${msg} The ${this.ship().name} breaks apart and sinks with all hands.`);
        return false;
      }
      if (s.hull < 35) msg += ' The ship is badly damaged — repair her in port or careen her on a beach!';
      this.log(msg, 'bad');
      UI.toast(msg);
      return false;
    }
    if (this.year() >= 1521 && s.treasure > 400 && World.t(x, y) !== TT.RIVER && Math.random() < 0.003) {
      if (s.cannons >= 4) {
        this.log(`French corsairs try to take your treasure, but your ${s.cannons} cannon drive them off!`, 'good');
      } else {
        const lost = Math.round(s.treasure * 0.3);
        s.treasure -= lost; s.hull -= 10;
        this.log(`French corsairs attack! They escape with ${fmt(lost)} in treasure. (More cannon would deter them.)`, 'bad');
        UI.toast(`Corsairs! Lost ${fmt(lost)} treasure.`);
        return false;
      }
    }
    return true;
  },

  disembark(x, y) {
    const s = this.s;
    if (!World.landOK(x, y)) return false;
    s.party = { x, y, dir: s.ship.dir };
    this.reveal(x, y, 4);
    this.log(`Your expedition lands ${TERRAIN[World.t(x, y)].name.toLowerCase() === 'river' ? 'on the river bank' : 'in the ' + TERRAIN[World.t(x, y)].name.toLowerCase()}.`, '');
    this.checkDiscoveries(x, y);
    UI.refresh();
    return true;
  },
  embark() {
    const s = this.s;
    if (!s.party) return;
    s.party = null;
    if (s.allies > 0) { this.log(`Your ${fmt(s.allies)} native allies return to their homes.`, ''); s.allies = 0; }
    this.log('The expedition returns aboard ship.', '');
    UI.refresh();
  },
  partyAdjacentToShip() {
    const p = this.s.party, sh = this.s.ship;
    return p && Math.abs(p.x - sh.x) <= 1 && Math.abs(p.y - sh.y) <= 1;
  },

  partyStep(nx, ny) {
    const s = this.s, p = s.party;
    if (nx === s.ship.x && ny === s.ship.y) { this.embark(); return false; }
    const site = this.site(nx, ny);
    if (site && site.kind === 'settlement' && !site.ref.conquered) { this.interact(site, false); return false; }
    if (site && site.kind === 'port') return false;
    if (!World.landOK(nx, ny)) return false;
    const dx = nx - p.x;
    if (dx) p.dir = Math.sign(dx);
    const days = this.landCost(nx, ny) * (dx && ny !== p.y ? 1.414 : 1);
    p.x = nx; p.y = ny;
    s.stats.tiles++;
    this.reveal(nx, ny, World.t(nx, ny) === TT.MOUNTAIN ? 5 : 4);
    this.advance(days);
    if (s.over) return false;
    // living off the land as they march
    this.addFood(this.dailyFood() * days * (FORAGE[World.t(nx, ny)] || 0) * 0.9);
    this.checkDiscoveries(nx, ny);
    if (site) { this.interact(site, false); return false; }
    return this.landEvents(nx, ny);
  },

  landEvents(x, y) {
    const s = this.s;
    // passing near villages spreads disease
    for (const st of s.settlements) {
      if (st.conquered) continue;
      const d = Math.hypot(st.x - x, st.y - y);
      if (d <= 1.5) this.contactDisease(st, 0.12);
    }
    // tropical fevers
    if (World.t(x, y) === TT.JUNGLE && Math.random() < 0.03 && s.soldiers > 3) {
      const lost = randi(1, 3);
      s.soldiers -= lost; s.stats.soldiersLost += lost; this.clampArmy();
      this.log(`Fever in the jungle claims ${lost} of your men.`, 'bad');
    }
    // ambushes by hostile peoples
    for (const st of s.settlements) {
      if (st.conquered) continue;
      const rel = s.cultures[st.culture].rel;
      if (rel > -30) continue;
      const d = Math.hypot(st.x - x, st.y - y);
      if (d > 5) continue;
      const p = rel <= -60 ? 0.1 : 0.05;
      if (Math.random() < p) {
        const w = Math.max(20, Math.round(this.warriors(st) * rand(0.12, 0.3)));
        Battle.start({ title: `Ambush by ${CULTURES[st.culture].name} warriors`, culture: st.culture, warriors: w, settlement: st, ambush: true });
        return false;
      }
    }
    return true;
  },

  forage() {
    const s = this.s;
    if (!s.party || s.over) return;
    const t = World.t(s.party.x, s.party.y);
    const frac = FORAGE[t] || 0;
    if (s.food >= this.ship().food) { UI.toast('Your stores are already full.'); return; }
    this.advance(5);
    if (s.over) return;
    const got = this.addFood(this.dailyFood() * 5 * (1 + frac * 4) * rand(0.85, 1.2) + 40 * frac);
    const what = {
      [TT.GRASS]: 'hunt deer and turkeys and gather wild beans', [TT.SAVANNA]: 'hunt deer and rheas and dig wild roots',
      [TT.STEPPE]: 'hunt guanacos and rheas', [TT.FOREST]: 'hunt game and gather nuts and berries',
      [TT.JUNGLE]: 'gather fruit, catch peccaries and fish the streams', [TT.RIVER]: 'catch fish and turtles in the river',
      [TT.MOUNTAIN]: 'search the cold slopes, finding little', [TT.DESERT]: 'find only cactus fruit and lizards',
    }[t] || 'search for food';
    this.log(`Your men spend five days foraging. They ${what}: +${got} provisions.`, got > 20 ? 'good' : 'warn');
    UI.toast(`Foraging: +${got} provisions`);
    if (!this.landEvents(s.party.x, s.party.y)) return;
    UI.refresh();
  },

  // Friars preach in a settlement. Returns a message for the dialog.
  preach(st) {
    const s = this.s, cs = s.cultures[st.culture];
    if (s.priests <= 0) return null;
    this.advance(10);
    if (s.over) return null;
    // a friar may be killed by those who resent the newcomers
    const risk = st.conquered ? 0.03 : clamp(0.18 - cs.rel / 250, 0.03, 0.4);
    if (Math.random() < risk) {
      s.priests--;
      const msg = `A friar preaching in ${st.name} is killed by people who want nothing of the strangers' god. He is remembered as a martyr.`;
      this.log(msg, 'bad');
      return `<p class="bad">${msg}</p>`;
    }
    const size = { village: 1, town: 0.8, city: 0.6, capital: 0.45 }[st.type];
    const open = { taino: 1.2, guarani: 1.3, totonac: 1.2, tlaxcala: 1.2, kaqchikel: 1.1, canari: 1.2, huanca: 1.2, mapuche: 0.5, mexica: 0.8, inca: 0.8, kalinago: 0.6, charrua: 0.6 }[st.culture] || 1;
    const friars = Math.min(s.priests, 4);
    const gain = Math.max(2, Math.round(rand(6, 14) * size * open * (st.conquered ? 1.5 : 1) * (0.75 + friars * 0.25)));
    const before = st.converted;
    st.converted = Math.min(100, st.converted + gain);
    const converts = Math.round(st.pop * (st.converted - before) / 100);
    s.stats.converts += converts;
    if (!st.conquered) this.changeRel(st.culture, 3);
    let html = `<p>Your friars spend ten days in ${st.name}, preaching through interpreters, teaching prayers and baptising. About <b>${fmt(converts)}</b> people accept baptism. (${st.converted}% Christian)</p>`;
    this.log(`Friars baptise about ${fmt(converts)} people in ${st.name} (${st.converted}% Christian).`, 'good');
    const T = SETTLEMENT_TYPES[st.type];
    if (before < 50 && st.converted >= 50) {
      const f = Math.round(T.fame / 2) + 5;
      html += `<p class="good"><b>A mission church rises in ${st.name}.</b> Converts here are more willing to trade, feed and fight alongside you.</p>`;
      this.addFame(f, `mission founded at ${st.name}`);
    }
    if (before < 100 && st.converted >= 100) {
      const f = T.fame + 10;
      html += `<p class="good"><b>${st.name} is now a Christian town.</b></p><p class="flavor">Many keep honouring their old gods in secret, behind the faces of the saints.</p>`;
      this.addFame(f, `conversion of ${st.name}`);
    }
    return html;
  },

  checkDiscoveries(x, y) {
    const s = this.s;
    for (const [id, name, lon, lat, r, fame, text] of DISCOVERIES) {
      if (s.discoveries.includes(id)) continue;
      const tx = World.tx(lon), ty = World.ty(lat);
      if ((tx - x) ** 2 + (ty - y) ** 2 > r * r) continue;
      s.discoveries.push(id);
      this.log(`DISCOVERY: ${name}. ${text}`, 'discovery');
      this.addFame(fame, name);
      if (id === 'potosi') { s.treasure += 3000; }
      UI.banner(`Discovery: ${name}`, text);
    }
  },

  // ------------------------------------------------------------ sites
  interact(site, fromShip) {
    const s = this.s;
    if (site.kind === 'port') {
      if (fromShip) UI.portDialog();
      return;
    }
    if (site.kind === 'ruin') {
      if (fromShip) { UI.toast('Land an expedition to explore the ruins.'); return; }
      this.exploreRuin(site.ref);
      return;
    }
    const st = site.ref;
    if (st.conquered) { UI.colonyDialog(st, fromShip); return; }
    const cul = s.cultures[st.culture];
    if (!st.met) {
      st.met = true;
      if (!cul.met) { cul.met = true; this.log(`First contact with the ${CULTURES[st.culture].name}. ${CULTURES[st.culture].desc}`, 'big'); }
      if (cul.rel >= 0) {
        const got = this.addFood(randi(40, 90));
        if (got > 0) this.log(`The people of ${st.name} come out to greet you with gifts of food: +${got} provisions.`, 'good');
      }
    }
    this.contactDisease(st, 0.5);
    UI.encounterDialog(st);
  },

  exploreRuin(r) {
    const s = this.s;
    if (r.explored) { UI.toast(`${r.name} has already been searched.`); return; }
    r.explored = true;
    let body = '';
    if (r.artifact && !s.artifacts.includes(r.artifact)) {
      const a = ARTIFACTS[r.artifact];
      s.artifacts.push(r.artifact);
      body += `<div class="artifact-find"><span class="big-icon">${a.icon}</span><div><b>${a.name}</b><br><i>${a.desc}</i></div></div>`;
      this.log(`ARTIFACT found at ${r.name}: ${a.name}.`, 'artifact');
      this.addFame(a.fame, a.name);
      if (r.named) {
        const g = randi(80, 300); s.treasure += g;
        body += `<p>Your men also gather offerings worth <b>${g}</b> in gold and silver.</p>`;
      }
      if (r.artifact === 'youth_water') body += '<p>Your soldiers splash in the spring with great hope. Nothing happens.</p>';
    } else {
      const roll = Math.random();
      if (roll < 0.4) {
        const g = randi(80, 400); s.treasure += g;
        body += `<p>Beneath a fallen altar your men uncover a cache of gold ornaments worth <b>${g}</b>.</p>`;
        this.log(`Found ${g} in gold at ${r.name}.`, 'good');
      } else if (roll < 0.7) {
        body += '<p>Only vines, silence and carved faces watching from the stone. Whoever lived here left long ago.</p>';
      } else {
        const lost = Math.min(s.soldiers - 1, randi(1, 4));
        s.soldiers -= lost; s.stats.soldiersLost += lost; this.clampArmy();
        body += `<p>A stairway collapses and snakes swarm from the darkness. <b>${lost}</b> of your men are lost.</p>`;
        this.log(`Disaster at ${r.name}: ${lost} men lost.`, 'bad');
      }
      this.addFame(10, `exploring ${r.name}`);
    }
    UI.dialog(`🏛️ ${r.name}`, `<p class="flavor">${r.named ? 'The ancient site of ' + r.name + ', abandoned or sacred long before your arrival.' : 'Ruins hidden deep in the wilderness.'}</p>${body}`, [['Continue', () => UI.close()]]);
    UI.refresh();
  },

  // ------------------------------------------------------------ diplomacy
  strengthRatio(st) {
    const s = this.s;
    const ours = s.soldiers + s.arquebuses * 0.8 + s.horses * 2.5 + s.cannons * 5 + s.allies * 0.35;
    const theirs = this.warriors(st) * CULTURES[st.culture].t * 0.3 * (st.type === 'city' || st.type === 'capital' ? 1.3 : 1);
    return ours / Math.max(1, theirs);
  },
  changeRel(culture, delta) {
    const c = this.s.cultures[culture];
    c.rel = clamp(c.rel + delta, -100, 100);
  },
  attacked(culture) {
    this.changeRel(culture, -50);
    for (const r of CULTURES[culture].rivals) this.changeRel(r, 20);
  },

  rumor(st) {
    const s = this.s;
    let best = null, bd = 60 * 60;
    for (const r of s.ruins) {
      if (r.explored || this.isExplored(r.x, r.y)) continue;
      const d = (r.x - st.x) ** 2 + (r.y - st.y) ** 2;
      if (d < bd) { bd = d; best = r; }
    }
    if (!best) return null;
    this.reveal(best.x, best.y, 2);
    const dx = best.x - st.x, dy = best.y - st.y;
    const ang = Math.atan2(-dy, dx) * 180 / Math.PI;
    const dirs = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];
    const dir = dirs[Math.round(((ang + 360) % 360) / 45) % 8];
    return `They speak of ancient ruins to the ${dir}. (Marked on your map.)`;
  },

  conquer(st, kills) {
    const s = this.s;
    st.conquered = true;
    st.pop = Math.max(50, st.pop - kills);
    const loot = st.gold; s.treasure += loot; st.gold = 0;
    const grain = this.addFood({ village: 100, town: 200, city: 400, capital: 800 }[st.type]);
    s.stats.conquered++;
    const T = SETTLEMENT_TYPES[st.type];
    let html = `<p>${st.name} has fallen. Your men seize <b>${fmt(loot)}</b> in gold and silver${grain ? ` and <b>${grain}</b> provisions from the granaries` : ''}.</p>`;
    this.log(`${st.name} is conquered! Looted ${fmt(loot)} in treasure.`, 'good');
    this.addFame(T.fame, `conquest of ${st.name}`);
    if (st.artifact && !s.artifacts.includes(st.artifact)) {
      const a = ARTIFACTS[st.artifact];
      s.artifacts.push(st.artifact);
      this.addFame(a.fame, a.name);
      html += `<div class="artifact-find"><span class="big-icon">${a.icon}</span><div><b>${a.name}</b><br><i>${a.desc}</i></div></div>`;
    }
    if (st.cibola) html += '<p class="flavor">The fabled "golden city" of Cíbola is a town of adobe and stone. There is no gold here — only maize, turquoise and angry people.</p>';
    if (st.type === 'capital') {
      const empire = CULTURES[st.culture].name;
      html += `<p class="flavor">The heart of the ${empire} is in your hands. Its subject peoples watch to see what kind of masters the newcomers will be.</p>`;
      this.log(`The capital of the ${empire} has fallen.`, 'big');
    }
    html += `<p>${st.name} becomes a Spanish colony. It will pay tribute over time, supply provisions and recruits${this.adjacentWater(st.x, st.y) ? ', and serve as a port' : ''}.</p>`;
    UI.dialog(`⚔️ ${st.name} conquered`, html, [['Continue', () => UI.close()]]);
    UI.refresh();
  },

  clampArmy() {
    const s = this.s;
    s.soldiers = Math.max(0, Math.round(s.soldiers));
    s.horses = Math.max(0, Math.min(s.horses, s.soldiers));
    s.arquebuses = Math.max(0, Math.min(s.arquebuses, s.soldiers));
    s.allies = Math.max(0, Math.round(s.allies));
  },

  // ------------------------------------------------------------ Spain
  deliverTreasure() {
    const s = this.s;
    if (s.treasure <= 0) return;
    const fifth = Math.round(s.treasure * 0.2);
    const yours = s.treasure - fifth;
    s.crownGold += fifth; s.ducats += yours; s.treasure = 0;
    const fame = Math.floor(fifth / 25);
    this.log(`The Casa de Contratación registers your treasure. The Crown takes its royal fifth (${fmt(fifth)}); you keep ${fmt(yours)} ducats.`, 'good');
    if (fame > 0) this.addFame(fame, 'the royal fifth delivered to the King');
  },

  score() {
    const s = this.s;
    const art = s.artifacts.reduce((a, id) => a + ARTIFACTS[id].value, 0);
    return Math.round(s.fame + s.ducats / 100 + art / 10);
  },

  gameOver(cause, text) {
    if (this.s.over) return;
    this.s.over = true;
    this.log(text, 'bad');
    UI.endScreen(cause, text, false);
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  },
  endGame(text) {
    if (this.s.over) return;
    this.s.over = true;
    UI.endScreen('Retirement', text, true);
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  },

  // ------------------------------------------------------------ save / load
  save(auto) {
    if (!this.s || this.s.over) return;
    try {
      let bin = '';
      const ex = this.explored;
      for (let i = 0; i < ex.length; i += 8) {
        let b = 0;
        for (let k = 0; k < 8; k++) if (ex[i + k]) b |= 1 << k;
        bin += String.fromCharCode(b);
      }
      const data = { s: this.s, ex: btoa(bin) };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      if (!auto) UI.toast('Game saved.');
    } catch (e) { if (!auto) UI.toast('Could not save: ' + e.message); }
  },
  hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } },
  load() {
    try {
      const data = JSON.parse(localStorage.getItem(SAVE_KEY));
      this.s = data.s;
      this.explored = new Uint8Array(World.W * World.H);
      const bin = atob(data.ex);
      for (let i = 0; i < bin.length; i++) {
        const b = bin.charCodeAt(i);
        for (let k = 0; k < 8; k++) if (b & (1 << k)) this.explored[i * 8 + k] = 1;
      }
      if (this.s.priests == null) this.s.priests = 0;
      if (this.s.stats.converts == null) this.s.stats.converts = 0;
      for (const st of this.s.settlements) { if (st.converted == null) st.converted = 0; if (st.foodReadyDay == null) st.foodReadyDay = 0; }
      this.buildSiteIndex();
      return true;
    } catch (e) { console.error(e); return false; }
  },
};
