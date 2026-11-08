let creatingOffscreen = null;

async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (contexts.length) return;
  creatingOffscreen ??= chrome.offscreen
    .createDocument({
      url: 'offscreen.html',
      reasons: ['WORKERS', 'CLIPBOARD'],
      justification: 'Run OCR on the selected video frame and copy the result',
    })
    .finally(() => {
      creatingOffscreen = null;
    });
  await creatingOffscreen;
}

function flashError(tabId) {
  chrome.action.setBadgeBackgroundColor({ color: '#d93025', tabId });
  chrome.action.setBadgeText({ text: '!', tabId });
  setTimeout(() => chrome.action.setBadgeText({ text: '', tabId }), 2500);
}

async function run(tab) {
  if (!tab?.id) return;
  ensureOffscreen().catch(() => {});
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    const status = await chrome.tabs.sendMessage(tab.id, { type: 'vtg:status' });
    if (status?.active) {
      await chrome.tabs.sendMessage(tab.id, { type: 'vtg:close' });
      return;
    }
    const shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    await chrome.tabs.sendMessage(tab.id, { type: 'vtg:start', shot });
  } catch (err) {
    console.warn('Video Text Grabber:', err);
    flashError(tab.id);
  }
}

chrome.action.onClicked.addListener(run);

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.target !== 'background') return;
  ensureOffscreen()
    .then(() => chrome.runtime.sendMessage({ ...msg, target: 'offscreen' }))
    .then(sendResponse, (err) => sendResponse({ error: err.message }));
  return true;
});
