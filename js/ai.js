// js/ai.js
import { STATE } from "./app.js";

// ── ALL PUTER.JS MODELS ──
export const MODELS = {
  top: [
    { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", badge: "Top", icon: "🤖" },
    { id: "claude-3-7-sonnet", name: "Claude 3.7 Sonnet", badge: "Top", icon: "🤖" },
    { id: "gpt-4o", name: "GPT-4o", badge: "Top", icon: "⚡" },
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", badge: "Top", icon: "✨" },
    { id: "o1-mini", name: "o1 Mini", badge: "Top", icon: "🧠" },
  ],
  fast: [
    { id: "claude-3-5-haiku", name: "Claude 3.5 Haiku", badge: "Fast", icon: "🤖" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini", badge: "Fast", icon: "⚡" },
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", badge: "Fast", icon: "✨" },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", badge: "Fast", icon: "✨" },
  ],
  open: [
    { id: "llama-3.1-70b", name: "Llama 3.1 70B", badge: "Open", icon: "🦙" },
    { id: "llama-3.1-8b", name: "Llama 3.1 8B", badge: "Open", icon: "🦙" },
    { id: "llama-3.3-70b", name: "Llama 3.3 70B", badge: "Open", icon: "🦙" },
    { id: "mixtral-8x7b", name: "Mixtral 8x7B", badge: "Open", icon: "🔀" },
    { id: "deepseek-r1", name: "DeepSeek R1", badge: "Open", icon: "🔍" },
    { id: "deepseek-chat", name: "DeepSeek Chat", badge: "Open", icon: "🔍" },
    { id: "qwen-2.5-72b", name: "Qwen 2.5 72B", badge: "Open", icon: "🌐" },
  ],
  premium: [
    { id: "claude-3-opus", name: "Claude 3 Opus", badge: "Premium", icon: "👑", premium: true },
    { id: "gpt-4-turbo", name: "GPT-4 Turbo", badge: "Premium", icon: "👑", premium: true },
    { id: "o1-preview", name: "o1 Preview", badge: "Premium", icon: "👑", premium: true },
    { id: "gemini-ultra", name: "Gemini Ultra", badge: "Premium", icon: "👑", premium: true },
  ]
};

// ── BUILD DROPDOWN ──
export function initModels() {
  const dropdown = document.getElementById("modelDropdown");
  if (!dropdown) return;

  const groups = [
    { label: "⭐ Top Models", models: MODELS.top },
    { label: "⚡ Fast Models", models: MODELS.fast },
    { label: "🌐 Open Source", models: MODELS.open },
    { label: "👑 Premium", models: MODELS.premium },
  ];

  dropdown.innerHTML = groups.map(g => `
    <div class="model-group-label">${g.label}</div>
    ${g.models.map(m => `
      <div class="model-item${STATE.model === m.id ? " selected" : ""}"
           onclick="window.selectModel('${m.id}','${m.name}')">
        <span>${m.icon}</span>
        <span style="flex:1">${m.name}</span>
        <span class="mi-badge${m.premium ? " premium" : ""}">${m.badge}</span>
        <span class="mi-check">✓</span>
      </div>
    `).join("")}
  `).join("");

  // Set initial model name
  const el = document.getElementById("modelName");
  if (el) el.textContent = STATE.modelName;
}

// ── SELECT MODEL ──
window.selectModel = function(id, name) {
  STATE.model = id;
  STATE.modelName = name;
  const el = document.getElementById("modelName");
  if (el) el.textContent = name;

  // Update selected state in dropdown
  document.querySelectorAll(".model-item").forEach(item => {
    item.classList.toggle("selected", item.textContent.includes(name));
  });

  // Close dropdown
  document.getElementById("modelDropdown")?.classList.remove("open");

  // Save
  if (STATE.uid) {
    import("./firebase.js").then(m =>
      m.saveSettings(STATE.uid, { theme: STATE.theme, model: id, modelName: name })
    );
  }
};

// ── TOGGLE DROPDOWN ──
window.toggleModelDropdown = function() {
  document.getElementById("modelDropdown")?.classList.toggle("open");
};

// Close on outside click
document.addEventListener("click", e => {
  if (!e.target.closest(".model-selector-wrap")) {
    document.getElementById("modelDropdown")?.classList.remove("open");
  }
});

// ── CALL AI ──
export async function callAI(prompt, imageData = null) {
  if (typeof puter === "undefined") {
    throw new Error("Puter.js load नहीं हुआ");
  }

  // Models to try in order (fallback chain)
  const fallbackChain = [
    STATE.model,
    "claude-3-5-haiku",
    "gpt-4o-mini",
    "gemini-1.5-flash",
    "llama-3.1-8b"
  ];

  const tried = new Set();

  for (const modelId of fallbackChain) {
    if (tried.has(modelId)) continue;
    tried.add(modelId);

    try {
      let response;

      if (imageData) {
        // With image
        response = await puter.ai.chat([
          { role: "user", content: [
            { type: "image_url", image_url: { url: imageData } },
            { type: "text", text: prompt }
          ]}
        ], { model: modelId });
      } else {
        response = await puter.ai.chat(prompt, { model: modelId });
      }

      // Extract text
      const text = typeof response === "string" ? response :
        response?.message?.content?.[0]?.text ||
        response?.message?.content ||
        response?.text ||
        JSON.stringify(response);

      if (text) return text;

    } catch (e) {
      console.warn(`Model ${modelId} failed:`, e.message);
      // Continue to next model
    }
  }

  throw new Error("सभी AI models unavailable हैं। थोड़ी देर बाद try करें।");
}

// ── BUILD SYSTEM PROMPT ──
export function buildSystemPrompt(context = {}) {
  const connectedServices = Object.entries(STATE.tokens)
    .filter(([_, v]) => v)
    .map(([k]) => k)
    .join(", ") || "none";

  return `You are Dev.ai Studio, an expert AI coding assistant.

User: ${STATE.user?.username || "Developer"}
Model: ${STATE.modelName}
Connected services: ${connectedServices}
Project files: ${Object.keys(STATE.files || {}).join(", ")}

You help with:
- Writing complete, production-ready code
- Pushing code to GitHub
- Deploying to Vercel, Netlify, Render, Railway, Cloudflare
- Building APKs via Codemagic
- Explaining and debugging code

When generating code files, ALWAYS use this format:
// File: filename.ext
\`\`\`language
(complete code)
\`\`\`

Respond naturally in Hindi/English mix. Be concise but complete.
If a service token is missing, guide user to Settings (⚙) or use the 🔑 button.`;
     }
