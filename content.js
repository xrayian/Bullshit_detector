(() => {
  "use strict";

  const PROCESSED = "data-bs-done";
  const MIN_TEXT = 15;
  const DEBOUNCE_MS = 200;

  // ── Icon library (from heroicons npm package via icons.js) ───

  function withIconClass(svg, extra = "") {
    const cls = ["bs-btn-icon", extra].filter(Boolean).join(" ");
    return (svg || "").replace("<svg ", `<svg class="${cls}" `);
  }

  const ICONS = {
    gauge: withIconClass(window.BS_ICONS && window.BS_ICONS.smell),
    zap: withIconClass(window.BS_ICONS && window.BS_ICONS.zap),
    undo: withIconClass(window.BS_ICONS && window.BS_ICONS.undo),
    loader: withIconClass(window.BS_ICONS && window.BS_ICONS.loader, "bs-spin"),
  };

  // ── Theme detection ───────────────────────────────────────────

  function detectTheme() {
    try {
      const bg = getComputedStyle(document.body).backgroundColor;
      if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") {
        const rgb = bg.match(/\d+/g).slice(0, 3).map(Number);
        if (rgb.length === 3) {
          const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
          return luminance > 0.5 ? "light" : "dark";
        }
      }
    } catch (e) { /* fall through */ }
    return matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  function applyTheme() {
    document.body.dataset.bsTheme = detectTheme();
  }

  // ── Site configs ──────────────────────────────────────────────

  const SITES = {
    linkedin: {
      hostPatterns: ["linkedin.com"],
      postSelectors: [
        '[data-view-name="feed-full-update"]',
        ".feed-shared-update-v2",
        ".occludable-update",
        'div[componentkey*="FeedType_MAIN_FEED"]',
      ],
      textSelectors: [
        ".feed-shared-inline-show-more-text",
        '[data-testid="expandable-text-box"]',
        'div[dir="ltr"] > span[dir="ltr"]',
        ".feed-shared-text__text-view span",
      ],
      actionLabels: ["like", "comment", "repost", "send", "react"],
      mediaSelectors: [
        ".update-components-image",
        ".update-components-video",
        ".update-components-article",
        ".feed-shared-external-video",
        'div[data-testid="video-player"]',
        "video",
        ".update-components-linkedin-prompt",
      ],
    },
    facebook: {
      hostPatterns: ["facebook.com"],
      postSelectors: [],   // TODO: fill when testing
      textSelectors: [],
      actionLabels: [],
      mediaSelectors: [],
    },
    instagram: {
      hostPatterns: ["instagram.com"],
      postSelectors: [],
      textSelectors: [],
      actionLabels: [],
      mediaSelectors: [],
    },
    x: {
      hostPatterns: ["x.com", "twitter.com"],
      postSelectors: [],
      textSelectors: [],
      actionLabels: [],
      mediaSelectors: [],
    },
  };

  function detectSite() {
    const host = location.hostname;
    for (const cfg of Object.values(SITES)) {
      if (cfg.hostPatterns.some((p) => host.includes(p))) return cfg;
    }
    return null;
  }

  const siteConfig = detectSite();
  if (!siteConfig) return;

  // ── Hash + cache ──────────────────────────────────────────────

  function djb2(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
    }
    return "h_" + (hash >>> 0).toString(36);
  }

  let ratingCache = new Map();
  let normalizeCache = new Map();

  function loadCache() {
    return new Promise((resolve) => {
      chrome.storage.local.get("bs_cache", (data) => {
        const cached = data.bs_cache || {};
        for (const [hash, entry] of Object.entries(cached)) {
          if (entry.rating) ratingCache.set(hash, { rating: entry.rating, oneLiner: entry.oneLiner });
          if (entry.normalized) normalizeCache.set(hash, entry.normalized);
        }
        resolve();
      });
    });
  }

  function cacheResult(hash, ratingData, normalizedText) {
    if (ratingData) ratingCache.set(hash, ratingData);
    if (normalizedText) normalizeCache.set(hash, normalizedText);

    chrome.storage.local.get("bs_cache", (data) => {
      const cache = data.bs_cache || {};
      cache[hash] = { ...cache[hash], ...ratingData, normalized: normalizedText };
      chrome.storage.local.set({ bs_cache: cache });
    });
  }

  // ── DOM helpers ───────────────────────────────────────────────

  function walkUpToCard(element) {
    let el = element;
    for (let i = 0; i < 15 && el.parentElement; i++) {
      el = el.parentElement;
      if (el.offsetHeight > 150 && el.offsetWidth > 400) return el;
    }
    return null;
  }

  function findPostContainer(element) {
    for (const sel of siteConfig.postSelectors) {
      const match = element.closest(sel);
      if (match) return match;
    }
    return walkUpToCard(element) || element.parentElement;
  }

  function getCaptionText(card) {
    for (const sel of siteConfig.textSelectors) {
      const el = card.querySelector(sel);
      if (el) {
        const text = el.innerText.trim();
        if (text.length >= MIN_TEXT) return text;
      }
    }
    const fallback = card.innerText.replace(/\s+/g, " ").trim();
    return fallback.length >= MIN_TEXT ? fallback : null;
  }

  function getTextElement(card) {
    for (const sel of siteConfig.textSelectors) {
      const el = card.querySelector(sel);
      if (el && el.innerText.trim().length >= MIN_TEXT) return el;
    }
    return null;
  }

  function findMediaElement(card) {
    for (const sel of siteConfig.mediaSelectors) {
      const el = card.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function safeInsert(parent, child, ref) {
    if (ref && ref.parentNode === parent) {
      parent.insertBefore(child, ref);
    } else {
      parent.prepend(child);
    }
  }

  // ── Collect captions ──────────────────────────────────────────

  function collectAllCaptions() {
    const captions = [];
    const seen = new Set();

    for (const sel of siteConfig.postSelectors) {
      document.querySelectorAll(sel).forEach((el) => {
        const card = findPostContainer(el);
        if (!card || seen.has(card)) return;
        seen.add(card);
        const text = getCaptionText(card);
        if (text) captions.push({ card, text });
      });
    }

    if (siteConfig.actionLabels.length) {
      document.querySelectorAll("button[aria-label]").forEach((btn) => {
        const label = (btn.getAttribute("aria-label") || "").toLowerCase();
        if (!siteConfig.actionLabels.some((l) => label.includes(l))) return;
        const card = walkUpToCard(btn);
        if (!card || seen.has(card)) return;
        seen.add(card);
        const text = getCaptionText(card);
        if (text) captions.push({ card, text });
      });
    }

    return captions;
  }

  // ── Smell Test button ─────────────────────────────────────────

  const RATING_TO_BARS = {
    "Pure Fact": 1,
    "Mild Spin": 2,
    "Corporate Fluff": 3,
    "Performative Cringe": 4,
    "Complete BS": 5,
    "Main Character Syndrome": 6,
  };

  const BAR_COLORS = [
    "#22c55e", // green
    "#84cc16", // lime
    "#eab308", // yellow
    "#f97316", // orange
    "#ef4444", // red
    "#ec4899", // pink
  ];

  function setSmellState(btn, state) {
    btn.dataset.state = state;
    btn.classList.toggle("bs-smell-loading", state === "loading");

    if (state === "idle") {
      btn.innerHTML = `${ICONS.gauge}<span class="bs-smell-label">Smell Test</span>`;
    } else if (state === "loading") {
      btn.innerHTML = `${ICONS.loader}<span class="bs-smell-label">Analyzing</span>`;
    }
  }

  function createSmellTestButton(card, text) {
    const btn = document.createElement("button");
    btn.className = "bs-smell-btn";
    setSmellState(btn, "idle");

    const hash = djb2(text);
    const cached = ratingCache.get(hash);

    if (cached) {
      renderMeter(btn, cached.rating);
      btn.dataset.state = "rated";
    }

    btn.addEventListener("click", async () => {
      if (btn.dataset.state === "rated") {
        const meter = btn.querySelector(".bs-smell-meter");
        if (meter) {
          meter.classList.toggle("bs-smell-meter-expanded");
        }
        return;
      }

      setSmellState(btn, "loading");

      try {
        const response = await chrome.runtime.sendMessage({ action: "ratePost", text });

        if (response.error) {
          alert("BS Detector error:\n\n" + response.error);
          setSmellState(btn, "idle");
          return;
        }

        cacheResult(hash, { rating: response.rating, oneLiner: response.oneLiner }, null);
        renderMeter(btn, response.rating);
        btn.dataset.state = "rated";
      } catch (err) {
        alert("BS Detector error:\n\n" + (err.message || "Could not connect."));
        setSmellState(btn, "idle");
      }
    });

    return btn;
  }

  function renderMeter(btn, rating) {
    const bars = RATING_TO_BARS[rating] || 3;
    const meter = document.createElement("span");
    meter.className = "bs-smell-meter bs-smell-meter-expanded";

    let barsHtml = "";
    for (let i = 0; i < 6; i++) {
      const active = i < bars;
      const color = active ? BAR_COLORS[i] : "var(--bs-bar-empty)";
      const height = 6 + i * 2;
      barsHtml += `<span class="bs-smell-bar${active ? " active" : ""}" style="height:${height}px;background:${color}"></span>`;
    }

    meter.innerHTML = barsHtml;
    btn.innerHTML = "";
    btn.appendChild(meter);

    // tooltip with one-liner
    const hash = djb2(btn.closest("[data-bs-caption]")?.dataset.bsCaption || "");
    const cached = ratingCache.get(hash);
    if (cached?.oneLiner) {
      const tip = document.createElement("span");
      tip.className = "bs-smell-tooltip";
      tip.textContent = cached.oneLiner;
      btn.appendChild(tip);
    }
  }

  // ── Normalize button ──────────────────────────────────────────

  function createNormalizeButton(textEl, text) {
    const btn = document.createElement("button");
    btn.className = "bs-normalize-btn";
    setNormalizeState(btn, "idle");

    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (btn.dataset.state === "revert") {
        if (textEl && btn.dataset.original) {
          textEl.innerText = btn.dataset.original;
        }
        setNormalizeState(btn, "idle");
        return;
      }

      setNormalizeState(btn, "loading");

      const hash = djb2(text);
      const cached = normalizeCache.get(hash);

      if (cached) {
        if (textEl) {
          btn.dataset.original = textEl.innerText;
          textEl.innerText = cached;
        }
        setNormalizeState(btn, "revert");
        return;
      }

      try {
        const response = await chrome.runtime.sendMessage({ action: "normalizePost", text });

        if (response.error) {
          alert("BS Detector error:\n\n" + response.error);
          setNormalizeState(btn, "idle");
          return;
        }

        cacheResult(hash, null, response.normalized);

        if (textEl) {
          btn.dataset.original = textEl.innerText;
          textEl.innerText = response.normalized;
        }
        setNormalizeState(btn, "revert");
      } catch (err) {
        alert("BS Detector error:\n\n" + (err.message || "Could not connect."));
        setNormalizeState(btn, "idle");
      }
    });

    return btn;
  }

  function setNormalizeState(btn, state) {
    btn.dataset.state = state;
    if (state === "idle") {
      btn.innerHTML = `${ICONS.zap}Normalize`;
    } else if (state === "loading") {
      btn.innerHTML = `${ICONS.loader}Working...`;
    } else if (state === "revert") {
      btn.innerHTML = `${ICONS.undo}Revert`;
    }
  }

  // ── Inject controls ───────────────────────────────────────────

  function injectControls(card, text) {
    if (card.querySelector(".bs-controls")) return;

    const textEl = getTextElement(card);

    const controls = document.createElement("div");
    controls.className = "bs-controls";
    card.dataset.bsCaption = text;

    const smellBtn = createSmellTestButton(card, text);
    const normalizeBtn = createNormalizeButton(textEl, text);

    controls.appendChild(smellBtn);
    controls.appendChild(normalizeBtn);

    const media = findMediaElement(card);
    if (media && media.parentNode === card) {
      card.insertBefore(controls, media);
    } else if (textEl && textEl.parentNode) {
      textEl.parentNode.insertBefore(controls, textEl.nextSibling);
    } else {
      card.prepend(controls);
    }
  }

  // ── Inject badge (for cached ratings) ─────────────────────────

  function injectBadge(card, data) {
    const existing = card.querySelector(".bs-badge");
    if (existing) existing.remove();

    const colors = {
      "Pure Fact": "#22c55e",
      "Mild Spin": "#84cc16",
      "Corporate Fluff": "#eab308",
      "Performative Cringe": "#f97316",
      "Complete BS": "#ef4444",
      "Main Character Syndrome": "#ec4899",
      Unknown: "#6b7280",
    };

    const color = colors[data.rating] || colors.Unknown;

    const badge = document.createElement("div");
    badge.className = "bs-badge";
    badge.style.borderLeftColor = color;
    badge.innerHTML = `
      <span class="bs-dot" style="background:${color}"></span>
      <span class="bs-rating-text">${data.rating || "???"}</span>
    `;

    if (data.oneLiner) {
      const tip = document.createElement("div");
      tip.className = "bs-tooltip";
      tip.textContent = data.oneLiner;
      badge.appendChild(tip);
    }

    const media = findMediaElement(card);
    const controls = card.querySelector(".bs-controls");

    badge.style.position = "relative";
    if (controls && controls.parentNode === card) {
      card.insertBefore(badge, controls);
    } else if (media && media.parentNode === card) {
      card.insertBefore(badge, media);
    } else {
      card.prepend(badge);
    }
  }

  // ── Auto-detect + MutationObserver ────────────────────────────

  let debounceTimer = null;

  function detectAndInject() {
    const captions = collectAllCaptions();

    for (const { card, text } of captions) {
      if (card.getAttribute(PROCESSED)) continue;
      card.setAttribute(PROCESSED, "true");
      injectControls(card, text);

      const hash = djb2(text);
      const cached = ratingCache.get(hash);
      if (cached) injectBadge(card, cached);
    }
  }

  function debouncedDetect() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(detectAndInject, DEBOUNCE_MS);
  }

  // ── Init ──────────────────────────────────────────────────────

  applyTheme();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

  loadCache().then(() => {
    detectAndInject();

    const observer = new MutationObserver((mutations) => {
      const hasNewNodes = mutations.some((m) => m.addedNodes.length > 0);
      if (hasNewNodes) debouncedDetect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
