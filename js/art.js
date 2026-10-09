/*
 * FLOS DESIGN MATCH — illustrazioni vettoriali (SVG inline, nessuna immagine esterna).
 * Ogni elemento è disegnato in un viewBox 100x100.
 */
(function (root) {
  'use strict';

  function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function mix(a, b, t) {
    var x = hex(a), y = hex(b);
    return '#' + [0, 1, 2].map(function (i) {
      var v = Math.round(x[i] + (y[i] - x[i]) * t);
      return ('0' + v.toString(16)).slice(-2);
    }).join('');
  }

  /* Perline del Brucaliffo: tre tonalità per colorazione (chiara, media, scura come nel gioiello originale). */
  var BEADS = {
    lilla:  ['#c9b6e6', '#a98fd3', '#6e4a8e'],
    rosa:   ['#f6cbd6', '#e5a0b4', '#a9526f'],
    salvia: ['#cde2c7', '#a2c79b', '#4f7b58'],
    ambra:  ['#f7e0ab', '#e5b96c', '#9b6a2d']
  };
  var NAMES = { lilla: 'lilla', rosa: 'rosa cipria', salvia: 'salvia', ambra: 'ambra' };

  function radial(id, c, spec) {
    return '<radialGradient id="' + id + '" cx="' + (spec ? spec[0] : '36%') + '" cy="' + (spec ? spec[1] : '30%') + '" r="75%">' +
      '<stop offset="0" stop-color="' + mix(c, '#ffffff', 0.7) + '"/>' +
      '<stop offset="0.45" stop-color="' + c + '"/>' +
      '<stop offset="1" stop-color="' + mix(c, '#2a1736', 0.42) + '"/></radialGradient>';
  }
  function linear(id, c1, c2, x2, y2) {
    return '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + (x2 || 0) + '" y2="' + (y2 === undefined ? 1 : y2) + '">' +
      '<stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient>';
  }

  /** Definizioni condivise (gradienti) da inserire una sola volta nel documento. */
  function defs() {
    var d = '';
    d += linear('g-marg', '#ffffff', '#efe6dc');
    d += radial('g-marg-c', '#f6c443', ['40%', '35%']);
    d += linear('g-tul', '#ff9d7e', '#e2543f');
    d += linear('g-tul-l', '#ffc3ae', '#f58468');
    d += linear('g-leaf', '#a9d49b', '#6ea36a', 1, 1);
    d += radial('g-ros', '#e87aa0', ['38%', '32%']);
    d += linear('g-ros-d', '#cf4a78', '#a52f5c');
    d += linear('g-cam', '#c6b4f2', '#8468cf');
    d += linear('g-cam-l', '#e2d8fa', '#b5a0ea');
    d += linear('g-bru', '#c5e67e', '#79b440');
    d += linear('g-bru-d', '#9ccd54', '#5b9a32');
    d += radial('g-wire', '#e6b89a', ['40%', '30%']);
    d += linear('g-silver', '#f4f5f8', '#a9aeb8');
    Object.keys(BEADS).forEach(function (v) {
      BEADS[v].forEach(function (c, i) { d += radial('bd-' + v + '-' + i, c); });
    });
    return '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>' + d + '</defs></svg>';
  }

  function r1(n) { return Math.round(n * 10) / 10; }

  /* ---------- fiori ---------- */

  function margherita() {
    var s = '<ellipse cx="50" cy="90" rx="26" ry="4" fill="#5a3b52" opacity=".10"/>';
    for (var i = 0; i < 14; i++) {
      var a = i * (360 / 14);
      s += '<ellipse cx="50" cy="23" rx="6.6" ry="19" fill="url(#g-marg)" stroke="#c9bcae" stroke-width="1.3" transform="rotate(' + r1(a) + ' 50 50)"/>';
    }
    s += '<circle cx="50" cy="50" r="14.5" fill="url(#g-marg-c)" stroke="#c98a14" stroke-width="1.4"/>';
    s += '<circle cx="45" cy="45" r="3.2" fill="#fff" opacity=".55"/>';
    return s;
  }

  function tulipano() {
    return '' +
      '<ellipse cx="50" cy="92" rx="22" ry="3.5" fill="#5a3b52" opacity=".10"/>' +
      '<path d="M50 94 L50 62" stroke="#6ea36a" stroke-width="5.5" stroke-linecap="round"/>' +
      '<path d="M50 91 C 28 88 20 70 22 56 C 38 62 48 74 50 91 Z" fill="url(#g-leaf)" stroke="#5a8f5b" stroke-width="1.2"/>' +
      '<path d="M50 91 C 72 88 80 70 78 56 C 62 62 52 74 50 91 Z" fill="url(#g-leaf)" stroke="#5a8f5b" stroke-width="1.2"/>' +
      '<path d="M26 20 L40 36 L50 12 L60 36 L74 20 C 80 52 68 72 50 72 C 32 72 20 52 26 20 Z" fill="url(#g-tul)" stroke="#c4432f" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M50 12 C 40 34 40 56 50 72 C 60 56 60 34 50 12 Z" fill="url(#g-tul-l)" opacity=".9"/>' +
      '<path d="M32 30 C 30 46 36 60 44 68" stroke="#fff" stroke-opacity=".45" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
  }

  function rosellina() {
    var s = '<ellipse cx="50" cy="90" rx="26" ry="4" fill="#5a3b52" opacity=".10"/>';
    s += '<path d="M50 88 C 34 90 18 80 16 66 C 32 66 46 74 50 88 Z" fill="url(#g-leaf)" stroke="#5a8f5b" stroke-width="1.1"/>';
    s += '<path d="M50 88 C 66 90 82 80 84 66 C 68 66 54 74 50 88 Z" fill="url(#g-leaf)" stroke="#5a8f5b" stroke-width="1.1"/>';
    for (var i = 0; i < 6; i++) {
      var a = (i * 60 - 90) * Math.PI / 180;
      s += '<circle cx="' + r1(50 + Math.cos(a) * 21) + '" cy="' + r1(46 + Math.sin(a) * 21) + '" r="15.5" fill="url(#g-ros)" stroke="#b8406a" stroke-width="1.3"/>';
    }
    s += '<circle cx="50" cy="46" r="17" fill="url(#g-ros-d)" stroke="#a52f5c" stroke-width="1.2"/>';
    s += '<path d="M50 46 m0 -3 a3 3 0 1 1 -3 3 a6.5 6.5 0 1 1 6.5 6.5 a10 10 0 1 1 -10 -10 a13.5 13.5 0 1 1 13.5 13.5" fill="none" stroke="#f9b9cf" stroke-width="1.8" stroke-linecap="round"/>';
    s += '<ellipse cx="40" cy="30" rx="6" ry="3.2" fill="#fff" opacity=".35" transform="rotate(-30 40 30)"/>';
    return s;
  }

  function campanula() {
    return '' +
      '<ellipse cx="50" cy="92" rx="20" ry="3.4" fill="#5a3b52" opacity=".10"/>' +
      '<path d="M50 90 C 50 70 58 40 70 22" stroke="#7aa874" stroke-width="3" fill="none" stroke-linecap="round" opacity="0"/>' +
      // campanula principale (a campana, vista di lato)
      '<path d="M50 10 C 66 10 68 28 70 44 C 71 56 78 64 84 74 C 70 80 30 80 16 74 C 22 64 29 56 30 44 C 32 28 34 10 50 10 Z" fill="url(#g-cam)" stroke="#6a4fb8" stroke-width="1.6" stroke-linejoin="round"/>' +
      // bordo svasato a lobi
      '<path d="M16 74 C 18 86 30 88 34 80 C 38 90 46 92 50 82 C 54 92 62 90 66 80 C 70 88 82 86 84 74 C 70 80 30 80 16 74 Z" fill="url(#g-cam-l)" stroke="#6a4fb8" stroke-width="1.5" stroke-linejoin="round"/>' +
      '<ellipse cx="50" cy="77" rx="25" ry="4.2" fill="#5f47a8" opacity=".35"/>' +
      '<path d="M40 14 C 38 32 36 50 28 66" stroke="#fff" stroke-opacity=".5" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
      '<path d="M45 8 C 45 5 55 5 55 8" stroke="#6ea36a" stroke-width="3.2" fill="none" stroke-linecap="round"/>' +
      '<circle cx="50" cy="60" r="2" fill="#f4eefc" opacity=".8"/><circle cx="50" cy="48" r="1.7" fill="#f4eefc" opacity=".6"/>';
  }

  /* ---------- bruco ---------- */

  function bruco() {
    var seg = [[20, 72, 12], [34, 58, 13.5], [50, 52, 14.5], [66, 58, 14], [80, 70, 12.5]];
    var s = '<ellipse cx="50" cy="90" rx="34" ry="4" fill="#5a3b52" opacity=".10"/>';
    // zampette
    seg.forEach(function (p) { s += '<ellipse cx="' + p[0] + '" cy="' + (p[1] + p[2] - 1) + '" rx="3.6" ry="3" fill="#4f8a2a"/>'; });
    // corpo: dal fondo (coda) verso la testa
    seg.forEach(function (p, i) {
      s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + p[2] + '" fill="url(#' + (i % 2 ? 'g-bru-d' : 'g-bru') + ')" stroke="#4f8a2a" stroke-width="1.5"/>';
      s += '<ellipse cx="' + (p[0] - p[2] * 0.3) + '" cy="' + (p[1] - p[2] * 0.45) + '" rx="' + r1(p[2] * 0.32) + '" ry="' + r1(p[2] * 0.2) + '" fill="#fff" opacity=".4"/>';
    });
    // testa (ultimo segmento a destra) con viso e antenne
    s += '<path d="M76 58 C 74 46 72 40 70 34" stroke="#4f8a2a" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
    s += '<path d="M85 58 C 88 48 92 42 94 36" stroke="#4f8a2a" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
    s += '<circle cx="70" cy="33" r="3.6" fill="#f49ab4" stroke="#4f8a2a" stroke-width="1"/><circle cx="94" cy="35" r="3.6" fill="#f49ab4" stroke="#4f8a2a" stroke-width="1"/>';
    s += '<circle cx="76" cy="67" r="4.6" fill="#fff"/><circle cx="87" cy="67" r="4.6" fill="#fff"/>';
    s += '<circle cx="77.2" cy="67.6" r="2.3" fill="#3a2a46"/><circle cx="88.2" cy="67.6" r="2.3" fill="#3a2a46"/>';
    s += '<circle cx="78" cy="66.6" r=".8" fill="#fff"/><circle cx="89" cy="66.6" r=".8" fill="#fff"/>';
    s += '<path d="M78 75 Q 82 79 86 75" stroke="#3a2a46" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
    s += '<circle cx="73.5" cy="73" r="2.2" fill="#f49ab4" opacity=".6"/><circle cx="90" cy="73" r="2.2" fill="#f49ab4" opacity=".6"/>';
    return s;
  }

  /* ---------- Brucaliffo: il cerchietto Flos Design ---------- */

  function hash(i, salt) { var x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453; return x - Math.floor(x); }

  /**
   * Orecchino a cerchio con perline sfaccettate su due file sfalsate, filo ramato
   * e chiusura in argento (come il gioiello fotografato).
   */
  function brucaliffo(variant) {
    var v = BEADS[variant] ? variant : 'lilla';
    var cx = 50, cy = 56;
    var s = '<ellipse cx="50" cy="92" rx="26" ry="3.6" fill="#5a3b52" opacity=".12"/>';
    // filo ramato di sostegno
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="27" fill="none" stroke="url(#g-wire)" stroke-width="2.2"/>';
    var gap = 34; // gradi liberi in alto per la chiusura
    function ring(n, radius, bead, salt, phase) {
      var out = '';
      for (var i = 0; i < n; i++) {
        var ang = -90 + gap / 2 + (i + phase) * ((360 - gap) / n) + (phase ? 0 : 0);
        var rad = ang * Math.PI / 180;
        var x = cx + Math.cos(rad) * radius, y = cy + Math.sin(rad) * radius;
        var h = hash(i, salt);
        var tone = h < 0.34 ? 0 : h < 0.76 ? 1 : 2; // chiara / media / scura, mescolate
        out += '<g transform="rotate(' + r1(ang + 90 + (h - 0.5) * 14) + ' ' + r1(x) + ' ' + r1(y) + ')">' +
          '<ellipse cx="' + r1(x) + '" cy="' + r1(y) + '" rx="' + r1(bead * 1.18) + '" ry="' + bead + '" fill="url(#bd-' + v + '-' + tone + ')" stroke="' + mix(BEADS[v][tone], '#2a1736', 0.5) + '" stroke-width=".55"/>' +
          '<path d="M' + r1(x - bead * 0.55) + ' ' + r1(y - bead * 0.1) + ' L' + r1(x) + ' ' + r1(y - bead * 0.75) + ' L' + r1(x + bead * 0.55) + ' ' + r1(y - bead * 0.1) + '" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width=".7" stroke-linejoin="round"/>' +
          '<ellipse cx="' + r1(x - bead * 0.35) + '" cy="' + r1(y - bead * 0.38) + '" rx="' + r1(bead * 0.32) + '" ry="' + r1(bead * 0.2) + '" fill="#fff" opacity=".75"/>' +
          '</g>';
      }
      return out;
    }
    s += ring(17, 20.5, 5.0, 3, 0.5);   // fila interna
    s += ring(19, 31.5, 5.4, 7, 0);     // fila esterna
    s += ring(17, 26, 4.6, 11, 0.25);   // fila centrale (più piccola, riempie gli spazi)
    // chiusura argentata in alto: perno a sinistra con avvolgimento di filo ramato, gancetto a destra
    s += '<path d="M' + (cx - 13) + ' 25 Q ' + cx + ' 20.5 ' + (cx + 13) + ' 25" fill="none" stroke="url(#g-silver)" stroke-width="3.4" stroke-linecap="round"/>';
    s += '<rect x="' + (cx - 19) + '" y="21.5" width="10" height="8" rx="2.6" fill="url(#g-silver)" stroke="#8d93a0" stroke-width=".9" transform="rotate(-14 ' + (cx - 14) + ' 25.5)"/>';
    s += '<rect x="' + (cx + 9) + '" y="21.5" width="10" height="8" rx="2.6" fill="url(#g-silver)" stroke="#8d93a0" stroke-width=".9" transform="rotate(14 ' + (cx + 14) + ' 25.5)"/>';
    s += '<path d="M' + (cx - 17) + ' 21.5 l-1.5 8 M' + (cx - 14) + ' 21 l-1.5 8 M' + (cx - 11) + ' 21.3 l-1.5 8" stroke="#d9a58a" stroke-width="1.5" stroke-linecap="round"/>';
    s += '<path d="M' + (cx + 20) + ' 18.5 q4 -2 5 2.5" stroke="url(#g-silver)" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
    // brillantini
    s += '<path class="spark s1" d="M84 20 l1.8 5.4 5.4 1.8 -5.4 1.8 -1.8 5.4 -1.8 -5.4 -5.4 -1.8 5.4 -1.8z" fill="#fff"/>';
    s += '<path class="spark s2" d="M14 40 l1.3 3.7 3.7 1.3 -3.7 1.3 -1.3 3.7 -1.3 -3.7 -3.7 -1.3 3.7 -1.3z" fill="#fff"/>';
    return s;
  }

  var LABELS = {
    margherita: 'Margherita', tulipano: 'Tulipano', rosellina: 'Rosellina',
    campanula: 'Campanula lilla', bruco: 'Bruco verde', brucaliffo: 'Brucaliffo'
  };

  /** Markup SVG completo dell'elemento richiesto. */
  function svg(kind, variant) {
    var body;
    switch (kind) {
      case 'margherita': body = margherita(); break;
      case 'tulipano': body = tulipano(); break;
      case 'rosellina': body = rosellina(); break;
      case 'campanula': body = campanula(); break;
      case 'bruco': body = bruco(); break;
      case 'brucaliffo': body = brucaliffo(variant); break;
      default: body = '';
    }
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + (LABELS[kind] || kind) + '" focusable="false">' + body + '</svg>';
  }

  root.FlosArt = { svg: svg, defs: defs, BEADS: BEADS, NAMES: NAMES, LABELS: LABELS, mix: mix };
})(typeof self !== 'undefined' ? self : this);
