(() => {
  if (window.__videoTextGrabber) return;
  window.__videoTextGrabber = true;

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; -webkit-font-smoothing: antialiased; }
    [hidden] { display: none !important; }
    button { font: inherit; color: inherit; border: 0; background: none; cursor: pointer; }

    .stage {
      --accent: #0a84ff; --ok: #30d158; --warn: #ff9f0a;
      --spring: cubic-bezier(.32, 1.32, .5, 1);
      position: absolute; inset: 0; overflow: hidden; user-select: none; cursor: crosshair; background: #000;
      font: 500 13px/1.3 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
      color: #fff; animation: fade .2s ease-out both;
    }
    .stage.busy { cursor: progress; }
    .stage.out { animation: fade .16s ease-in reverse both; }
    @keyframes fade { from { opacity: 0; } }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes draw { to { stroke-dashoffset: 0; } }

    canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; object-fit: contain; }
    .scrim { position: absolute; inset: 0; background: rgba(0, 0, 0, .3); }

    /* Liquid glass: dark-tinted blur, a crisp 1px rim, a top specular edge and one soft drop shadow. No glows. */
    .glass {
      position: absolute; z-index: 3; white-space: nowrap; cursor: default;
      background: rgba(34, 34, 38, .6);
      -webkit-backdrop-filter: blur(32px) saturate(180%); backdrop-filter: blur(32px) saturate(180%);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.14), inset 0 1px 0 rgba(255,255,255,.3), 0 8px 24px rgba(0,0,0,.3);
    }

    .pill {
      top: 18px; left: 50%; display: flex; align-items: center; gap: 10px;
      height: 44px; padding: 0 6px 0 18px; border-radius: 22px;
      transform: translateX(-50%); animation: drop .5s var(--spring) both;
    }
    @keyframes drop { from { opacity: 0; transform: translateX(-50%) translateY(-12px) scale(.95); } }
    .status { display: flex; align-items: center; gap: 9px; font-weight: 600; letter-spacing: -.01em; }
    .status small { font-weight: 500; color: rgba(255,255,255,.62); }
    .spin { width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(255,255,255,.25); border-top-color: #fff; animation: spin .75s linear infinite; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ok); }
    .dot.warn { background: var(--warn); }
    .sep { width: 1px; height: 20px; background: rgba(255,255,255,.18); }

    .btn {
      display: inline-flex; align-items: center; gap: 7px; height: 32px; padding: 0 14px; border-radius: 16px;
      font-weight: 600; background: rgba(255,255,255,.13);
      transition: background .15s, transform .18s var(--spring);
    }
    .btn:hover { background: rgba(255,255,255,.22); }
    .btn:active { transform: scale(.96); }
    .btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .btn svg { width: 16px; height: 16px; flex: none; }
    .btn.icon { width: 32px; padding: 0; justify-content: center; }
    .btn.primary { background: var(--accent); box-shadow: inset 0 1px 0 rgba(255,255,255,.25); }
    .btn.primary:hover { background: #3396ff; }
    .btn.done { background: var(--ok); box-shadow: inset 0 1px 0 rgba(255,255,255,.25); pointer-events: none; }
    .btn.done path { stroke-dasharray: 24; stroke-dashoffset: 24; animation: draw .35s .05s ease-out forwards; }
    kbd {
      font: 600 11px/1 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
      padding: 3px 6px; border-radius: 6px; background: rgba(255,255,255,.16); letter-spacing: .02em;
    }
    .btn.primary kbd, .btn.done kbd { background: rgba(255,255,255,.22); }

    .bar { display: flex; align-items: center; gap: 12px; height: 44px; padding: 0 6px 0 16px; border-radius: 22px; animation: pop .4s var(--spring) both; }
    @keyframes pop { from { opacity: 0; transform: scale(.88) translateY(6px); } }
    .count { font-weight: 500; color: rgba(255,255,255,.75); }

    .hint {
      bottom: 20px; left: 50%; display: flex; align-items: center; gap: 16px; height: 34px; padding: 0 16px;
      border-radius: 17px; font-size: 12px; color: rgba(255,255,255,.8);
      transform: translateX(-50%); animation: rise .5s .1s var(--spring) both;
    }
    @keyframes rise { from { opacity: 0; transform: translateX(-50%) translateY(10px); } }
    .hint span { display: inline-flex; align-items: center; gap: 6px; }

    .ln {
      position: absolute; z-index: 1; border-radius: 8px; pointer-events: none;
      background: rgba(255,255,255,.05); box-shadow: inset 0 0 0 1px rgba(255,255,255,.26);
      animation: pop-in .36s calc(var(--i) * 28ms) var(--spring) both;
    }
    @keyframes pop-in { from { opacity: 0; transform: scale(.97); } }
    .hov { position: absolute; z-index: 1; border-radius: 8px; pointer-events: none; background: rgba(255,255,255,.1); }
    .hl { position: absolute; z-index: 2; border-radius: 3px; pointer-events: none; background: rgba(10,132,255,.45); }
    .sweep { position: absolute; z-index: 1; border-radius: 12px; overflow: hidden; pointer-events: none; box-shadow: inset 0 0 0 1px rgba(255,255,255,.24); }
    .sweep::after {
      content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 38%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,.16), transparent);
      animation: sweep 1.3s ease-in-out infinite;
    }
    @keyframes sweep { from { transform: translateX(-110%); } to { transform: translateX(300%); } }
    .marq { position: absolute; z-index: 2; border-radius: 6px; pointer-events: none; border: 1px solid rgba(255,255,255,.9); background: rgba(255,255,255,.1); }
    @media (prefers-reduced-motion: reduce) {
      * { animation-duration: .01ms !important; animation-delay: 0s !important; transition: none !important; }
    }
  `;

  const REPLACED = new Set(['VIDEO', 'IFRAME', 'IMG', 'CANVAS', 'EMBED', 'OBJECT', 'AUDIO']);
  const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';
  const NS = 'http://www.w3.org/2000/svg';
  const ICON = {
    copy: ['M8 8h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z', 'M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h2'],
    check: ['M5 12.5l4.5 4.5L19 7.5'],
    close: ['M6 6l12 12', 'M18 6L6 18'],
    all: ['M4 7h16', 'M4 12h16', 'M4 17h10'],
  };

  let ui = null;
  let job = 0;

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'vtg:status') {
      sendResponse({ active: !!ui });
    } else if (msg?.type === 'vtg:close') {
      close();
      sendResponse({});
    } else if (msg?.type === 'vtg:start') {
      start(msg.shot).catch((err) => console.warn('Video Text Grabber:', err));
      sendResponse({});
    }
  });

  const el = (tag, props = {}, ...children) => {
    const node = document.createElement(tag);
    Object.assign(node, props);
    node.append(...children);
    return node;
  };

  const svg = (name) => {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2.2');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    for (const d of ICON[name]) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      s.append(p);
    }
    return s;
  };

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  function dataUrlToBlob(dataUrl) {
    const [head, body] = dataUrl.split(',');
    const bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
    return new Blob([bytes], { type: head.slice(5, head.indexOf(';')) });
  }

  function findTargets() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scope = document.fullscreenElement;
    const targets = [];
    for (const node of document.querySelectorAll('video, iframe')) {
      if (scope && scope !== node && !scope.contains(node)) continue;
      const b = node.getBoundingClientRect();
      const left = Math.max(0, b.left);
      const top = Math.max(0, b.top);
      const right = Math.min(vw, b.right);
      const bottom = Math.min(vh, b.bottom);
      if (right - left < 80 || bottom - top < 60) continue;
      if (getComputedStyle(node).visibility === 'hidden') continue;
      targets.push({ x: left / vw, y: top / vh, w: (right - left) / vw, h: (bottom - top) / vh });
    }
    return targets;
  }

  function pauseVideos() {
    for (const video of document.querySelectorAll('video')) {
      if (!video.paused) video.pause();
    }
  }

  // Crops rect (fractions of the frame) and returns three OCR candidates plus the crop geometry.
  function prepare(bmp, r) {
    const sx = Math.round(r.x * bmp.width);
    const sy = Math.round(r.y * bmp.height);
    const sw = Math.max(1, Math.round(r.w * bmp.width));
    const sh = Math.max(1, Math.round(r.h * bmp.height));
    const scale = Math.max(1, Math.min(4, 1800 / Math.max(sw, sh), Math.sqrt(1.2e7 / (sw * sh))));
    const w = Math.round(sw * scale);
    const h = Math.round(sh * scale);
    const pad = 16;

    const work = el('canvas', { width: w, height: h });
    const wctx = work.getContext('2d', { willReadFrequently: true });
    wctx.imageSmoothingQuality = 'high';
    wctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, w, h);

    const img = wctx.getImageData(0, 0, w, h);
    const px = img.data;
    const n = w * h;
    const lum = new Uint8Array(n);
    const hist = new Uint32Array(256);
    let edgeSum = 0;
    let edgeCount = 0;

    for (let i = 0; i < n; i++) {
      const j = i * 4;
      const l = (px[j] * 299 + px[j + 1] * 587 + px[j + 2] * 114) / 1000;
      lum[i] = l;
      hist[lum[i]]++;
      const x = i % w;
      const y = (i / w) | 0;
      if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) {
        edgeSum += l;
        edgeCount++;
      }
    }

    const percentile = (p) => {
      const target = n * p;
      let acc = 0;
      for (let v = 0; v < 256; v++) {
        acc += hist[v];
        if (acc >= target) return v;
      }
      return 255;
    };

    const lo = percentile(0.01);
    const hi = percentile(0.99);
    const range = Math.max(1, hi - lo);
    const invert = edgeSum / edgeCount < 128;

    for (let i = 0; i < n; i++) {
      let v = ((lum[i] - lo) * 255) / range;
      if (invert) v = 255 - v;
      const j = i * 4;
      px[j] = px[j + 1] = px[j + 2] = v;
      px[j + 3] = 255;
    }
    wctx.putImageData(img, 0, 0);

    const frame = () => {
      const out = el('canvas', { width: w + pad * 2, height: h + pad * 2 });
      const octx = out.getContext('2d');
      octx.fillStyle = '#fff';
      octx.fillRect(0, 0, out.width, out.height);
      octx.drawImage(work, pad, pad);
      return out.toDataURL('image/png');
    };
    const gray = frame();

    // Extra candidates for captions on busy video: keep only the brightest class (text fill) so
    // outlines and shadows vanish. `ink` also drops big solid blobs (sky, lights); `edge` keeps
    // them, which preserves dark text inside a bright caption box.
    const mask = new Uint8Array(n);
    const t2 = brightCut(hist);
    for (let i = 0; i < n; i++) mask[i] = lum[i] >= t2 ? 1 : 0;
    const render = (solid) => {
      const m = mask.slice();
      dropBlobs(m, w, h, solid);
      for (let i = 0; i < n; i++) {
        const j = i * 4;
        px[j] = px[j + 1] = px[j + 2] = m[i] ? 0 : 255;
      }
      wctx.putImageData(img, 0, 0);
      return frame();
    };
    return { gray, ink: render(true), edge: render(false), geo: { sx, sy, scale, pad } };
  }

  // 3-class Otsu on the luminance histogram; returns the lower bound of the brightest class.
  function brightCut(hist) {
    const P = new Float64Array(257);
    const S = new Float64Array(257);
    for (let i = 0; i < 256; i++) {
      P[i + 1] = P[i] + hist[i];
      S[i + 1] = S[i] + i * hist[i];
    }
    const part = (a, b) => (P[b] > P[a] ? (S[b] - S[a]) ** 2 / (P[b] - P[a]) : 0);
    let best = -1;
    let cut = 170;
    for (let a = 1; a < 255; a++) {
      for (let b = a + 1; b < 256; b++) {
        const v = part(0, a) + part(a, b) + part(b, 256);
        if (v > best) {
          best = v;
          cut = b;
        }
      }
    }
    return cut;
  }

  // Clears bright blobs that cannot be letters: anything touching the crop edge, plus (with
  // `solid`, in big crops such as a whole video) large solid areas like sky or lights that miss it.
  function dropBlobs(ink, w, h, solid) {
    const n = w * h;
    const q = new Int32Array(n);
    const big = solid && n > 5e5;
    let qe = 0;
    for (let s = 0; s < n; s++) {
      if (ink[s] !== 1) continue;
      const qs = qe;
      ink[s] = 2;
      q[qe++] = s;
      let x0 = w;
      let x1 = 0;
      let y0 = h;
      let y1 = 0;
      let edge = false;
      for (let head = qs; head < qe; head++) {
        const i = q[head];
        const x = i % w;
        const y = (i - x) / w;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
        if (x > 0 && ink[i - 1] === 1) ink[q[qe++] = i - 1] = 2;
        if (x < w - 1 && ink[i + 1] === 1) ink[q[qe++] = i + 1] = 2;
        if (y > 0 && ink[i - w] === 1) ink[q[qe++] = i - w] = 2;
        if (y < h - 1 && ink[i + w] === 1) ink[q[qe++] = i + w] = 2;
      }
      const area = qe - qs;
      const drop = edge || (big && area > n * 0.006 && area > 0.45 * (x1 - x0 + 1) * (y1 - y0 + 1));
      for (let k = qs; k < qe; k++) ink[q[k]] = drop ? 0 : 3;
    }
    for (let i = 0; i < n; i++) ink[i] = ink[i] === 3 ? 1 : 0;
  }

  // Groups loose words (frame pixels) into lines, then returns lines and words in reading order.
  // Rows come from vertical overlap; a row splits into separate lines at wide horizontal gaps.
  function layout(raw) {
    const rows = [];
    for (const w of [...raw].sort((a, b) => a.y0 + a.y1 - b.y0 - b.y1)) {
      const h = w.y1 - w.y0;
      const row = rows.find((r) => Math.min(r.y1, w.y1) - Math.max(r.y0, w.y0) > 0.5 * Math.min(r.y1 - r.y0, h));
      if (row) {
        row.words.push(w);
        row.y0 = Math.min(row.y0, w.y0);
        row.y1 = Math.max(row.y1, w.y1);
      } else {
        rows.push({ words: [w], y0: w.y0, y1: w.y1 });
      }
    }
    rows.sort((a, b) => a.y0 + a.y1 - b.y0 - b.y1);

    const lines = [];
    for (const row of rows) {
      let line = null;
      for (const w of row.words.sort((a, b) => a.x0 - b.x0)) {
        if (line && w.x0 - line.x1 < 4 * Math.max(w.y1 - w.y0, line.y1 - line.y0)) {
          line.words.push(w);
          line.x1 = Math.max(line.x1, w.x1);
          line.y0 = Math.min(line.y0, w.y0);
          line.y1 = Math.max(line.y1, w.y1);
        } else {
          line = { words: [w], x0: w.x0, y0: w.y0, x1: w.x1, y1: w.y1 };
          lines.push(line);
        }
      }
    }

    const words = [];
    lines.forEach((l, i) => {
      for (const w of l.words) {
        w.line = i;
        words.push(w);
      }
    });
    return { lines, words };
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {}
    try {
      const res = await chrome.runtime.sendMessage({ target: 'background', type: 'copy', text });
      return !!res?.ok;
    } catch {
      return false;
    }
  }

  function onKey(e) {
    if (!ui) return;
    e.stopImmediatePropagation();
    if (e.type === 'keydown') ui.key(e);
  }

  function mount(host) {
    const fs = document.fullscreenElement;
    const parent = fs && !REPLACED.has(fs.tagName) ? fs : document.documentElement;
    if (host.parentNode !== parent) parent.append(host);
    try {
      if (!host.matches(':popover-open')) host.showPopover();
    } catch {}
  }

  function onFullscreenChange() {
    if (ui) mount(ui.host);
  }

  function onResize() {
    ui?.relayout();
  }

  function close() {
    if (!ui) return;
    job++;
    for (const type of ['keydown', 'keyup', 'keypress']) window.removeEventListener(type, onKey, true);
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    window.removeEventListener('resize', onResize);
    ui.host.remove();
    ui.bmp.close();
    ui = null;
  }

  function closeSoft() {
    if (!ui || ui.closing) return;
    ui.closing = true;
    ui.stage.classList.add('out');
    const host = ui.host;
    setTimeout(() => ui?.host === host && close(), 170);
  }

  async function start(shot) {
    close();
    const targets = findTargets();
    pauseVideos();
    const bmp = await createImageBitmap(dataUrlToBlob(shot));
    if (document.fullscreenElement && REPLACED.has(document.fullscreenElement.tagName)) {
      await document.exitFullscreen().catch(() => {});
    }

    const host = el('video-text-grabber');
    host.setAttribute('popover', 'manual');
    host.style.cssText = [
      'all: initial',
      'position: fixed',
      'inset: 0',
      'width: 100vw',
      'height: 100vh',
      'max-width: none',
      'max-height: none',
      'margin: 0',
      'padding: 0',
      'border: 0',
      'background: transparent',
      'overflow: hidden',
      'display: block',
      'z-index: 2147483647',
    ]
      .map((rule) => rule + ' !important')
      .join(';');

    // ---- DOM ----
    const root = host.attachShadow({ mode: 'closed' });
    const canvas = el('canvas', { width: bmp.width, height: bmp.height });
    canvas.getContext('2d').drawImage(bmp, 0, 0);
    const sweep = el('div', { className: 'sweep', hidden: true });
    const lineLayer = el('div');
    const hov = el('div', { className: 'hov', hidden: true });
    const hlLayer = el('div');
    const marq = el('div', { className: 'marq', hidden: true });

    const status = el('div', { className: 'status', role: 'status' });
    const allBtn = el('button', { className: 'btn', type: 'button', title: `Select all (${MOD}A)`, hidden: true }, svg('all'), 'Select all');
    const closeBtn = el('button', { className: 'btn icon', type: 'button', title: 'Close (Esc)', ariaLabel: 'Close' }, svg('close'));
    const pill = el('div', { className: 'glass pill' }, status, el('div', { className: 'sep' }), allBtn, closeBtn);

    const count = el('span', { className: 'count' });
    const copyBtn = el('button', { type: 'button' });
    const bar = el('div', { className: 'glass bar', hidden: true }, count, copyBtn);

    const key = (k, label) => el('span', {}, el('kbd', { textContent: k }), label);
    const hint = el(
      'div',
      { className: 'glass hint' },
      key('Drag', 'select text'),
      key('Double-click', 'word'),
      key('Triple-click', 'line'),
      key(MOD + 'A', 'all'),
      key('Esc', 'close'),
    );

    const stage = el('div', { className: 'stage' }, canvas, el('div', { className: 'scrim' }), sweep, lineLayer, hov, hlLayer, marq, pill, bar, hint);
    root.append(el('style', { textContent: CSS }), stage);
    mount(host);

    // ---- state ----
    let raw = [];
    let lines = [];
    let words = [];
    let glyphs = [];
    let lineRects = [];
    let lineSel = [];
    let sel = null;
    let drag = null;
    let busy = false;
    let clicks = { t: 0, n: 0, x: 0, y: 0 };

    const setStatus = (kind, text, sub) => {
      const lead = kind === 'busy' ? el('span', { className: 'spin' }) : el('span', { className: 'dot' + (kind === 'warn' ? ' warn' : '') });
      status.replaceChildren(lead, text, ...(sub ? [el('small', { textContent: sub })] : []));
    };

    const setCopyIdle = () => {
      copyBtn.className = 'btn primary';
      copyBtn.replaceChildren(svg('copy'), 'Copy', el('kbd', { textContent: MOD + 'C' }));
    };
    setCopyIdle();

    // ---- geometry: frame pixels <-> stage pixels ----
    const imageBox = () => {
      const W = stage.clientWidth;
      const H = stage.clientHeight;
      const s = Math.min(W / bmp.width, H / bmp.height);
      const width = bmp.width * s;
      const height = bmp.height * s;
      return { left: (W - width) / 2, top: (H - height) / 2, width, height, W, H };
    };

    const point = (e) => {
      const b = stage.getBoundingClientRect();
      return { x: e.clientX - b.left, y: e.clientY - b.top };
    };

    const toFrac = (p) => {
      const box = imageBox();
      return { x: clamp((p.x - box.left) / box.width, 0, 1), y: clamp((p.y - box.top) / box.height, 0, 1) };
    };

    const fracToStage = (r) => {
      const box = imageBox();
      return { l: box.left + r.x * box.width, t: box.top + r.y * box.height, w: r.w * box.width, h: r.h * box.height };
    };

    const place = (node, r) => {
      node.style.left = r.l + 'px';
      node.style.top = r.t + 'px';
      node.style.width = r.r - r.l + 'px';
      node.style.height = r.b - r.t + 'px';
    };

    // Flat list of characters in reading order, with a space between words and a newline between
    // lines. A selection is a caret range [a, b) over it, so it can start and end between any letters.
    const buildGlyphs = () => {
      glyphs = [];
      lines.forEach((line, li) => {
        line.gs = glyphs.length;
        line.words.forEach((w, wi) => {
          if (wi) glyphs.push({ ch: ' ', x0: line.words[wi - 1].x1, x1: w.x0 });
          const chars = Array.from(w.t);
          const b = w.b?.length === chars.length + 1 ? w.b : chars.map((_, k) => w.x0 + ((w.x1 - w.x0) * k) / chars.length).concat(w.x1);
          w.gs = glyphs.length;
          chars.forEach((ch, k) => glyphs.push({ ch, x0: b[k], x1: b[k + 1] }));
          w.ge = glyphs.length;
        });
        line.ge = glyphs.length;
        if (li < lines.length - 1) glyphs.push({ ch: '\n', x0: line.x1, x1: line.x1 });
      });
    };

    const measure = () => {
      const box = imageBox();
      const s = box.width / bmp.width;
      const toX = (x) => box.left + x * s;
      const toY = (y) => box.top + y * s;
      lineRects = lines.map((l) => {
        const pad = Math.max(3, (l.y1 - l.y0) * s * 0.18);
        return { l: toX(l.x0) - pad, r: toX(l.x1) + pad, t: toY(l.y0) - pad * 0.6, b: toY(l.y1) + pad * 0.6 };
      });
      lineSel = lines.map((l) => {
        const pad = Math.max(1.5, (l.y1 - l.y0) * s * 0.08);
        return { t: toY(l.y0) - pad, b: toY(l.y1) + pad };
      });
      for (const g of glyphs) {
        g.l = toX(g.x0);
        g.r = toX(g.x1);
      }
    };

    // ---- selection ----
    const lineAtPoint = (p) => lineRects.findIndex((r) => p.x >= r.l && p.x <= r.r && p.y >= r.t && p.y <= r.b);

    const nearestLine = (p) => {
      let best = -1;
      let bestScore = Infinity;
      lineRects.forEach((r, i) => {
        const dx = Math.max(r.l - p.x, 0, p.x - r.r);
        const dy = Math.max(r.t - p.y, 0, p.y - r.b);
        const score = dx + dy * 3 + Math.abs(p.y - (r.t + r.b) / 2) * 0.01;
        if (score < bestScore) {
          bestScore = score;
          best = i;
        }
      });
      return best;
    };

    // Caret index (0..glyphs.length) nearest to the pointer: before the first glyph whose middle is right of it.
    const caretAt = (p) => {
      const line = lines[nearestLine(p)];
      for (let i = line.gs; i < line.ge; i++) {
        if (p.x < (glyphs[i].l + glyphs[i].r) / 2) return i;
      }
      return line.ge;
    };

    const glyphAt = (p) => {
      const line = lines[nearestLine(p)];
      let best = line.gs;
      let bestDist = Infinity;
      for (let i = line.gs; i < line.ge; i++) {
        const d = Math.max(glyphs[i].l - p.x, 0, p.x - glyphs[i].r);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      return best;
    };

    const selectedText = () => (sel ? glyphs.slice(sel.a, sel.b).map((g) => g.ch).join('').trim() : '');

    const placeBar = (rects) => {
      const n = Array.from(selectedText()).length;
      count.textContent = `${n} character${n === 1 ? '' : 's'}`;
      bar.hidden = false;
      const { W, H } = imageBox();
      const gap = 14;
      const bw = bar.offsetWidth;
      const bh = bar.offsetHeight;
      const first = rects[0];
      const last = rects[rects.length - 1];
      const mid = (Math.min(...rects.map((r) => r.l)) + Math.max(...rects.map((r) => r.r))) / 2;
      const left = clamp(mid - bw / 2, gap, W - bw - gap);
      // Prefer below the selection, then above; skip a spot that would cover other detected text.
      const free = (t) => t >= gap && t + bh <= H - gap && !lineRects.some((r) => t < r.b && t + bh > r.t && left < r.r && left + bw > r.l);
      const top = [last.b + gap, first.t - gap - bh].find(free) ?? clamp(last.b + gap, gap, H - bh - gap);
      bar.style.top = top + 'px';
      bar.style.left = left + 'px';
    };

    const renderSel = () => {
      hlLayer.replaceChildren();
      const rects = [];
      if (sel) {
        lines.forEach((line, i) => {
          const lo = Math.max(sel.a, line.gs);
          const hi = Math.min(sel.b, line.ge);
          if (hi > lo) rects.push({ l: glyphs[lo].l, r: glyphs[hi - 1].r, t: lineSel[i].t, b: lineSel[i].b });
        });
      }
      if (!rects.length) {
        bar.hidden = true;
        return;
      }
      for (const r of rects) {
        const node = el('div', { className: 'hl' });
        place(node, r);
        hlLayer.append(node);
      }
      if (drag) bar.hidden = true;
      else placeBar(rects);
    };

    const setRange = (a, b) => {
      sel = a === b ? null : { a: Math.min(a, b), b: Math.max(a, b) };
      if (copyBtn.classList.contains('done')) setCopyIdle();
      renderSel();
    };

    const selectAll = () => glyphs.length && setRange(0, glyphs.length);

    const selectLine = (i) => setRange(lines[i].gs, lines[i].ge);

    // Word under the pointer, minus punctuation stuck to its ends.
    const selectWordAt = (p) => {
      const g = glyphAt(p);
      const w = words.find((x) => g < x.ge) ?? words[words.length - 1];
      const isText = (i) => /[\p{L}\p{N}]/u.test(glyphs[i].ch);
      let a = w.gs;
      let b = w.ge;
      while (a < b - 1 && !isText(a)) a++;
      while (b > a + 1 && !isText(b - 1)) b--;
      setRange(a, b);
    };

    const render = () => {
      measure();
      lineLayer.replaceChildren(
        ...lineRects.map((r, i) => {
          const node = el('div', { className: 'ln' });
          node.style.setProperty('--i', Math.min(i, 12));
          place(node, r);
          return node;
        }),
      );
      allBtn.hidden = !glyphs.length;
      renderSel();
    };

    // ---- scanning ----
    const scan = async (rect, psm) => {
      const { geo, ...images } = prepare(bmp, rect);
      const res = await chrome.runtime.sendMessage({ target: 'background', type: 'scan', images, psm });
      if (!res || res.error) throw new Error(res?.error || 'No response');
      const back = (v, o) => o + (v - geo.pad) / geo.scale;
      return res.words.map((w) => ({ t: w.t, b: w.b.map((x) => back(x, geo.sx)), x0: back(w.x0, geo.sx), y0: back(w.y0, geo.sy), x1: back(w.x1, geo.sx), y1: back(w.y1, geo.sy) }));
    };

    const detect = async (rect, psm, merge) => {
      const id = ++job;
      busy = true;
      stage.classList.add('busy');
      sel = null;
      renderSel();
      const area = fracToStage(rect);
      place(sweep, { l: area.l, t: area.t, r: area.l + area.w, b: area.t + area.h });
      sweep.hidden = false;
      setStatus('busy', merge ? 'Scanning area…' : 'Detecting text…');
      try {
        const found = await scan(rect, psm);
        if (id !== job) return;
        const px = { x0: rect.x * bmp.width, x1: (rect.x + rect.w) * bmp.width, y0: rect.y * bmp.height, y1: (rect.y + rect.h) * bmp.height };
        const inside = (w) => (w.x0 + w.x1) / 2 >= px.x0 && (w.x0 + w.x1) / 2 <= px.x1 && (w.y0 + w.y1) / 2 >= px.y0 && (w.y0 + w.y1) / 2 <= px.y1;
        raw = merge ? raw.filter((w) => !inside(w)).concat(found) : found;
        ({ lines, words } = layout(raw));
        buildGlyphs();
        render();
        if (!found.length) {
          setStatus('warn', merge ? 'No text in that area' : 'No text found', 'Drag over an area to scan it');
        } else {
          setStatus('ok', `${words.length} word${words.length === 1 ? '' : 's'} detected`);
          if (merge) {
            const fresh = words.filter((w) => found.includes(w));
            setRange(Math.min(...fresh.map((w) => w.gs)), Math.max(...fresh.map((w) => w.ge)));
          }
        }
      } catch (err) {
        if (id === job) setStatus('warn', 'Scan failed', err.message);
      } finally {
        if (id === job) {
          busy = false;
          stage.classList.remove('busy');
          sweep.hidden = true;
        }
      }
    };

    // ---- copy ----
    const doCopy = async () => {
      if (busy || !glyphs.length) return;
      if (!sel) selectAll();
      const text = selectedText();
      if (!text) return;
      const ok = await copy(text);
      if (ui?.host !== host) return;
      if (ok) {
        copyBtn.className = 'btn done';
        copyBtn.replaceChildren(svg('check'), 'Copied');
        setTimeout(() => ui?.host === host && closeSoft(), 800);
      } else {
        setStatus('warn', 'Copy was blocked', `Press ${MOD}C after clicking the page`);
      }
    };

    ui = {
      host,
      bmp,
      stage,
      relayout: render,
      key(e) {
        const mod = e.metaKey || e.ctrlKey;
        const k = e.key.toLowerCase();
        if (k === 'escape') {
          e.preventDefault();
          closeSoft();
        } else if (mod && k === 'a') {
          e.preventDefault();
          selectAll();
        } else if ((mod && k === 'c') || k === 'enter') {
          e.preventDefault();
          doCopy();
        } else if (!mod && !e.altKey && k !== 'tab') {
          e.preventDefault();
        }
      },
    };
    for (const type of ['keydown', 'keyup', 'keypress']) window.addEventListener(type, onKey, true);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    window.addEventListener('resize', onResize);

    // ---- pointer ----
    const setHover = (i) => {
      hov.hidden = i < 0;
      if (i >= 0) place(hov, lineRects[i]);
      stage.style.cursor = i >= 0 ? 'text' : '';
    };

    stage.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || busy || pill.contains(e.target) || bar.contains(e.target) || hint.contains(e.target)) return;
      e.preventDefault();
      stage.setPointerCapture(e.pointerId);
      const p = point(e);
      const now = e.timeStamp;
      clicks = now - clicks.t < 450 && Math.hypot(p.x - clicks.x, p.y - clicks.y) < 8 ? { ...clicks, t: now, n: clicks.n + 1 } : { t: now, n: 1, x: p.x, y: p.y };
      if (lineAtPoint(p) >= 0) {
        if (clicks.n >= 3) selectLine(nearestLine(p));
        else if (clicks.n === 2) selectWordAt(p);
        else {
          const c = caretAt(p);
          drag = { kind: 'text', anchor: c };
          setRange(c, c);
        }
      } else {
        sel = null;
        renderSel();
        drag = { kind: 'box', from: p, to: p };
      }
    });

    stage.addEventListener('pointermove', (e) => {
      const p = point(e);
      if (!drag) {
        if (!busy) setHover(lineAtPoint(p));
        return;
      }
      if (drag.kind === 'text') {
        setRange(drag.anchor, caretAt(p));
      } else {
        drag.to = p;
        setHover(-1);
        const r = { l: Math.min(drag.from.x, p.x), t: Math.min(drag.from.y, p.y), r: Math.max(drag.from.x, p.x), b: Math.max(drag.from.y, p.y) };
        place(marq, r);
        marq.hidden = Math.hypot(p.x - drag.from.x, p.y - drag.from.y) < 6;
      }
    });

    stage.addEventListener('pointerup', (e) => {
      if (!drag) return;
      const d = drag;
      drag = null;
      if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
      marq.hidden = true;
      if (d.kind === 'text') {
        renderSel();
        return;
      }
      const a = toFrac(d.from);
      const b = toFrac(d.to);
      const rect = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
      const size = fracToStage(rect);
      if (size.w >= 24 && size.h >= 14) detect(rect, 6, true);
    });

    stage.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
    allBtn.addEventListener('click', selectAll);
    closeBtn.addEventListener('click', closeSoft);
    copyBtn.addEventListener('click', doCopy);

    // ---- go: scan the biggest video on screen, else the whole viewport ----
    const biggest = targets.sort((a, b) => b.w * b.h - a.w * a.h)[0];
    detect(biggest || { x: 0, y: 0, w: 1, h: 1 }, 11, false);
  }
})();
