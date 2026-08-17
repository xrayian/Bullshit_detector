const STATUS_ICONS = {
  ready: "shieldCheck",
  error: "alert",
  checking: "loader",
};

function iconSvg(key) {
  return (window.BS_ICONS && window.BS_ICONS[key]) || "";
}

function mountIcons() {
  document.querySelectorAll("[data-icon]").forEach((el) => {
    const src = iconSvg(el.dataset.icon);
    if (!src) return;
    const innerStart = src.indexOf(">") + 1;
    const innerEnd = src.lastIndexOf("</svg>");
    el.setAttribute("viewBox", "0 0 24 24");
    el.setAttribute("fill", "none");
    el.setAttribute("stroke", "currentColor");
    el.setAttribute("stroke-width", "1.5");
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = src.slice(innerStart, innerEnd);
  });
}

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
  mountIcons();

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

  keyToggle.innerHTML = iconSvg("eye");
  keyToggle.addEventListener("click", () => {
    const show = apiKeyInput.type === "password";
    apiKeyInput.type = show ? "text" : "password";
    keyToggle.innerHTML = show ? iconSvg("eyeOff") : iconSvg("eye");
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
    statusIcon.innerHTML = iconSvg(STATUS_ICONS[state] || "");
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