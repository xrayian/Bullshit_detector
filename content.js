(() => {
  "use strict";

  const PROCESSED = "data-bs-done";
  const MIN_TEXT = 15;

  const POST_SELECTORS = [
    '[data-view-name="feed-full-update"]',
    ".feed-shared-update-v2",
    ".occludable-update",
    ".feed-shared-inline-show-more-text",
    '[data-testid="expandable-text-box"]',
    'div[componentkey*="FeedType_MAIN_FEED"]',
  ];

  const TEXT_SELECTORS = [
    ".feed-shared-inline-show-more-text",
    '[data-testid="expandable-text-box"]',
    'div[dir="ltr"] > span[dir="ltr"]',
    ".feed-shared-text__text-view span",
  ];

  function findPostContainer(element) {
    return (
      element.closest('[data-view-name="feed-full-update"]') ||
      element.closest(".feed-shared-update-v2") ||
      element.closest(".occludable-update") ||
      element.closest('div[componentkey*="FeedType_MAIN_FEED"]') ||
      walkUpToCard(element) ||
      element.parentElement
    );
  }

  function walkUpToCard(element) {
    let el = element;
    for (let i = 0; i < 15 && el.parentElement; i++) {
      el = el.parentElement;
      if (el.offsetHeight > 150 && el.offsetWidth > 400) return el;
    }
    return null;
  }

  function getCaptionText(card) {
    for (const sel of TEXT_SELECTORS) {
      const el = card.querySelector(sel);
      if (el) {
        const text = el.innerText.trim();
        if (text.length >= MIN_TEXT) return text;
      }
    }
    const fallback = card.innerText.replace(/\s+/g, " ").trim();
    return fallback.length >= MIN_TEXT ? fallback : null;
  }

  function collectAllCaptions() {
    const captions = [];
    const seen = new Set();

    for (const sel of POST_SELECTORS) {
      document.querySelectorAll(sel).forEach((el) => {
        const card = findPostContainer(el);
        if (!card || seen.has(card)) return;
        seen.add(card);

        const text = getCaptionText(card);
        if (text) captions.push({ card, text });
      });
    }

    const actionLabels = ["like", "comment", "repost", "send", "react"];
    document.querySelectorAll("button[aria-label]").forEach((btn) => {
      const label = (btn.getAttribute("aria-label") || "").toLowerCase();
      if (!actionLabels.some((l) => label.includes(l))) return;

      const card = walkUpToCard(btn);
      if (!card || seen.has(card)) return;
      seen.add(card);

      const text = getCaptionText(card);
      if (text) captions.push({ card, text });
    });

    return captions;
  }

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

    const mediaSelectors = [
      ".update-components-image",
      ".update-components-video",
      ".update-components-article",
      ".feed-shared-external-video",
      'div[data-testid="video-player"]',
      "video",
    ];

    let insertBefore = null;
    for (const sel of mediaSelectors) {
      const el = card.querySelector(sel);
      if (el) { insertBefore = el; break; }
    }

    const controls = card.querySelector(".bs-controls");

    badge.style.position = "relative";
    if (controls) {
      card.insertBefore(badge, controls);
    } else if (insertBefore) {
      card.insertBefore(badge, insertBefore);
    } else {
      card.appendChild(badge);
    }
  }

  function injectControls(card, text) {
    const existing = card.querySelector(".bs-controls");
    if (existing) return;

    const controls = document.createElement("div");
    controls.className = "bs-controls";

    const textEl = card.querySelector(".feed-shared-inline-show-more-text") ||
      card.querySelector('[data-testid="expandable-text-box"]') ||
      card.querySelector('div[dir="ltr"] > span[dir="ltr"]');

    const mediaSelectors = [
      ".update-components-image",
      ".update-components-video",
      ".update-components-article",
      ".feed-shared-external-video",
      'div[data-testid="video-player"]',
      "video",
      ".update-components-linkedin-prompt",
    ];

    let insertBefore = null;
    if (textEl) {
      let sibling = textEl.nextElementSibling;
      while (sibling) {
        if (mediaSelectors.some((s) => sibling.matches?.(s) || sibling.querySelector?.(s))) {
          insertBefore = sibling;
          break;
        }
        sibling = sibling.nextElementSibling;
      }
    }

    const btn = document.createElement("button");
    btn.className = "bs-normalize-btn";
    btn.textContent = "Normalize";

    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (btn.dataset.original) {
        if (textEl) textEl.innerText = btn.dataset.original;
        delete btn.dataset.original;
        btn.textContent = "Normalize";
        return;
      }

      btn.textContent = "...";
      btn.disabled = true;

      try {
        const response = await chrome.runtime.sendMessage({
          action: "normalizePost",
          text,
        });

        if (response.error) {
          alert("BS Detector error:\n\n" + response.error);
          btn.textContent = "Normalize";
          btn.disabled = false;
          return;
        }

        if (textEl) {
          btn.dataset.original = textEl.innerText;
          textEl.innerText = response.normalized;
        }
        btn.textContent = "Revert";
        btn.disabled = false;
      } catch (err) {
        alert("BS Detector error:\n\n" + (err.message || "Could not connect."));
        btn.textContent = "Normalize";
        btn.disabled = false;
      }
    });

    controls.appendChild(btn);

    if (insertBefore) {
      card.insertBefore(controls, insertBefore);
    } else if (textEl && textEl.parentElement) {
      textEl.parentElement.insertBefore(controls, textEl.nextSibling);
    } else {
      card.appendChild(controls);
    }
  }

  async function scanPage() {
    const captions = collectAllCaptions();
    if (captions.length === 0) {
      alert("BS Detector: No LinkedIn captions found on this page.");
      return;
    }

    for (const { card, text } of captions) {
      if (card.getAttribute(PROCESSED)) continue;
      card.setAttribute(PROCESSED, "true");
      injectControls(card, text);
    }

    const batch = captions.map((c) => c.text).join("\n---\n");

    try {
      const response = await chrome.runtime.sendMessage({
        action: "ratePost",
        text: batch,
      });

      if (response.error) {
        alert("BS Detector error:\n\n" + response.error);
        return;
      }

      if (Array.isArray(response)) {
        response.forEach((r, i) => {
          if (captions[i]) injectBadge(captions[i].card, r);
        });
      } else {
        captions.forEach(({ card }) => injectBadge(card, response));
      }
    } catch (err) {
      alert("BS Detector error:\n\n" + (err.message || "Could not connect."));
    }
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scanPage") {
      scanPage().then(() => sendResponse({ status: "ok" }));
      return true;
    }
  });
})();
