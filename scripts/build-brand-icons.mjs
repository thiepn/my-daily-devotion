import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

// Export the approved artwork without redrawing, recoloring or filtering it.
const master = await readFile(new URL('../design/brand/cream-forest-master.png', import.meta.url));
assert.equal(createHash('sha256').update(master).digest('hex'), '391b70b313e75fa7cee0f7b687fbcf4cbdd18ad16db7b8b6c20e61f2e035856f');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1120, height: 850 }, deviceScaleFactor: 1 });
  const source = `data:image/png;base64,${master.toString('base64')}`;
  const exports = {};
  for (const [file, size, scale] of [
    ['icons/icon-192.png', 192, 1], ['icons/icon-512.png', 512, 1],
    ['icons/maskable-512.png', 512, .9], ['apple-touch-icon.png', 180, 1],
    ['icons/favicon-16.png', 16, 1], ['icons/favicon-32.png', 32, 1],
    ['favicon-source', 64, 1],
  ]) {
    const raster = await page.evaluate(async ({ source, size, scale }) => {
      const image = new Image(); image.src = source; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#faf6ee'; ctx.fillRect(0, 0, size, size);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      const inset = size * (1 - scale) / 2;
      ctx.drawImage(image, inset, inset, size * scale, size * scale);
      const pixels = ctx.getImageData(0, 0, size, size).data;
      let greenPixels = 0, maxGreenRadius = 0;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        if (pixels[i + 1] > pixels[i] + 15 && pixels[i + 1] > pixels[i + 2] + 8) {
          greenPixels++;
          maxGreenRadius = Math.max(maxGreenRadius, Math.hypot(x + .5 - size / 2, y + .5 - size / 2) / size);
        }
      }
      return { url: canvas.toDataURL('image/png'), greenPixels, maxGreenRadius };
    }, { source, size, scale });
    assert.ok(raster.greenPixels > 0, `${file}: green cross/book disappeared`);
    if (scale < 1) assert.ok(raster.maxGreenRadius <= .4, 'Keep cross/book inside the maskable safe circle');
    exports[file] = raster.url;
    if (file !== 'favicon-source') await writeFile(new URL(`../public/${file}`, import.meta.url), Buffer.from(raster.url.split(',')[1], 'base64'));
    console.log(`${file}: ${size}px${scale < 1 ? `, foreground safe radius ${raster.maxGreenRadius.toFixed(3)}` : ''}`);
  }
  // This SVG is a self-contained raster wrapper, not a claim of vector artwork.
  await writeFile(new URL('../public/brand-mark.svg', import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><title>My Daily Devotion</title><image width="64" height="64" href="${exports['favicon-source']}"/></svg>\n`);

  const reviewIndex = process.argv.indexOf('--review');
  if (reviewIndex >= 0) {
    const reviewDir = resolve(process.argv[reviewIndex + 1]);
    await mkdir(reviewDir, { recursive: true });
    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Approved Morning Grace icon</title><style>
      body{margin:0;background:#faf6ee;color:#252922;font:16px system-ui;padding:36px}h1{font:32px Georgia;margin:0 0 8px}p{color:#5e625a}.row{display:flex;gap:28px;align-items:flex-end;flex-wrap:wrap;margin:28px 0}.tile{text-align:center}.tile span{display:block;margin-top:10px;font-size:13px}.dark{background:#20271f;padding:20px;border-radius:12px;color:#faf6ee}.mask{width:192px;height:192px}.circle{border-radius:50%}.squircle{border-radius:24%}</style>
      <h1>Cream & forest — approved artwork</h1><p>Original shapes and finish. Size exports only; no redraw or recoloring.</p>
      <div class="row"><img src="${exports['icons/icon-512.png']}" width="256" height="256" alt="Approved app icon">${[16,32,48,64,180].map(size=>`<div class="tile"><img src="${exports[size<=32?`icons/favicon-${size}.png`:'icons/icon-192.png']}" width="${size}" height="${size}" alt=""><span>${size}px</span></div>`).join('')}</div>
      <div class="row"><div class="tile"><img class="mask circle" src="${exports['icons/maskable-512.png']}" alt="Circular launcher mask"><span>Circular mask</span></div><div class="tile"><img class="mask squircle" src="${exports['icons/maskable-512.png']}" alt="Rounded launcher mask"><span>Rounded mask</span></div><div class="tile dark"><img src="${exports['icons/icon-192.png']}" width="64" height="64" alt="Icon on dark canvas"><span>Dark canvas</span></div></div>
      <p>Source: selected cream-and-forest reference edit. Maskable export reserves additional safe space.</p></html>`;
    await writeFile(resolve(reviewDir, 'icon-review.html'), html);
    await page.setContent(html);
    await page.evaluate(() => Promise.all([...document.images].map(img => img.decode())));
    await page.screenshot({ path: resolve(reviewDir, 'icon-review.png'), fullPage: true });
    for (const [file, url] of Object.entries(exports)) if (file !== 'favicon-source') await writeFile(resolve(reviewDir, file.replace('icons/', '')), Buffer.from(url.split(',')[1], 'base64'));
  }
} finally { await browser.close(); }
