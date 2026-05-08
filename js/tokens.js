// js/tokens.js
import { STATE, showToast, updateBadges } from "./app.js";
import { saveTokens, loadTokens } from "./firebase.js";

// ── SIMPLE ENCRYPT (XOR + base64) ──
function encrypt(text, key = "devai2024") {
  let result = "";
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(unescape(encodeURIComponent(result)));
}

function decrypt(encoded, key = "devai2024") {
  try {
    const text = decodeURIComponent(escape(atob(encoded)));
    let result = "";
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch (e) {
    return encoded; // fallback
  }
}

// ── SAVE TOKEN ──
export async function saveToken(service, value) {
  if (!value) return;
  STATE.tokens[service] = value;

  // Encrypt locally
  const encrypted = {};
  for (const [k, v] of Object.entries(STATE.tokens)) {
    encrypted[k] = v ? encrypt(v) : "";
  }
  localStorage.setItem("devai_tokens_enc", JSON.stringify(encrypted));

  // Also save to Firebase if logged in
  if (STATE.uid) {
    await saveTokens(STATE.uid, STATE.tokens);
  }

  updateBadges();
  showToast(`✓ ${service} token saved!`, "success");
}

// ── LOAD TOKENS ──
export async function loadAllTokens() {
  // Try Firebase first
  if (STATE.uid) {
    const fbTokens = await loadTokens(STATE.uid);
    if (fbTokens && Object.keys(fbTokens).length > 0) {
      STATE.tokens = { ...STATE.tokens, ...fbTokens };
      updateBadges();
      return;
    }
  }

  // Fallback to localStorage
  try {
    const enc = localStorage.getItem("devai_tokens_enc");
    if (enc) {
      const encrypted = JSON.parse(enc);
      for (const [k, v] of Object.entries(encrypted)) {
        STATE.tokens[k] = v ? decrypt(v) : "";
      }
      updateBadges();
    }
  } catch (e) {
    console.warn("Token load error:", e);
  }
}

// ── DETECT TOKEN TYPE ──
export function detectTokenService(token) {
  if (!token) return "github";
  if (token.startsWith("ghp_") || token.startsWith("github_pat_")) return "github";
  if (token.length === 40 && /^[a-f0-9]+$/i.test(token)) return "github";
  if (token.startsWith("Bearer ")) return "vercel";
  if (token.length > 30 && token.includes("-")) return "railway";
  return "github"; // default
}

// ── SHOW TOKEN POPUP IN CHAT ──
export function showTokenPopupInChat(service = null) {
  const messages = document.getElementById("messages");
  if (!messages) return;

  const services = [
    { id: "github", label: "GitHub", logo: "assets/logos/github.svg" },
    { id: "vercel", label: "Vercel", logo: "assets/logos/vercel.svg" },
    { id: "netlify", label: "Netlify", logo: "assets/logos/netlify.svg" },
    { id: "render", label: "Render", logo: "assets/logos/render.svg" },
    { id: "railway", label: "Railway", logo: "assets/logos/railway.svg" },
    { id: "cloudflare", label: "Cloudflare", logo: "assets/logos/cloudflare.svg" },
    { id: "codemagic", label: "Codemagic", logo: "assets/logos/codemagic.svg" },
  ];

  const activeService = service || "github";

  const row = document.createElement("div");
  row.className = "msg-row ai";
  row.id = "token-popup-row";
  row.innerHTML = `
    <div class="msg-avatar">⚡</div>
    <div class="msg-body" style="max-width:90%">
      <div class="msg-name">DEV.AI</div>
      <div class="msg-bubble chat-token-popup">
        <div class="chat-token-popup-title">🔑 Token Add करो</div>
        <div class="chat-token-popup-desc">Service select करो और token paste करो:</div>
        <div class="ctp-service-tabs" id="ctpTabs">
          ${services.map(s => `
            <div class="ctp-tab${s.id === activeService ? " active" : ""}"
                 onclick="window.ctpSelectService('${s.id}')">
              <img src="${s.logo}" style="width:13px;height:13px;object-fit:contain;">
              ${s.label}
            </div>
          `).join("")}
        </div>
        <div style="display:flex;gap:6px;margin-bottom:10px;">
          <input class="token-input" id="ctpInput" type="password"
                 placeholder="Token paste करो..."
                 style="flex:1;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px 10px;font-family:'DM Mono',monospace;font-size:12px;outline:none;">
          <button class="token-eye" onclick="window.ctpToggleEye()" id="ctpEye"
                  style="width:36px;height:36px;border-radius:8px;background:var(--surface2);border:1px solid var(--border);color:var(--text2);cursor:pointer;display:flex;align-items:center;justify-content:center;">👁</button>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="msg-action-btn primary" onclick="window.ctpSave()">✓ Save Token</button>
          <button class="msg-action-btn" onclick="document.getElementById('token-popup-row').remove()">Cancel</button>
        </div>
      </div>
    </div>`;

  messages.appendChild(row);
  document.getElementById("chatArea").scrollTop = document.getElementById("chatArea").scrollHeight;

  // Focus input
  setTimeout(() => document.getElementById("ctpInput")?.focus(), 100);
}

// ── POPUP HELPERS ──
let ctpActiveService = "github";

window.ctpSelectService = function(service) {
  ctpActiveService = service;
  document.querySelectorAll(".ctp-tab").forEach(t => {
    t.classList.toggle("active", t.textContent.trim().toLowerCase().includes(service));
  });
};

window.ctpToggleEye = function() {
  const inp = document.getElementById("ctpInput");
  const eye = document.getElementById("ctpEye");
  if (!inp) return;
  inp.type = inp.type === "password" ? "text" : "password";
  if (eye) eye.textContent = inp.type === "password" ? "👁" : "🙈";
};

window.ctpSave = async function() {
  const val = document.getElementById("ctpInput")?.value.trim();
  if (!val) { showToast("Token खाली है!", "error"); return; }
  await saveToken(ctpActiveService, val);
  document.getElementById("token-popup-row")?.remove();

  // Confirm in chat
  import("./chat.js").then(m =>
    m.addAIMessage(`✅ **${ctpActiveService} token saved!**\n\nअब आप ${ctpActiveService} operations कर सकते हो।`)
  );
};
                 
