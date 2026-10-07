/* common.js: theme toggle and small UI helpers shared by both pages. */
(function (global) {
  'use strict';
  var saved = null;
  try { saved = localStorage.getItem('cz-theme'); } catch (e) {}
  if (saved) document.documentElement.setAttribute('data-theme', saved);

  document.addEventListener('DOMContentLoaded', function () {
    var b = document.getElementById('theme');
    if (!b) return;
    b.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', cur);
      try { localStorage.setItem('cz-theme', cur); } catch (e) {}
    });
  });

  /** Bind a range input to an output element. fmt(value) -> string. */
  function bind(input, output, fmt, onInput) {
    function upd() { output.textContent = fmt(parseFloat(input.value)); }
    input.addEventListener('input', function () { upd(); onInput(parseFloat(input.value)); });
    upd();
  }
  function setRange(input, output, fmt, value) {
    input.value = value; output.textContent = fmt(value);
  }

  var MESSAGES = {
    pinched: '\u26A0 The ingot necked down and snapped: too thin to hold itself up',
    frozen: '\u2744 The crystal grew wider and froze across the melt',
    detached: '\u26A0 The meniscus broke: the crystal pulled away from the melt'
  };

  global.UI = { bind: bind, setRange: setRange, MESSAGES: MESSAGES };
})(window);
