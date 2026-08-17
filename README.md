# BS Detector

> Rates social media BS in one click. Hit Normalize and corporate fluff becomes one honest sentence.

Built at the [Build with AI Hack Days](https://build-with-ai-hack-days-emk.devpost.com/).

---

## What it does

BS Detector is a Chrome extension that scans LinkedIn and Facebook post captions, rates them on a scale from **Pure Fact** to **Complete BS**, and lets you replace any post with a deadpan one-sentence translation of what the person actually means.

- **Scan** — Click once, get instant ratings on every caption in your feed.
- **Normalize** — Click again, the fluff gets replaced with one honest sentence.
- **Revert** — Don't like it? One click to bring the original back.

No accounts. No data collection. Your API key, your machine, your feed.

## How it works

1. Load the extension in Chrome and add your Gemini API key.
2. Open LinkedIn or Facebook. Click **Scan Captions**.
3. Hit **Normalize** on any post to see what the person actually meant.

## Built with

- **Chrome Extension** — Manifest V3, vanilla JS, zero dependencies
- **Google Gemini API** — Structured JSON output for ratings, streaming prompt for normalization
- **Social media DOM scraping** — Multi-layer selector chain with fallbacks for LinkedIn and Facebook

## Getting started

1. Clone the repo:
   ```bash
   git clone https://github.com/xrayian/Bullshit_detector.git
   ```
2. Open `chrome://extensions` in Chrome, enable **Developer mode**, and click **Load unpacked**.
3. Select the `dist` folder from this repo.
4. Click the extension icon, paste your Gemini API key, and you're good to go.

## License

MIT
