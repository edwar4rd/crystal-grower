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

  /** Size the canvas backing store to its CSS size; prepares off-screen buffer for double buffering. */
  function setup(canvas) {
    var dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return null;
    var tw = Math.round(w * dpr), th = Math.round(h * dpr);
    if (canvas.width !== tw || canvas.height !== th) {
      canvas.width = tw; canvas.height = th;
    }
    if (!canvas._offscreen) {
      canvas._offscreen = document.createElement('canvas');
    }
    var off = canvas._offscreen;
    if (off.width !== tw || off.height !== th) {
      off.width = tw; off.height = th;
    }
    var offCtx = off.getContext('2d');
    offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    offCtx.clearRect(0, 0, w, h);
    return {
      ctx: offCtx,
      targetCanvas: canvas,
      w: w,
      h: h,
      dpr: dpr,
      flush: function () {
        var tc = canvas.getContext('2d');
        tc.setTransform(1, 0, 0, 1, 0, 0);
        tc.clearRect(0, 0, tw, th);
        tc.drawImage(off, 0, 0);
      }
    };
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
    // Collect profile points from the interface (newest) upward until off-screen.
    var pts = [];
    for (var i = n; i >= 0; i--) {
      var sl = i >= n ? head : segs[i];
      var y = yI - (zNow - sl.z) * s, bd = Phys.bounds(sl.rc);
      pts.push({ y: y, r: sl.R * s, v: bd.rhoV, f: bd.rhoI, z: sl.z });
      if (y < -10) break;
    }

    if (pts.length >= 2) {
      // 1. Calculate axial slope dr/dy at each point to account for 3D normal tilt
      for (var k = 0; k < pts.length; k++) {
        var dr, dy;
        if (k === 0) {
          dr = pts[0].r - pts[1].r; dy = pts[0].y - pts[1].y;
        } else if (k === pts.length - 1) {
          dr = pts[k - 1].r - pts[k].r; dy = pts[k - 1].y - pts[k].y;
        } else {
          dr = pts[k - 1].r - pts[k + 1].r; dy = pts[k - 1].y - pts[k + 1].y;
        }
        pts[k].slope = (Math.abs(dy) > 0.001) ? (dr / dy) : 0;
      }

      // 2. Render Left Surface with full 3D normal shading (Nx, Ny, Nz)
      // Light vector L from upper-left-front: (-0.42, -0.62, 0.66)
      // Trapezoids overlap by 0.8px vertically to eliminate subpixel anti-aliasing seam artifacts.
      for (var k = 0; k < pts.length - 1; k++) {
        var p0 = pts[k], p1 = pts[k + 1];
        var yTop = (k === pts.length - 2) ? p1.y : p1.y - 0.8;
        var yBot = (k === 0) ? p0.y : p0.y + 0.8;
        var rTop = p1.r, rBot = p0.r;
        var rMax = Math.max(rTop, rBot);
        if (rMax < 0.5) continue;
        var avgSlope = (p0.slope + p1.slope) * 0.5;
        // Slope factor: positive slope (expanding downward) tilts normal upward into overhead light
        var slopeTilt = Phys.clamp(avgSlope * 0.75, -0.45, 0.45);
        var normLen = Math.sqrt(1 + avgSlope * avgSlope);

        var grad = ctx.createLinearGradient(cx - rMax, 0, cx, 0);
        // Function to compute lit RGB with metallic base
        function shadeRGB(u, sinTh, cosTh) {
          var dot = (0.42 * sinTh + 0.62 * (avgSlope / normLen) + 0.66 * (cosTh / normLen));
          var spec = Math.pow(Math.max(0, (0.24 * sinTh + 0.35 * (avgSlope / normLen) + 0.90 * (cosTh / normLen))), 14);
          var light = Phys.clamp(0.48 + 0.45 * dot + 0.35 * spec + slopeTilt * 0.3, 0.2, 1.35);
          var red = Math.round(Phys.clamp(135 * light, 40, 250));
          var grn = Math.round(Phys.clamp(145 * light, 45, 252));
          var blu = Math.round(Phys.clamp(160 * light, 55, 255));
          return 'rgb(' + red + ',' + grn + ',' + blu + ')';
        }

        grad.addColorStop(0.0, shadeRGB(1.0, 1.0, 0.0));       // outer edge (darker grazing rim)
        grad.addColorStop(0.25, shadeRGB(0.75, 0.75, 0.66));   // mid-rim
        grad.addColorStop(0.55, shadeRGB(0.45, 0.45, 0.89));   // specular highlight strip
        grad.addColorStop(0.85, shadeRGB(0.15, 0.15, 0.99));   // mid-face
        grad.addColorStop(1.0, shadeRGB(0.0, 0.0, 1.0));       // centerline

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(cx, yBot);
        ctx.lineTo(cx - rBot, yBot);
        ctx.lineTo(cx - rTop, yTop);
        ctx.lineTo(cx, yTop);
        ctx.closePath();
        ctx.fill();
      }

      // 3. Render Right Half (Cross-Section) with depth & subtle crystalline sheen
      function band(fa, fb, fill) {
        ctx.beginPath();
        for (var k = 0; k < pts.length; k++) {
          var p = pts[k], x = cx + fa(p) * p.r;
          if (k === 0) ctx.moveTo(x, p.y); else ctx.lineTo(x, p.y);
        }
        for (var k = pts.length - 1; k >= 0; k--) {
          var q = pts[k]; ctx.lineTo(cx + fb(q) * q.r, q.y);
        }
        ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
      }
      var f0 = function () { return 0; }, f1 = function () { return 1; };
      band(f0, f1, col.I);
      band(f0, function (p) { return p.f; }, col.DF);
      band(f0, function (p) { return p.v; }, col.V);

      // Subtle ambient depth gradient over cross-section to unify lighting with the exterior
      var csGrad = ctx.createLinearGradient(cx, 0, cx + P.Rt * s, 0);
      csGrad.addColorStop(0, 'rgba(0,0,0,0.06)');
      csGrad.addColorStop(0.7, 'rgba(255,255,255,0.04)');
      csGrad.addColorStop(1, 'rgba(0,0,0,0.08)');
      band(f0, f1, csGrad);

      // Metallic outer rim on the right edge (shows cutaway is inside the cylindrical shell)
      band(function (p) { return Math.max(0, 1 - 2.5 / Math.max(p.r, 1)); }, f1, '#94a3b8');

      // 4. Silicon Boule Outlines & Physical Cut Seam
      ctx.strokeStyle = col.ink; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
      [-1, 1].forEach(function (sg) {
        ctx.beginPath();
        pts.forEach(function (p, k) {
          if (k === 0) ctx.moveTo(cx + sg * p.r, p.y); else ctx.lineTo(cx + sg * p.r, p.y);
        });
        ctx.stroke();
      });

      // Curved solid-liquid interface at the melt (unifying the bottom boundary)
      ctx.beginPath();
      ctx.moveTo(cx - Rpx, yI);
      ctx.quadraticCurveTo(cx, yI + 2.5, cx + Rpx, yI);
      ctx.strokeStyle = col.ink; ctx.lineWidth = 1.5; ctx.stroke();

      // Clean 3D cut seam at centerline (knife-edge highlight & shadow)
      var zSeed = (segs.length > 0) ? segs[0].z : 0;
      var seedY = yI - (zNow - zSeed) * s;
      var seamTop = Math.max(0, seedY);

      ctx.beginPath();
      ctx.moveTo(cx - 0.75, seamTop); ctx.lineTo(cx - 0.75, yI);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx + 0.75, seamTop); ctx.lineTo(cx + 0.75, yI);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
    }

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

    // Double buffer: blit off-screen buffer to screen in a single atomic draw
    st.flush();
  }

  global.Render = { draw: draw, setup: setup, colors: colors, drawWafer: drawWafer, flush: function (st) { if (st && st.flush) st.flush(); } };
})(window);
