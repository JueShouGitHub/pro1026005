(function () {
  'use strict';

  var FONT = '-apple-system,Segoe UI,Roboto,sans-serif';

  var canvas = null, ctx = null;
  var W = 390, H = 844, DPR = 1;
  var started = false, rafId = 0;
  var lastTs = 0, lastInput = 0;
  var view = { top: 0, right: 0, bottom: 0, left: 0 };
  var nodeR = 15, hitR = 35, baseFont = 14;

  var PHASE_START = 'start', PHASE_PLAY = 'play', PHASE_OVER = 'over';
  var phase = PHASE_START, overT = 0;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function setFont(size, weight) { ctx.font = weight + ' ' + size + 'px ' + FONT; }
  function fitFont(text, size, weight, maxW) {
    var s = size;
    setFont(s, weight);
    while (s > 10 && ctx.measureText(text).width > maxW) { s -= 1; setFont(s, weight); }
    return s;
  }
  function rr(x, y, w, h, r) {
    if (w <= 0 || h <= 0) return;
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function playSound(n) { /* reserved */ }
  function vibrate(p) { if (navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} } }

  /* ================= level model ================= */
  /* nodes defined in normalized 0..1 coords, scaled to the play area */
  var LEVELS = [
    {edges:[[0,1],[1,2],[2,3],[3,4],[4,0]],
     start:[[0.2,0.2],[0.8,0.15],[0.35,0.8],[0.85,0.75],[0.55,0.45]]},
    {edges:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[0,3]],
     start:[[0.5,0.1],[0.1,0.4],[0.2,0.85],[0.8,0.9],[0.9,0.35],[0.5,0.5]]},
    {edges:[[0,1],[1,2],[2,3],[3,0],[0,4],[1,5],[2,6],[3,7],[4,5],[5,6],[6,7],[7,4]],
     start:[[0.5,0.1],[0.1,0.3],[0.9,0.25],[0.3,0.7],[0.7,0.75],[0.85,0.6],[0.15,0.85],[0.45,0.4]]}
  ];

  /* ================= state ================= */
  var level = 0, nodes = [], edges = [];
  var dragIdx = -1, score = 0, moves = 0, best = 0, newBest = false;
  var msg = '', msgT = 0, clearT = 0;
  var playArea = { x: 0, y: 0, w: 0, h: 0 };
  try { best = parseInt(localStorage.getItem('unt_best') || '0', 10) || 0; } catch (e) { best = 0; }
  function saveBest() { try { localStorage.setItem('unt_best', '' + best); } catch (e) {} }

  function loadLevel(n) {
    level = n;
    edges = LEVELS[n].edges.map(function (e) { return e.slice(); });
    nodes = LEVELS[n].start.map(function (p) {
      return { x: playArea.x + p[0] * playArea.w, y: playArea.y + p[1] * playArea.h };
    });
    dragIdx = -1; moves = 0; clearT = 0;
    msg = 'LEVEL ' + (n + 1); msgT = 1.4;
    phase = PHASE_PLAY;
  }
  function resetGame() {
    score = 0; newBest = false;
    layout();
    loadLevel(0);
    overT = 0;
  }
  function resetToStart() {
    phase = PHASE_START;
    level = 0; nodes = []; edges = [];
    score = 0; moves = 0; newBest = false;
    msg = ''; msgT = 0; clearT = 0; overT = 0; dragIdx = -1;
    try { best = parseInt(localStorage.getItem('unt_best') || '0', 10) || 0; } catch (e) { best = 0; }
  }
  function segIntersect(p1, p2, p3, p4) {
    function ccw(a, b, c) { return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); }
    var d1 = ccw(p3, p4, p1), d2 = ccw(p3, p4, p2), d3 = ccw(p1, p2, p3), d4 = ccw(p1, p2, p4);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  }
  function crossings() {
    var count = 0, i, j;
    for (i = 0; i < edges.length; i++) {
      var a = nodes[edges[i][0]], b = nodes[edges[i][1]];
      for (j = i + 1; j < edges.length; j++) {
        var e2 = edges[j];
        if (e2[0] === edges[i][0] || e2[0] === edges[i][1] || e2[1] === edges[i][0] || e2[1] === edges[i][1]) continue;
        var c = nodes[e2[0]], d = nodes[e2[1]];
        if (segIntersect(a, b, c, d)) count++;
      }
    }
    return count;
  }
  function afterMove() {
    if (clearT > 0) return;                       /* already solved this level */
    moves++;
    if (crossings() === 0) {
      score += 100 + level * 50;
      playSound('fan'); vibrate(40);
      if (level + 1 >= LEVELS.length) {
        if (score > best) { best = score; newBest = true; saveBest(); }
        else newBest = false;
        phase = PHASE_OVER; overT = 0;
      } else {
        clearT = 1.0;
        msg = 'UNTANGLED!'; msgT = 1;
      }
    }
  }

  /* ================= layout ================= */
  function readInsets() {
    var p = document.getElementById('safeAreaProbe');
    if (!p) return { top: 0, right: 0, bottom: 0, left: 0 };
    var s = window.getComputedStyle(p);
    return {
      top: parseFloat(s.paddingTop) || 0,
      right: parseFloat(s.paddingRight) || 0,
      bottom: parseFloat(s.paddingBottom) || 0,
      left: parseFloat(s.paddingLeft) || 0
    };
  }

  function layout() {
    var pad = Math.max(8, Math.round(Math.min(W, H) * 0.03));
    var headerH = Math.max(54, Math.round(H * 0.14));
    var footerH = Math.max(38, Math.round(H * 0.07));
    var top = view.top + headerH;
    var bottom = view.bottom + footerH;
    playArea = {
      x: view.left + pad,
      y: top,
      w: Math.max(60, W - view.left - view.right - pad * 2),
      h: Math.max(80, H - top - bottom)
    };
    nodeR = clamp(Math.round(Math.min(W, H) * 0.038), 12, 18);
    hitR = nodeR + 20;
    baseFont = clamp(Math.round(W * 0.042), 12, 16);
  }

  /* ================= layout / resize ================= */
  function resize() {
    if (!canvas || !ctx) return;
    var cw = canvas.clientWidth || document.documentElement.clientWidth || 390;
    var ch = canvas.clientHeight || document.documentElement.clientHeight || 844;
    W = cw; H = ch;
    DPR = Math.min(2, window.devicePixelRatio || 1);
    var bw = Math.round(W * DPR), bh = Math.round(H * DPR);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw; canvas.height = bh;
    }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    var prev = playArea;
    var rel = nodes.length ? nodes.map(function (n) {
      return {
        x: (n.x - prev.x) / Math.max(1, prev.w),
        y: (n.y - prev.y) / Math.max(1, prev.h)
      };
    }) : null;

    view = readInsets();
    layout();

    if (rel) {
      nodes = rel.map(function (p) {
        return { x: playArea.x + p.x * playArea.w, y: playArea.y + p.y * playArea.h };
      });
    }
  }

  function onResize() { resize(); }
  function onOrientation() { setTimeout(resize, 250); }

  /* ================= input ================= */
  function nodeHit(x, y) {
    var i, bestD = hitR, bestI = -1;
    for (i = 0; i < nodes.length; i++) {
      var d = Math.hypot(x - nodes[i].x, y - nodes[i].y);
      if (d < bestD) { bestD = d; bestI = i; }
    }
    return bestI;
  }
  function tapAny() {
    var now = Date.now();
    if (now - lastInput < 40) return;
    lastInput = now;
    playSound('click'); vibrate(10);
    resetGame();
  }
  function inputDown(x, y) {
    if (phase === PHASE_START) { tapAny(); return; }
    if (phase === PHASE_OVER) {
      if (overT > 0.55) tapAny();
      return;
    }
    var now = Date.now();
    if (now - lastInput < 40) return;
    lastInput = now;
    dragIdx = nodeHit(x, y);
    if (dragIdx >= 0) { playSound('grab'); vibrate(6); }
  }
  function inputMove(x, y) {
    if (phase !== PHASE_PLAY || dragIdx < 0) return;
    nodes[dragIdx].x = clamp(x, playArea.x + nodeR, playArea.x + playArea.w - nodeR);
    nodes[dragIdx].y = clamp(y, playArea.y + nodeR, playArea.y + playArea.h - nodeR);
  }
  function inputUp(x, y) {
    if (phase !== PHASE_PLAY || dragIdx < 0) return;
    dragIdx = -1;
    var before = score;
    afterMove();
    if (score > before) { /* level cleared */ }
    else { playSound('drop'); }
  }

  function onTouchStart(e) {
    e.preventDefault();
    var t = e.changedTouches[0];
    if (t) inputDown(t.clientX, t.clientY);
  }
  function onTouchMove(e) {
    e.preventDefault();
    var t = e.changedTouches[0];
    if (t) inputMove(t.clientX, t.clientY);
  }
  function onTouchEnd(e) {
    e.preventDefault();
    var t = e.changedTouches[0];
    if (t) inputUp(t.clientX, t.clientY);
  }
  function onMouseDown(e) { inputDown(e.clientX, e.clientY); }
  function onMouseMove(e) { inputMove(e.clientX, e.clientY); }
  function onMouseUp(e) { inputUp(e.clientX, e.clientY); }
  function onContextMenu(e) { e.preventDefault(); }
  function onVisibility() { lastTs = 0; }

  function bindInput() {
    window.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: false });
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('visibilitychange', onVisibility);
  }
  function unbindInput() {
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('contextmenu', onContextMenu);
    document.removeEventListener('visibilitychange', onVisibility);
  }

  /* ================= fullscreen button ================= */
  var fsLast = 0;
  function onFsPointerDown(e) { e.stopPropagation(); toggleFullscreen(); }
  function onFsTouchStart(e) { e.stopPropagation(); }
  function onFsClick(e) { e.stopPropagation(); }
  function onFsChange() { setTimeout(resize, 150); }
  function toggleFullscreen() {
    var now = Date.now();
    if (now - fsLast < 500) return;
    fsLast = now;
    try {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        var el = document.documentElement;
        var fn = el.requestFullscreen || el.webkitRequestFullscreen;
        if (fn) { var p = fn.call(el); if (p && p.catch) p.catch(function () {}); }
      } else {
        var ex = document.exitFullscreen || document.webkitExitFullscreen;
        if (ex) ex.call(document);
      }
      setTimeout(resize, 120);
    } catch (e) {}
  }
  function bindFs() {
    var b = document.getElementById('fsBtn');
    if (!b) return;
    b.addEventListener('pointerdown', onFsPointerDown);
    b.addEventListener('touchstart', onFsTouchStart, { passive: false });
    b.addEventListener('click', onFsClick);
    document.addEventListener('fullscreenchange', onFsChange);
  }
  function unbindFs() {
    var b = document.getElementById('fsBtn');
    if (b) {
      b.removeEventListener('pointerdown', onFsPointerDown);
      b.removeEventListener('touchstart', onFsTouchStart);
      b.removeEventListener('click', onFsClick);
    }
    document.removeEventListener('fullscreenchange', onFsChange);
  }

  /* ================= update ================= */
  function update(dt) {
    if (msgT > 0) msgT -= dt;
    if (phase === PHASE_OVER) { overT += dt; return; }
    if (clearT > 0) {
      clearT -= dt;
      if (clearT <= 0) loadLevel(level + 1);
    }
  }

  /* ================= drawing ================= */
  function drawScene() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#16222e'); g.addColorStop(1, '#101820');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    /* play area */
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2;
    rr(playArea.x, playArea.y, playArea.w, playArea.h, 12); ctx.stroke();
    var cross = crossings();
    /* edges */
    var i;
    ctx.lineWidth = 3;
    ctx.strokeStyle = cross === 0 ? 'rgba(141,232,157,0.85)' : 'rgba(255,150,120,0.75)';
    for (i = 0; i < edges.length; i++) {
      ctx.beginPath();
      ctx.moveTo(nodes[edges[i][0]].x, nodes[edges[i][0]].y);
      ctx.lineTo(nodes[edges[i][1]].x, nodes[edges[i][1]].y);
      ctx.stroke();
    }
    /* nodes */
    for (i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      ctx.fillStyle = i === dragIdx ? '#ffd666' : '#5fb0e8';
      ctx.beginPath(); ctx.arc(n.x, n.y, nodeR, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#101820';
      setFont(clamp(Math.round(nodeR * 0.8), 10, 13), '800');
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('' + (i + 1), n.x, n.y + 1);
    }
    if (msgT > 0 && msg) {
      var a = clamp(msgT, 0, 1);
      fitFont(msg, clamp(Math.round(H * 0.028), 16, 26), '800', playArea.w - 12);
      ctx.fillStyle = 'rgba(141,232,157,' + a + ')';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(msg, W / 2, playArea.y - 16);
    }
  }

  function drawHeader() {
    var left = view.left + Math.max(8, Math.round(Math.min(W, H) * 0.03));
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    setFont(baseFont, '800');
    ctx.fillStyle = '#fff';
    ctx.fillText('LEVEL ' + (level + 1) + '/' + LEVELS.length, left, view.top + 18);
    var small = Math.max(11, baseFont - 3);
    setFont(small, '700');
    var cross = crossings();
    ctx.fillStyle = cross === 0 ? '#8de89d' : 'rgba(255,150,120,0.9)';
    ctx.fillText(cross === 0 ? 'NO CROSSINGS \u2014 DRAG A NODE' : 'CROSSES ' + cross, left, view.top + 40);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('SCORE ' + score + '  BEST ' + best, W - view.right - 60, view.top + 18);
    if (phase === PHASE_PLAY) {
      ctx.textAlign = 'center';
      setFont(small, '600');
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      fitFont('Drag the dots until no lines cross', small, '600', W - view.left - view.right - 24);
      ctx.fillText('Drag the dots until no lines cross', W / 2, H - view.bottom - 20);
    }
  }

  function drawStart() {
    ctx.fillStyle = 'rgba(8,14,20,0.6)'; ctx.fillRect(0, 0, W, H);
    var safeW = W - view.left - view.right;
    var safeH = H - view.top - view.bottom;
    var pw = Math.min(safeW - 32, 340);
    var ph = Math.min(240, safeH - 48);
    var k = ph / 240;
    var cx = view.left + safeW / 2;
    var cy = view.top + safeH / 2 - ph / 2;
    rr(cx - pw / 2, cy, pw, ph, 18);
    ctx.fillStyle = 'rgba(20,34,46,0.97)'; ctx.fill();
    ctx.strokeStyle = 'rgba(95,176,232,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    fitFont('UNTANGLE DOTS', Math.round(32 * k), '800', pw - 28);
    ctx.fillStyle = '#5fb0e8';
    ctx.fillText('UNTANGLE DOTS', cx, cy + 48 * k);
    setFont(Math.max(12, Math.round(14 * k)), '500');
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('The lines are hopelessly crossed.', cx, cy + 92 * k);
    ctx.fillText('Drag the dots around until none', cx, cy + 114 * k);
    ctx.fillText('of the lines intersect.', cx, cy + 136 * k);
    var pulse = 0.75 + 0.25 * Math.sin(Date.now() / 300);
    fitFont('TAP TO PLAY', Math.round(18 * k), '700', pw - 28);
    ctx.fillStyle = 'rgba(141,232,157,' + pulse + ')';
    ctx.fillText('TAP TO PLAY', cx, cy + 180 * k);
    if (best > 0) {
      setFont(Math.max(11, Math.round(13 * k)), '600');
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('BEST ' + best, cx, cy + 210 * k);
    }
  }

  function drawOver() {
    var a = clamp(overT / 0.35, 0, 1);
    ctx.fillStyle = 'rgba(8,14,20,' + (0.66 * a) + ')'; ctx.fillRect(0, 0, W, H);
    var safeW = W - view.left - view.right;
    var safeH = H - view.top - view.bottom;
    var pw = Math.min(safeW - 32, 330);
    var ch = Math.min(210, safeH - 48);
    var k = ch / 210;
    var cx = view.left + safeW / 2;
    var cy = view.top + safeH / 2 - ch / 2, oy = (1 - a) * 40;
    rr(cx - pw / 2, cy + oy, pw, ch, 18);
    ctx.fillStyle = 'rgba(20,34,46,0.97)'; ctx.fill();
    ctx.strokeStyle = 'rgba(141,232,157,0.45)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    fitFont('ALL UNTANGLED!', Math.round(30 * k), '800', pw - 28);
    ctx.fillStyle = '#8de89d';
    ctx.fillText('ALL UNTANGLED!', cx, cy + oy + 56 * k);
    setFont(Math.max(13, Math.round(20 * k)), '700');
    ctx.fillStyle = '#ffd666';
    ctx.fillText('SCORE ' + score, cx, cy + oy + 96 * k);
    if (newBest) {
      var blink = 0.6 + 0.4 * Math.sin(Date.now() / 160);
      setFont(Math.max(12, Math.round(16 * k)), '800');
      ctx.fillStyle = 'rgba(141,232,157,' + blink + ')';
      ctx.fillText('NEW BEST!', cx, cy + oy + 124 * k);
    } else {
      setFont(Math.max(11, Math.round(13 * k)), '600');
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('BEST ' + best, cx, cy + oy + 124 * k);
    }
    if (overT > 0.55) {
      var pulse = 0.7 + 0.3 * Math.sin(Date.now() / 280);
      fitFont('TAP TO PLAY AGAIN', Math.round(17 * k), '700', pw - 28);
      ctx.fillStyle = 'rgba(255,214,102,' + pulse + ')';
      ctx.fillText('TAP TO PLAY AGAIN', cx, cy + oy + 162 * k);
    }
  }

  /* ================= frame loop ================= */
  function frameLoop(ts) {
    rafId = requestAnimationFrame(frameLoop);
    if (!lastTs) { lastTs = ts; return; }
    var dt = Math.min(0.033, (ts - lastTs) / 1000);
    lastTs = ts;
    update(dt);
    drawScene();
    drawHeader();
    if (phase === PHASE_START) drawStart();
    if (phase === PHASE_OVER) drawOver();
  }

  /* ================= test api ================= */
  var api = {
    state: function () {
      return { phase: phase, level: level, nodes: nodes.map(function (n) { return [Math.round(n.x), Math.round(n.y)]; }),
        edges: edges.map(function (e) { return e.slice(); }), crossings: crossings(),
        score: score, moves: moves, best: best, clearT: clearT,
        viewport: { w: W, h: H, dpr: DPR }, playArea: playArea };
    },
    setNode: function (i, x, y) {
      nodes[i].x = clamp(x, playArea.x + nodeR, playArea.x + playArea.w - nodeR);
      nodes[i].y = clamp(y, playArea.y + nodeR, playArea.y + playArea.h - nodeR);
    },
    crossings: function () { return crossings(); },
    release: function () { afterMove(); },
    loadLevel: function (n) { layout(); loadLevel(n); },
    newGame: function () { resetGame(); },
    playArea: function () { return playArea; },
    resize: function () { resize(); }
  };

  /* ================= boot / teardown ================= */
  function start() {
    if (started) return;
    canvas = document.getElementById('cv');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    started = true;
    lastTs = 0;
    view = readInsets();
    layout();
    resetToStart();
    resize();
    bindInput();
    bindFs();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onOrientation);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
    rafId = requestAnimationFrame(frameLoop);
  }

  function stop() {
    if (!started) return;
    started = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    unbindInput();
    unbindFs();
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onOrientation);
    if (window.visualViewport) window.visualViewport.removeEventListener('resize', onResize);
  }

  if (typeof window !== 'undefined') {
    window.untGame = { start: start, stop: stop };
    window.__unt = api;
  }
})();
