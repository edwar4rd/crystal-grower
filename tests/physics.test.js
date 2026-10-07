// Run with:  deno run --allow-read tests/physics.test.js
globalThis.window = globalThis;
(0, eval)(Deno.readTextFileSync(new URL('../js/physics.js', import.meta.url)));
const { Sim, P, goldenVp, neckRadius, solveGl, bounds } = window.Phys;

function run(name, minutes) {
  const s = new Sim({ prefill: 'body', bodyLen: 120 });
  s.preset(name);
  const out = [];
  for (let t = 0; t <= minutes; t += 20) {
    out.push(`${t}m R=${s.R.toFixed(1)} e=${s.e.toFixed(2)} vp=${s.p.vp.toFixed(3)} rc=${s.rcNow().toFixed(3)} ${s.status}`);
    s.advance(20);
    if (s.status !== 'running') { out.push(`${t + 20}m R=${s.R.toFixed(1)} -> ${s.status}`); break; }
  }
  console.log('== ' + name + '\n' + out.filter((_, i) => i % 3 === 0 || i === out.length - 1).join('\n'));
}
console.log('goldenVp', goldenVp(3).toFixed(4), 'Gl', solveGl(goldenVp(3), 3, 150).toFixed(4));
console.log('vmax(Gl=0,G=3) mm/min', (P.A * 3.16).toFixed(3));
[1, 2, 3, 6].forEach(v => console.log('neck R at vp', v, neckRadius(v, 3, solveGl(goldenVp(3), 3, 150)).toFixed(2)));
['golden', 'speed', 'freeze', 'void', 'rim'].forEach(n => run(n, 1500));
// ADC disturbance rejection: raise heater with ADC on
const s = new Sim({ prefill: 'body' }); s.preset('golden'); s.advance(100); s.p.Gl += 0.1;
for (let i = 0; i < 40; i++) { s.advance(20); if (i % 5 === 0) console.log('ADC dist', (i * 20) + 'm R=' + s.R.toFixed(1), 'vp=' + s.p.vp.toFixed(3), s.status); }
// manual: tiny slider error
const m = new Sim({ prefill: 'body' }); m.p.vp += 0.02; m.advance(300); console.log('manual +0.02 after 300 min R=', m.R.toFixed(1), m.status);
console.log(bounds(1.18), bounds(0.925), bounds(1.0));
