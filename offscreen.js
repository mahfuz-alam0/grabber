const libUrl = chrome.runtime.getURL('lib/');

const workerReady = Tesseract.createWorker('deu+eng', 1, {
  workerPath: libUrl + 'worker.min.js',
  corePath: libUrl + 'core',
  langPath: libUrl + 'lang',
  workerBlobURL: false,
  cacheMethod: 'none',
});

let queue = Promise.resolve();

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.target !== 'offscreen') return;

  if (msg.type === 'scan') {
    const job = queue.then(() => scan(msg));
    queue = job.catch(() => {});
    job.then(sendResponse, (err) => sendResponse({ error: String(err?.message ?? err) }));
    return true;
  }

  if (msg.type === 'copy') {
    sendResponse({ ok: copyText(msg.text) });
  }
});

// Words Tesseract is sure about; single stray glyphs need very high confidence.
function isWord(w) {
  const letters = w.text.replace(/[^\p{L}\p{N}]/gu, '');
  return w.confidence >= 60 && letters.length > 0 && (letters.length > 1 || w.confidence >= 85);
}

async function readWords(worker, image) {
  const { data } = await worker.recognize(image, {}, { blocks: true });
  return data.blocks
    .flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)))
    .filter(isWord)
    .map((w) => ({ t: w.text.trim(), c: w.confidence, ...w.bbox }));
}

// Share of the smaller box covered by the overlap (1 = one box inside the other).
function overlap(a, b) {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0));
}

// Passes in priority order: text-fill-only images first (best on captions over video), the
// plain grey image last (covers dark text on light backgrounds). Later passes only add words
// they are very sure about that earlier passes did not already find.
function mergeWords(...passes) {
  const out = [...passes[0]];
  for (const pass of passes.slice(1)) {
    for (const w of pass) {
      if (w.c >= 80 && !out.some((o) => overlap(o, w) > 0.5)) out.push(w);
    }
  }
  return out;
}

async function scan({ images, psm }) {
  const worker = await workerReady;
  await worker.setParameters({
    tessedit_pageseg_mode: String(psm),
    preserve_interword_spaces: '1',
  });
  const passes = [];
  for (const name of ['ink', 'edge', 'gray']) {
    passes.push(await readWords(worker, images[name]).catch(() => []));
  }
  return { words: mergeWords(...passes) };
}

function copyText(text) {
  const area = document.getElementById('clip');
  area.value = text;
  area.select();
  const ok = document.execCommand('copy');
  area.value = '';
  return ok;
}
