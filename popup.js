document.addEventListener("DOMContentLoaded", async () => {
  const statusDot = document.querySelector(".status-dot");
  const statusText = document.getElementById("statusText");
  const settingsToggle = document.getElementById("settingsToggle");
  const settingsBody = document.getElementById("settingsBody");
  const settingsArrow = document.getElementById("settingsArrow");
  const apiKeyInput = document.getElementById("apiKey");
  const modelNameInput = document.getElementById("modelName");
  const saveBtn = document.getElementById("saveBtn");
  const saveMsg = document.getElementById("saveMsg");

  settingsToggle.addEventListener("click", () => {
    settingsBody.classList.toggle("hidden");
    settingsArrow.classList.toggle("rotated");
  });

  chrome.storage.local.get(["geminiApiKey", "geminiModel"], (data) => {
    if (data.geminiApiKey) apiKeyInput.value = data.geminiApiKey;
    if (data.geminiModel) modelNameInput.value = data.geminiModel;
  });

  saveBtn.addEventListener("click", () => {
    const key = apiKeyInput.value.trim();
    const model = modelNameInput.value.trim() || "gemini-3.7-flash";
    chrome.storage.local.set({ geminiApiKey: key, geminiModel: model }, () => {
      saveMsg.textContent = "Saved";
      saveMsg.style.color = "#22c55e";
      setTimeout(() => (saveMsg.textContent = ""), 1500);
      refreshStatus();
    });
  });

  async function refreshStatus() {
    statusDot.className = "status-dot checking";
    statusText.textContent = "Checking API key...";
    try {
      const resp = await chrome.runtime.sendMessage({ action: "checkAvailability" });
      if (resp.hasApiKey) {
        statusDot.className = "status-dot ready";
        statusText.textContent = `API ready \u00b7 ${resp.model}`;
      } else {
        statusDot.className = "status-dot error";
        statusText.textContent = "No API key \u2014 open settings";
      }
    } catch {
      statusDot.className = "status-dot error";
      statusText.textContent = "Extension error";
    }
  }

  refreshStatus();
});
