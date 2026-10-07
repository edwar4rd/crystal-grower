/* poster.js: the one-card-per-screen interactive poster. */
(function () {
  'use strict';
  var P = Phys.P;
  var $ = function (id) { return document.getElementById(id); };
  var cards = [].slice.call(document.querySelectorAll('.card'));
  var NAMES = ['Intro', '1 Neck', '2 Diameter', '3 Defects'];
  var G0 = 3.0, GOLD_GL = Phys.solveGl(Phys.goldenVp(G0), G0, P.Rt);

  function banner(sim, el) {
    if (sim.status !== 'running') { el.hidden = false; el.textContent = UI.MESSAGES[sim.status]; }
    else el.hidden = true;
  }

  /* ---------- card 0: intro, ingot growing quietly ---------- */
  var sim0 = new Phys.Sim({ fixed: true, prefill: 'body', bodyLen: 420 });
  var c0 = {
    tick: function (dt) { sim0.advance(dt * 30); },
    draw: function () { Render.draw($('cv0'), sim0, {}); }
  };

  /* ---------- card 1: the thin neck ---------- */
  var LNECK = 50;
  var dis = [
    { u: -0.6, s: 1, deg: 5 }, { u: 0.3, s: -1, deg: 8 }, { u: -0.2, s: 1, deg: 12 },
    { u: 0.7, s: -1, deg: 17 }, { u: 0.1, s: 1, deg: 25 }, { u: -0.5, s: -1, deg: 40 }
  ].map(function (l) { l.t = Math.tan(l.deg * Math.PI / 180); return l; });
  var n1 = { vp: 4, R: null };
  function neckTarget() { return Math.min(14, Phys.neckRadius(n1.vp, G0, GOLD_GL)); }

  var c1 = {
    tick: function () {
      var t = neckTarget();
      n1.R = n1.R === null ? t : n1.R + (t - n1.R) * 0.12;
    },
    draw: function () {
      var st = Render.setup($('cv1')); if (!st) return;
      var ctx = st.ctx, w = st.w, h = st.h, col = Render.colors(), R = n1.R;
      var cx = w / 2, sx = Math.min(w * 0.9 / 52, 20), sy = h * 0.46 / LNECK;
      var yTop = h * 0.12, yNeck = yTop + LNECK * sy, yFl = h * 0.8, yMelt = h * 0.8;
      var fs = Math.max(12, Math.min(16, w / 50));
      ctx.font = fs + 'px system-ui, sans-serif'; ctx.textBaseline = 'middle';

      // crystal silhouette: seed, neck, flare
      ctx.beginPath();
      ctx.moveTo(cx - 14 * sx, h * 0.03); ctx.lineTo(cx + 14 * sx, h * 0.03);
      ctx.lineTo(cx + 14 * sx, yTop - 6); ctx.lineTo(cx + R * sx, yTop);
      ctx.lineTo(cx + R * sx, yNeck);
      ctx.quadraticCurveTo(cx + R * sx, yFl, cx + 26 * sx, yFl);
      ctx.lineTo(cx - 26 * sx, yFl);
      ctx.quadraticCurveTo(cx - R * sx, yFl, cx - R * sx, yNeck);
      ctx.lineTo(cx - R * sx, yTop); ctx.lineTo(cx - 14 * sx, yTop - 6);
      ctx.closePath();
      var gr = ctx.createLinearGradient(cx - 26 * sx, 0, cx + 26 * sx, 0);
      gr.addColorStop(0, '#8f98a6'); gr.addColorStop(0.35, '#c9ced6'); gr.addColorStop(0.7, '#a9b0bc'); gr.addColorStop(1, '#8f98a6');
      ctx.fillStyle = gr; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = col.ink; ctx.stroke();

      // melt
      var gm = ctx.createLinearGradient(0, yMelt, 0, h);
      gm.addColorStop(0, '#ffd45e'); gm.addColorStop(1, '#f59e0b');
      ctx.fillStyle = gm; ctx.fillRect(0, yMelt, w, h - yMelt);

      // dislocation lines
      var survivors = 0;
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#c026d3'; ctx.fillStyle = '#c026d3';
      dis.forEach(function (l) {
        var x0 = l.u * R, dzExit = R * (1 - l.s * l.u) / l.t;
        var px = function (dz) { return cx + (x0 + l.s * l.t * dz) * sx; };
        var py = function (dz) { return yTop + dz * sy; };
        ctx.beginPath(); ctx.moveTo(px(0), py(0));
        if (dzExit <= LNECK) {
          ctx.lineTo(px(dzExit), py(dzExit)); ctx.stroke();
          ctx.beginPath(); ctx.arc(px(dzExit), py(dzExit), 4, 0, 7); ctx.fill();   // escapes
        } else {
          survivors++;
          var dzEnd = (yFl - yTop) / sy;
          ctx.lineTo(px(dzEnd), py(dzEnd)); ctx.stroke();
        }
      });

      ctx.fillStyle = col.card; ctx.textAlign = 'center';
      ctx.fillText('seed', cx, h * 0.03 + (yTop - h * 0.03) / 2 - 2);
      ctx.fillStyle = col.ink; ctx.textAlign = 'left';
      ctx.fillText('melt  1414 \u00B0C', 14, yMelt + (h - yMelt) / 2);
      ctx.fillStyle = col.mute;
      ctx.fillText('\u2193 shoulder and body grow from here', cx + 30 * sx > w - 270 ? 14 : cx + 8 * sx, yFl - fs * 1.5);

      var gneck = G0 * (1 + P.c / R);
      $('r1d').textContent = (2 * R).toFixed(1) + ' mm';
      $('r1g').textContent = gneck.toFixed(1) + ' K/mm';
      var v = $('r1v');
      if (survivors === 0) { v.textContent = '\u2713 All 6 dislocations escape. Clean crystal below.'; v.className = 'verdict good'; }
      else { v.textContent = '\u2717 ' + survivors + ' of 6 dislocations survive into the crystal.'; v.className = 'verdict bad'; }
    }
  };

  /* ---------- card 2: diameter / heat balance ---------- */
  var sim2 = new Phys.Sim({ prefill: 'body', bodyLen: 380 });
  var f2a = function (v) { return v.toFixed(2) + ' mm/min'; };
  var f2b = function (v) { return v.toFixed(2) + ' K/mm'; };
  function sync2() {
    UI.setRange($('s2a'), $('o2a'), f2a, sim2.p.vp);
    UI.setRange($('s2b'), $('o2b'), f2b, sim2.p.Gl);
  }
  UI.bind($('s2a'), $('o2a'), f2a, function (v) { sim2.p.vp = v; });
  UI.bind($('s2b'), $('o2b'), f2b, function (v) { sim2.p.Gl = v; });
  $('reset2').addEventListener('click', function () { sim2.reset(); sync2(); });
  sync2();

  function drawBalance() {
    var st = Render.setup($('cv2b')); if (!st) return;
    var ctx = st.ctx, w = st.w, h = st.h, col = Render.colors();
    var gs = sim2.gs(), cool = P.A * gs, melt = P.B * sim2.p.Gl, vg = cool - melt, vp = sim2.p.vp;
    var x0 = 8, full = w - 16, mx = 1.4, k = full / mx, rh = h * 0.2;
    var fs = Math.max(11, Math.min(14, w / 40));
    ctx.font = fs + 'px system-ui, sans-serif'; ctx.textBaseline = 'middle';
    function bar(y, a, b, fill) { ctx.fillStyle = fill; ctx.fillRect(x0 + a * k, y, (b - a) * k, rh); }
    var y1 = h * 0.06, y2 = h * 0.38, y3 = h * 0.7;
    bar(y1, 0, cool, col.teal);
    bar(y2, 0, Math.max(vg, 0), col.card);
    ctx.strokeStyle = col.teal; ctx.lineWidth = 2; ctx.strokeRect(x0, y2, Math.max(vg, 0) * k, rh);
    bar(y2, Math.max(vg, 0), cool, col.amber);
    bar(y3, 0, vp, col.purple);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    ctx.fillText('cooling  k\u209BG\u209B', x0 + 6, y1 + rh / 2);
    ctx.fillText('melt heat k\u2097G\u2097', x0 + Math.max(vg, 0) * k + 6, y2 + rh / 2);
    ctx.fillText('pull rate v', x0 + 6, y3 + rh / 2);
    ctx.fillStyle = col.teal; ctx.textAlign = 'right';
    ctx.fillText('net = ' + vg.toFixed(2), x0 + Math.max(vg, 0) * k - 6, y2 + rh / 2);
    // marker for net growth capacity on pull row
    ctx.strokeStyle = col.ink; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x0 + vg * k, y2); ctx.lineTo(x0 + vg * k, y3 + rh); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = col.ink; ctx.textAlign = 'right';
    var d = vp - vg, msg;
    if (Math.abs(d) < 0.01) msg = 'balanced \u2192 constant diameter';
    else if (d > 0) msg = 'pull > freeze rate \u2192 thinner \u2193';
    else msg = 'freeze > pull rate \u2192 wider \u2191';
    ctx.fillText(msg, w - 8, y3 + rh / 2);
    ctx.textAlign = 'left'; ctx.fillStyle = col.mute;
    ctx.fillText('(all terms shown as mm/min of crystal)', x0 + 2, h - fs * 0.6);
  }
  var c2 = {
    tick: function (dt) { sim2.advance(dt * 30); },
    draw: function () {
      Render.draw($('cv2'), sim2, {});
      banner(sim2, $('b2'));
      drawBalance();
    }
  };

  /* ---------- card 3: defects, v/G ---------- */
  var sim3 = new Phys.Sim({ fixed: true, prefill: 'body', bodyLen: 420 });
  var f3a = function (v) { return v.toFixed(3) + ' mm/min'; };
  var f3b = function (v) { return v.toFixed(2) + ' K/mm'; };
  function sync3() {
    UI.setRange($('s3a'), $('o3a'), f3a, sim3.p.vp);
    UI.setRange($('s3b'), $('o3b'), f3b, sim3.p.G0);
  }
  UI.bind($('s3a'), $('o3a'), f3a, function (v) { sim3.p.vp = v; });
  UI.bind($('s3b'), $('o3b'), f3b, function (v) { sim3.p.G0 = v; });
  sync3();
  var presets3 = { fast: 0.6, ok: Phys.goldenVp(G0), slow: 0.27 };
  [].forEach.call(document.querySelectorAll('[data-p3]'), function (b) {
    b.addEventListener('click', function () {
      sim3.p.G0 = G0; sim3.p.vp = presets3[b.getAttribute('data-p3')]; sync3();
    });
  });
  function place(el, ratio) {
    el.style.left = Phys.clamp((ratio - 0.6) / 0.9 * 100, 1, 99) + '%';
  }
  var c3 = {
    tick: function (dt) { sim3.advance(dt * 40); },
    draw: function () {
      Render.draw($('cv3'), sim3, { inset: true });
      var rc = sim3.rcNow(), re = rc / (1 + P.kappa), b = Phys.bounds(rc);
      place($('mkC'), rc); place($('mkE'), re);
      var v = $('r3v'), hasV = b.rhoV > 0.02, hasI = b.rhoI < 0.98;
      if (hasV && hasI) { v.textContent = 'Voids in the core, loops at the rim'; v.className = 'verdict bad'; }
      else if (hasV) { v.textContent = b.rhoV > 0.98 ? 'Voids everywhere (too fast)' : 'Void-rich core, ring of good silicon'; v.className = 'verdict bad'; }
      else if (hasI) { v.textContent = b.rhoI < 0.02 ? 'Loops everywhere (too slow)' : 'Loop-rich rim, good silicon in the middle'; v.className = 'verdict bad'; }
      else { v.textContent = '\u2713 Defect-free silicon'; v.className = 'verdict good'; }
    }
  };

  /* ---------- navigation + main loop ---------- */
  var ctrls = [c0, c1, c2, c3], idx = 0;
  var dots = $('dots');
  NAMES.forEach(function (n, i) {
    var b = document.createElement('button'); b.className = 'dot'; b.textContent = n;
    b.addEventListener('click', function () { show(i); }); dots.appendChild(b);
  });
  function show(i) {
    idx = Phys.clamp(i, 0, cards.length - 1);
    cards.forEach(function (c, j) { c.classList.toggle('active', j === idx); });
    [].forEach.call(dots.children, function (b, j) { b.classList.toggle('on', j === idx); });
    history.replaceState(null, '', '#' + idx);
  }
  $('prev').addEventListener('click', function () { show(idx - 1); });
  $('next').addEventListener('click', function () { show(idx + 1); });
  document.addEventListener('keydown', function (e) {
    if (e.target && e.target.tagName === 'INPUT' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) e.target.blur();
    if (e.key === 'ArrowRight' || e.key === 'PageDown') show(idx + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') show(idx - 1);
  });
  UI.bind($('s1'), $('o1'), function (v) { return v.toFixed(1) + ' mm/min'; }, function (v) { n1.vp = v; });
  show(parseInt(location.hash.slice(1), 10) || 0);

  var last = performance.now();
  function frame(now) {
    var dt = Math.min((now - last) / 1000, 0.1); last = now;
    var c = ctrls[idx];
    c.tick(dt); c.draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
