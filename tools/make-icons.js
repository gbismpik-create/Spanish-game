// Renders the app icons from the game's own caravel sprite.
// Usage: serve the project on http://localhost:8123, then: node tools/make-icons.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage();
  await page.goto('http://localhost:8123/index.html');
  await page.waitForFunction(() => window.__ready);
  const icons = await page.evaluate(() => {
    const make = (size, maskable) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = size;
      const c = cv.getContext('2d');
      // night sea
      const g = c.createRadialGradient(size * 0.5, size * 0.38, size * 0.05, size * 0.5, size * 0.5, size * 0.75);
      g.addColorStop(0, '#2f6f9c'); g.addColorStop(0.6, '#1c4a72'); g.addColorStop(1, '#0d2238');
      c.fillStyle = g;
      if (maskable) c.fillRect(0, 0, size, size);
      else { c.beginPath(); c.roundRect(0, 0, size, size, size * 0.2); c.fill(); }
      // waves
      c.strokeStyle = 'rgba(220,235,255,0.35)'; c.lineWidth = size * 0.012;
      for (let i = 0; i < 3; i++) {
        const y = size * (0.74 + i * 0.07);
        c.beginPath();
        for (let x = -size * 0.1; x < size * 1.1; x += size * 0.16) { c.moveTo(x, y); c.quadraticCurveTo(x + size * 0.04, y - size * 0.03, x + size * 0.08, y); }
        c.stroke();
      }
      if (!maskable) {
        c.strokeStyle = '#c9a227'; c.lineWidth = size * 0.022;
        c.beginPath(); c.roundRect(size * 0.04, size * 0.04, size * 0.92, size * 0.92, size * 0.17); c.stroke();
      }
      // the caravel, drawn by the game's sprite code
      const saved = Render.ctx, savedT = Render.time;
      Render.ctx = c; Render.time = 0.6;
      if (!Game.s) Game.s = { cannons: 0 };
      const k = size * (maskable ? 0.0105 : 0.0135);
      const z = k * 24 / 0.9;
      Render.drawShip(size / 2 - z / 2 - k * 2, size / 2 - z / 2 + k * 11, z, 1, false, 'caravel', false);
      Render.ctx = saved; Render.time = savedT;
      return cv.toDataURL('image/png');
    };
    return { 'icon-192.png': make(192, false), 'icon-512.png': make(512, false), 'icon-maskable-512.png': make(512, true), 'apple-touch-icon.png': make(180, true) };
  });
  for (const [name, url] of Object.entries(icons)) {
    fs.writeFileSync(path.join(__dirname, '..', 'icons', name), Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote icons/' + name);
  }
  await browser.close();
})();
