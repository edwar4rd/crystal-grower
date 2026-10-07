/* sandbox.js: the full ingot puller simulator. */
(function () {
  'use strict';
  var P = Phys.P;
  var $ = function (id) { return document.getElementById(id); };
  var sim = new Phys.Sim({ prefill: 'full' });
  var speed = 30, playing = true;

  var fmt = {
    vp: function (v) { return v.toFixed(3) + ' mm/min'; },
    gl: function (v) { return v.toFixed(2) + ' K/mm'; },
    g0: function (v) { return v.toFixed(2) + ' K/mm'; },
    sp: function (v) { return v + ' min/s'; }
  };
  UI.bind($('vp'), $('ovp'), fmt.vp, function (v) { sim.p.vp = v; });
  UI.bind($('gl'), $('ogl'), fmt.gl, function (v) { sim.p.Gl = v; });
  UI.bind($('g0'), $('og0'), fmt.g0, function (v) { sim.p.G0 = v; });
  UI.bind($('sp'), $('osp'), fmt.sp, function (v) { speed = v; });

  function syncControls() {
    UI.setRange($('vp'), $('ovp'), fmt.vp, sim.p.vp);
    UI.setRange($('gl'), $('ogl'), fmt.gl, sim.p.Gl);
    UI.setRange($('g0'), $('og0'), fmt.g0, sim.p.G0);
    $('adc').checked = sim.p.adc;
    $('vp').disabled = sim.p.adc;
  }
  $('adc').addEventListener('change', function () {
    sim.setADC($('adc').checked); $('vp').disabled = sim.p.adc;
  });
  [].forEach.call(document.querySelectorAll('[data-preset]'), function (b) {
    b.addEventListener('click', function () { sim.preset(b.getAttribute('data-preset')); syncControls(); });
  });
  $('reset').addEventListener('click', function () { sim.reset(); syncControls(); });
  $('play').addEventListener('click', function () {
    playing = !playing; $('play').innerHTML = playing ? '&#10074;&#10074; Pause' : '&#9654; Play';
  });
  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT') { e.preventDefault(); $('play').click(); }
  });
  var fromHash = location.hash.slice(1);
  if (fromHash) sim.preset(fromHash);
  syncControls();

  function defectText() {
    var b = Phys.bounds(sim.rcNow()), hasV = b.rhoV > 0.02, hasI = b.rhoI < 0.98;
    if (hasV && hasI) return 'voids core + loop rim';
    if (hasV) return b.rhoV > 0.98 ? 'voids everywhere' : 'void-rich core';
    if (hasI) return b.rhoI < 0.02 ? 'loops everywhere' : 'loop-rich rim';
    return 'defect-free \u2713';
  }

  function readouts() {
    var D = 2 * sim.R;
    $('rD').textContent = D.toFixed(0) + ' mm (target ' + 2 * P.Rt + ')';
    $('rD').className = Math.abs(sim.R - P.Rt) > 10 ? 'bad' : 'good';
    $('rVg').textContent = sim.vg().toFixed(3) + ' mm/min';
    $('rVp').textContent = sim.p.vp.toFixed(3) + ' mm/min';
    var rc = sim.rcNow();
    $('rXi').textContent = rc.toFixed(2) + ' / ' + (rc / (1 + P.kappa)).toFixed(2);
    $('rLen').textContent = (sim.z / 10).toFixed(1) + ' cm  \u00B7  ' + (sim.t / 60).toFixed(1) + ' h';
    $('rDef').textContent = defectText();
    var banner = $('banner');
    if (sim.status !== 'running') { banner.hidden = false; banner.textContent = UI.MESSAGES[sim.status] + '. Press Reset or pick a scenario.'; }
    else banner.hidden = true;
  }

  var last = performance.now(), tAcc = 0;
  function frame(now) {
    var dt = Math.min((now - last) / 1000, 0.1); last = now;
    if (playing) sim.advance(dt * speed);
    if (sim.p.adc && sim.status === 'running') UI.setRange($('vp'), $('ovp'), fmt.vp, sim.p.vp);
    Render.draw($('cv'), sim, { inset: true, cutLabels: false });
    readouts();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
