/* Botão "Co-op local" no xCloud: lista os jogos da lista de co-op do Better xCloud que estão no catálogo
   de nuvem do Game Pass (mercado BR) e abre a página do jogo. Navegável por controle e controle remoto. */
(function () {
  if (window.__bxCoopMenu) return;
  window.__bxCoopMenu = true;
  var CLOUD_SIGL = 'https://catalog.gamepass.com/sigls/v2?id=29a81209-df6f-41fd-a528-2ae6b91f719c&language=pt-BR&market=BR';
  var NAO_FUNCIONA = { '9N2J0FGV30DX': 1 }; // Bluey: relatado como não funcionando
  var games = null, open = false, idx = 0, overlay = null, items = [], lastPad = {}, rafId = 0;

  function slug(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  function loadGames() {
    var list = {};
    try { list = (JSON.parse(localStorage.getItem('BetterXcloud.GhPages.LocalCoOp') || '{}').data) || {}; } catch (e) {}
    return fetch(CLOUD_SIGL).then(function (r) { return r.json(); }).then(function (d) {
      var cloud = {}; d.slice(1).forEach(function (x) { cloud[x.id] = 1; });
      return Object.keys(list).filter(function (id) { return cloud[id] && !NAO_FUNCIONA[id]; });
    }).catch(function () { return Object.keys(list).filter(function (id) { return !NAO_FUNCIONA[id]; }); })
      .then(function (ids) {
        var seen = {};
        games = ids.map(function (id) { return { id: id, name: list[id] }; })
          .filter(function (g) { var k = g.name.replace(/ \(Xbox One\)$/, ''); if (seen[k]) return false; seen[k] = 1; return true; })
          .sort(function (a, b) { return a.name.localeCompare(b.name); });
        return games;
      });
  }

  function css() {
    var s = document.createElement('style');
    s.textContent = '#bx-coop-btn{margin-right:10px;padding:0 14px;height:40px;border-radius:6px;border:2px solid #2d8a3e;background:#107c10;color:#fff;font:600 16px "Segoe UI",sans-serif;cursor:pointer}' +
      '#bx-coop-btn:focus{outline:3px solid #fff}' +
      '#bx-coop{position:fixed;inset:0;z-index:2147483646;background:rgba(10,12,16,.94);color:#fff;font-family:"Segoe UI",sans-serif;padding:48px 72px;overflow:auto}' +
      '#bx-coop h2{margin:0 0 6px;font-size:34px}#bx-coop p{margin:0 0 24px;color:#bbb;font-size:18px}' +
      '#bx-coop .g{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}' +
      '#bx-coop button{min-height:64px;text-align:left;padding:10px 16px;border-radius:8px;border:2px solid #333;background:#1e2229;color:#fff;font-size:19px}' +
      '#bx-coop button.sel{border-color:#fff;background:#107c10}';
    document.head.appendChild(s);
  }

  function render() {
    overlay.innerHTML = '<h2>Co-op local (' + games.length + ' jogos na nuvem agora)</h2>' +
      '<p>Lista do Better xCloud cruzada com o catálogo do Game Pass. Setas/direcional para escolher, A/OK abre, B/Voltar fecha.</p>' +
      '<div class="g"></div>';
    var grid = overlay.querySelector('.g');
    items = games.map(function (g, i) {
      var b = document.createElement('button');
      b.textContent = g.name.replace(/ \(Xbox One\)$/, '');
      b.onclick = function () { go(i); };
      grid.appendChild(b);
      return b;
    });
    select(0);
  }

  function select(i) {
    if (!items.length) return;
    idx = Math.max(0, Math.min(items.length - 1, i));
    items.forEach(function (b, k) { b.classList.toggle('sel', k === idx); });
    items[idx].scrollIntoView({ block: 'nearest' });
  }

  function go(i) {
    var g = games[i]; close();
    history.pushState({}, '', '/pt-BR/play/games/' + slug(g.name) + '/' + g.id);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }

  function openMenu() {
    if (open) return;
    open = true;
    overlay = document.createElement('div'); overlay.id = 'bx-coop';
    overlay.innerHTML = '<h2>Carregando…</h2>';
    document.body.appendChild(overlay);
    var root = document.getElementById('gamepass-root'); if (root) root.inert = true;
    (games ? Promise.resolve(games) : loadGames()).then(function () { if (open) render(); });
    lastPad = {}; rafId = requestAnimationFrame(poll);
  }

  function close() {
    open = false; cancelAnimationFrame(rafId);
    if (overlay) overlay.remove(); overlay = null;
    var root = document.getElementById('gamepass-root'); if (root) root.inert = false;
  }

  function move(dx, dy) { select(idx + dx + dy * 4); }

  // Controle: lê o estado e age na borda de descida de cada botão (A=0, B=1, direcional 12-15).
  function poll() {
    if (!open) return;
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (var p = 0; p < pads.length; p++) {
      var g = pads[p]; if (!g) continue;
      var prev = lastPad[p] || {};
      var now = { a: g.buttons[0] && g.buttons[0].pressed, b: g.buttons[1] && g.buttons[1].pressed,
        u: g.buttons[12] && g.buttons[12].pressed || g.axes[1] < -0.6, d: g.buttons[13] && g.buttons[13].pressed || g.axes[1] > 0.6,
        l: g.buttons[14] && g.buttons[14].pressed || g.axes[0] < -0.6, r: g.buttons[15] && g.buttons[15].pressed || g.axes[0] > 0.6 };
      if (now.u && !prev.u) move(0, -1);
      if (now.d && !prev.d) move(0, 1);
      if (now.l && !prev.l) move(-1, 0);
      if (now.r && !prev.r) move(1, 0);
      if (now.a && !prev.a && items.length) { lastPad[p] = now; go(idx); return; }
      if (now.b && !prev.b) { lastPad[p] = now; close(); return; }
      lastPad[p] = now;
    }
    rafId = requestAnimationFrame(poll);
  }

  // Controle remoto da TV / teclado.
  window.addEventListener('keydown', function (e) {
    if (!open) return;
    var k = e.keyCode;
    if (k === 37) move(-1, 0); else if (k === 39) move(1, 0); else if (k === 38) move(0, -1); else if (k === 40) move(0, 1);
    else if (k === 13) go(idx); else if (k === 10009 || k === 27 || k === 8) close(); else return;
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);

  // Botão no cabeçalho do xCloud (recolocado quando o cabeçalho é redesenhado).
  function ensureButton() {
    if (!/\/play/.test(location.pathname) || document.getElementById('bx-coop-btn')) return;
    var anchor = document.querySelector('.bx-header-settings-button');
    var holder = anchor && anchor.parentElement;
    if (!holder) return;
    var b = document.createElement('button');
    b.id = 'bx-coop-btn'; b.textContent = 'Co-op local';
    b.onclick = function (e) { e.preventDefault(); openMenu(); };
    holder.insertBefore(b, holder.firstChild);
  }

  function start() { css(); setInterval(ensureButton, 1500); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.BX_COOP_MENU = { open: openMenu, close: close };
})();
