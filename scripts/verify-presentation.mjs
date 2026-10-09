import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import postcss from 'postcss';
const read = p => readFile(new URL('../'+p, import.meta.url), 'utf8');
export async function verifyPresentation() {
  const index = await read('src/styles/index.css');
  assert.match(index, /@layer base, foundation, components, screens/);
  assert.doesNotMatch(index, /layer\(legacy\)|\.\/phase\d+\.css|\.\/morning-grace[^"\n]*\.css/);
  const imports = [...index.matchAll(/@import "\.\/(.*?)" layer\((.*?)\)/g)];
  const names = imports.map(m=>m[1]);
  assert.equal(new Set(names).size, names.length, 'Each stylesheet has one import');
  for (const name of ['base.css','shell.css','controls.css','feedback.css','tokens.css','components.css','scripture.css','today.css','bible.css','prayer.css','history.css','writing.css','prayer-detail.css','focused-prayer.css','prayer-metadata.css','data.css','archive.css','plan.css']) assert.ok(names.includes(name), 'Missing style owner '+name);
  for (const [,name] of imports) {
    const css = await read('src/styles/'+name);
    assert.doesNotMatch(css, /url\(\s*["']?https?:\/\//, 'No remote runtime CSS assets');
    assert.doesNotMatch(css, /filter:\s*invert/, 'Artwork is never inverted');
    postcss.parse(css).walkRules(rule=>{
      if (name === 'tokens.css') return;
      if (!rule.selector.includes(':root')) return;
      rule.walkDecls(decl=>assert.ok(!/^--(?:color|font|radius|shadow)-/.test(decl.prop), 'Global design tokens belong only to tokens.css: '+decl.prop));
    });
  }
  const tokens = await read('src/styles/tokens.css');
  for(const token of ['--font-display:','--font-reading:','--font-ui:','--color-canvas: #faf6ee','--color-surface: #fffbf5','--color-ink: #252922','--color-prayer: #9f563b','data-theme="dark"','prefers-color-scheme: dark']) assert.ok(tokens.includes(token), 'Missing visual token '+token);
  assert.match(await read('src/styles/base.css'), /:focus-visible/);
  assert.match(await read('src/styles/base.css'), /prefers-reduced-motion/);
  const shell = await read('src/styles/shell.css');
  for(const token of ['.mobile-nav','.skip-link','safe-area-inset-bottom','.mobile-appbar-back']) assert.ok(shell.includes(token), 'Missing navigation primitive '+token);
  const art = await read('src/app/visual/MorningGraceArtwork.tsx');
  assert.match(art, /useEffectiveTheme/); assert.match(art, /aria-hidden="true"/);
  for(const name of ['evening-valley.webp','evening-context.webp','evening-reflection.webp']) {
    assert.ok(art.includes(name));
    const bytes = await readFile(new URL('../src/assets/morning-grace/'+name,import.meta.url));
    assert.equal(bytes.toString('ascii',8,12),'WEBP'); assert.ok(bytes.length > 50000 && bytes.length < 220000);
  }
}
