# Publish Text Grabber on the Chrome Web Store

Planned for December 2026. Store rules below were checked on 2026-11-23.

## Free steps (can be done before paying)

- [ ] Turn on 2-Step Verification for the Google account. Google requires it before publishing.
- [ ] Search the [Chrome Web Store](https://chromewebstore.google.com) for the name "Text Grabber". A similar one exists: "GrabText - Screen & Image OCR".
- [ ] Publish a privacy policy at a public URL. Google counts page screenshots as user data, even when they are processed only on the device. The policy must say:
  - The extension captures the visible tab only when the user activates it.
  - OCR runs locally on the device.
  - Nothing is sent to a server, shared or stored.
- [ ] Take 1 to 5 screenshots at 1280x800.
- [ ] Optional: make a 440x280 promo tile. Items without one are shown after items that have one.
- [ ] Add the Apache-2.0 license for Tesseract. `lib/LICENSE.txt` currently covers only regenerator-runtime.

The 128x128 store icon already exists: `icons/128.png`.

## Account (payment needed)

- [ ] Choose the account email carefully. It cannot be changed later. A different email means a new account, a new fee and an item transfer.
- [ ] Register at <https://chrome.google.com/webstore/devconsole>.
- [ ] Pay the one-time registration fee. It was $5 in 2020; current docs give no amount, so check the price shown at registration. There is no yearly renewal and no fee per extension or update.
- [ ] Set the publisher name.
- [ ] Verify the contact email.
- [ ] Declare trader or non-trader status.

New publishers can have at most two published extensions.

## Build the zip

Run in the project folder. `manifest.json` must be at the root of the zip.

```sh
rm -f ../text-grabber.zip
zip -r ../text-grabber.zip manifest.json background.js content.js offscreen.html offscreen.js icons lib -x '*.DS_Store'
```

## Upload and fill in the dashboard

- [ ] Click **Add new item** and upload `text-grabber.zip`.
- [ ] **Store Listing:** description, category, language, icon and screenshots.
- [ ] **Privacy:** privacy policy URL and these answers:

| Field | Answer |
|---|---|
| Single purpose | Copy text from a video frame or the visible page using on-device OCR. |
| `activeTab` | Captures the visible tab only when the user clicks the icon or presses the shortcut. |
| `scripting` | Injects the text selection overlay into the active tab. |
| `offscreen` | Runs the OCR worker and copies the selected text to the clipboard. |
| Remote code | No. All code and OCR data are in the package. |
| Data usage | Tick **Website content**, then the Limited Use certifications. |

- [ ] **Distribution:** **Public**, all regions. **Unlisted** gives link-only sharing with the same review.

If a reviewer asks about the `cdn.jsdelivr.net` URLs in the Tesseract files: they are library defaults. `offscreen.js` overrides all three paths with local ones.

## Submit

- [ ] Click **Submit for review**. Uncheck automatic publishing to choose the launch moment. You then have 30 days after approval to publish.
- [ ] Wait for review: usually a few days, possibly a few weeks. New developers can take longer. Contact developer support after three weeks.

## Later updates

1. Raise `version` in `manifest.json`.
2. Build the zip again.
3. Upload it to the same item and submit for review.

## Official docs

- [Register](https://developer.chrome.com/docs/webstore/register)
- [Account setup](https://developer.chrome.com/docs/webstore/set-up-account)
- [Publish](https://developer.chrome.com/docs/webstore/publish)
- [Store listing](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
- [Images](https://developer.chrome.com/docs/webstore/images)
- [Privacy tab](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [Distribution](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution)
- [Review process](https://developer.chrome.com/docs/webstore/review-process)
- [2-Step Verification](https://developer.chrome.com/docs/webstore/program-policies/two-step-verification)
- [User data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Trader disclosure](https://developer.chrome.com/docs/webstore/program-policies/trader-disclosure)
- [2020 fee announcement](https://blog.chromium.org/2020/03/new-developer-dashboard-and.html?hl=fr)
