'use strict';
/*
 * Controlli statici (senza browser) sugli asset e sui percorsi: garantiscono che il sito resti
 * pubblicabile così com'è su GitHub Pages (percorsi relativi, file presenti, SVG coerenti, pesi contenuti).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const html = read('index.html');
const css = read('css/style.css');

function refs(text, re) { const out = []; let m; while ((m = re.exec(text))) out.push(m[1]); return out; }

test('index.html: tutti i file referenziati esistono e i percorsi sono relativi', () => {
  const urls = [
    ...refs(html, /\b(?:src|href)="([^"#]+)"/g),
  ].filter((u) => !u.startsWith('data:'));
  assert.ok(urls.length >= 7, 'attesi CSS, 4 script e 2 immagini');
  for (const u of urls) {
    assert.ok(!/^(\/|https?:|\/\/)/.test(u), `percorso non relativo: ${u}`);
    const file = u.split('?')[0];
    assert.ok(fs.existsSync(path.join(ROOT, file)), `file mancante: ${file}`);
  }
});

test('style.css: gli url() puntano a file esistenti (relativi al CSS) e non sono assoluti', () => {
  const urls = refs(css, /url\(\s*['"]?([^'")]+)['"]?\s*\)/g).filter((u) => !u.startsWith('data:') && !u.startsWith('#'));
  assert.ok(urls.length >= 2, 'attesi sfondo e liane');
  for (const u of urls) {
    assert.ok(!/^(\/|https?:|\/\/)/.test(u), `url() non relativo: ${u}`);
    assert.ok(fs.existsSync(path.resolve(ROOT, 'css', u)), `file mancante: ${u}`);
  }
});

test('versione dei file statici coerente (?v=N uguale per CSS e JS)', () => {
  const versions = new Set(refs(html, /\b(?:src|href)="(?:css|js)\/[^"?]+\?v=(\d+)"/g));
  assert.equal(versions.size, 1, 'tutti i file css/js devono usare lo stesso ?v=');
});

test('asset SVG: ogni riferimento interno (url(#id), href="#id") esiste', () => {
  for (const f of fs.readdirSync(path.join(ROOT, 'assets')).filter((n) => n.endsWith('.svg'))) {
    const svg = read('assets/' + f);
    assert.ok(/^<svg[\s>]/.test(svg.trim()) && svg.trim().endsWith('</svg>'), `${f}: SVG non completo`);
    const ids = new Set(refs(svg, /\bid="([^"]+)"/g));
    const used = [...refs(svg, /url\(#([^)]+)\)/g), ...refs(svg, /\bhref="#([^"]+)"/g)];
    for (const id of used) assert.ok(ids.has(id), `${f}: riferimento a #${id} senza definizione`);
    // niente script né risorse esterne dentro gli SVG
    assert.ok(!/<script|<foreignObject|https?:\/\/(?!www\.w3\.org)/i.test(svg), `${f}: contenuto non ammesso`);
  }
});

test('logo Flos Design: lettering presente e accessibile', () => {
  for (const f of ['assets/flos-logo.svg', 'assets/flos-fiore.svg']) {
    const svg = read(f);
    assert.match(svg, /aria-label="FLOS DESIGN"/);
    assert.match(svg, /<title>FLOS DESIGN<\/title>/);
    assert.match(svg, /id="fl-letters"/, 'tracciato del lettering');
  }
  assert.match(html, /<img src="assets\/flos-logo\.svg" alt="FLOS DESIGN"/);
});

test('peso degli asset contenuto (sito leggero anche in rete mobile)', () => {
  const size = (f) => fs.statSync(path.join(ROOT, 'assets', f)).size;
  const files = fs.readdirSync(path.join(ROOT, 'assets'));
  let total = 0;
  for (const f of files) { total += size(f); assert.ok(size(f) <= 150 * 1024, `${f} supera 150 KB (${size(f)} byte)`); }
  assert.ok(total <= 320 * 1024, `asset totali ${Math.round(total / 1024)} KB (limite 320 KB)`);
});

test('nessun font o script di terze parti', () => {
  assert.ok(!/https?:\/\//.test(html.replace(/xmlns='http:\/\/www\.w3\.org\/2000\/svg'/g, '')), 'index.html non deve chiamare risorse esterne');
  assert.ok(!/@import|https?:\/\//.test(css), 'style.css non deve importare risorse esterne');
});
