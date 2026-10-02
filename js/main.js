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
    for (const w of Raids.list()) {
      if (!inView(w.x, w.y) || !Game.isExplored(w.x, w.y)) continue;
      const t = w.movedAt ? Math.min(1, (performance.now() - w.movedAt) / 450) : 1;
      const wx = w.fx != null ? w.fx + (w.x - w.fx) * t : w.x, wy = w.fy != null ? w.fy + (w.y - w.fy) * t : w.y;
      this.drawWarParty(sx(wx), sy(wy), z, w, t < 1);
    }
    if (inView(s.port.x, s.port.y)) this.drawCastle(sx(s.port.x), sy(s.port.y), z, '#e8c040', '#b02020');
    // units
    const moving = (u) => !!((Input.anim && Input.anim.unit === u) || (Input.path.length && Game.active() === u));
    const sp = this.unitPos(s.ship);
    this.drawShip(sx(sp.x), sy(sp.y), z, s.ship.dir, !s.party, s.shipType, moving(s.ship));
    if (s.party) { const pp = this.unitPos(s.party); this.drawParty(sx(pp.x), sy(pp.y), z, s.party.dir, moving(s.party)); }
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
    m.fillStyle = '#ff2020';
    for (const w of Raids.list()) if (Game.isExplored(w.x, w.y)) m.fillRect(w.x - 1, w.y - 1, 3, 3);
    const vw = this.cw / this.zoom, vh = this.ch / this.zoom;
    m.strokeStyle = '#fff'; m.lineWidth = 1;
    m.strokeRect(this.cx - vw / 2, this.cy - vh / 2, vw, vh);
    const u = Game.active();
    m.fillStyle = '#ff3030'; m.fillRect(u.x - 2, u.y - 2, 5, 5);
  },

  // ---- sprites ----
  // Burgundy cross flag, waving. Pole top at (px, py), flies towards +x.
  drawFlag(c, px, py, w, h, t) {
    c.fillStyle = '#f4ecd8';
    c.beginPath(); c.moveTo(px, py);
    for (let i = 1; i <= 4; i++) c.lineTo(px + (w * i) / 4, py + Math.sin(t * 6 + i) * h * 0.12);
    for (let i = 4; i >= 0; i--) c.lineTo(px + (w * i) / 4, py + h + Math.sin(t * 6 + i) * h * 0.12);
    c.closePath(); c.fill();
    const wv = (i) => Math.sin(t * 6 + i) * h * 0.12;
    c.strokeStyle = '#c0202a'; c.lineWidth = Math.max(0.8, h * 0.18);
    c.beginPath(); c.moveTo(px + w * 0.1, py + h * 0.1 + wv(0.4)); c.lineTo(px + w * 0.9, py + h * 0.9 + wv(3.6));
    c.moveTo(px + w * 0.9, py + h * 0.1 + wv(3.6)); c.lineTo(px + w * 0.1, py + h * 0.9 + wv(0.4)); c.stroke();
  },

  // A square sail on a yard: centre x, top y, width, height, billow
  squareSail(c, x, top, w, h, b, cross) {
    c.fillStyle = '#efe6cf';
    c.beginPath();
    c.moveTo(x - w / 2, top); c.lineTo(x + w / 2, top);
    c.quadraticCurveTo(x + w / 2 + b, top + h / 2, x + w / 2, top + h);
    c.quadraticCurveTo(x, top + h + b * 0.6, x - w / 2, top + h);
    c.quadraticCurveTo(x - w / 2 + b, top + h / 2, x - w / 2, top);
    c.fill();
    c.strokeStyle = 'rgba(120,100,70,0.5)'; c.lineWidth = 0.4; c.stroke();
    c.strokeStyle = '#4a3018'; c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(x - w / 2 - 1, top); c.lineTo(x + w / 2 + 1, top); c.stroke();
    if (cross) {
      c.strokeStyle = '#c0202a'; c.lineWidth = Math.max(1, w * 0.12);
      c.beginPath(); c.moveTo(x - w * 0.32, top + h * 0.15); c.lineTo(x + w * 0.32, top + h * 0.85);
      c.moveTo(x + w * 0.32, top + h * 0.15); c.lineTo(x - w * 0.32, top + h * 0.85); c.stroke();
    }
  },
  // A triangular lateen sail hung from a slanted yard on a mast at x
  lateenSail(c, x, top, len, b, cross) {
    const yx0 = x - len * 0.55, yy0 = top + len * 0.55, yx1 = x + len * 0.45, yy1 = top - len * 0.05;
    c.fillStyle = '#efe6cf';
    c.beginPath(); c.moveTo(yx0, yy0); c.lineTo(yx1, yy1);
    c.quadraticCurveTo(x + b, top + len * 0.6, x, top + len * 0.85);
    c.closePath(); c.fill();
    c.strokeStyle = '#4a3018'; c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(yx0, yy0); c.lineTo(yx1, yy1); c.stroke();
    if (cross) {
      const cx = x + 0.5, cy = top + len * 0.42, r = len * 0.12;
      c.strokeStyle = '#c0202a'; c.lineWidth = Math.max(1, r * 0.5);
      c.beginPath(); c.moveTo(cx - r, cy); c.lineTo(cx + r, cy); c.moveTo(cx, cy - r); c.lineTo(cx, cy + r); c.stroke();
    }
  },

  drawShip(x, y, z, dir, active, type, moving) {
    const c = this.ctx, t = this.time;
    const size = { caravel: 0.9, nao: 1.0, galleon: 1.12 }[type] || 1;
    const k = (z / 24) * size;
    c.save(); c.translate(x + z / 2, y + z / 2 + z * 0.1);
    c.scale(dir < 0 ? -k : k, k);
    // wake and ripples on the water (drawn before the bob so they stay flat)
    c.strokeStyle = 'rgba(235,245,255,0.55)'; c.lineWidth = 1;
    if (moving) {
      for (let i = 0; i < 4; i++) {
        const ph = (t * 2 + i / 4) % 1;
        const wx = -18 - ph * 22, spread = 2 + ph * 7;
        c.globalAlpha = 0.6 * (1 - ph);
        c.beginPath(); c.moveTo(wx, 7 - spread); c.quadraticCurveTo(wx - 3, 7, wx, 7 + spread); c.stroke();
      }
      c.globalAlpha = 0.7;
      c.beginPath(); c.moveTo(20, 4); c.quadraticCurveTo(16, 8, 10, 9); c.moveTo(20, 6); c.quadraticCurveTo(18, 10, 12, 11); c.stroke();
      c.globalAlpha = 1;
    } else {
      const ph = (t * 0.7) % 1;
      c.globalAlpha = 0.4 * (1 - ph);
      c.beginPath(); c.ellipse(0, 7, 20 + ph * 6, 3 + ph * 1.5, 0, 0, 7); c.stroke();
      c.globalAlpha = 1;
    }
    if (active) {
      c.strokeStyle = `rgba(255,215,106,${0.45 + Math.sin(t * 4) * 0.2})`; c.lineWidth = 1.2;
      c.beginPath(); c.ellipse(0, 7, 22, 4.5, 0, 0, 7); c.stroke();
    }
    c.fillStyle = 'rgba(10,25,40,0.35)'; c.beginPath(); c.ellipse(0, 7.5, 18, 3, 0, 0, 7); c.fill();
    // bob and roll
    c.translate(0, Math.sin(t * 2.6) * 0.9);
    c.rotate(Math.sin(t * 1.9) * 0.035);
    const big = type !== 'caravel', gal = type === 'galleon';
    const sternH = gal ? 13 : big ? 10 : 7;
    // hull
    c.fillStyle = '#5b3a1f';
    c.beginPath();
    c.moveTo(-17, -sternH); c.lineTo(-11, -sternH); c.lineTo(-11, -3);
    c.lineTo(big ? 9 : 12, -3);
    if (big) { c.lineTo(9, -6); c.lineTo(15, -6); }
    c.lineTo(18, big ? -7 : -5);
    c.quadraticCurveTo(15, 6, 8, 8);
    c.lineTo(-12, 8);
    c.quadraticCurveTo(-17, 4, -17, -sternH);
    c.fill();
    // planking and wales
    c.strokeStyle = 'rgba(30,18,8,0.55)'; c.lineWidth = 0.5;
    for (const py of [0, 3, 6]) { c.beginPath(); c.moveTo(-16, py); c.lineTo(15 - py * 0.6, py); c.stroke(); }
    c.fillStyle = '#c9a227'; c.fillRect(-16.5, -3.6, 33.5, 1.1);
    c.fillStyle = '#7a1f1a'; c.fillRect(-16.8, -sternH, 5.8, 2.2);
    if (big) c.fillRect(9, -6, 6, 1.6);
    // stern windows
    c.fillStyle = '#e8c870';
    for (let i = 0; i < (gal ? 3 : 2); i++) c.fillRect(-15.5 + i * 1.6, -sternH + 3.5, 1, 1.6);
    // gun ports, one per cannon carried (up to the ship's size)
    const ports = Math.min(Game.s.cannons, gal ? 7 : big ? 5 : 2);
    c.fillStyle = '#1e140a';
    for (let i = 0; i < ports; i++) c.fillRect(-8 + i * (gal ? 3.2 : 4), -1.8, 1.6, 1.4);
    // bowsprit
    c.strokeStyle = '#3a2410'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(16, -6); c.lineTo(25, -11); c.stroke();
    // masts, rigging and sails
    const billow = 2.5 + Math.sin(t * 1.3) * 0.8;
    const masts = gal ? [[11, 30], [0, 38], [-9, 26]] : big ? [[10, 26], [0, 33], [-9, 22]] : [[3, 30], [-8, 22]];
    c.strokeStyle = 'rgba(40,25,10,0.6)'; c.lineWidth = 0.4;
    c.beginPath();
    for (const [mx, mh] of masts) { c.moveTo(mx, -3 - mh); c.lineTo(-16, -sternH); c.moveTo(mx, -3 - mh); c.lineTo(24, -11); }
    c.stroke();
    c.strokeStyle = '#3a2410'; c.lineWidth = 1.3;
    c.beginPath();
    for (const [mx, mh] of masts) { c.moveTo(mx, -3); c.lineTo(mx, -3 - mh); }
    c.stroke();
    if (type === 'caravel') {
      // caravela latina: lateen sails marked with a red cross
      this.lateenSail(c, 3, -31, 30, billow, true);
      this.lateenSail(c, -8, -23, 20, billow * 0.8, false);
    } else {
      const [[fx, fh], [mx, mh], [zx, zh]] = masts;
      this.squareSail(c, fx, -3 - fh + 3, 11, 10, billow, false);
      if (gal) this.squareSail(c, fx, -3 - fh + 14, 13, 8, billow, false);
      this.squareSail(c, mx, -3 - mh + 4, 12, 11, billow, false);
      this.squareSail(c, mx, -3 - mh + 16, 16, 13, billow, true);
      this.lateenSail(c, zx, -3 - zh + 2, 18, billow * 0.7, false);
      c.fillStyle = '#efe6cf';
      c.beginPath(); c.moveTo(17, -7); c.lineTo(24, -10); c.lineTo(22, -5); c.closePath(); c.fill();
    }
    // pennant on the mainmast and ensign at the stern
    const top = masts[gal || big ? 1 : 0];
    c.fillStyle = '#c0202a';
    c.beginPath(); c.moveTo(top[0], -3 - top[1]);
    c.quadraticCurveTo(top[0] - 5, -3 - top[1] - 1 + Math.sin(t * 7) * 1.2, top[0] - 11, -3 - top[1] + Math.sin(t * 7 + 1) * 1.5);
    c.lineTo(top[0], -3 - top[1] + 2); c.fill();
    c.strokeStyle = '#3a2410'; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(-17, -sternH); c.lineTo(-19, -sternH - 9); c.stroke();
    c.save(); c.scale(-1, 1); this.drawFlag(c, 19, -sternH - 9, 7, 5, t); c.restore();
    c.restore();
  },

  // ---- people ----
  figSoldier(c, fx, fy, step, i, kind) {
    const legA = step * 1.6;
    c.strokeStyle = '#3a2a1a'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(fx - 0.8, fy - 5); c.lineTo(fx - 1.2 + legA, fy); c.moveTo(fx + 0.8, fy - 5); c.lineTo(fx + 1.2 - legA, fy); c.stroke();
    c.fillStyle = i % 2 ? '#b8862a' : '#a8322a'; // puffed breeches
    c.beginPath(); c.ellipse(fx, fy - 5.5, 2.6, 1.6, 0, 0, 7); c.fill();
    c.fillStyle = kind === 'arq' ? '#7a5a3a' : '#a8322a'; c.fillRect(fx - 2.4, fy - 11, 4.8, 5.5);
    c.fillStyle = '#b8bec6'; c.fillRect(fx - 2.4, fy - 11, 4.8, 3.6); // cuirass
    c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(fx - 1.6, fy - 10.6, 1, 2.6);
    c.fillStyle = '#e0b890'; c.beginPath(); c.arc(fx + 0.3, fy - 13, 1.8, 0, 7); c.fill();
    if (kind === 'arq') {
      c.fillStyle = '#2a2018'; c.beginPath(); c.ellipse(fx + 0.3, fy - 14.4, 3.4, 0.9, 0, 0, 7); c.fill();
      c.fillRect(fx - 1.2, fy - 16.6, 3, 2.4);
      c.strokeStyle = '#5a3a1e'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(fx - 1, fy - 7.5); c.lineTo(fx + 4, fy - 10); c.stroke();
      c.strokeStyle = '#2a2a2a'; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(fx + 4, fy - 10); c.lineTo(fx + 9, fy - 12.5); c.stroke();
    } else {
      // morion helmet with crest
      c.fillStyle = '#c8ccd2';
      c.beginPath(); c.ellipse(fx + 0.3, fy - 14.3, 3.6, 1.1, 0, 0, 7); c.fill();
      c.beginPath(); c.arc(fx + 0.3, fy - 14.3, 2, Math.PI, 0); c.fill();
      c.fillStyle = '#e8ecf0'; c.fillRect(fx, fy - 17.2, 0.8, 2.4);
      // pike
      c.strokeStyle = '#6b4a2a'; c.lineWidth = 0.9;
      c.beginPath(); c.moveTo(fx + 2.6, fy - 2); c.lineTo(fx + 4.6, fy - 27); c.stroke();
      c.fillStyle = '#d8dde2';
      c.beginPath(); c.moveTo(fx + 4.6, fy - 30); c.lineTo(fx + 5.4, fy - 26.5); c.lineTo(fx + 3.9, fy - 26.6); c.fill();
    }
  },
  figBanner(c, fx, fy, step, t) {
    this.figSoldier(c, fx, fy, step, 1, 'pike');
    c.strokeStyle = '#4a3018'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(fx - 2.4, fy - 4); c.lineTo(fx - 2.4, fy - 32); c.stroke();
    this.drawFlag(c, fx - 2.4, fy - 32, 11, 7.5, t);
  },
  figFriar(c, fx, fy, step) {
    c.fillStyle = '#6b4a2e';
    c.beginPath(); c.moveTo(fx - 3.4 + step * 0.4, fy); c.lineTo(fx + 3.4 - step * 0.4, fy); c.lineTo(fx + 1.8, fy - 11); c.lineTo(fx - 1.8, fy - 11); c.fill();
    c.strokeStyle = '#e8dcc0'; c.lineWidth = 0.6;
    c.beginPath(); c.moveTo(fx - 2, fy - 7); c.lineTo(fx + 2, fy - 7); c.lineTo(fx + 1, fy - 3.5); c.stroke();
    c.fillStyle = '#5a3c24'; c.beginPath(); c.arc(fx, fy - 12.6, 2.6, 0, 7); c.fill();
    c.fillStyle = '#e0b890'; c.beginPath(); c.arc(fx + 0.7, fy - 12.6, 1.6, 0, 7); c.fill();
    c.fillStyle = '#d4a017'; c.fillRect(fx + 2.6, fy - 11, 0.8, 4); c.fillRect(fx + 1.7, fy - 10, 2.6, 0.8);
  },
  figNative(c, fx, fy, step, i, enemy) {
    const skin = ['#9a6040', '#8a5434', '#a86a46'][i % 3];
    const legA = step * 1.6;
    c.strokeStyle = skin; c.lineWidth = 1.3;
    c.beginPath(); c.moveTo(fx - 0.8, fy - 5); c.lineTo(fx - 1.2 + legA, fy); c.moveTo(fx + 0.8, fy - 5); c.lineTo(fx + 1.2 - legA, fy); c.stroke();
    c.fillStyle = i % 2 ? '#ece4cc' : '#d8c8a0'; c.fillRect(fx - 2.3, fy - 7, 4.6, 2.6); // cotton armour / loincloth
    c.fillStyle = skin; c.fillRect(fx - 2, fy - 11, 4, 4.4);
    c.beginPath(); c.arc(fx + 0.2, fy - 12.8, 1.7, 0, 7); c.fill();
    c.fillStyle = '#1a1410'; c.beginPath(); c.arc(fx + 0.1, fy - 13.4, 1.6, Math.PI, 0); c.fill();
    const feathers = enemy ? ['#2e8b57', '#d4a017', '#2e8b57'] : ['#c0392b', '#d4a017', '#2e8b57'];
    for (let j = 0; j < 3; j++) {
      c.strokeStyle = feathers[j]; c.lineWidth = 1;
      c.beginPath(); c.moveTo(fx, fy - 14); c.lineTo(fx - 2 + j * 2, fy - 18.5 + Math.abs(j - 1)); c.stroke();
    }
    if (i % 2) { // bow
      c.strokeStyle = '#5a3a1e'; c.lineWidth = 0.9;
      c.beginPath(); c.arc(fx + 2.5, fy - 9, 4.5, -1.2, 1.2); c.stroke();
      c.strokeStyle = 'rgba(240,230,200,0.7)'; c.lineWidth = 0.3;
      c.beginPath(); c.moveTo(fx + 2.5 + 4.5 * Math.cos(-1.2), fy - 9 + 4.5 * Math.sin(-1.2)); c.lineTo(fx + 2.5 + 4.5 * Math.cos(1.2), fy - 9 + 4.5 * Math.sin(1.2)); c.stroke();
    } else { // round shield and club
      c.fillStyle = enemy ? '#2e6b8a' : '#c0392b'; c.beginPath(); c.arc(fx - 2.2, fy - 8.5, 2.4, 0, 7); c.fill();
      c.strokeStyle = '#f0e0b0'; c.lineWidth = 0.5; c.beginPath(); c.arc(fx - 2.2, fy - 8.5, 1.4, 0, 7); c.stroke();
      c.strokeStyle = '#4a3018'; c.lineWidth = 1.1;
      c.beginPath(); c.moveTo(fx + 1.8, fy - 8); c.lineTo(fx + 4.5, fy - 15); c.stroke();
    }
  },
  figRider(c, fx, fy, step, i) {
    const coat = ['#6b4226', '#e4dccc', '#2a1d14', '#8a5a30'][i % 4];
    const g = step * 2;
    c.strokeStyle = coat === '#e4dccc' ? '#b8ae9c' : coat; c.lineWidth = 1.3;
    c.beginPath();
    c.moveTo(fx - 4.5, fy - 5); c.lineTo(fx - 5.5 + g, fy);
    c.moveTo(fx - 3, fy - 5); c.lineTo(fx - 2.5 - g, fy);
    c.moveTo(fx + 3.5, fy - 5); c.lineTo(fx + 4.5 - g, fy);
    c.moveTo(fx + 5, fy - 5); c.lineTo(fx + 5.5 + g, fy);
    c.stroke();
    c.fillStyle = coat;
    c.beginPath(); c.ellipse(fx, fy - 6.8, 6.5, 2.8, 0, 0, 7); c.fill();
    c.beginPath(); c.moveTo(fx + 4, fy - 8.5); c.lineTo(fx + 7.6, fy - 13); c.lineTo(fx + 9, fy - 12); c.lineTo(fx + 6.5, fy - 6); c.fill();
    c.beginPath(); c.ellipse(fx + 9, fy - 12.4, 2.4, 1.2, 0.5, 0, 7); c.fill();
    c.strokeStyle = '#1a1410'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(fx - 6.4, fy - 7.5); c.quadraticCurveTo(fx - 9, fy - 6, fx - 8.5, fy - 2.5); c.stroke();
    c.fillStyle = '#a8322a'; c.fillRect(fx - 3, fy - 9.5, 5, 2.4); // saddle cloth
    // rider
    c.fillStyle = '#b8bec6'; c.fillRect(fx - 1.8, fy - 15.5, 3.8, 6);
    c.fillStyle = '#e0b890'; c.beginPath(); c.arc(fx + 0.2, fy - 17.2, 1.7, 0, 7); c.fill();
    c.fillStyle = '#c8ccd2'; c.beginPath(); c.ellipse(fx + 0.2, fy - 18.4, 3.2, 1, 0, 0, 7); c.fill();
    c.beginPath(); c.arc(fx + 0.2, fy - 18.4, 1.8, Math.PI, 0); c.fill();
    c.strokeStyle = '#6b4a2a'; c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(fx - 5, fy - 11); c.lineTo(fx + 15, fy - 20); c.stroke();
    c.fillStyle = '#d8dde2'; c.beginPath(); c.moveTo(fx + 17, fy - 21); c.lineTo(fx + 14.4, fy - 20.6); c.lineTo(fx + 15.2, fy - 19.2); c.fill();
  },

  // the expedition: a formation that reflects the real army
  drawParty(x, y, z, dir, moving) {
    const c = this.ctx, s = Game.s, t = this.time;
    const k = (z / 24) * 1.25;
    c.save(); c.translate(x + z / 2, y + z / 2 + z * 0.2); c.scale(dir < 0 ? -k : k, k);
    const figs = [];
    const nArq = s.soldiers > 0 ? Math.min(3, Math.ceil((s.arquebuses / Math.max(1, s.soldiers)) * 4)) : 0;
    const nSol = clamp(Math.ceil(s.soldiers / 12), 1, 7);
    const nRid = s.horses > 0 ? Math.min(3, Math.ceil(s.horses / 8)) : 0;
    const nAll = s.allies + s.auxiliaries > 0 ? Math.min(6, Math.ceil((s.allies + s.auxiliaries) / 120)) : 0;
    // back rows first: allies on the far flank, friar and standard in the middle, soldiers in front
    for (let i = 0; i < nAll; i++) figs.push({ kind: 'native', x: -24 + (i % 3) * 6.5 + (i > 2 ? 3 : 0), y: -6 + Math.floor(i / 3) * 7 });
    figs.push({ kind: 'banner', x: 0, y: -7 });
    if (s.priests > 0) figs.push({ kind: 'friar', x: -8, y: -5 });
    for (let i = 0; i < nSol; i++) {
      const row = Math.floor(i / 4), col = i % 4;
      figs.push({ kind: i < nArq ? 'arq' : 'pike', x: -6 + col * 7 + (row % 2) * 3.5, y: -1 + row * 6.5 });
    }
    for (let i = 0; i < nRid; i++) figs.push({ kind: 'rider', x: 25 - (i % 2) * 5, y: -6 + i * 7 });
    figs.sort((a, b) => a.y - b.y);
    // shadow, selection ring, dust
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.beginPath(); c.ellipse(1, 5, 31, 8, 0, 0, 7); c.fill();
    c.strokeStyle = `rgba(255,215,106,${0.45 + Math.sin(t * 4) * 0.2})`; c.lineWidth = 1.2;
    c.beginPath(); c.ellipse(1, 5, 33, 9, 0, 0, 7); c.stroke();
    if (moving) {
      for (let i = 0; i < 5; i++) {
        const ph = (t * 1.5 + i / 5) % 1;
        c.fillStyle = `rgba(205,185,145,${0.35 * (1 - ph)})`;
        c.beginPath(); c.arc(-30 - ph * 10, 6 - ph * 5 + (i % 2) * 3, 2 + ph * 4, 0, 7); c.fill();
      }
    }
    figs.forEach((f, i) => {
      const step = moving ? Math.sin(t * 12 + i * 1.7) : 0;
      const bob = moving ? -Math.abs(Math.sin(t * 12 + i * 1.7)) * 0.6 : 0;
      const fy = f.y + 6 + bob;
      if (f.kind === 'pike' || f.kind === 'arq') this.figSoldier(c, f.x, fy, step, i, f.kind);
      else if (f.kind === 'banner') this.figBanner(c, f.x, fy, step, t);
      else if (f.kind === 'friar') this.figFriar(c, f.x, fy, step);
      else if (f.kind === 'native') this.figNative(c, f.x, fy, step, i, false);
      else this.figRider(c, f.x, fy, step, i);
    });
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
  // a native war party: feathered warriors behind a war standard
  drawWarParty(x, y, z, w, moving) {
    const c = this.ctx, t = this.time;
    const k = (z / 24) * 1.15;
    c.save(); c.translate(x + z / 2, y + z / 2 + z * 0.2); c.scale(w.dir < 0 ? -k : k, k);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(0, 5, 20, 6, 0, 0, 7); c.fill();
    c.strokeStyle = `rgba(230,60,50,${0.55 + Math.sin(t * 5) * 0.25})`; c.lineWidth = 1.4;
    c.beginPath(); c.ellipse(0, 5, 22, 7, 0, 0, 7); c.stroke();
    // feathered war standard
    c.strokeStyle = '#4a3018'; c.lineWidth = 1; c.beginPath(); c.moveTo(-2, 6); c.lineTo(-2, -24); c.stroke();
    const cols = ['#2e8b57', '#d4a017', '#c0392b', '#2e8b57', '#2e6b8a'];
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.35 + Math.sin(t * 3 + i) * 0.05;
      c.strokeStyle = cols[i]; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(-2, -24); c.lineTo(-2 + Math.cos(a) * 7, -24 + Math.sin(a) * 7); c.stroke();
    }
    c.fillStyle = '#d4a017'; c.beginPath(); c.arc(-2, -24, 1.8, 0, 7); c.fill();
    const n = clamp(Math.ceil(w.warriors / 150), 3, 7);
    const pos = [];
    for (let i = 0; i < n; i++) pos.push({ x: -14 + (i % 4) * 8 + (Math.floor(i / 4) % 2) * 4, y: -3 + Math.floor(i / 4) * 6 });
    pos.sort((a, b) => a.y - b.y).forEach((p, i) => {
      const step = moving ? Math.sin(t * 12 + i * 1.9) : Math.sin(t * 2 + i) * 0.2;
      this.figNative(c, p.x, p.y + 6, step, i, true);
    });
    c.restore();
    if (z >= 14) {
      c.save(); c.font = `bold ${clamp(z * 0.42, 9, 13)}px Georgia, serif`; c.textAlign = 'center';
      c.lineWidth = 3; c.strokeStyle = 'rgba(30,10,5,0.8)'; c.fillStyle = '#ff9a8a';
      const label = `${fmt(w.warriors)} warriors`;
      c.strokeText(label, x + z / 2, y - z * 0.55); c.fillText(label, x + z / 2, y - z * 0.55);
      c.restore();
    }
  },

  // a colony grows on the map as it is built up
  drawColony(x, y, z, st) {
    const c = this.ctx, b = st.buildings || {}, t = this.time;
    const total = Object.values(b).reduce((a, v) => a + v, 0);
    const k = (z / 24) * (1 + Math.min(0.5, total * 0.03));
    c.save(); c.translate(x + z / 2, y + z / 2); c.scale(k, k);
    if (b.fields) { c.fillStyle = '#c8b050'; for (let i = 0; i < Math.min(3, b.fields); i++) c.fillRect(-14 + i * 4, 6, 3, 4); }
    if (b.walls) {
      c.strokeStyle = '#b8a888'; c.lineWidth = 1 + b.walls * 0.4;
      c.beginPath(); c.ellipse(0, 3, 13, 7.5, 0, 0, 7); c.stroke();
      c.fillStyle = '#a89878';
      for (const [wx, wy] of [[-13, 3], [13, 3], [0, -4.5], [0, 10.5]]) c.fillRect(wx - 1.5, wy - 2.5, 3, 4);
    }
    // houses
    c.fillStyle = '#e8dcc4';
    const houses = Math.min(5, 1 + Math.floor(total / 3));
    for (let i = 0; i < houses; i++) { const hx = -9 + (i % 3) * 7, hy = 2 + Math.floor(i / 3) * 4; c.fillRect(hx, hy, 4.5, 3); c.fillStyle = '#a0402a'; c.fillRect(hx - 0.5, hy - 1.2, 5.5, 1.4); c.fillStyle = '#e8dcc4'; }
    // keep with flag
    c.fillStyle = '#d8cbb0'; c.fillRect(-4, -6, 8, 9);
    c.fillStyle = '#b8a888'; for (let i = -4; i < 4; i += 2.7) c.fillRect(i, -8, 1.7, 2);
    c.fillStyle = '#4a3a2a'; c.fillRect(-1.2, -1, 2.4, 4);
    c.strokeStyle = '#3a2a1a'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(0, -8); c.lineTo(0, -16); c.stroke();
    this.drawFlag(c, 0, -16, 7, 4.5, t);
    if (b.church || st.converted >= 50) {
      c.fillStyle = '#f0e6d0'; c.fillRect(6, -4, 5, 7); c.fillStyle = '#a0402a'; c.beginPath(); c.moveTo(5.5, -4); c.lineTo(8.5, -7); c.lineTo(11.5, -4); c.fill();
      c.fillStyle = '#f4ecd8'; c.fillRect(8.1, -11, 0.9, 4); c.fillRect(7.1, -10, 2.9, 0.9);
    }
    if (b.mine) { c.fillStyle = '#5a4a3a'; c.beginPath(); c.moveTo(-15, 0); c.lineTo(-11, -6); c.lineTo(-7, 0); c.fill(); c.fillStyle = '#1a1410'; c.fillRect(-12, -2, 2, 2); }
    if (st.queue && st.queue.length) { c.strokeStyle = '#8a6a3a'; c.lineWidth = 0.6; c.strokeRect(-14, -5, 4, 8); c.beginPath(); c.moveTo(-14, -1); c.lineTo(-10, -1); c.stroke(); }
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
    if (st.conquered) { this.drawColony(x, y, z, st); return; }
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
    if (st.converted >= 50) {
      c.fillStyle = '#fff4dc'; c.fillRect(-11, -12, 2, 8); c.fillRect(-13, -10, 6, 2);
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
    else if (k === 'f') Game.forage();
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
    const wp = Raids.at(t.x, t.y);
    if (wp) html += `<br><span class="bad">⚔ <b>War party</b>: ${fmt(wp.warriors)} ${CULTURES[wp.culture].name} warriors marching on ${Raids.targetName(wp)}</span>`;
    if (site && site.kind === 'settlement') {
      const st = site.ref;
      const [l, cls] = Game.relLabel(Game.s.cultures[st.culture].rel);
      html += st.conquered ? `<br>🏰 <b>${st.name}</b> — Spanish colony${st.queue && st.queue.length ? ' · building' : ''}` : `<br><b>${st.name}</b> — ${SETTLEMENT_TYPES[st.type].label}, ${CULTURES[st.culture].name}<br>Pop. ${fmt(st.pop)} · <span class="${cls}">${l}</span>`;
      if (st.converted > 0) html += `<br>✝️ ${st.converted}% Christian${st.converted >= 50 ? ' (mission)' : ''}`;
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
    if (Game.pendingBattle) {
      const pb = Game.pendingBattle; Game.pendingBattle = null;
      this.path = []; this.pending = null; this.anim = null;
      Render.free = false;
      Battle.start(pb);
      return;
    }
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
        <p>You command a <b>caravel</b> with <b>40 soldiers</b>, 4 horses, 10 arquebuses, a cannon and a Franciscan friar. Sail west with the trade winds, discover new lands, seek out ancient ruins, and win fame for yourself and the Crown before the century is out.</p>
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
