'use strict';
// ---------------------------------------------------------------------------
// Rendering, input and the main loop
// ---------------------------------------------------------------------------

const MESO_ANDEAN = new Set(['mexica', 'tlaxcala', 'totonac', 'purepecha', 'zapotec', 'mixtec', 'maya', 'itza', 'kiche', 'kaqchikel', 'pipil', 'inca', 'canari', 'huanca', 'muisca', 'tairona']);

const Render = {
  zoom: 24, cx: 0, cy: 0, free: false, fogDirty: true, hover: null, time: 0,

  init() {
    this.cv = $('#map');
    this.ctx = this.cv.getContext('2d');
    this.fog = document.createElement('canvas');
    this.fog.width = World.W; this.fog.height = World.H;
    this.fogCtx = this.fog.getContext('2d');
    this.fogImg = this.fogCtx.createImageData(World.W, World.H);
    this.mini = $('#minimap');
    this.miniCtx = this.mini.getContext('2d');
    this.mini.width = World.W; this.mini.height = World.H;
    this.lastMini = 0;
    window.addEventListener('resize', () => this.resize());
    this.resize();
  },
  resize() {
    this.dpr = window.devicePixelRatio || 1;
    this.cw = window.innerWidth; this.ch = window.innerHeight;
    this.cv.width = this.cw * this.dpr; this.cv.height = this.ch * this.dpr;
    this.cv.style.width = this.cw + 'px'; this.cv.style.height = this.ch + 'px';
  },
  zoomBy(f, px, py) {
    const nz = clamp(this.zoom * f, 6, 56);
    if (px != null) {
      // keep the tile under the cursor fixed
      const tx = this.cx + (px - this.cw / 2) / this.zoom, ty = this.cy + (py - this.ch / 2) / this.zoom;
      this.cx = tx - (px - this.cw / 2) / nz; this.cy = ty - (py - this.ch / 2) / nz;
      this.free = true;
    }
    this.zoom = nz;
  },
  screenToTile(px, py) {
    return { x: Math.floor(this.cx + (px - this.cw / 2) / this.zoom), y: Math.floor(this.cy + (py - this.ch / 2) / this.zoom) };
  },
  updateFog() {
    const d = this.fogImg.data, ex = Game.explored;
    for (let i = 0; i < ex.length; i++) {
      const o = i * 4;
      d[o] = 38; d[o + 1] = 29; d[o + 2] = 21; d[o + 3] = ex[i] ? 0 : 255;
    }
    this.fogCtx.putImageData(this.fogImg, 0, 0);
    this.fogDirty = false;
  },
  unitPos(u) {
    const a = Input.anim;
    if (a && a.unit === u) {
      const t = a.t * a.t * (3 - 2 * a.t);
      return { x: a.fx + (u.x - a.fx) * t, y: a.fy + (u.y - a.fy) * t };
    }
    return { x: u.x, y: u.y };
  },

  blit(img, s, x0, y0, vw, vh) {
    const z = this.zoom, W = World.W, H = World.H;
    const sx0 = Math.max(0, x0), sy0 = Math.max(0, y0), sx1 = Math.min(W, x0 + vw), sy1 = Math.min(H, y0 + vh);
    if (sx1 <= sx0 || sy1 <= sy0) return;
    this.ctx.drawImage(img, sx0 * s, sy0 * s, (sx1 - sx0) * s, (sy1 - sy0) * s, (sx0 - x0) * z, (sy0 - y0) * z, (sx1 - sx0) * z, (sy1 - sy0) * z);
  },

  frame(dt) {
    this.time += dt;
    const s = Game.s, ctx = this.ctx, z = this.zoom;
    if (!s) return;
    if (this.fogDirty) this.updateFog();
    const u = Game.active();
    const up = this.unitPos(u);
    if (!this.free) {
      const k = Math.min(1, dt * 6);
      this.cx += (up.x + 0.5 - this.cx) * k; this.cy += (up.y + 0.5 - this.cy) * k;
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#261d15';
    ctx.fillRect(0, 0, this.cw, this.ch);
    const vw = this.cw / z, vh = this.ch / z;
    const x0 = this.cx - vw / 2, y0 = this.cy - vh / 2;
    ctx.imageSmoothingEnabled = false;
    this.blit(World.terrainCanvas, TP, x0, y0, vw, vh);
    const sx = (x) => (x - x0) * z, sy = (y) => (y - y0) * z;
    const tx0 = Math.max(0, Math.floor(x0)), ty0 = Math.max(0, Math.floor(y0));
    const tx1 = Math.min(World.W - 1, Math.ceil(x0 + vw)), ty1 = Math.min(World.H - 1, Math.ceil(y0 + vh));

    // animated waves
    if (z >= 14) {
      ctx.strokeStyle = 'rgba(200,225,255,0.22)'; ctx.lineWidth = Math.max(1, z / 16);
      ctx.beginPath();
      for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
        if (World.t(x, y) !== TT.DEEP || hash2(x, y, 77) > 0.12) continue;
        const ph = (this.time * 0.6 + hash2(x, y, 78) * 6) % 6;
        if (ph > 3) continue;
        const ox = sx(x + 0.2 + ph * 0.12), oy = sy(y + 0.5);
        ctx.moveTo(ox, oy); ctx.quadraticCurveTo(ox + z * 0.15, oy - z * 0.12, ox + z * 0.3, oy);
      }
      ctx.stroke();
    }
    // Tordesillas line
    if (s.tordesillas) {
      const lx = sx((-46.37 - GEO.LON_MIN) * GEO.RES);
      ctx.save(); ctx.setLineDash([z * 0.4, z * 0.3]); ctx.strokeStyle = 'rgba(180,40,40,0.55)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, this.ch); ctx.stroke(); ctx.restore();
    }
    // planned path
    if (Input.path.length) {
      ctx.fillStyle = 'rgba(255,240,180,0.85)';
      for (const p of Input.path) { ctx.beginPath(); ctx.arc(sx(p.x + 0.5), sy(p.y + 0.5), Math.max(1.5, z * 0.08), 0, 7); ctx.fill(); }
    }
    // sites
    const inView = (x, y) => x >= tx0 - 1 && x <= tx1 + 1 && y >= ty0 - 1 && y <= ty1 + 1;
    for (const r of s.ruins) if (inView(r.x, r.y) && Game.isExplored(r.x, r.y)) this.drawRuin(sx(r.x), sy(r.y), z, r);
    for (const st of s.settlements) if (inView(st.x, st.y) && Game.isExplored(st.x, st.y)) this.drawSettlement(sx(st.x), sy(st.y), z, st);
    if (inView(s.port.x, s.port.y)) this.drawCastle(sx(s.port.x), sy(s.port.y), z, '#e8c040', '#b02020');
    // units
    const sp = this.unitPos(s.ship);
    this.drawShip(sx(sp.x), sy(sp.y), z, s.ship.dir, !s.party);
    if (s.party) { const pp = this.unitPos(s.party); this.drawParty(sx(pp.x), sy(pp.y), z, s.party.dir); }
    // fog of war, smooth-edged
    ctx.imageSmoothingEnabled = true;
    this.blit(this.fog, 1, x0, y0, vw, vh);
    // region labels for discoveries
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const fs = clamp(z * 0.7, 10, 22);
    ctx.font = `italic ${fs}px "IM Fell English", Georgia, serif`;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(30,20,10,0.6)'; ctx.fillStyle = 'rgba(255,240,205,0.85)';
    for (const [id, name, lon, lat] of DISCOVERIES) {
      if (!s.discoveries.includes(id)) continue;
      const x = sx((lon - GEO.LON_MIN) * GEO.RES), y = sy((GEO.LAT_MAX - lat) * GEO.RES) - z * 1.2;
      if (x < -200 || x > this.cw + 200 || y < -50 || y > this.ch + 50) continue;
      ctx.strokeText(name, x, y); ctx.fillText(name, x, y);
    }
    if (z >= 16) {
      ctx.font = `${clamp(z * 0.45, 9, 14)}px Georgia, serif`;
      for (const st of s.settlements) {
        if (!inView(st.x, st.y) || !Game.isExplored(st.x, st.y)) continue;
        const x = sx(st.x + 0.5), y = sy(st.y + 1.15);
        ctx.strokeText(st.name, x, y); ctx.fillStyle = st.conquered ? '#ffd76a' : '#fff4dc'; ctx.fillText(st.name, x, y);
      }
      ctx.fillStyle = '#ffd76a';
      ctx.strokeText('Sevilla', sx(s.port.x + 0.5), sy(s.port.y + 1.15)); ctx.fillText('Sevilla', sx(s.port.x + 0.5), sy(s.port.y + 1.15));
    }
    // hover
    if (this.hover && !UI.open) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(sx(this.hover.x) + 0.5, sy(this.hover.y) + 0.5, z - 1, z - 1);
    }
    if (this.time - this.lastMini > 0.5) { this.lastMini = this.time; this.drawMini(); }
  },

  drawMini() {
    const m = this.miniCtx, s = Game.s;
    m.imageSmoothingEnabled = true;
    m.drawImage(World.terrainCanvas, 0, 0, World.W, World.H);
    m.imageSmoothingEnabled = false;
    m.drawImage(this.fog, 0, 0);
    for (const st of s.settlements) if (st.conquered) { m.fillStyle = '#ffd040'; m.fillRect(st.x - 1, st.y - 1, 3, 3); }
    const vw = this.cw / this.zoom, vh = this.ch / this.zoom;
    m.strokeStyle = '#fff'; m.lineWidth = 1;
    m.strokeRect(this.cx - vw / 2, this.cy - vh / 2, vw, vh);
    const u = Game.active();
    m.fillStyle = '#ff3030'; m.fillRect(u.x - 2, u.y - 2, 5, 5);
  },

  // ---- sprites ----
  drawShip(x, y, z, dir, active) {
    const c = this.ctx, k = z / 24;
    c.save(); c.translate(x + z / 2, y + z / 2); c.scale(dir < 0 ? -k : k, k);
    const bob = Math.sin(this.time * 3) * 0.8;
    c.translate(0, bob);
    if (active) { c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.ellipse(0, 7, 13, 4, 0, 0, 7); c.fill(); }
    c.fillStyle = '#5a3a1e';
    c.beginPath(); c.moveTo(-11, 2); c.lineTo(11, 2); c.lineTo(8, 8); c.lineTo(-8, 8); c.closePath(); c.fill();
    c.fillStyle = '#7a5230'; c.fillRect(-11, 1, 22, 2);
    c.strokeStyle = '#3a2410'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(0, 2); c.lineTo(0, -12); c.moveTo(-6, 2); c.lineTo(-6, -6); c.stroke();
    c.fillStyle = '#f4ecd8';
    c.beginPath(); c.moveTo(-5, -11); c.quadraticCurveTo(0, -9, 5, -11); c.lineTo(5, -1); c.quadraticCurveTo(0, 0, -5, -1); c.closePath(); c.fill();
    c.strokeStyle = '#c0202a'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(-3.5, -9); c.lineTo(3.5, -2.5); c.moveTo(3.5, -9); c.lineTo(-3.5, -2.5); c.stroke();
    c.fillStyle = '#e9dfc6'; c.beginPath(); c.moveTo(-6, -6); c.lineTo(-10, 0); c.lineTo(-6, 0); c.fill();
    c.fillStyle = '#d4a017'; c.fillRect(0, -15, 5, 3);
    c.restore();
  },
  drawParty(x, y, z, dir) {
    const c = this.ctx, k = z / 24;
    c.save(); c.translate(x + z / 2, y + z / 2); c.scale(k, k);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(0, 9, 11, 3, 0, 0, 7); c.fill();
    const fig = (fx, col) => {
      c.fillStyle = col; c.fillRect(fx - 2.5, -1, 5, 7);
      c.fillStyle = '#3a2a1a'; c.fillRect(fx - 2, 6, 1.6, 3); c.fillRect(fx + 0.4, 6, 1.6, 3);
      c.fillStyle = '#e0b890'; c.beginPath(); c.arc(fx, -3, 2.2, 0, 7); c.fill();
      c.fillStyle = '#c8ccd2'; c.beginPath(); c.ellipse(fx, -4.6, 3.6, 1.4, 0, 0, 7); c.fill();
      c.fillRect(fx - 0.6, -7, 1.2, 2);
    };
    fig(-6, '#a8322a'); fig(6, '#a8322a'); fig(0, '#d0a020');
    c.strokeStyle = '#3a2410'; c.lineWidth = 1; c.beginPath(); c.moveTo(3, 6); c.lineTo(3, -14); c.stroke();
    c.fillStyle = '#f4ecd8'; c.fillRect(3, -14, 8 * (dir < 0 ? -1 : 1), 6);
    c.strokeStyle = '#c0202a'; c.beginPath();
    const fx = dir < 0 ? -1 : 1;
    c.moveTo(3, -14); c.lineTo(3 + 8 * fx, -8); c.moveTo(3 + 8 * fx, -14); c.lineTo(3, -8); c.stroke();
    c.restore();
  },
  drawCastle(x, y, z, flag, flag2) {
    const c = this.ctx, k = z / 24;
    c.save(); c.translate(x + z / 2, y + z / 2); c.scale(k, k);
    c.fillStyle = '#d8cbb0'; c.fillRect(-8, -4, 16, 12);
    c.fillStyle = '#b8a888';
    for (let i = -8; i < 8; i += 4) c.fillRect(i, -7, 2.5, 3);
    c.fillRect(-3, -10, 6, 6);
    c.fillStyle = '#4a3a2a'; c.fillRect(-2, 2, 4, 6);
    c.strokeStyle = '#3a2a1a'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -10); c.lineTo(0, -18); c.stroke();
    c.fillStyle = flag2; c.fillRect(0, -18, 7, 2); c.fillStyle = flag; c.fillRect(0, -16, 7, 2); c.fillStyle = flag2; c.fillRect(0, -14, 7, 1.5);
    c.restore();
  },
  drawRuin(x, y, z, r) {
    const c = this.ctx, k = z / 24;
    c.save(); c.translate(x + z / 2, y + z / 2); c.scale(k, k);
    c.globalAlpha = r.explored ? 0.55 : 1;
    c.fillStyle = '#9a958a';
    c.fillRect(-9, 4, 18, 4); c.fillRect(-6, 0, 12, 4); c.fillRect(-3, -4, 5, 4);
    c.fillStyle = '#6f6a60'; c.fillRect(4, -2, 3, 2); c.fillRect(-9, 7, 18, 1);
    c.fillStyle = '#3c6b2c'; c.fillRect(-8, 3, 3, 1); c.fillRect(5, 1, 2, 3);
    if (!r.explored) { c.fillStyle = '#ffd76a'; c.font = 'bold 10px Georgia'; c.textAlign = 'center'; c.fillText('?', 0, -7); }
    c.restore();
  },
  drawSettlement(x, y, z, st) {
    const c = this.ctx, k = z / 24, s = Game.s;
    if (st.conquered) { this.drawCastle(x, y, z, '#e8c040', '#b02020'); return; }
    const size = { village: 0.75, town: 0.9, city: 1.05, capital: 1.25 }[st.type];
    c.save(); c.translate(x + z / 2, y + z / 2); c.scale(k * size, k * size);
    const [, cls] = Game.relLabel(s.cultures[st.culture].rel);
    const ring = { good: '#4cc060', neutral: '#e0c040', warn: '#e08030', bad: '#e04040' }[cls];
    c.strokeStyle = ring; c.lineWidth = 2;
    c.beginPath(); c.ellipse(0, 7, 12, 4, 0, 0, 7); c.stroke();
    if (MESO_ANDEAN.has(st.culture) && st.type !== 'village') {
      c.fillStyle = '#d8c8a0';
      c.fillRect(-10, 2, 20, 5); c.fillRect(-7, -3, 14, 5); c.fillRect(-4, -8, 8, 5);
      c.fillStyle = st.type === 'capital' ? '#e8b820' : '#b04030'; c.fillRect(-2.5, -12, 5, 4);
      c.fillStyle = '#a89870'; c.fillRect(-1.5, -8, 3, 15);
    } else {
      const hut = (hx, hy, s2) => {
        c.fillStyle = '#9a6a3a'; c.fillRect(hx - 4 * s2, hy, 8 * s2, 5 * s2);
        c.fillStyle = '#c8a050'; c.beginPath(); c.moveTo(hx - 6 * s2, hy + 0.5); c.lineTo(hx, hy - 6 * s2); c.lineTo(hx + 6 * s2, hy + 0.5); c.fill();
      };
      hut(-5, 1, 0.85); hut(5, 2, 0.8); hut(0, -2, 1);
    }
    if (st.infection) {
      c.fillStyle = '#8a3cc8'; c.beginPath(); c.arc(9, -8, 3.5, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.font = 'bold 6px sans-serif'; c.textAlign = 'center'; c.fillText('☠', 9, -6);
    }
    c.restore();
  },
};

// ---------------------------------------------------------------------------
const Input = {
  path: [], anim: null, pending: null, drag: null, keyCooldown: 0,

  init() {
    const cv = Render.cv;
    cv.addEventListener('pointerdown', (e) => { this.drag = { x: e.clientX, y: e.clientY, cx: Render.cx, cy: Render.cy, moved: false }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => {
      const t = Render.screenToTile(e.clientX, e.clientY);
      Render.hover = t;
      if (this.drag) {
        const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
        if (Math.hypot(dx, dy) > 6) this.drag.moved = true;
        if (this.drag.moved) { Render.free = true; Render.cx = this.drag.cx - dx / Render.zoom; Render.cy = this.drag.cy - dy / Render.zoom; }
        $('#tooltip').style.display = 'none';
      } else this.tooltip(e.clientX, e.clientY, t);
    });
    cv.addEventListener('pointerup', (e) => {
      const d = this.drag; this.drag = null;
      if (!d || d.moved || UI.open || !Game.s || Game.s.over) return;
      const t = Render.screenToTile(e.clientX, e.clientY);
      if (World.inb(t.x, t.y)) this.order(t.x, t.y);
    });
    cv.addEventListener('pointerleave', () => { Render.hover = null; $('#tooltip').style.display = 'none'; });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); Render.zoomBy(e.deltaY < 0 ? 1.15 : 0.87, e.clientX, e.clientY); }, { passive: false });
    Render.mini.addEventListener('click', (e) => {
      const r = Render.mini.getBoundingClientRect();
      Render.cx = ((e.clientX - r.left) / r.width) * World.W; Render.cy = ((e.clientY - r.top) / r.height) * World.H; Render.free = true;
    });
    window.addEventListener('keydown', (e) => this.key(e));
  },

  key(e) {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'Escape' && UI.open && UI.closable) { UI.close(); return; }
    if (UI.open || !Game.s || Game.s.over) return;
    const k = e.key.toLowerCase();
    const dirs = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0], q: [-1, -1], e: [1, -1], z: [-1, 1], c: [1, 1] };
    if (dirs[k]) {
      e.preventDefault();
      if (this.anim || this.path.length) return;
      const u = Game.active();
      this.pending = null;
      this.path = [{ x: u.x + dirs[k][0], y: u.y + dirs[k][1] }];
      Render.free = false;
    } else if (k === ' ') { e.preventDefault(); Render.free = false; }
    else if (k === 'l') this.landOrEmbark();
    else if (k === '+' || k === '=') Render.zoomBy(1.25);
    else if (k === '-') Render.zoomBy(0.8);
  },

  stop() { this.path = []; this.pending = null; },

  tooltip(px, py, t) {
    const tip = $('#tooltip');
    if (!Game.s || UI.open || !World.inb(t.x, t.y) || !Game.isExplored(t.x, t.y)) { tip.style.display = 'none'; return; }
    const lat = World.lat(t.y), lon = World.lon(t.x);
    let html = `<b>${TERRAIN[World.t(t.x, t.y)].name}</b> <small>${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(1)}°W</small>`;
    const site = Game.site(t.x, t.y);
    if (site && site.kind === 'settlement') {
      const st = site.ref;
      const [l, cls] = Game.relLabel(Game.s.cultures[st.culture].rel);
      html += st.conquered ? `<br>⛪ <b>${st.name}</b> — Spanish colony` : `<br><b>${st.name}</b> — ${SETTLEMENT_TYPES[st.type].label}, ${CULTURES[st.culture].name}<br>Pop. ${fmt(st.pop)} · <span class="${cls}">${l}</span>`;
      if (st.infection) html += `<br><span class="disease">☠ ${DISEASES.find((d) => d.id === st.infection.d).name} epidemic</span>`;
    } else if (site && site.kind === 'ruin') html += `<br>🏛️ <b>${site.ref.name}</b>${site.ref.explored ? ' (searched)' : ' — unexplored ruins'}`;
    else if (site && site.kind === 'port') html += '<br>🏰 <b>Sevilla</b> — home port. Sail next to it to trade and recruit.';
    if (World.shipOK(t.x, t.y) && !World.landOK(t.x, t.y)) { const w = Game.windAt(lat); html += `<br><small>🌬️ ${w.name}</small>`; }
    tip.innerHTML = html;
    tip.style.display = 'block';
    tip.style.left = Math.min(px + 16, window.innerWidth - 260) + 'px';
    tip.style.top = Math.min(py + 16, window.innerHeight - 100) + 'px';
  },

  landOrEmbark() {
    const s = Game.s;
    if (UI.open || s.over) return;
    if (s.party) {
      if (Game.partyAdjacentToShip()) Game.embark();
      else this.order(s.ship.x, s.ship.y);
      return;
    }
    for (const [dx, dy] of DIRS8) {
      const x = s.ship.x + dx, y = s.ship.y + dy;
      if (World.landOK(x, y) && !Game.site(x, y)) { this.stop(); Game.disembark(x, y); return; }
    }
    UI.toast('No New World shore next to the ship. Click on land to sail there and go ashore.');
  },

  order(tx, ty) {
    const s = Game.s;
    this.pending = null;
    Render.free = false;
    if (s.party) {
      const p = s.party;
      if ((tx === s.ship.x && ty === s.ship.y) || (!World.landOK(tx, ty) && World.shipOK(tx, ty))) {
        if (Game.partyAdjacentToShip()) { Game.embark(); return; }
        const path = World.findPath(p.x, p.y, s.ship.x, s.ship.y, (x, y) => World.landOK(x, y), (x, y) => Game.landCost(x, y));
        if (!path) { UI.toast('Your expedition cannot find a way back to the ship.'); return; }
        this.path = path; return;
      }
      if (tx === p.x && ty === p.y) return;
      const site = Game.site(tx, ty);
      if (!World.landOK(tx, ty) && !site) { UI.toast('Your expedition cannot go there.'); return; }
      const path = World.findPath(p.x, p.y, tx, ty, (x, y) => World.landOK(x, y), (x, y) => Game.landCost(x, y));
      if (!path) { UI.toast('No route over land. Return to the ship and sail there.'); return; }
      this.path = path;
      return;
    }
    // at sea
    const sh = s.ship;
    if (World.shipOK(tx, ty)) {
      if (World.waterComp[World.idx(tx, ty)] !== World.waterComp[World.idx(sh.x, sh.y)]) { UI.toast('Your ship cannot reach those waters.'); return; }
      const path = World.findPath(sh.x, sh.y, tx, ty, (x, y) => World.shipOK(x, y), () => 1);
      if (path) this.path = path;
      return;
    }
    this.shipToLand(tx, ty);
  },

  shipToLand(tx, ty) {
    const s = Game.s, sh = s.ship, W = World.W;
    const site = Game.site(tx, ty);
    const isPort = site && site.kind === 'port';
    if (!isPort && !World.landOK(tx, ty)) { UI.toast('Your men have no business wandering the Old World. Sail west!'); return; }
    const myComp = World.waterComp[World.idx(sh.x, sh.y)];
    const targetComp = World.landComp[World.idx(tx, ty)];
    let best = null, bestScore = Infinity;
    for (let y = 0; y < World.H; y++) for (let x = 0; x < W; x++) {
      if (World.waterComp[y * W + x] !== myComp) continue;
      for (const [dx, dy] of DIRS8) {
        const lx = x + dx, ly = y + dy;
        if (!World.inb(lx, ly)) continue;
        const ok = isPort ? (lx === tx && ly === ty) : (World.landOK(lx, ly) && World.landComp[ly * W + lx] === targetComp);
        if (!ok) continue;
        const sc = Math.hypot(lx - tx, ly - ty) * 10 + Math.hypot(x - sh.x, y - sh.y) * 0.01;
        if (sc < bestScore) { bestScore = sc; best = { wx: x, wy: y, lx, ly }; }
      }
    }
    if (!best) { UI.toast('No reachable shore near there.'); return; }
    const path = World.findPath(sh.x, sh.y, best.wx, best.wy, (x, y) => World.shipOK(x, y), () => 1);
    if (!path) { UI.toast('No sea route found.'); return; }
    this.path = path;
    this.pending = { lx: best.lx, ly: best.ly, tx, ty };
    if (!path.length) this.runPending();
  },

  runPending() {
    const pd = this.pending; this.pending = null;
    if (!pd) return;
    const s = Game.s;
    const site = Game.site(pd.lx, pd.ly);
    if (site) { Game.interact(site, true); return; }
    if (!Game.disembark(pd.lx, pd.ly)) return;
    if (pd.lx !== pd.tx || pd.ly !== pd.ty) {
      const path = World.findPath(pd.lx, pd.ly, pd.tx, pd.ty, (x, y) => World.landOK(x, y), (x, y) => Game.landCost(x, y));
      if (path) this.path = path;
    }
    void s;
  },

  update(dt) {
    if (UI.open || !Game.s || Game.s.over) return;
    if (this.anim) {
      this.anim.t += dt / this.anim.dur;
      if (this.anim.t < 1) return;
      this.anim = null;
    }
    if (!this.path.length) return;
    const next = this.path.shift();
    const unit = Game.active();
    const fx = unit.x, fy = unit.y, onLand = !!Game.s.party;
    const ok = Game.step(next.x, next.y);
    if (unit.x !== fx || unit.y !== fy) this.anim = { unit, fx, fy, t: 0, dur: onLand ? 0.17 : 0.1 };
    if (!ok) { this.path = []; this.pending = null; }
    else if (!this.path.length && this.pending) this.runPending();
    UI.refresh();
  },
};

// ---------------------------------------------------------------------------
const Main = {
  start(loaded) {
    $('#title-screen').classList.add('hidden');
    $('#game-ui').classList.remove('hidden');
    UI.rebuildLog();
    Render.fogDirty = true;
    const u = Game.active();
    Render.cx = u.x + 0.5; Render.cy = u.y + 0.5;
    UI.refresh();
    if (!loaded) {
      UI.dialog('⚓ Sevilla, August 1492', `<p class="flavor">Their Catholic Majesties have granted you a royal charter to sail west across the Ocean Sea. Some say you will reach the Indies. Others say you will fall off the edge of the world.</p>
        <p>You command a <b>caravel</b> with <b>40 soldiers</b>, 4 horses, 10 arquebuses and a cannon. Sail west with the trade winds, discover new lands, seek out ancient ruins, and win fame for yourself and the Crown before the century is out.</p>
        <p class="small">Click the map to sail. Click land to send an expedition ashore. Sail next to the castle of Sevilla to trade and recruit. Press ❓ for help.</p>`,
      [['Visit the Casa de Contratación first', () => UI.portDialog()], ['Set sail!', () => UI.close()]]);
    }
    let last = performance.now();
    const loop = (t) => {
      const dt = Math.min(0.1, (t - last) / 1000); last = t;
      Input.update(dt);
      Render.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },
};

window.addEventListener('load', () => {
  setTimeout(() => {
    World.generate();
    World.render();
    Render.init();
    Input.init();
    UI.init();
    $('#loading').classList.add('hidden');
    $('#title-menu').classList.remove('hidden');
    if (!Game.hasSave()) $('#btn-continue').style.display = 'none';
    $('#btn-new').addEventListener('click', () => { Game.newGame($('#captain').value.trim() || 'Capitán'); Main.start(false); });
    $('#btn-continue').addEventListener('click', () => { if (Game.load()) Main.start(true); else UI.toast('Save could not be loaded.'); });
    $('#btn-howto').addEventListener('click', () => UI.help());
    window.__ready = true;
  }, 30);
});
