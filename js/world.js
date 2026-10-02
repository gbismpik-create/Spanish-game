'use strict';
// ---------------------------------------------------------------------------
// World: tile map generated from the geographic outlines in data.js
// ---------------------------------------------------------------------------

const TT = { DEEP: 0, SEA: 1, RIVER: 2, LAKE: 3, GRASS: 10, FOREST: 11, JUNGLE: 12, DESERT: 13, SAVANNA: 14, MOUNTAIN: 15, STEPPE: 16 };
const TERRAIN = {
  0: { name: 'Open Ocean', color: [28, 74, 118] },
  1: { name: 'Coastal Waters', color: [46, 108, 152] },
  2: { name: 'River', color: [56, 124, 170], cost: 3 },
  3: { name: 'Lake', color: [56, 124, 170] },
  10: { name: 'Grassland', color: [140, 176, 88], cost: 1.5 },
  11: { name: 'Forest', color: [84, 136, 62], cost: 2.5 },
  12: { name: 'Jungle', color: [46, 106, 50], cost: 3.5 },
  13: { name: 'Desert', color: [216, 190, 136], cost: 2.5 },
  14: { name: 'Savanna', color: [190, 182, 98], cost: 1.5 },
  15: { name: 'Mountains', color: [138, 124, 106], cost: 4.5 },
  16: { name: 'Steppe', color: [180, 170, 122], cost: 1.5 },
};
const TP = 8; // pixels per tile in the pre-rendered terrain image
const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

function hash2(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function distToPolyline(x, y, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const dx = bx - ax, dy = by - ay;
    const L = dx * dx + dy * dy;
    let t = L ? ((x - ax) * dx + (y - ay) * dy) / L : 0;
    t = Math.max(0, Math.min(1, t));
    const px = ax + t * dx - x, py = ay + t * dy - y;
    best = Math.min(best, Math.hypot(px, py));
  }
  if (pts.length === 1) best = Math.hypot(pts[0][0] - x, pts[0][1] - y);
  return best;
}

const World = {
  W: GEO.W, H: GEO.H,
  tiles: null, oldWorld: null, landComp: null, waterComp: null, terrainCanvas: null,

  idx(x, y) { return y * this.W + x; },
  inb(x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H; },
  lon(x) { return GEO.LON_MIN + (x + 0.5) / GEO.RES; },
  lat(y) { return GEO.LAT_MAX - (y + 0.5) / GEO.RES; },
  tx(lon) { return Math.floor((lon - GEO.LON_MIN) * GEO.RES); },
  ty(lat) { return Math.floor((GEO.LAT_MAX - lat) * GEO.RES); },
  t(x, y) { return this.tiles[y * this.W + x]; },
  isWater(x, y) { return this.tiles[y * this.W + x] < 10; },
  shipOK(x, y) {
    if (!this.inb(x, y)) return false;
    const t = this.tiles[y * this.W + x];
    return t === TT.DEEP || t === TT.SEA || t === TT.RIVER;
  },
  landOK(x, y) {
    if (!this.inb(x, y)) return false;
    const i = y * this.W + x, t = this.tiles[i];
    return (t >= 10 || t === TT.RIVER) && !this.oldWorld[i];
  },
  isLandTile(x, y) { return this.inb(x, y) && this.tiles[y * this.W + x] >= 10; },

  baseBiome(lon, lat) {
    if (lon > GEO.OLD_WORLD_LON) {
      if (lat > 36) return TT.GRASS;
      if (lat > 15) return TT.DESERT;
      if (lat > 8) return TT.SAVANNA;
      return TT.JUNGLE;
    }
    if (lat > 30) return lon < -97 ? TT.GRASS : TT.FOREST;
    if (lat > 22) return lon > -91 ? TT.FOREST : (lon < -100 ? TT.DESERT : TT.GRASS);
    if (lat > -15) return (lat > 18 && lon < -97 && lon > -106) ? TT.GRASS : TT.JUNGLE;
    if (lat > -30) return lon > -50 ? TT.FOREST : TT.SAVANNA;
    if (lat > -39) return lon > -68 ? TT.GRASS : (lat > -36 ? TT.GRASS : TT.FOREST);
    return lon > -71.5 ? TT.STEPPE : TT.FOREST;
  },

  generate() {
    const W = this.W, H = this.H;
    const tiles = new Uint8Array(W * H);
    this.oldWorld = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      const lat = this.lat(y);
      for (let x = 0; x < W; x++) {
        const lon = this.lon(x);
        let land = false;
        for (const p of LAND_POLYS) if (pointInPoly(lon, lat, p)) { land = true; break; }
        if (!land) for (const [cx, cy, r] of LAND_CIRCLES) if ((lon - cx) ** 2 + (lat - cy) ** 2 <= r * r) { land = true; break; }
        tiles[y * W + x] = land ? 1 : 0;
        if (lon > GEO.OLD_WORLD_LON) this.oldWorld[y * W + x] = 1;
      }
    }
    // make sure every small island has at least one tile
    for (const [cx, cy] of LAND_CIRCLES) {
      const x = this.tx(cx), y = this.ty(cy);
      if (this.inb(x, y)) tiles[y * W + x] = 1;
    }
    // biomes
    for (let y = 0; y < H; y++) {
      const lat = this.lat(y);
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!tiles[i]) continue;
        const lon = this.lon(x);
        let t = this.baseBiome(lon, lat);
        if (lon < GEO.OLD_WORLD_LON) {
          for (const b of BIOME_POLYS) if (pointInPoly(lon, lat, b.pts)) t = TT[b.t];
          for (const m of MOUNTAINS) if (distToPolyline(lon, lat, m.pts) <= m.w) { t = TT.MOUNTAIN; break; }
        }
        tiles[i] = t;
      }
    }
    // rivers and lakes
    for (let y = 0; y < H; y++) {
      const lat = this.lat(y);
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (tiles[i] < 10) continue;
        const lon = this.lon(x);
        for (const r of RIVERS) if (distToPolyline(lon, lat, r.pts) <= r.w) { tiles[i] = TT.RIVER; break; }
        for (const [cx, cy, r] of LAKES) if ((lon - cx) ** 2 + (lat - cy) ** 2 <= r * r) tiles[i] = TT.LAKE;
      }
    }
    // coastal shallows (within 2 tiles of land)
    const dist = new Int16Array(W * H).fill(99);
    let q = [];
    for (let i = 0; i < W * H; i++) if (tiles[i] >= 10) { dist[i] = 0; q.push(i); }
    for (let d = 1; d <= 2; d++) {
      const nq = [];
      for (const i of q) {
        const x = i % W, y = (i / W) | 0;
        for (const [dx, dy] of DIRS8) {
          const nx = x + dx, ny = y + dy;
          if (!this.inb(nx, ny)) continue;
          const j = ny * W + nx;
          if (dist[j] > d) { dist[j] = d; nq.push(j); }
        }
      }
      q = nq;
    }
    for (let i = 0; i < W * H; i++) if (tiles[i] === TT.DEEP && dist[i] <= 2) tiles[i] = TT.SEA;
    this.tiles = tiles;
    this.waterComp = this.components((x, y) => this.shipOK(x, y));
    this.landComp = this.components((x, y) => this.landOK(x, y));
  },

  // diagonal moves are blocked when both orthogonal neighbours are impassable
  canStep(x, y, dx, dy, ok) {
    if (!ok(x + dx, y + dy)) return false;
    if (dx && dy && !ok(x + dx, y) && !ok(x, y + dy)) return false;
    return true;
  },

  components(ok) {
    const W = this.W, H = this.H, comp = new Int32Array(W * H).fill(-1);
    let id = 0;
    for (let s = 0; s < W * H; s++) {
      const sx = s % W, sy = (s / W) | 0;
      if (comp[s] >= 0 || !ok(sx, sy)) continue;
      const stack = [s]; comp[s] = id;
      while (stack.length) {
        const i = stack.pop(), x = i % W, y = (i / W) | 0;
        for (const [dx, dy] of DIRS8) {
          if (!this.canStep(x, y, dx, dy, ok)) continue;
          const j = (y + dy) * W + x + dx;
          if (comp[j] < 0) { comp[j] = id; stack.push(j); }
        }
      }
      id++;
    }
    return comp;
  },

  nearestLand(lon, lat, taken) {
    const fx = (lon - GEO.LON_MIN) * GEO.RES - 0.5, fy = (GEO.LAT_MAX - lat) * GEO.RES - 0.5;
    let best = null, bd = Infinity;
    const cx = Math.round(fx), cy = Math.round(fy);
    for (let y = cy - 6; y <= cy + 6; y++) for (let x = cx - 6; x <= cx + 6; x++) {
      if (!this.inb(x, y) || this.tiles[this.idx(x, y)] < 10) continue;
      if (taken && taken.has(this.idx(x, y))) continue;
      const d = (x - fx) ** 2 + (y - fy) ** 2;
      if (d < bd) { bd = d; best = { x, y }; }
    }
    return best;
  },

  // A* path search. mode 'ship' or 'land'. costFn(x,y) returns step cost.
  findPath(sx, sy, gx, gy, ok, costFn, maxNodes = 120000) {
    const W = this.W;
    if (sx === gx && sy === gy) return [];
    const start = sy * W + sx, goal = gy * W + gx;
    const g = new Float32Array(W * this.H).fill(Infinity);
    const came = new Int32Array(W * this.H).fill(-1);
    const closed = new Uint8Array(W * this.H);
    const heap = [];
    const push = (f, i) => {
      heap.push([f, i]); let k = heap.length - 1;
      while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last; let k = 0;
        for (;;) {
          const l = 2 * k + 1, r = l + 1; let m = k;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m;
        }
      }
      return top;
    };
    const minCost = 1;
    const hfn = (x, y) => { const dx = Math.abs(x - gx), dy = Math.abs(y - gy); return minCost * (Math.max(dx, dy) + 0.414 * Math.min(dx, dy)); };
    g[start] = 0; push(hfn(sx, sy), start);
    let n = 0;
    const okGoal = (x, y) => (x === gx && y === gy) || ok(x, y);
    while (heap.length && n++ < maxNodes) {
      const [, i] = pop();
      if (i === goal) break;
      if (closed[i]) continue;
      closed[i] = 1;
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of DIRS8) {
        if (!this.canStep(x, y, dx, dy, okGoal)) continue;
        const nx = x + dx, ny = y + dy, j = ny * W + nx;
        if (closed[j]) continue;
        const c = costFn(nx, ny) * (dx && dy ? 1.414 : 1);
        const ng = g[i] + c;
        if (ng < g[j]) { g[j] = ng; came[j] = i; push(ng + hfn(nx, ny), j); }
      }
    }
    if (came[goal] < 0) return null;
    const path = [];
    for (let i = goal; i !== start; i = came[i]) path.push({ x: i % W, y: (i / W) | 0 });
    return path.reverse();
  },

  // ---- rendering of the static terrain image ----
  render() {
    const W = this.W, H = this.H;
    const cv = document.createElement('canvas');
    cv.width = W * TP; cv.height = H * TP;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(cv.width, cv.height);
    const d = img.data;
    const sand = [222, 205, 150];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = this.tiles[y * W + x];
      const base = TERRAIN[t].color;
      const land = t >= 10;
      // which neighbours are water (for beaches)
      const wN = land && y > 0 && this.tiles[(y - 1) * W + x] < 2;
      const wS = land && y < H - 1 && this.tiles[(y + 1) * W + x] < 2;
      const wW = land && x > 0 && this.tiles[y * W + x - 1] < 2;
      const wE = land && x < W - 1 && this.tiles[y * W + x + 1] < 2;
      for (let py = 0; py < TP; py++) for (let px = 0; px < TP; px++) {
        const gx = x * TP + px, gy = y * TP + py;
        const n = hash2(gx, gy);
        let c = base, k = (n - 0.5) * 14;
        if (t === TT.FOREST && hash2(gx >> 1, gy >> 1, 3) < 0.3) k -= 22;
        if (t === TT.JUNGLE && hash2(gx >> 1, gy >> 1, 5) < 0.45) k -= 18;
        if (t === TT.SAVANNA && hash2(gx, gy, 7) < 0.06) k -= 40;
        if (t === TT.DESERT && ((gx + gy * 2) % 7 === 0) && hash2(gx >> 2, gy >> 2, 2) < 0.5) k += 14;
        if (t === TT.DEEP && hash2(gx >> 1, gy, 9) < 0.02) k += 30;
        if ((wN && py === 0) || (wS && py === TP - 1) || (wW && px === 0) || (wE && px === TP - 1)) { c = sand; }
        const o = (gy * cv.width + gx) * 4;
        d[o] = Math.max(0, Math.min(255, c[0] + k));
        d[o + 1] = Math.max(0, Math.min(255, c[1] + k));
        d[o + 2] = Math.max(0, Math.min(255, c[2] + k));
        d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // mountain peaks and trees
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = this.tiles[y * W + x];
      const ox = x * TP, oy = y * TP;
      if (t === TT.MOUNTAIN) {
        const h = 4 + Math.floor(hash2(x, y, 11) * 3);
        const bx = ox + 1 + Math.floor(hash2(x, y, 12) * 2);
        ctx.fillStyle = '#5e5242';
        ctx.beginPath(); ctx.moveTo(bx, oy + 7); ctx.lineTo(bx + 3, oy + 7 - h); ctx.lineTo(bx + 6, oy + 7); ctx.fill();
        ctx.fillStyle = '#a89a84';
        ctx.beginPath(); ctx.moveTo(bx, oy + 7); ctx.lineTo(bx + 3, oy + 7 - h); ctx.lineTo(bx + 3, oy + 7); ctx.fill();
        ctx.fillStyle = '#f2f2f2';
        ctx.fillRect(bx + 2, oy + 7 - h, 2, 1);
      } else if (t === TT.FOREST || t === TT.JUNGLE) {
        const nTrees = t === TT.JUNGLE ? 3 : 2;
        for (let k = 0; k < nTrees; k++) {
          const tx = ox + 1 + Math.floor(hash2(x, y, 20 + k) * 5), ty = oy + 1 + Math.floor(hash2(x, y, 30 + k) * 5);
          ctx.fillStyle = t === TT.JUNGLE ? '#1f4f24' : '#3b6b2e';
          ctx.fillRect(tx, ty, 2, 2);
          ctx.fillStyle = '#4a3420';
          ctx.fillRect(tx + 0.5, ty + 2, 1, 1);
        }
      }
    }
    this.terrainCanvas = cv;
    return cv;
  },
};
