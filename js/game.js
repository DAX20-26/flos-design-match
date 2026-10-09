/*
 * FLOS DESIGN MATCH — interfaccia di gioco.
 * Il motore (engine.js) decide tutto; qui ci si limita a mostrare i passaggi che restituisce.
 */
(function () {
  'use strict';

  var E = window.FlosEngine, A = window.FlosArt, FX = window.FlosFX;
  var SIZE = E.SIZE;
  var $ = function (s) { return document.querySelector(s); };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  var els = {
    start: $('#screen-start'), game: $('#screen-game'), final: $('#screen-final'),
    board: $('#board'), wrap: $('#board-wrap'), flash: $('#flash'),
    moves: $('#moves'), level: $('#level-label'), toast: $('#toast'), slots: document.querySelectorAll('.slot'),
    modal: $('#modal'), mArt: $('#modal-art'), mKicker: $('#modal-kicker'), mTitle: $('#modal-title'),
    mBody: $('#modal-body'), mBtn: $('#modal-btn')
  };

  var params = new URLSearchParams(location.search);
  var fixedSeed = params.has('seed') ? parseInt(params.get('seed'), 10) : null;
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var speed = reducedMotion ? 0.35 : 1;

  var S = {
    game: null, level: 0, attempt: 0, run: 0, epoch: 0, busy: true,
    pieces: new Map(),   // id -> { el, kind, variant, r, c }
    sel: null, drag: null, hintTimer: 0, hintIds: [], created: 0, toastTimer: 0
  };

  /* ---------- schermate ---------- */

  function show(name) {
    ['start', 'game', 'final'].forEach(function (n) { els[n].classList.toggle('active', n === name); });
  }

  /* ---------- sfondo e illustrazioni statiche ---------- */

  function buildBackground() {
    document.getElementById('svg-defs').innerHTML = A.defs();
    if (reducedMotion) return;
    var host = $('#bg-petals'), cols = ['#f4b8c8', '#cdbbea', '#f8dcae', '#bcd9b4', '#e68aa8'], html = '';
    for (var i = 0; i < 12; i++) {
      html += '<i class="bg-petal" style="left:' + Math.round(Math.random() * 100) + '%;--s:' + (8 + Math.round(Math.random() * 10)) + 'px;--col:' + cols[i % cols.length] +
        ';--dur:' + (16 + Math.round(Math.random() * 16)) + 's;--delay:-' + Math.round(Math.random() * 30) + 's;--dx:' + (Math.round(Math.random() * 120) - 60) + 'px"></i>';
    }
    host.innerHTML = html;
  }

  function buildHero() {
    $('#hero').innerHTML =
      '<div class="hero-main">' + A.svg('brucaliffo', 'lilla') + '</div>' +
      '<div class="hero-flower">' + A.svg('margherita') + '</div>' +
      '<div class="hero-flower">' + A.svg('tulipano') + '</div>' +
      '<div class="hero-flower">' + A.svg('rosellina') + '</div>' +
      '<div class="hero-flower">' + A.svg('campanula') + '</div>';
  }

  function buildBloom() {
    var fl = ['margherita', 'tulipano', 'rosellina', 'campanula'], html = '<div class="b-spin">';
    for (var i = 0; i < 8; i++) {
      html += '<div class="b-flower" style="--a:' + (i * 45) + 'deg;--d:' + (0.15 + i * 0.12).toFixed(2) + 's">' + A.svg(fl[i % 4]) + '</div>';
    }
    html += '</div><div class="b-core">' + A.svg('brucaliffo', 'rosa') + '</div>';
    $('#bloom').innerHTML = html;
  }

  /* ---------- griglia ---------- */

  function setPos(id, r, c, mode) {
    var p = S.pieces.get(id);
    if (!p) return;
    p.r = r; p.c = c;
    p.el.classList.toggle('quick', mode === 'quick');
    p.el.classList.toggle('slow', mode === 'slow');
    p.el.style.setProperty('--r', r);
    p.el.style.setProperty('--c', c);
  }

  function createPiece(info, r, c) {
    var el = document.createElement('div');
    el.className = 'piece' + (info.kind === E.BRUCALIFFO ? ' k' : '');
    el.dataset.id = info.id;
    el.innerHTML = A.svg(info.kind, info.variant);
    el.style.setProperty('--r', r);
    el.style.setProperty('--c', c);
    els.board.appendChild(el);
    S.pieces.set(info.id, { el: el, kind: info.kind, variant: info.variant, r: r, c: c });
    return el;
  }

  function removePiece(id) {
    var p = S.pieces.get(id);
    if (p) { p.el.remove(); S.pieces.delete(id); }
  }

  function buildBoard() {
    els.board.innerHTML = '';
    S.pieces.clear();
    S.game.snapshot().forEach(function (p) { createPiece(p, p.r, p.c); });
  }

  function cellCenter(r, c) {
    var b = els.board.getBoundingClientRect(), cs = b.width / SIZE;
    return { x: b.left + (c + 0.5) * cs, y: b.top + (r + 0.5) * cs };
  }

  /* ---------- HUD ---------- */

  function setMoves(n, animate) {
    els.moves.textContent = n;
    els.moves.classList.toggle('low', n <= 3);
    if (animate) { els.moves.classList.remove('tick'); void els.moves.offsetWidth; els.moves.classList.add('tick'); }
  }

  function resetSlots() {
    S.created = 0;
    els.slots.forEach(function (s) { s.classList.remove('full'); s.innerHTML = ''; });
  }

  function fillSlot(variant) {
    if (S.created >= 2) return;
    var s = els.slots[S.created++];
    s.innerHTML = A.svg('brucaliffo', variant);
    s.classList.add('full');
  }

  function toast(msg, ms) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(S.toastTimer);
    S.toastTimer = setTimeout(function () { els.toast.classList.remove('show'); }, ms || 2200);
  }

  /* ---------- finestre ---------- */

  function openModal(o) {
    els.mArt.innerHTML = o.art || '';
    els.mKicker.textContent = o.kicker || '';
    els.mTitle.textContent = o.title;
    els.mBody.innerHTML = o.body || '';
    els.mBtn.textContent = o.button;
    els.modal.hidden = false;
    els.mBtn.onclick = function () {
      els.mBtn.onclick = null; // un solo click utile (evita doppi tocchi)
      els.modal.hidden = true;
      if (o.onClick) o.onClick();
    };
    setTimeout(function () { els.mBtn.focus({ preventScroll: true }); }, 50);
  }

  function rulesHTML() {
    return '<ul class="rules">' +
      '<li><span class="ri">' + A.svg('margherita') + '</span><span>Scambia due elementi vicini per allineare <b>almeno tre</b> fiori uguali.</span></li>' +
      '<li><span class="ri">' + A.svg('bruco') + '</span><span>Unisci <b>tre bruchi verdi</b>: nascerà un <b>Brucaliffo</b>, il nostro gioiello.</span></li>' +
      '<li><span class="ri">' + A.svg('brucaliffo', 'lilla') + '</span><span>Crea <b>due Brucaliffo</b> e scambiali tra loro: tutto il giardino sboccerà. Il Brucaliffo si sposta anche senza combinazioni.</span></li>' +
      '</ul>';
  }

  /* ---------- flusso dei livelli ---------- */

  function newGame() {
    var seed;
    if (fixedSeed !== null) seed = fixedSeed + S.run * 104729 + S.level * 1000 + S.attempt * 7919;
    else seed = (Math.random() * 4294967296) >>> 0;
    S.game = new E.Game(S.level, E.mulberry32(seed));
    S.attempt++;
    S.epoch++;
    S.busy = true;
    els.board.classList.remove('finished');
    resetSlots();
    clearSelection(); clearHint();
    buildBoard();
    setMoves(S.game.movesLeft, false);
    els.level.textContent = 'Livello ' + (S.level + 1) + ' / ' + E.LEVELS.length;
  }

  function startLevel() {
    newGame();
    var lv = E.LEVELS[S.level];
    openModal({
      art: A.svg('brucaliffo', E.VARIANTS[S.level % E.VARIANTS.length]),
      kicker: 'Livello ' + (S.level + 1) + ' di ' + E.LEVELS.length,
      title: ['Il primo petalo', 'Il giardino cresce', 'La fioritura'][S.level],
      body: (S.level === 0 ? rulesHTML() : '<p>Crea due Brucaliffo e scambiali tra loro.</p>') +
        '<div class="chips"><span class="chip">' + lv.moves + ' mosse</span></div>',
      button: 'Inizia',
      onClick: function () { S.busy = false; armHint(); }
    });
  }

  function beginRun() {
    S.level = 0; S.attempt = 0; S.run++;
    FX.clear();
    show('game');
    startLevel();
  }

  function levelWon() {
    if (S.level < E.LEVELS.length - 1) {
      openModal({
        art: A.svg('brucaliffo', 'rosa'),
        kicker: 'Livello ' + (S.level + 1) + ' superato',
        title: 'Che fioritura!',
        body: '<p>I due Brucaliffo hanno fatto sbocciare il giardino.</p><div class="chips"><span class="chip">' + S.game.movesLeft + ' mosse avanzate</span></div>',
        button: 'Livello successivo',
        onClick: function () { S.level++; S.attempt = 0; startLevel(); }
      });
    } else {
      showFinal();
    }
  }

  function levelLost() {
    els.board.classList.add('finished');
    openModal({
      art: A.svg('bruco'),
      kicker: 'Mosse terminate',
      title: 'Quasi sbocciato…',
      body: '<p>Il giardino ha bisogno di un nuovo inizio: si riparte dal livello 1. I tentativi sono illimitati.</p>',
      button: 'Riprova',
      onClick: function () { S.level = 0; S.attempt = 0; S.run++; startLevel(); }
    });
  }

  function showFinal() {
    S.busy = true;
    S.epoch++;
    els.modal.hidden = true;
    clearHint();
    buildBloom();
    show('final');
    FX.clear();
    setTimeout(function () { FX.rain(true); }, 300);
    setTimeout(function () {
      var w = window.innerWidth;
      for (var i = 0; i < 4; i++) FX.burst(w * (0.15 + i * 0.23), window.innerHeight * 0.3, 26, 'brucaliffo', 1.3);
    }, 500);
  }

  /* ---------- selezione, suggerimenti ---------- */

  function setSelected(cell) {
    if (S.sel) { var o = S.game.grid[S.sel.r][S.sel.c]; if (o && S.pieces.get(o.id)) S.pieces.get(o.id).el.classList.remove('sel'); }
    S.sel = cell;
    if (cell) { var p = S.game.grid[cell.r][cell.c]; if (p && S.pieces.get(p.id)) S.pieces.get(p.id).el.classList.add('sel'); }
  }
  function clearSelection() { S.sel = null; S.pieces.forEach(function (p) { p.el.classList.remove('sel'); }); }

  function clearHint() {
    clearTimeout(S.hintTimer);
    S.hintIds.forEach(function (id) { var p = S.pieces.get(id); if (p) p.el.classList.remove('hint'); });
    S.hintIds = [];
  }
  function armHint() {
    clearHint();
    S.hintTimer = setTimeout(function () {
      if (S.busy || !S.game || S.game.status !== 'playing') return;
      var m = S.game.suggest();
      if (!m) return;
      [m.a, m.b].forEach(function (c) {
        var p = S.game.grid[c.r][c.c];
        if (p && S.pieces.get(p.id)) { S.pieces.get(p.id).el.classList.add('hint'); S.hintIds.push(p.id); }
      });
    }, 7000);
  }

  /* ---------- animazioni dei passaggi ---------- */

  function snapById(board) { var m = {}; board.forEach(function (p) { m[p.id] = p; }); return m; }

  async function playCascade(st, ep) {
    var byId = snapById(st.board), mergeIds = {}, i;
    st.merges.forEach(function (m) {
      m.ids.forEach(function (id) { mergeIds[id] = true; setPos(id, m.to.r, m.to.c, 'quick'); var p = S.pieces.get(id); if (p) p.el.classList.add('merging'); });
    });
    st.clearIds.forEach(function (id) {
      var p = S.pieces.get(id);
      if (!p) return;
      if (!mergeIds[id]) {
        p.el.classList.add('pop');
        var ctr = cellCenter(p.r, p.c);
        FX.burst(ctr.x, ctr.y, 5, p.kind, 0.7);
      }
    });
    await sleep(300 * speed);
    if (ep !== S.epoch) return;
    st.clearIds.forEach(removePiece);

    // nuovi elementi: i Brucaliffo nascono sul posto, gli altri cadono dall'alto
    st.created.forEach(function (cr) {
      var info = byId[cr.id];
      if (!info) return;
      var el = createPiece(info, cr.fromR, cr.fromC);
      if (st.spawned.indexOf(cr.id) >= 0) {
        el.classList.add('spawn');
        var ctr = cellCenter(cr.fromR, cr.fromC);
        FX.burst(ctr.x, ctr.y, 14, 'brucaliffo', 0.8);
        fillSlot(info.variant);
      }
    });
    void els.board.offsetWidth;
    if (st.spawned.length) await sleep(520 * speed); else await sleep(30);
    if (ep !== S.epoch) return;
    st.board.forEach(function (p) { setPos(p.id, p.r, p.c); });
    await sleep(430 * speed);
    if (ep !== S.epoch) return;
    for (i = 0; i < st.board.length; i++) { var q = S.pieces.get(st.board[i].id); if (q) q.el.classList.remove('spawn'); }
  }

  async function playSync(st, ep) {
    var byId = snapById(st.board);
    st.changed.forEach(function (id) {
      var p = S.pieces.get(id), info = byId[id];
      if (!p || !info) return;
      p.kind = info.kind;
      p.el.innerHTML = A.svg(info.kind, info.variant);
      p.el.classList.remove('bloom'); void p.el.offsetWidth; p.el.classList.add('bloom');
    });
    await sleep(500 * speed);
    if (ep !== S.epoch) return;
    S.pieces.forEach(function (p) { p.el.classList.remove('bloom'); });
  }

  async function playShuffle(st, ep) {
    toast('Nessuna mossa possibile: il giardino si rimescola…', 2600);
    await sleep(350 * speed);
    if (ep !== S.epoch) return;
    st.board.forEach(function (p) { setPos(p.id, p.r, p.c, 'slow'); });
    await sleep(850 * speed);
    if (ep !== S.epoch) return;
    S.pieces.forEach(function (p) { p.el.classList.remove('slow'); });
  }

  async function playExplosion(st, swap, ep) {
    var ids = [swap.idA, swap.idB];
    ids.forEach(function (id) { var p = S.pieces.get(id); if (p) p.el.classList.add('ignite'); });
    toast('Due Brucaliffo: il giardino sboccia!', 3000);
    await sleep(600 * speed);
    if (ep !== S.epoch) return;
    var o = cellCenter(st.origin.r, st.origin.c);
    var shock = document.createElement('div');
    shock.className = 'shock';
    var br = els.board.getBoundingClientRect();
    shock.style.left = ((o.x - br.left) / br.width * 100) + '%';
    shock.style.top = ((o.y - br.top) / br.height * 100) + '%';
    els.wrap.appendChild(shock);
    els.flash.classList.add('on');
    FX.burst(o.x, o.y, 70, 'brucaliffo', 2.2);
    S.pieces.forEach(function (p, id) {
      var d = Math.hypot(p.r - st.origin.r, p.c - st.origin.c);
      p.el.style.setProperty('--d', Math.round(d * 70 * speed) + 'ms');
      p.el.classList.remove('ignite');
      p.el.classList.add('blast');
      if (id !== swap.idA && id !== swap.idB && Math.random() < 0.28) {
        var ctr = cellCenter(p.r, p.c);
        setTimeout(function () { FX.burst(ctr.x, ctr.y, 4, p.kind, 0.9); }, d * 70 * speed);
      }
    });
    await sleep(1300 * speed);
    shock.remove();
    if (ep !== S.epoch) return;
    els.flash.classList.remove('on');
    els.board.innerHTML = '';
    S.pieces.clear();
  }

  /* ---------- mosse ---------- */

  async function attempt(a, b) {
    if (S.busy || !S.game || S.game.status !== 'playing') return;
    S.busy = true;
    var ep = S.epoch;
    clearHint(); clearSelection();
    var pa = S.game.grid[a.r][a.c], pb = S.game.grid[b.r][b.c];
    var res = S.game.tryMove(a, b);

    if (!res.ok) {
      // scambio non valido: i pezzi si sfiorano e tornano al loro posto; nessuna mossa consumata
      setPos(pa.id, b.r, b.c, 'quick'); setPos(pb.id, a.r, a.c, 'quick');
      await sleep(190 * speed);
      if (ep !== S.epoch) return;
      setPos(pa.id, a.r, a.c, 'quick'); setPos(pb.id, b.r, b.c, 'quick');
      await sleep(210 * speed);
      if (ep !== S.epoch) return;
      [pa, pb].forEach(function (p) {
        var x = S.pieces.get(p.id);
        if (x) { x.el.classList.remove('quick'); x.el.classList.remove('shake'); void x.el.offsetWidth; x.el.classList.add('shake'); }
      });
      await sleep(360 * speed);
      if (ep !== S.epoch) return;
      S.busy = false; armHint();
      return;
    }

    setMoves(res.movesLeft, true);
    setPos(res.swap.idA, res.swap.b.r, res.swap.b.c, 'quick');
    setPos(res.swap.idB, res.swap.a.r, res.swap.a.c, 'quick');
    await sleep(230 * speed);
    for (var i = 0; i < res.steps.length && ep === S.epoch; i++) {
      var st = res.steps[i];
      if (st.type === 'cascade') await playCascade(st, ep);
      else if (st.type === 'sync') await playSync(st, ep);
      else if (st.type === 'shuffle') await playShuffle(st, ep);
      else if (st.type === 'explosion') await playExplosion(st, res.swap, ep);
    }
    if (ep !== S.epoch) return;
    S.pieces.forEach(function (p) { p.el.classList.remove('quick'); });

    if (res.status === 'won') { await sleep(250 * speed); levelWon(); }
    else if (res.status === 'lost') { await sleep(300 * speed); levelLost(); }
    else { S.busy = false; armHint(); }
  }

  /* ---------- input (touch, penna e mouse) ---------- */

  function cellFromPoint(x, y) {
    var b = els.board.getBoundingClientRect();
    var c = Math.floor((x - b.left) / b.width * SIZE), r = Math.floor((y - b.top) / b.height * SIZE);
    if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) return null;
    return { r: r, c: c };
  }

  function onTap(cell) {
    if (!S.sel) { setSelected(cell); return; }
    if (S.sel.r === cell.r && S.sel.c === cell.c) { setSelected(null); return; }
    if (Math.abs(S.sel.r - cell.r) + Math.abs(S.sel.c - cell.c) === 1) { var from = S.sel; attempt(from, cell); return; }
    setSelected(cell);
  }

  els.board.addEventListener('pointerdown', function (e) {
    if (S.busy || !S.game || S.game.status !== 'playing') return;
    var cell = cellFromPoint(e.clientX, e.clientY);
    if (!cell) return;
    clearHint();
    S.drag = { cell: cell, x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
    try { els.board.setPointerCapture(e.pointerId); } catch (err) { /* non essenziale */ }
    e.preventDefault();
  });

  els.board.addEventListener('pointermove', function (e) {
    var d = S.drag;
    if (!d || d.moved || d.id !== e.pointerId) return;
    var dx = e.clientX - d.x, dy = e.clientY - d.y;
    var cs = els.board.getBoundingClientRect().width / SIZE;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < cs * 0.3) return;
    d.moved = true;
    var t = Math.abs(dx) > Math.abs(dy) ? { r: d.cell.r, c: d.cell.c + (dx > 0 ? 1 : -1) } : { r: d.cell.r + (dy > 0 ? 1 : -1), c: d.cell.c };
    if (t.r < 0 || t.c < 0 || t.r >= SIZE || t.c >= SIZE) return;
    attempt(d.cell, t);
  });

  function endDrag(e) {
    var d = S.drag;
    if (!d || d.id !== e.pointerId) return;
    S.drag = null;
    if (!d.moved && e.type === 'pointerup' && !S.busy) onTap(d.cell);
    else if (!d.moved && !S.busy) armHint();
  }
  els.board.addEventListener('pointerup', endDrag);
  els.board.addEventListener('pointercancel', endDrag);
  els.board.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* ---------- pulsanti ---------- */

  $('#btn-play').addEventListener('click', beginRun);
  $('#btn-replay').addEventListener('click', function () { FX.clear(); beginRun(); });
  $('#btn-home').addEventListener('click', function () {
    S.busy = true; S.epoch++; clearHint(); els.modal.hidden = true; FX.clear(); show('start');
  });

  /* ---------- avvio ---------- */

  buildBackground();
  buildHero();
  FX.init($('#fx'));

  // Interfaccia minima per i test automatici (nessun dato lasciato dal dispositivo).
  window.__flos = {
    state: S, engine: E,
    cellRect: function (r, c) { var b = els.board.getBoundingClientRect(), cs = b.width / SIZE; return { x: b.left + (c + 0.5) * cs, y: b.top + (r + 0.5) * cs, cs: cs }; },
    showFinal: showFinal
  };
})();
