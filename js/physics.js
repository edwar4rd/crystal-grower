/*
 * physics.js: shared reduced-order model of Czochralski silicon growth.
 *
 * Units: lengths in mm, time in minutes, temperature gradients in K/mm.
 * This is a TEACHING model with realistic numbers, not a CFD simulation.
 *
 *   Heat balance at the interface:   ks*Gs - kl*Gl = rho*L*vg
 *   Meniscus height deviation e:     de/dt = vp - vg - gamma*e
 *   Crystal radius R:                dR/dt = -alpha*e
 *   Crystal gradient (thin = steep): Gs = G0 * (1 + c/R)
 *   Voronkov criterion:              xi = vp / G(r),  G(r) = Gs*(1 + kappa*(r/R)^2)
 */
(function (global) {
  'use strict';

  var P = {
    ks: 0.022,      // W/(mm K)  thermal conductivity of solid Si near melting point
    kl: 0.060,      // W/(mm K)  thermal conductivity of liquid Si
    rho: 2.33e-6,   // kg/mm^3   density of solid Si
    L: 1.8e6,       // J/kg      latent heat of fusion
    xiC: 0.13,      // mm^2/(min K)  critical v/G (Voronkov)
    band: 0.12,     // +-12 % around critical counts as defect-free
    kappa: 0.12,    // edge of the crystal has a 12 % steeper gradient than the centre
    c: 8,           // mm   thin crystals radiate heat away better: Gs = G0 (1 + c/R)
    Rt: 150,        // mm   target radius (300 mm wafer)
    Rcruc: 250,     // mm   crucible radius
    Rfreeze: 200,   // mm   crystal this wide freezes across the melt
    Rpinch: 30,     // mm   crystal this thin can't hold itself up
    h0: 5,          // mm   nominal meniscus height
    eMax: 12,       // mm   meniscus deviation at which the melt column snaps
    alpha: 0.08,    // 1/min  meniscus deviation -> radius change
    gamma: 0.05,    // 1/min  meniscus relaxation
    Kp: 0.045, Kd: 0.875, Ki: 0.00068   // automatic diameter control (PID)
  };
  var rhoL = P.rho * P.L;                // J/mm^3
  P.A = P.ks * 60 / rhoL;                // mm/min of growth per (K/mm) of crystal gradient
  P.B = P.kl * 60 / rhoL;                // mm/min of growth per (K/mm) of melt gradient

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  /** Axial gradient at the crystal centre (K/mm). */
  function Gcentre(G0, R) { return G0 * (1 + P.c / Math.max(R, 0.5)); }
  /** Crystallisation rate allowed by the heat balance (mm/min). */
  function growthRate(G0, Gl, R) { return P.A * Gcentre(G0, R) - P.B * Gl; }
  /** Melt gradient that makes growth rate equal to pull rate vp. */
  function solveGl(vp, G0, R) { return (P.A * Gcentre(G0, R) - vp) / P.B; }
  /** (v/G at the centre) / critical value. */
  function ratioC(vp, G0, R) { return vp / Gcentre(G0, R) / P.xiC; }
  /** Pull rate that puts the middle of the wafer exactly at the critical v/G. */
  function goldenVp(G0) { return P.xiC * Gcentre(G0, P.Rt) * (1 + P.kappa * 0.5); }
  /**
   * Radial defect map for a slice whose centre ratio is rc.
   * Vacancy (void) core for rho < rhoV, interstitial rim for rho > rhoI, defect-free between.
   */
  function bounds(rc) {
    var v2 = (rc / (1 + P.band) - 1) / P.kappa;
    var i2 = (rc / (1 - P.band) - 1) / P.kappa;
    return {
      rhoV: v2 <= 0 ? 0 : Math.min(1, Math.sqrt(v2)),
      rhoI: i2 <= 0 ? 0 : Math.min(1, Math.sqrt(i2))
    };
  }
  /** Quasi-static neck radius for a given pull rate (stable solution of the model). */
  function neckRadius(vp, G0, Gl) {
    var d = (vp + P.B * Gl) / (P.A * G0) - 1;
    return d <= P.c / 60 ? 60 : P.c / d;
  }

  function Sim(opts) {
    opts = opts || {};
    this.fixed = !!opts.fixed;    // fixed diameter: R pinned at target (defect demo)
    this.prefill = opts.prefill || 'full';
    this.bodyLen = opts.bodyLen || 120;
    this.reset();
  }

  Sim.prototype.reset = function () {
    var G0 = 3.0, vp = goldenVp(G0);
    this.p = { vp: vp, G0: G0, Gl: solveGl(vp, G0, P.Rt), adc: false };
    this.R = P.Rt; this.e = 0; this.z = 0; this.t = 0;
    this.status = 'running';
    this.I = 0; this.vp0 = vp;
    var rc = ratioC(vp, G0, P.Rt), i;
    this.slices = [{ z: 0, R: this.prefill === 'full' ? 2 : P.Rt, rc: this.prefill === 'full' ? 1 : rc }];
    if (this.prefill === 'full') {
      for (i = 1; i <= 60; i++) this.slices.push({ z: i, R: 2, rc: 1 });                       // dash neck
      for (i = 1; i <= 120; i++) {
        var u = i / 120;
        var s = 0.5 * (1 - Math.cos(Math.PI * u)); // smooth S-curve crown
        this.slices.push({ z: 60 + i, R: 2 + (P.Rt - 2) * s, rc: 1 });                         // shoulder
      }
      var bl = this.bodyLen || 40;
      for (i = 1; i <= bl; i++) this.slices.push({ z: 180 + i, R: P.Rt, rc: rc });             // start of body
      this.z = 180 + bl;
    } else {
      for (i = 1; i <= this.bodyLen; i++) this.slices.push({ z: i, R: P.Rt, rc: rc });
      this.z = this.bodyLen;
    }
  };

  /** Load one of the named scenarios (resets the ingot). */
  Sim.prototype.preset = function (name) {
    this.reset();
    var p = this.p, G0 = 3.0, vp, gv = goldenVp(G0);
    p.G0 = G0;
    switch (name) {
      case 'golden':   vp = gv;    p.adc = true;  break;
      case 'speed':    vp = 0.80;  p.adc = false; p.Gl = solveGl(gv, G0, P.Rt); break;
      case 'freeze':   vp = 0.12;  p.adc = false; p.Gl = solveGl(gv, G0, P.Rt); break;
      case 'void':     vp = 0.485; p.adc = true;  break;
      case 'rim':      vp = 0.38;  p.adc = true;  break;
      default: return;
    }
    p.vp = vp;
    if (name === 'golden' || name === 'void' || name === 'rim') p.Gl = solveGl(vp, G0, P.Rt);
    this.vp0 = vp; this.I = 0;
    var prc = ratioC(vp, G0, P.Rt);
    for (var j = 0; j < this.slices.length; j++) {
      if (this.slices[j].R > 140) this.slices[j].rc = prc;
    }
  };

  Sim.prototype.setADC = function (on) {
    this.p.adc = !!on;
    if (on) { this.vp0 = this.p.vp; this.I = 0; }
  };

  Sim.prototype.gs = function () { return Gcentre(this.p.G0, this.R); };
  Sim.prototype.vg = function () { return growthRate(this.p.G0, this.p.Gl, this.R); };
  Sim.prototype.rcNow = function () { return ratioC(this.p.vp, this.p.G0, this.R); };

  Sim.prototype.step = function (dt) {
    var p = this.p;
    if (this.fixed) {
      this.R = P.Rt; this.e = 0;
    } else {
      if (p.adc) {
        var err = this.R - P.Rt;
        this.I = clamp(this.I + err * dt, -1.5 / P.Ki, 1.5 / P.Ki);
        var Rdot = -P.alpha * this.e;
        p.vp = clamp(this.vp0 + P.Kp * err + P.Kd * Rdot + P.Ki * this.I, 0.02, 3);
      }
      var vg = this.vg();
      this.e += (p.vp - vg - P.gamma * this.e) * dt;
      this.e = Math.max(this.e, -P.h0);
      this.R = Math.max(0, this.R - P.alpha * this.e * dt);
    }
    this.z += p.vp * dt;
    this.t += dt;
    var last = this.slices[this.slices.length - 1];
    if (this.z - last.z >= 1) this.slices.push({ z: this.z, R: this.R, rc: this.rcNow() });
    if (this.slices.length > 2000) this.slices.splice(0, 500);

    if (!this.fixed) {
      if (this.R < P.Rpinch) this.status = 'pinched';
      else if (this.R > P.Rfreeze) this.status = 'frozen';
      else if (this.e > P.eMax) this.status = 'detached';
    }
  };

  /** Advance by dtTotal simulated minutes. */
  Sim.prototype.advance = function (dtTotal) {
    if (this.status !== 'running') return;
    var n = Math.max(1, Math.ceil(dtTotal / 0.2)), h = dtTotal / n;
    for (var i = 0; i < n && this.status === 'running'; i++) this.step(h);
  };

  global.Phys = {
    P: P, Sim: Sim, clamp: clamp, Gcentre: Gcentre, growthRate: growthRate, solveGl: solveGl,
    ratioC: ratioC, goldenVp: goldenVp, bounds: bounds, neckRadius: neckRadius
  };
})(window);
