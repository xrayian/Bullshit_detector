const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

const SYSTEM_PROMPT = `You are a deadpan bullshit detector for LinkedIn posts. You have zero patience for corporate fluff, hustle culture, and performative thought leadership.

RULES:
1. No emojis.
2. No softening. Be direct.
3. Ratings are one short phrase.
4. Normalization rewrites are ONE sentence, brutal, honest, funny.
5. Treat every post like it wasted your time.`;

const RATING_PROMPT = `Rate this LinkedIn post. Respond with JSON only:
{"rating":"[phrase]","oneLiner":"[deadpan roast]"}

Pick the closest rating: "Pure Fact", "Mild Spin", "Corporate Fluff", "Performative Cringe", "Complete BS", "Main Character Syndrome"

Post:
`;

const NORMALIZE_PROMPT = `Rewrite this LinkedIn post as ONE single sentence. Say what the person actually means. Be brutally honest and funny. No emojis. No lists. No line breaks. Just one sentence.

Post:
`;

const RATING_SCHEMA = {
  type: "OBJECT",
  properties: {
    rating: {
      type: "STRING",
      description: "Short rating phrase",
    },
    oneLiner: {
      type: "STRING",
      description: "One deadpan sentence roasting this post",
    },
  },
  required: ["rating", "oneLiner"],
};

async function getSettings() {
  return chrome.storage.local.get(["geminiApiKey", "geminiModel"]);
}

async function callGeminiAPI(apiKey, model, prompt, systemPrompt, responseSchema) {
  const url = `${GEMINI_API_BASE}/models/${model}:generateContent`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.9,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
    },
  };

  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  if (responseSchema) {
    body.generationConfig.responseMimeType = "application/json";
    body.generationConfig.responseSchema = responseSchema;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${res.status}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini API");
  return text.trim();
}

function parseJSON(text) {
  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

async function ratePost(text) {
  const settings = await getSettings();
  if (!settings.geminiApiKey) throw new Error("No API key. Open extension settings.");

  const raw = await callGeminiAPI(
    settings.geminiApiKey,
    settings.geminiModel || "gemini-3.7-flash",
    RATING_PROMPT + text,
    SYSTEM_PROMPT,
    RATING_SCHEMA
  );
  return parseJSON(raw) || { rating: "Unknown", oneLiner: "Couldn't parse response." };
}

async function normalizePost(text) {
  const settings = await getSettings();
  if (!settings.geminiApiKey) throw new Error("No API key. Open extension settings.");

  return await callGeminiAPI(
    settings.geminiApiKey,
    settings.geminiModel || "gemini-3.7-flash",
    NORMALIZE_PROMPT + text,
    SYSTEM_PROMPT
  );
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ratePost") {
    ratePost(request.text)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (request.action === "normalizePost") {
    normalizePost(request.text)
      .then((normalized) => sendResponse({ normalized }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (request.action === "checkAvailability") {
    getSettings().then((s) => sendResponse({ hasApiKey: !!s.geminiApiKey, model: s.geminiModel || "gemini-3.7-flash" }));
    return true;
  }
});
