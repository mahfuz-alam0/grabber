(() => {
  if (window.__videoTextGrabber) return;
  window.__videoTextGrabber = true;

  const CSS = `
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    .stage {
      position: absolute; inset: 0; cursor: crosshair; user-select: none; background: #000;
      font: 13px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #f2f2f2;
    }
    canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; object-fit: contain; }
    .dim { position: absolute; inset: 0; background: rgba(0, 0, 0, .35); }
    .sel {
      position: absolute; outline: 2px solid #4da3ff; border-radius: 2px; pointer-events: none;
      box-shadow: 0 0 0 100vmax rgba(0, 0, 0, .5);
    }
    .hint {
      position: absolute; top: 16px; left: 50%; transform: translateX(-50%); white-space: nowrap;
      background: rgba(20, 20, 22, .9); padding: 8px 16px; border-radius: 999px; pointer-events: none;
      box-shadow: 0 4px 16px rgba(0, 0, 0, .35);
    }
    .hint b { color: #4da3ff; font-weight: 600; }
    .panel {
      position: absolute; width: min(460px, calc(100% - 24px)); padding: 10px; cursor: default;
      background: #1c1c1f; border: 1px solid #34343a; border-radius: 10px; user-select: text;
      box-shadow: 0 12px 36px rgba(0, 0, 0, .55);
    }
    .bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
    .status { color: #bdbdc4; }
    .status.ok { color: #6fdc8c; }
    .status.err { color: #ff8080; }
    .status.busy::before {
      content: ""; display: inline-block; width: 10px; height: 10px; margin-right: 8px; vertical-align: -1px;
      border: 2px solid #4da3ff; border-top-color: transparent; border-radius: 50%;
      animation: spin .8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    textarea {
      width: 100%; min-height: 96px; max-height: 50vh; resize: vertical; outline: none;
      background: #111114; color: #f2f2f2; border: 1px solid #34343a; border-radius: 6px; padding: 8px;
      font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    }
    textarea:focus { border-color: #4da3ff; }
    .actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 8px; }
    .tip { color: #85858d; font-size: 12px; }
    button {
      font: inherit; font-weight: 600; cursor: pointer; border: 0; border-radius: 6px;
      padding: 6px 16px; background: #4da3ff; color: #fff;
    }
    button:hover { filter: brightness(1.1); }
    button.x { background: transparent; color: #a0a0a8; padding: 2px 8px; font-weight: 400; }
    button.x:hover { color: #fff; }
  `;

  const REPLACED = new Set(['VIDEO', 'IFRAME', 'IMG', 'CANVAS', 'EMBED', 'OBJECT', 'AUDIO']);

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

    // Second candidate for captions on busy video: keep only the brightest class (text fill),
    // then drop bright blobs touching the crop edge (sky, lights, box edges). Outlines vanish.
    const ink = new Uint8Array(n);
    const t2 = brightCut(hist);
    for (let i = 0; i < n; i++) ink[i] = lum[i] >= t2 ? 1 : 0;
    dropEdgeBlobs(ink, w, h);
    for (let i = 0; i < n; i++) {
      const j = i * 4;
      px[j] = px[j + 1] = px[j + 2] = ink[i] ? 0 : 255;
    }
    wctx.putImageData(img, 0, 0);
    return { gray, ink: frame() };
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

  function dropEdgeBlobs(ink, w, h) {
    const stack = new Int32Array(w * h);
    let top = 0;
    const push = (i) => {
      if (ink[i]) {
        ink[i] = 0;
        stack[top++] = i;
      }
    };
    for (let x = 0; x < w; x++) {
      push(x);
      push((h - 1) * w + x);
    }
    for (let y = 0; y < h; y++) {
      push(y * w);
      push(y * w + w - 1);
    }
    while (top) {
      const i = stack[--top];
      const x = i % w;
      if (x > 0) push(i - 1);
      if (x < w - 1) push(i + 1);
      if (i >= w) push(i - w);
      if (i < w * (h - 1)) push(i + w);
    }
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
    if (e.type === 'keydown' && e.key === 'Escape') {
      e.preventDefault();
      close();
    }
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

  function close() {
    if (!ui) return;
    job++;
    for (const type of ['keydown', 'keyup', 'keypress']) window.removeEventListener(type, onKey, true);
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    ui.host.remove();
    ui.bmp.close();
    ui = null;
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

    const root = host.attachShadow({ mode: 'closed' });
    const canvas = el('canvas', { width: bmp.width, height: bmp.height });
    canvas.getContext('2d').drawImage(bmp, 0, 0);
    const dim = el('div', { className: 'dim' });
    const sel = el('div', { className: 'sel', hidden: true });
    const hint = el(
      'div',
      { className: 'hint' },
      el('b', { textContent: 'Drag' }),
      ' over text  ·  ',
      el('b', { textContent: 'Click' }),
      ' a video for the full frame  ·  ',
      el('b', { textContent: 'Esc' }),
      ' to close',
    );
    const status = el('span', { className: 'status' });
    const closeBtn = el('button', { className: 'x', textContent: '✕', title: 'Close (Esc)' });
    const textarea = el('textarea', { spellcheck: false, placeholder: 'Detected text appears here' });
    const copyBtn = el('button', { textContent: 'Copy' });
    const panel = el(
      'div',
      { className: 'panel', hidden: true },
      el('div', { className: 'bar' }, status, closeBtn),
      textarea,
      el('div', { className: 'actions' }, el('span', { className: 'tip', textContent: 'Drag again to grab more' }), copyBtn),
    );
    const stage = el('div', { className: 'stage' }, canvas, dim, sel, hint, panel);
    root.append(el('style', { textContent: CSS }), stage);

    mount(host);

    ui = { host, bmp };
    for (const type of ['keydown', 'keyup', 'keypress']) window.addEventListener(type, onKey, true);
    document.addEventListener('fullscreenchange', onFullscreenChange);

    const setStatus = (text, kind = '') => {
      status.textContent = text;
      status.className = 'status' + (kind ? ' ' + kind : '');
    };

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
      const box = imageBox();
      return {
        x: clamp((e.clientX - b.left - box.left) / box.width, 0, 1),
        y: clamp((e.clientY - b.top - box.top) / box.height, 0, 1),
      };
    };

    const toStage = (r) => {
      const box = imageBox();
      return {
        left: box.left + r.x * box.width,
        top: box.top + r.y * box.height,
        width: r.w * box.width,
        height: r.h * box.height,
        W: box.W,
        H: box.H,
      };
    };

    const showSel = (r) => {
      const s = toStage(r);
      Object.assign(sel.style, {
        left: s.left + 'px',
        top: s.top + 'px',
        width: s.width + 'px',
        height: s.height + 'px',
      });
      sel.hidden = false;
      dim.hidden = true;
      hint.hidden = true;
    };

    const placePanel = (r) => {
      panel.hidden = false;
      const s = toStage(r);
      const pw = panel.offsetWidth;
      const ph = panel.offsetHeight;
      const gap = 12;
      let top;
      if (s.top + s.height + gap + ph <= s.H - gap) top = s.top + s.height + gap;
      else if (s.top - gap - ph >= gap) top = s.top - gap - ph;
      else top = s.H - ph - gap;
      panel.style.top = Math.max(gap, top) + 'px';
      panel.style.left = clamp(s.left, gap, s.W - pw - gap) + 'px';
    };

    const recognize = async (r, psm) => {
      const id = ++job;
      showSel(r);
      textarea.value = '';
      setStatus('Reading text…', 'busy');
      placePanel(r);
      try {
        const images = prepare(bmp, r);
        const res = await chrome.runtime.sendMessage({ target: 'background', type: 'ocr', images, psm });
        if (id !== job) return;
        if (!res || res.error) throw new Error(res?.error || 'No response');
        textarea.value = res.text;
        if (!res.text) {
          setStatus('No text found. Try a tighter selection.', 'err');
          return;
        }
        const ok = await copy(res.text);
        if (id !== job) return;
        setStatus(ok ? 'Copied to clipboard ✓' : 'Text ready. Press Copy.', ok ? 'ok' : '');
        textarea.focus({ preventScroll: true });
        textarea.select();
      } catch (err) {
        if (id === job) setStatus('OCR failed: ' + err.message, 'err');
      }
    };

    let drag = null;

    stage.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || panel.contains(e.target)) return;
      e.preventDefault();
      stage.setPointerCapture(e.pointerId);
      job++;
      panel.hidden = true;
      drag = { start: point(e), x: e.clientX, y: e.clientY, moved: false };
    });

    stage.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
      drag.moved = true;
      const p = point(e);
      drag.rect = {
        x: Math.min(drag.start.x, p.x),
        y: Math.min(drag.start.y, p.y),
        w: Math.abs(p.x - drag.start.x),
        h: Math.abs(p.y - drag.start.y),
      };
      showSel(drag.rect);
    });

    stage.addEventListener('pointerup', (e) => {
      if (!drag) return;
      const { moved, rect, start: p } = drag;
      drag = null;
      if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
      const size = toStage(rect || { x: 0, y: 0, w: 0, h: 0 });
      if (moved && size.width >= 4 && size.height >= 4) {
        recognize(rect, 6);
        return;
      }
      const hits = targets.filter((t) => p.x >= t.x && p.x <= t.x + t.w && p.y >= t.y && p.y <= t.y + t.h);
      hits.sort((a, b) => a.w * a.h - b.w * b.h);
      recognize(hits[0] || { x: 0, y: 0, w: 1, h: 1 }, 3);
    });

    stage.addEventListener(
      'wheel',
      (e) => {
        if (e.target !== textarea) e.preventDefault();
      },
      { passive: false },
    );

    closeBtn.addEventListener('click', close);
    copyBtn.addEventListener('click', async () => {
      const ok = await copy(textarea.value);
      setStatus(ok ? 'Copied to clipboard ✓' : 'Copy failed. Use Ctrl+C.', ok ? 'ok' : 'err');
    });
  }
})();
