/*
 * FLOS DESIGN MATCH — effetti di petali e coriandoli su canvas.
 * Il ciclo di animazione si ferma da solo quando non ci sono più particelle.
 */
(function (root) {
  'use strict';

  var canvas, ctx, parts = [], raf = 0, W = 0, H = 0, dpr = 1, last = 0;
  var rainOn = false, rainAcc = 0;
  var reduced = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var PALETTE = ['#f4b8c8', '#e68aa8', '#cdbbea', '#a98fd3', '#f8dcae', '#ffffff', '#bcd9b4', '#f5a68c'];
  var FLOWER_COLORS = {
    margherita: ['#ffffff', '#f6c443', '#efe6dc'],
    tulipano: ['#f58468', '#ff9d7e', '#e2543f'],
    rosellina: ['#e87aa0', '#cf4a78', '#f7b3c8'],
    campanula: ['#a98fd3', '#c6b4f2', '#8468cf'],
    bruco: ['#9ccd54', '#c5e67e', '#79b440'],
    brucaliffo: ['#c9b6e6', '#f4b8c8', '#f8dcae', '#bcd9b4']
  };

  function resize() {
    if (!canvas) return;
    dpr = Math.min(root.devicePixelRatio || 1, 2);
    W = root.innerWidth; H = root.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  }

  function init(el) {
    canvas = el; ctx = canvas.getContext('2d');
    resize();
    root.addEventListener('resize', resize);
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function spawn(x, y, vx, vy, size, colors, life, g) {
    parts.push({
      x: x, y: y, vx: vx, vy: vy, size: size, color: pick(colors),
      rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 7,
      flip: Math.random() * 6.28, vf: 3 + Math.random() * 5,
      life: 0, max: life, g: g
    });
  }

  /** Esplosione di petali da un punto (coordinate di viewport). */
  function burst(x, y, n, kind, power) {
    if (!ctx) return;
    var colors = FLOWER_COLORS[kind] || PALETTE;
    if (reduced) n = Math.ceil(n / 3);
    power = power || 1;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.283, s = (60 + Math.random() * 240) * power;
      spawn(x, y, Math.cos(a) * s, Math.sin(a) * s - 60 * power, 5 + Math.random() * 7, colors, 0.9 + Math.random() * 0.8, 380);
    }
    start();
  }

  /** Pioggia continua di petali (schermata finale). */
  function rain(on) { rainOn = on; if (on) start(); }

  function clear() { parts.length = 0; rainOn = false; if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height); }

  function start() { if (!raf) { last = 0; raf = root.requestAnimationFrame(frame); } }

  function petal(p) {
    var s = p.size;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.95, -s * 0.55, s * 0.8, s * 0.55, 0, s);
    ctx.bezierCurveTo(-s * 0.8, s * 0.55, -s * 0.95, -s * 0.55, 0, -s);
    ctx.fill();
  }

  function frame(t) {
    raf = 0;
    if (!ctx) return;
    var dt = last ? Math.min((t - last) / 1000, 0.05) : 0.016;
    last = t;
    if (rainOn) {
      rainAcc += dt * (reduced ? 6 : 26);
      while (rainAcc >= 1) {
        rainAcc -= 1;
        spawn(Math.random() * W, -14, (Math.random() - 0.5) * 40, 40 + Math.random() * 60, 6 + Math.random() * 7, PALETTE, 99, 40);
        parts[parts.length - 1].sway = Math.random() * 6.28;
      }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.life += dt;
      if (p.sway !== undefined) { p.vx += Math.sin(p.life * 2 + p.sway) * 30 * dt; p.vy = Math.min(p.vy + p.g * dt, 130); }
      else { p.vy += p.g * dt; p.vx *= (1 - 1.4 * dt); p.vy *= (1 - 0.6 * dt); }
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.flip += p.vf * dt;
      var dead = p.sway !== undefined ? p.y > H + 20 : p.life > p.max;
      if (dead) { parts.splice(i, 1); continue; }
      var fade = p.sway !== undefined ? 1 : Math.max(0, Math.min(1, (p.max - p.life) / 0.4));
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(Math.max(0.15, Math.abs(Math.cos(p.flip))), 1);
      ctx.globalAlpha = 0.92 * fade;
      ctx.fillStyle = p.color;
      petal(p);
      ctx.restore();
    }
    if (parts.length || rainOn) raf = root.requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, W, H);
  }

  root.FlosFX = { init: init, burst: burst, rain: rain, clear: clear };
})(typeof self !== 'undefined' ? self : this);
