const ICONS = {
  ready: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1 1 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>',
  error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  checking: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>',
};

const MODEL_PRESETS = [
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-pro-preview",
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-pro-latest",
  "gemini-omni-flash-preview",
];

document.addEventListener("DOMContentLoaded", async () => {
  const statusIcon = document.getElementById("statusIcon");
  const statusText = document.getElementById("statusText");
  const settingsToggle = document.getElementById("settingsToggle");
  const settingsBody = document.getElementById("settingsBody");
  const settingsArrow = document.getElementById("settingsArrow");
  const apiKeyInput = document.getElementById("apiKey");
  const keyToggle = document.getElementById("keyToggle");
  const modelSelect = document.getElementById("modelSelect");
  const modelCustom = document.getElementById("modelCustom");
  const clearCacheBtn = document.getElementById("clearCacheBtn");
  const cacheCount = document.getElementById("cacheCount");
  const saveBtn = document.getElementById("saveBtn");
  const saveMsg = document.getElementById("saveMsg");

  settingsToggle.addEventListener("click", () => {
    const isOpen = settingsBody.classList.toggle("hidden") === false;
    settingsToggle.setAttribute("aria-expanded", String(isOpen));
    settingsArrow.classList.toggle("rotated", isOpen);
  });

  keyToggle.innerHTML = ICONS.eye;
  keyToggle.addEventListener("click", () => {
    const show = apiKeyInput.type === "password";
    apiKeyInput.type = show ? "text" : "password";
    keyToggle.innerHTML = show ? ICONS.eyeOff : ICONS.eye;
    keyToggle.setAttribute("aria-label", show ? "Hide API key" : "Show API key");
  });

  function setModelInput(model) {
    if (MODEL_PRESETS.includes(model)) {
      modelSelect.value = model;
      modelCustom.classList.add("hidden");
    } else {
      modelSelect.value = "__custom__";
      modelCustom.classList.remove("hidden");
      modelCustom.value = model;
    }
  }

  modelSelect.addEventListener("change", () => {
    if (modelSelect.value === "__custom__") {
      modelCustom.classList.remove("hidden");
      modelCustom.focus();
    } else {
      modelCustom.classList.add("hidden");
    }
  });

  chrome.storage.local.get(["geminiApiKey", "geminiModel", "bs_cache"], (data) => {
    if (data.geminiApiKey) apiKeyInput.value = data.geminiApiKey;
    if (data.geminiModel) setModelInput(data.geminiModel);
    updateCacheCount(data.bs_cache || {});
  });

  saveBtn.addEventListener("click", () => {
    const key = apiKeyInput.value.trim();
    const model = modelSelect.value === "__custom__"
      ? modelCustom.value.trim()
      : modelSelect.value;
    chrome.storage.local.set(
      { geminiApiKey: key, geminiModel: model || "gemini-3.7-flash" },
      () => {
        saveMsg.textContent = "Saved";
        setTimeout(() => (saveMsg.textContent = ""), 1500);
        refreshStatus();
      }
    );
  });

  function updateCacheCount(cache) {
    const count = Object.keys(cache).length;
    cacheCount.textContent = count === 1 ? "1 rated" : `${count} rated`;
  }

  clearCacheBtn.addEventListener("click", () => {
    chrome.storage.local.get("bs_cache", (data) => {
      const count = Object.keys(data.bs_cache || {}).length;
      if (count === 0) {
        saveMsg.textContent = "Cache already empty";
        saveMsg.style.color = "var(--muted)";
        setTimeout(() => (saveMsg.textContent = ""), 1500);
        return;
      }
      if (!confirm(`Clear ${count} cached rating(s)? An open page will re-rate on next click.`)) return;
      chrome.storage.local.remove("bs_cache", () => {
        updateCacheCount({});
        saveMsg.textContent = "Cache cleared";
        setTimeout(() => (saveMsg.textContent = ""), 1500);
      });
    });
  });

  function setStatus(state, text) {
    statusIcon.className = "status-icon " + state;
    statusIcon.innerHTML = ICONS[state] || "";
    statusText.textContent = text;
  }

  async function refreshStatus() {
    setStatus("checking", "Checking API key...");
    try {
      const resp = await chrome.runtime.sendMessage({ action: "checkAvailability" });
      if (resp.hasApiKey) {
        setStatus("ready", `API ready \u00b7 ${resp.model}`);
      } else {
        setStatus("error", "No API key \u2014 open settings");
      }
    } catch {
      setStatus("error", "Extension error");
    }
  }

  refreshStatus();
});