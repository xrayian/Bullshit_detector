# AGENTS.md

Chrome extension (Manifest V3, vanilla JS, zero runtime deps) that scans LinkedIn/Facebook post captions via the Gemini API and injects "Smell Test" / "Normalize" buttons into each post card. No bundler, no tests, no lint.

## Commands

- `npm install` — only devDependency is `heroicons` (icon source)
- `npm run build` — copies root files (`background.js`, `content.js`, `popup.*`, `styles.css`, `icons.js`, `icons/`, `manifest.json`) into `dist/`
- `npm run icons` — regenerates `icons.js` from `node_modules/heroicons` via `scripts/extract-icons.js`
- `npm test` — fails by design; there is no test suite

## Gotchas

- **The loaded extension is `dist/`, not the repo root.** After editing any root extension file you MUST run `npm run build`, then reload the extension in `chrome://extensions`. `dist/` and `dist.zip` are gitignored.
- **`icons.js` is generated** — never edit by hand; edit the `ICONS`/`CUSTOM_ICONS` maps in `scripts/extract-icons.js` and run `npm run icons`. Content scripts/popup read icons from `window.BS_ICONS`.
- **Only LinkedIn and Facebook work.** Instagram and X/Twitter are declared in `manifest.json` and `content.js` `SITES` but have empty selector configs (no-op). New sites require selectors in both `manifest.json` matches and `SITES` in `content.js`.
- **No lint/typecheck.** Verify manually: build, load unpacked in Chrome, test on a real feed. `scripts/package.js` and `scripts/generate-icons.js` are not wired into `package.json` — run them directly.
- **`index.html` is a standalone landing page**, not part of the extension build — edits there don't need `npm run build`.
- **Version lives only in `manifest.json`** (currently 4.1.0); bump it there, not in `package.json`.

## Architecture

- `background.js` — service worker, the only code calling the Gemini API (`generativelanguage.googleapis.com/v1beta`). Message actions: `ratePost`, `normalizePost`, `checkAvailability`. Default model `gemini-3.7-flash`, overridable per-user in popup.
- `content.js` — IIFE; `MutationObserver` on `document.body` auto-detects post cards per-site, marks processed cards with `data-bs-done`, expands "see more", injects `.bs-controls`. Talks to background via `chrome.runtime.sendMessage`.
- `popup.html/js` — API key + model settings and cache-clear UI; key stored in `chrome.storage.local` (`geminiApiKey`, `geminiModel`). No env files.
- Cache — captions hashed with djb2; results persisted in `chrome.storage.local` under `bs_cache`; cached ratings render badges on scroll without API calls.
- Errors from Gemini are surfaced via `alert()` in the content script (existing pattern).
- `tmp_training_data/` is untracked scratch (saved page snapshots for selector work); not part of the build.
