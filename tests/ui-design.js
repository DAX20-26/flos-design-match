'use strict';
/*
 * Test della nuova grafica della schermata di gioco, nel browser.
 * Il sito viene servito da un sottopercorso (/flos-design-match/) come farà GitHub Pages: in questo modo
 * si verifica anche che nessun file (HTML, CSS, JS, SVG, JPG) dia 404.
 * Uso: node tests/ui-design.js [cartella_screenshot]
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node-tools/node_modules/playwright'); }

const ROOT = path.resolve(__dirname, '..');
const SHOTS = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const PREFIX = '/flos-design-match/';
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png' };

let failures = 0;
function check(cond, msg) { if (cond) console.log('  ok   ' + msg); else { failures++; console.log('  FAIL ' + msg); } }

function serve() {
  const hits = [];
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const rel = u.startsWith(PREFIX) ? (u.slice(PREFIX.length) || 'index.html') : null;
    const file = rel && path.join(ROOT, rel);
    if (!file || !file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      hits.push({ url: req.url, status: 404 }); res.writeHead(404); return res.end('not found');
    }
    hits.push({ url: req.url, status: 200 });
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, hits })));
}

/** Esegue nel browser: rettangoli degli elementi principali della schermata di gioco. */
const measure = () => {
  const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height, cx: (b.left + b.right) / 2 }; };
  return { level: r('#level-label'), logo: r('.game-logo img'), hud: r('.hud'), card: r('#board-card'), board: r('#board'), vw: innerWidth, vh: innerHeight };
};

const VIEWPORTS = [
  { name: 'android-360x640', w: 360, h: 640, mobile: true, minFlower: 90 },
  { name: 'iphone-se-375x548', w: 375, h: 548, mobile: true, minFlower: 90 },
  { name: 'iphone-390x844', w: 390, h: 844, mobile: true, minFlower: 130 },
  { name: 'tablet-768x1024', w: 768, h: 1024, mobile: true, minFlower: 150 },
  { name: 'desktop-1280x800', w: 1280, h: 800, mobile: false, minFlower: 100 },
  { name: 'land-844x390', w: 844, h: 390, mobile: true, minFlower: 100, landscape: true }
];

(async () => {
  const { server, port, hits } = await serve();
  const BASE = `http://127.0.0.1:${port}${PREFIX}`;
  const browser = await playwright.chromium.launch();

  for (const v of VIEWPORTS) {
    console.log(v.name);
    const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1, hasTouch: v.mobile, isMobile: v.mobile });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(BASE + '?seed=3');
    await page.waitForTimeout(900);

    // --- schermata iniziale: invariata, senza liane né sfondo dipinto
    check((await page.evaluate(() => document.body.dataset.screen)) === 'start', 'start: schermata iniziale attiva');
    check((await page.textContent('.title')).replace(/\s+/g, ' ').trim() === 'FLOS DESIGN MATCH', 'start: titolo FLOS DESIGN MATCH');
    check((await page.evaluate(() => getComputedStyle(document.querySelector('.vines-left')).opacity)) === '0', 'start: liane nascoste');
    check((await page.evaluate(() => getComputedStyle(document.querySelector('.bg-garden')).opacity)) === '0', 'start: sfondo dipinto nascosto');
    const petalsStart = await page.evaluate(() => [...document.querySelectorAll('.bg-petal')].filter((e) => getComputedStyle(e).display !== 'none').length);
    check(petalsStart >= 8, `start: foglioline e petali di sfondo presenti (${petalsStart})`);

    // --- schermata di gioco
    await page.click('#btn-play');
    await page.waitForSelector('#modal:not([hidden])');
    await page.click('#modal-btn');
    await page.waitForTimeout(1300);
    const m = await page.evaluate(measure);
    check((await page.evaluate(() => document.body.dataset.screen)) === 'game', 'gioco: schermata di gioco attiva');

    // ordine richiesto: livello → logo → box obiettivo → griglia
    check(m.level.b <= m.logo.t + 1, 'ordine: indicatore del livello sopra il logo');
    check(m.logo.b <= m.hud.t + 1, 'ordine: logo sopra il box obiettivo');
    if (!v.landscape) {
      check(m.hud.b <= m.card.t + 1, 'ordine: box obiettivo sopra la griglia');
      const cx = m.vw / 2;
      check(Math.abs(m.logo.cx - cx) <= 2, 'logo centrato (scarto ' + Math.abs(m.logo.cx - cx).toFixed(1) + 'px)');
      check(Math.abs(m.hud.cx - cx) <= 2 && Math.abs(m.card.cx - cx) <= 2, 'box obiettivo e griglia centrati');
      check(Math.abs(m.level.cx - cx) <= 2, 'indicatore del livello centrato');
    } else {
      check(m.logo.r <= m.card.l, 'in orizzontale la griglia sta a lato del logo e dell\'obiettivo');
    }
    const txt = await page.textContent('#level-label');
    check(/^LIVELLO 1 \/ 3$/i.test(txt.trim()), `indicatore: "${txt.trim()}"`);

    // logo: caricato, leggibile, accessibile
    const lg = await page.evaluate(() => { const i = document.querySelector('.game-logo img'); return { ok: i.complete && i.naturalWidth > 0, alt: i.alt }; });
    check(lg.ok && lg.alt === 'FLOS DESIGN', 'logo caricato con testo alternativo FLOS DESIGN');
    const flower = m.logo.h * (850 / 600) * 1.0; // il fiore con le foglie occupa circa 850/600 dell'altezza del riquadro
    check(flower >= v.minFlower, `logo leggibile: fiore largo ~${Math.round(flower)}px (>= ${v.minFlower}px), altezza ${Math.round(m.logo.h)}px`);

    // griglia e box dentro lo schermo, nessuno scroll orizzontale
    check(m.card.l >= 0 && m.card.r <= m.vw && m.card.b <= m.vh && m.card.t >= 0, 'griglia interamente visibile');
    check(m.hud.l >= 0 && m.hud.r <= m.vw, 'box obiettivo dentro lo schermo');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'nessuno scroll orizzontale');

    // liane: statiche, dietro a tutto, non intercettano il tocco; sfondo dipinto visibile
    const dec = await page.evaluate(() => {
      const q = (s) => document.querySelector(s), cs = (e) => getComputedStyle(e);
      const bd = q('#board').getBoundingClientRect();
      const top = document.elementFromPoint(bd.left + bd.width / 2, bd.top + bd.height / 2);
      return {
        vinesOpacity: [cs(q('.vines-left')).opacity, cs(q('.vines-right')).opacity],
        vinesPE: [cs(q('.vines-left')).pointerEvents, cs(q('.vines-right')).pointerEvents],
        vinesBg: cs(q('.vines-left')).backgroundImage,
        vinesAnim: [q('.vines-left').getAnimations().length, q('.vines-right').getAnimations().length, q('.bg-garden').getAnimations().length],
        gardenOpacity: cs(q('.bg-garden')).opacity, gardenBg: cs(q('.bg-garden')).backgroundImage,
        boardOnTop: !!(top && top.closest('#board')),
        petals: [...document.querySelectorAll('.bg-petal')].filter((e) => cs(e).display !== 'none').length,
        theme: document.querySelector('meta[name="theme-color"]').content
      };
    });
    check(dec.vinesOpacity.every((o) => o === '1'), 'liane visibili sui due lati');
    check(dec.vinesPE.every((p) => p === 'none'), 'le liane non intercettano il tocco (pointer-events: none)');
    check(/liane\.svg/.test(dec.vinesBg), 'le liane usano assets/liane.svg');
    check(dec.vinesAnim.every((n) => n === 0), 'liane e sfondo statici (nessuna animazione)');
    check(dec.gardenOpacity === '1' && /giardino-verde\.jpg/.test(dec.gardenBg), 'sfondo verde dipinto attivo');
    check(dec.boardOnTop, 'la griglia sta sopra le decorazioni');
    check(dec.petals <= 3, `foglioline in movimento minime nel gioco (${dec.petals})`);
    check(dec.theme === '#9bb868', 'colore della barra del browser coerente con lo sfondo verde');

    // il mio sfondo non è troppo scuro né troppo chiaro (luminanza relativa media)
    if (v.name === 'iphone-390x844') {
      const lum = await page.evaluate(async () => {
        const url = getComputedStyle(document.querySelector('.bg-garden')).backgroundImage.match(/url\("?([^")]+)"?\)/)[1];
        const img = new Image(); img.src = url; await img.decode();
        const c = document.createElement('canvas'); c.width = 80; c.height = 106;
        const x = c.getContext('2d'); x.drawImage(img, 0, 0, 80, 106);
        const d = x.getImageData(0, 0, 80, 106).data; let s = 0;
        const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        for (let i = 0; i < d.length; i += 4) s += 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]);
        return s / (d.length / 4);
      });
      check(lum >= 0.2 && lum <= 0.5, `sfondo verde delicato: luminanza relativa media ${lum.toFixed(2)} (la texture originale era 0.09)`);
    }

    // contrasto del testo sulle card chiare (WCAG AA)
    if (v.name === 'iphone-390x844') {
      await page.evaluate(() => { const t = document.getElementById('toast'); t.textContent = 'Nessuna mossa possibile: il giardino si rimescola…'; t.classList.add('show'); });
      const ratios = await page.evaluate(() => {
        const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/)[1].split(',').map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] === undefined ? 1 : m[3] }; };
        const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
        const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        const L = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
        const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
        const green = { r: 0x9b, g: 0xb8, b: 0x68, a: 1 };
        const bgOf = (el) => { const chain = []; for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c.a > 0) chain.push(c); } let acc = green; for (let i = chain.length - 1; i >= 0; i--) acc = over(chain[i], acc); return acc; };
        const out = {};
        for (const [name, sel] of [['livello', '#level-label'], ['etichetta mosse', '.hud-label'], ['numero mosse', '#moves'], ['messaggio', '#toast'], ['titolo scheda', '.hud-goal .hud-label']]) {
          const el = document.querySelector(sel); out[name] = ratio(parse(getComputedStyle(el).color), bgOf(el));
        }
        return out;
      });
      for (const [k, r] of Object.entries(ratios)) check(r >= (k === 'numero mosse' ? 3 : 4.5), `contrasto "${k}": ${r.toFixed(1)}:1`);
    }

    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `design-${v.name}.png`) });

    // --- schermata finale: logo piccolo al posto della scritta
    await page.evaluate(() => window.__flos.showFinal());
    await page.waitForTimeout(3500);
    const fin = await page.evaluate(() => { const i = document.querySelector('.final-logo'); const b = i.getBoundingClientRect(); return { ok: i.complete && i.naturalWidth > 0, vis: b.width > 60 && b.bottom <= innerHeight && b.top >= 0, theme: document.querySelector('meta[name="theme-color"]').content, vines: getComputedStyle(document.querySelector('.vines-left')).opacity }; });
    check(fin.ok && fin.vis, 'finale: logo FLOS DESIGN caricato e visibile');
    check(fin.theme === '#f6e8ea' && fin.vines === '0', 'finale: palette rosa, niente liane');
    check(errors.length === 0, 'nessun errore JS' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await ctx.close();
  }

  // --- movimento ridotto: nessuna foglia in movimento
  console.log('movimento ridotto');
  const rctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const rp = await rctx.newPage();
  await rp.goto(BASE);
  await rp.waitForTimeout(600);
  check((await rp.evaluate(() => document.querySelectorAll('.bg-petal').length)) === 0, 'con prefers-reduced-motion non vengono generate foglie in movimento');
  await rctx.close();

  // --- GitHub Pages: nessun 404, tutti gli asset richiesti
  console.log('pubblicazione da sottopercorso (GitHub Pages)');
  const bad = hits.filter((h) => h.status !== 200);
  check(bad.length === 0, 'nessuna risorsa mancante (404)' + (bad.length ? ': ' + bad.map((b) => b.url).join(', ') : ''));
  for (const f of ['css/style.css', 'js/engine.js', 'js/art.js', 'js/fx.js', 'js/game.js', 'assets/giardino-verde.jpg', 'assets/liane.svg', 'assets/flos-logo.svg', 'assets/flos-fiore.svg']) {
    check(hits.some((h) => h.status === 200 && h.url.split('?')[0] === PREFIX + f), `servito: ${f}`);
  }

  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} controlli falliti` : '\nGrafica della schermata di gioco verificata');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
