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

  if (msg.type === 'ocr') {
    const job = queue.then(() => recognize(msg));
    queue = job.catch(() => {});
    job.then(sendResponse, (err) => sendResponse({ error: String(err?.message ?? err) }));
    return true;
  }

  if (msg.type === 'copy') {
    sendResponse({ ok: copyText(msg.text) });
  }
});

async function recognize({ images, psm }) {
  const worker = await workerReady;
  await worker.setParameters({
    tessedit_pageseg_mode: String(psm),
    preserve_interword_spaces: '1',
  });
  let { data } = await worker.recognize(images.gray);
  if (data.confidence < 90) {
    // Low confidence (busy background): retry on the text-fill-only image, keep the surer read.
    const alt = await worker.recognize(images.ink).catch(() => null);
    if (alt && alt.data.confidence > data.confidence) data = alt.data;
  }
  return { text: tidy(data.text) };
}

function tidy(text) {
  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function copyText(text) {
  const area = document.getElementById('clip');
  area.value = text;
  area.select();
  const ok = document.execCommand('copy');
  area.value = '';
  return ok;
}
