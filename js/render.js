/* render.js: canvas drawing of the furnace, ingot (surface + cutaway) and wafer face. */
(function (global) {
  'use strict';
  var P = Phys.P;

  var cache = null, cacheTheme = null;
  function colors() {
    var th = document.documentElement.getAttribute('data-theme') || 'light';
    if (cache && cacheTheme === th) return cache;
    var cs = getComputedStyle(document.documentElement);
    var g = function (n) { return cs.getPropertyValue(n).trim(); };
    cache = {
      ink: g('--ink'), mute: g('--mute'), card: g('--card'), line: g('--line'),
      V: g('--V'), DF: g('--DF'), I: g('--I'), teal: g('--teal'), amber: g('--amber'), purple: g('--purple')
    };
    cacheTheme = th;
    return cache;
  }

  /** Size the canvas backing store to its CSS size; returns {ctx,w,h} or null if hidden. */
  function setup(canvas) {
    var dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return null;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx: ctx, w: w, h: h };
  }

  function drawWafer(ctx, cx, cy, r, rc, col) {
    var b = Phys.bounds(rc);
    function disc(rad, fill) {
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(rad, 0), 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
    }
    disc(r, col.I);
    if (b.rhoI > 0) disc(r * b.rhoI, col.DF);
    if (b.rhoV > 0) disc(r * b.rhoV, col.V);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = 2; ctx.strokeStyle = col.ink; ctx.stroke();
    // flat / notch marker
    ctx.fillStyle = col.ink; ctx.fillRect(cx - 5, cy + r - 1, 10, 3);
  }

  /**
   * opts: { inset: bool (wafer face top-right), viewMM: mm of crystal visible above melt }
   */
  function draw(canvas, sim, opts) {
    opts = opts || {};
    var st = setup(canvas); if (!st) return;
    var ctx = st.ctx, w = st.w, h = st.h, col = colors();
    var depth = 70, view = opts.viewMM || 430;
    var s = Math.min(w * 0.9 / (2 * P.Rcruc), h / (view + depth + 15));
    var bottomY = h - 6, yM = bottomY - depth * s, cx = w / 2;
    var fs = Math.max(11, Math.min(15, w / 60));
    ctx.font = fs + 'px system-ui, sans-serif';

    // ---- melt + crucible + heater + shield ----
    var gm = ctx.createLinearGradient(0, yM, 0, bottomY);
    gm.addColorStop(0, '#ffd45e'); gm.addColorStop(1, '#f59e0b');
    ctx.fillStyle = gm;
    ctx.fillRect(cx - P.Rcruc * s, yM, 2 * P.Rcruc * s, bottomY - yM);

    var heat = Phys.clamp((sim.p.Gl - 0.3) / 0.7, 0, 1);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(220,70,30,' + (0.25 + 0.7 * heat).toFixed(2) + ')';
    ctx.lineWidth = Math.max(5, 9 * s);
    [-1, 1].forEach(function (sg) {
      var x = cx + sg * (P.Rcruc + 16) * s;
      ctx.beginPath(); ctx.moveTo(x, yM - 20 * s); ctx.lineTo(x, bottomY - 6); ctx.stroke();
    });

    ctx.strokeStyle = col.mute; ctx.lineWidth = Math.max(5, 8 * s);
    ctx.beginPath();
    ctx.moveTo(cx - P.Rcruc * s, yM - 45 * s); ctx.lineTo(cx - P.Rcruc * s, bottomY);
    ctx.lineTo(cx + P.Rcruc * s, bottomY); ctx.lineTo(cx + P.Rcruc * s, yM - 45 * s);
    ctx.stroke();

    ctx.strokeStyle = col.line; ctx.lineWidth = Math.max(3, (2 + (sim.p.G0 - 2) * 2.4) * s * 1.6);
    [-1, 1].forEach(function (sg) {
      ctx.beginPath();
      ctx.moveTo(cx + sg * P.Rcruc * s, yM - 100 * s);
      ctx.lineTo(cx + sg * 222 * s, yM - 58 * s);
      ctx.stroke();
    });
    ctx.lineCap = 'butt';

    // ---- meniscus + crystal ----
    var hv = P.h0 + sim.e;                    // visible meniscus height (mm)
    var yI = yM - hv * s;                     // interface level
    var Rc = sim.R, Rpx = Rc * s;
    var mw = (hv * 1.6 + 6) * s;              // meniscus foot width
    ctx.fillStyle = '#ffbe3b';
    ctx.beginPath();
    ctx.moveTo(cx - Rpx - mw, yM);
    ctx.quadraticCurveTo(cx - Rpx, yM, cx - Rpx, yI);
    ctx.lineTo(cx + Rpx, yI);
    ctx.quadraticCurveTo(cx + Rpx, yM, cx + Rpx + mw, yM);
    ctx.closePath(); ctx.fill();

    var zNow = sim.z, segs = sim.slices, n = segs.length;
    var head = { z: zNow, R: sim.R, rc: sim.rcNow() };
    function get(i) { return i >= n ? head : segs[i]; }
    var edge = [], yTopMost = yI;
    for (var i = n; i >= 1; i--) {
      var a = get(i - 1), b = get(i);
      var yBot = yI - (zNow - a.z) * s, yTop = yI - (zNow - b.z) * s;
      if (yBot < 0) break;
      var rp = b.R * s, hh = yBot - yTop + 1.6;
      // outer surface (left half), three shading strips
      ctx.fillStyle = '#8f98a6'; ctx.fillRect(cx - rp, yTop, rp * 0.3, hh);
      ctx.fillStyle = '#c9ced6'; ctx.fillRect(cx - rp * 0.7, yTop, rp * 0.4, hh);
      ctx.fillStyle = '#a9b0bc'; ctx.fillRect(cx - rp * 0.3, yTop, rp * 0.3, hh);
      // cutaway (right half)
      var bd = Phys.bounds(b.rc), xV = cx + bd.rhoV * rp, xI = cx + bd.rhoI * rp;
      ctx.fillStyle = col.V;  ctx.fillRect(cx, yTop, xV - cx, hh);
      ctx.fillStyle = col.DF; ctx.fillRect(xV, yTop, xI - xV, hh);
      ctx.fillStyle = col.I;  ctx.fillRect(xI, yTop, cx + rp - xI, hh);
      edge.push([rp, yBot, yTop]);
      yTopMost = yTop;
    }
    ctx.strokeStyle = col.ink; ctx.lineWidth = 1.5;
    [-1, 1].forEach(function (sg) {
      ctx.beginPath();
      edge.forEach(function (e, k) {
        if (k === 0) ctx.moveTo(cx + sg * e[0], e[1]); else ctx.lineTo(cx + sg * e[0], e[1]);
        ctx.lineTo(cx + sg * e[0], e[2]);
      });
      ctx.stroke();
    });
    var zSeed = (segs.length > 0) ? segs[0].z : 0;
    var seedY = yI - (zNow - zSeed) * s;

    // Centerline
    ctx.beginPath();
    ctx.moveTo(cx, Math.max(0, seedY));
    ctx.lineTo(cx, yI);
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Seed holder + pull cable (smoothly clips at top boundary)
    if (seedY > 0) {
      ctx.fillStyle = col.mute;
      ctx.fillRect(cx - 7, seedY - 10, 14, 10);
      if (seedY > 10) {
        ctx.fillRect(cx - 1.5, 0, 3, seedY - 10);
      }
    }

    if (opts.cutLabels !== false) {
      ctx.textAlign = 'center'; ctx.fillStyle = col.mute;
      var rr = Math.max(Rpx, 40);
      ctx.fillText('\u2190 surface', cx - rr * 0.55, fs + 2);
      ctx.fillText('cross-section \u2192', cx + rr * 0.6, fs + 2);
    }

    // ---- wafer face inset ----
    if (opts.inset) {
      var wr = Math.min(58, w * 0.085), wx = w - wr - 16, wy = wr + fs * 2 + 14;
      ctx.fillStyle = col.card; ctx.globalAlpha = 0.9;
      ctx.fillRect(wx - wr - 10, wy - wr - fs * 2 - 6, 2 * wr + 20, 2 * wr + fs * 2 + 18);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = col.line; ctx.lineWidth = 1;
      ctx.strokeRect(wx - wr - 10, wy - wr - fs * 2 - 6, 2 * wr + 20, 2 * wr + fs * 2 + 18);
      ctx.fillStyle = col.ink; ctx.textAlign = 'center';
      ctx.fillText('wafer face now', wx, wy - wr - fs - 2);
      drawWafer(ctx, wx, wy, wr, head.rc, col);
    }
  }

  global.Render = { draw: draw, setup: setup, colors: colors, drawWafer: drawWafer };
})(window);
