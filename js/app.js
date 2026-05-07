// js/app.js
import { saveUser, loadTokens, saveTokens, loadSettings, saveSettings } from "./firebase.js";
import { initChat, sendMessage, newChat } from "./chat.js";
import { initModels } from "./ai.js";

// ── GLOBAL STATE ──
export const STATE = {
  user: null,           // Puter user object
  uid: null,            // Puter user UUID
  model: "claude-3-5-sonnet",
  modelName: "Claude 3.5 Sonnet",
  theme: "dark",
  sidebarOpen: false,   // closed by default
  tokens: {
    github: "", vercel: "", netlify: "",
    render: "", railway: "", cloudflare: "", codemagic: ""
  },
  github: { username: "", repo: "", branch: "main" },
  files: {
    "index.html": "<!DOCTYPE html>\n<html>\n<head>\n  <title>My App</title>\n</head>\n<body>\n  <h1>Hello World!</h1>\n</body>\n</html>",
    "style.css": "body {\n  font-family: sans-serif;\n  margin: 0;\n}",
    "app.js": "console.log('Hello from Dev.ai Studio!');"
  },
  activeFile: "index.html",
  chatId: null,
  chatHistory: [],
  puterReady: false
};

// ── INIT ──
window.addEventListener("load", async () => {
  // Apply saved theme from localStorage first (instant, no flash)
  const savedTheme = localStorage.getItem("devai_theme") || "dark";
  applyTheme(savedTheme, false);

  // Init models dropdown
  initModels();

  // Init chat
  initChat();

  // Try Puter login (silent)
  await initPuter();

  // Update badges
  updateBadges();

  console.log("Dev.ai Studio ready ✓");
});

// ── PUTER AUTH ──
async function initPuter() {
  try {
    if (typeof puter === "undefined") {
      console.warn("Puter.js not loaded");
      return;
    }

    STATE.puterReady = true;

    // Check if already signed in
    const isSignedIn = await puter.auth.isSignedIn();
    if (isSignedIn) {
      const user = await puter.auth.getUser();
      await onUserLoggedIn(user);
    }
  } catch (e) {
    console.warn("Puter init error:", e);
  }
}

async function onUserLoggedIn(user) {
  STATE.user = user;
  STATE.uid = user.uuid;

  // Update UI
  const userLabel = document.getElementById("userLabel");
  const userItem = document.getElementById("userItem");
  if (userLabel) userLabel.textContent = user.username || user.email || "Logged In";
  if (userItem) {
    const icon = userItem.querySelector(".item-icon");
    if (icon) icon.textContent = "✓";
  }

  // Save to Firebase
  await saveUser(user);

  // Load saved tokens from Firebase
  const savedTokens = await loadTokens(STATE.uid);
  if (savedTokens) STATE.tokens = { ...STATE.tokens, ...savedTokens };

  // Load settings
  const settings = await loadSettings(STATE.uid);
  if (settings?.theme) applyTheme(settings.theme);
  if (settings?.model) {
    STATE.model = settings.model;
    STATE.modelName = settings.modelName || STATE.modelName;
    const el = document.getElementById("modelName");
    if (el) el.textContent = STATE.modelName;
  }

  updateBadges();
}

export async function handleAuth() {
  if (!STATE.puterReady) {
    showToast("Puter.js load नहीं हुआ", "error");
    return;
  }
  try {
    if (STATE.user) {
      // Logout
      await puter.auth.signOut();
      STATE.user = null; STATE.uid = null;
      const userLabel = document.getElementById("userLabel");
      if (userLabel) userLabel.textContent = "Login with Puter";
      const icon = document.querySelector("#userItem .item-icon");
      if (icon) icon.textContent = "👤";
      showToast("Logged out", "success");
    } else {
      // Login
      const user = await puter.auth.signIn();
      await onUserLoggedIn(user);
      showToast(`Welcome, ${user.username || "User"}! ✓`, "success");
    }
  } catch (e) {
    showToast("Login failed: " + e.message, "error");
  }
}

// ── THEME ──
export function toggleTheme() {
  const newTheme = STATE.theme === "dark" ? "light" : "dark";
  applyTheme(newTheme);

  // Save
  if (STATE.uid) saveSettings(STATE.uid, { theme: newTheme, model: STATE.model, modelName: STATE.modelName });
}

function applyTheme(theme, save = true) {
  STATE.theme = theme;
  document.body.classList.remove("theme-dark", "theme-light");
  document.body.classList.add(`theme-${theme}`);

  const icon = document.getElementById("themeIcon");
  const label = document.getElementById("themeLabel");
  if (icon) icon.textContent = theme === "dark" ? "☀" : "🌙";
  if (label) label.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";

  if (save) localStorage.setItem("devai_theme", theme);
}

// ── SIDEBAR ──
export function toggleSidebar() {
  STATE.sidebarOpen = !STATE.sidebarOpen;
  const sb = document.getElementById("sidebar");
  if (sb) sb.classList.toggle("closed", !STATE.sidebarOpen);
}

// ── BADGES ──
export function updateBadges() {
  const services = ["github", "vercel", "netlify", "render", "railway", "cloudflare", "codemagic"];
  services.forEach(s => {
    const el = document.getElementById(`badge-${s}`);
    if (!el) return;
    const connected = !!STATE.tokens[s];
    el.textContent = connected ? "✓" : "—";
    el.classList.toggle("connected", connected);
  });
}

// ── TOKEN BAR ──
let tokenBarVisible = false;
export function toggleTokenBar() {
  tokenBarVisible = !tokenBarVisible;
  const bar = document.getElementById("tokenBar");
  if (bar) bar.classList.toggle("show", tokenBarVisible);
  if (tokenBarVisible) document.getElementById("inlineTokenInput")?.focus();
}

export function hideTokenBar() {
  tokenBarVisible = false;
  const bar = document.getElementById("tokenBar");
  if (bar) bar.classList.remove("show");
}

export function toggleTokenVisibility() {
  const inp = document.getElementById("inlineTokenInput");
  const eye = document.getElementById("tokenEye");
  if (!inp) return;
  if (inp.type === "password") { inp.type = "text"; if (eye) eye.textContent = "🙈"; }
  else { inp.type = "password"; if (eye) eye.textContent = "👁"; }
}

export async function saveInlineToken() {
  const val = document.getElementById("inlineTokenInput")?.value.trim();
  if (!val) return showToast("Token खाली है!", "error");

  // Auto-detect service
  let service = "github";
  if (val.startsWith("ghp_") || val.startsWith("github_pat_") || val.length === 40) service = "github";
  else if (val.startsWith("Bearer ") || val.length > 60) service = "vercel";

  STATE.tokens[service] = val;

  // Save to Firebase
  if (STATE.uid) await saveTokens(STATE.uid, STATE.tokens);
  else localStorage.setItem("devai_tokens", JSON.stringify(STATE.tokens));

  updateBadges();
  hideTokenBar();
  document.getElementById("inlineTokenInput").value = "";
  showToast(`✓ Token saved (${service})!`, "success");
}

// ── PLUS MENU ──
let plusMenuOpen = false;
export function togglePlusMenu() {
  plusMenuOpen = !plusMenuOpen;
  document.getElementById("plusMenu")?.classList.toggle("open", plusMenuOpen);
}

export function uploadImage() {
  plusMenuOpen = false;
  document.getElementById("plusMenu")?.classList.remove("open");
  document.getElementById("imageInput")?.click();
}
export function uploadFile() {
  plusMenuOpen = false;
  document.getElementById("plusMenu")?.classList.remove("open");
  document.getElementById("fileInput")?.click();
}
export function openCamera() {
  plusMenuOpen = false;
  document.getElementById("plusMenu")?.classList.remove("open");
  document.getElementById("cameraInput")?.click();
}

export function handleImageUpload(input) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    window._pendingImage = { data: e.target.result, name: file.name, type: file.type };
    showToast(`Image ready: ${file.name}`, "success");
    // Show preview near input
    const hint = document.querySelector(".input-hint");
    if (hint) hint.textContent = `📎 ${file.name} attached`;
  };
  reader.readAsDataURL(file);
}

export function handleFileUpload(input) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    window._pendingFile = { content: e.target.result, name: file.name };
    showToast(`File ready: ${file.name}`, "success");
    const hint = document.querySelector(".input-hint");
    if (hint) hint.textContent = `📎 ${file.name} attached`;
  };
  reader.readAsText(file);
}

// ── SETTINGS PANEL ──
export function openSettings(section = "general") {
  renderSettingsPanel(section);
  openPanel("settingsPanel");
}

function renderSettingsPanel(section) {
  const body = document.getElementById("settingsBody");
  if (!body) return;

  const navItems = [
    { id: "general", label: "⚙ General" },
    { id: "github", label: "🐙 GitHub" },
    { id: "vercel", label: "▲ Vercel" },
    { id: "netlify", label: "◆ Netlify" },
    { id: "render", label: "🟣 Render" },
    { id: "railway", label: "🚂 Railway" },
    { id: "cloudflare", label: "☁ Cloudflare" },
    { id: "codemagic", label: "🪄 APK" },
  ];

  const nav = navItems.map(n =>
    `<div class="snav-item${section === n.id ? " active" : ""}" onclick="window.appFns.openSettings('${n.id}')">${n.label}</div>`
  ).join("");

  body.innerHTML = `<div class="settings-nav">${nav}</div>${renderSection(section)}`;
}

function renderSection(s) {
  if (s === "general") return `
    <div class="settings-section">
      <div class="settings-section-title">Account</div>
      <div class="settings-card">
        <div class="settings-card-header">
          <div class="settings-card-title">${STATE.user ? `👤 ${STATE.user.username || "User"}` : "Not logged in"}</div>
          <button class="modal-btn${STATE.user ? " danger" : " primary"}" onclick="window.appFns.handleAuth()">
            ${STATE.user ? "Logout" : "Login with Puter"}
          </button>
        </div>
        <div class="settings-card-desc">Puter.js login — एक ही login से AI, storage सब free में।</div>
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-section-title">Theme</div>
      <div class="settings-card">
        <div class="settings-card-header">
          <div class="settings-card-title">Current: ${STATE.theme === "dark" ? "🌙 Dark" : "☀ Light"}</div>
          <button class="modal-btn primary" onclick="window.appFns.toggleTheme()">Switch Theme</button>
        </div>
      </div>
    </div>`;

  const serviceInfo = {
    github: {
      name: "GitHub", icon: "assets/logos/github.svg",
      help: "github.com → Settings → Developer Settings → Personal Access Tokens → Fine-grained → repo scope",
      placeholder: "ghp_xxxxxxxxxxxxxxxxxxxx",
      extra: `
        <div class="settings-card" style="margin-top:10px;">
          <div class="settings-section-title">Repository Details</div>
          <div class="modal-label">USERNAME</div>
          <input class="s-input" id="si_ghuser" placeholder="yourusername" value="${STATE.github.username}">
          <div class="modal-label" style="margin-top:8px;">REPO NAME</div>
          <input class="s-input" id="si_ghrepo" placeholder="my-project" value="${STATE.github.repo}">
          <div class="modal-label" style="margin-top:8px;">BRANCH</div>
          <input class="s-input" id="si_ghbranch" placeholder="main" value="${STATE.github.branch}">
          <button class="s-save" style="margin-top:10px;" onclick="window.appFns.saveGithubDetails()">Save Details</button>
        </div>`
    },
    vercel: { name: "Vercel", icon: "assets/logos/vercel.svg", help: "vercel.com → Settings → Tokens → Create", placeholder: "Bearer xxxxxxxxxxxxxxxx" },
    netlify: { name: "Netlify", icon: "assets/logos/netlify.svg", help: "app.netlify.com → User Settings → Applications → New access token", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxx" },
    render: { name: "Render", icon: "assets/logos/render.svg", help: "dashboard.render.com → Account Settings → API Keys", placeholder: "rnd_xxxxxxxxxxxxxx" },
    railway: { name: "Railway", icon: "assets/logos/railway.svg", help: "railway.app → Account Settings → Tokens", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
    cloudflare: { name: "Cloudflare Pages", icon: "assets/logos/cloudflare.svg", help: "dash.cloudflare.com → My Profile → API Tokens → Create Token", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" },
    codemagic: { name: "Codemagic (APK Build)", icon: "assets/logos/codemagic.svg", help: "codemagic.io → Teams → Integrations → API Keys", placeholder: "CM API Key" },
  };

  const info = serviceInfo[s];
  if (!info) return "";
  const connected = !!STATE.tokens[s];

  return `
    <div class="settings-section">
      <div class="settings-section-title">${info.name}</div>
      <div class="settings-card">
        <div class="settings-card-header">
          <div class="settings-card-title" style="display:flex;align-items:center;gap:8px;">
            <img src="${info.icon}" style="width:18px;height:18px;object-fit:contain;">
            API Token
          </div>
          <span class="${connected ? "connected-badge" : "disconnected-badge"}">${connected ? "✓ Connected" : "✗ Not Set"}</span>
        </div>
        <div class="settings-card-desc">${info.help}</div>
        <div class="s-input-row">
          <input class="s-input" id="si_${s}" type="password" placeholder="${info.placeholder}" value="${STATE.tokens[s]}" style="flex:1;">
          <button class="s-eye" onclick="window.appFns.toggleSI('si_${s}',this)">👁</button>
          <button class="s-save" onclick="window.appFns.saveSI('${s}','si_${s}')">Save</button>
        </div>
      </div>
      ${info.extra || ""}
    </div>`;
}

// ── PANELS ──
export function openPanel(id) {
  closePanel(false);
  document.getElementById("panelOverlay")?.classList.add("open");
  document.getElementById(id)?.classList.add("open");
}

export function closePanel(save = true) {
  document.getElementById("panelOverlay")?.classList.remove("open");
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("open"));
}

// ── EDITOR ──
export function openEditor() {
  import("./editor.js").then(m => m.openEditorPanel());
}
export function openTerminal() {
  openPanel("terminalPanel");
}
export function saveAllFiles() {
  import("./editor.js").then(m => m.saveAllFiles());
}
export function pushToGithub() {
  import("./github.js").then(m => m.pushToGithub());
}

// ── TOAST ──
export function showToast(msg, type = "") {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.className = `toast show ${type}`;
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => t.className = "toast", 2800);
}

// ── SETTINGS HELPERS ──
export function toggleSI(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  inp.type = inp.type === "password" ? "text" : "password";
  btn.textContent = inp.type === "password" ? "👁" : "🙈";
}

export async function saveSI(key, inputId) {
  const val = document.getElementById(inputId)?.value.trim() || "";
  STATE.tokens[key] = val;
  if (STATE.uid) await saveTokens(STATE.uid, STATE.tokens);
  else localStorage.setItem("devai_tokens", JSON.stringify(STATE.tokens));
  updateBadges();
  showToast(`✓ ${key} token saved!`, "success");
  openSettings(key);
}

export function saveGithubDetails() {
  STATE.github.username = document.getElementById("si_ghuser")?.value.trim() || "";
  STATE.github.repo = document.getElementById("si_ghrepo")?.value.trim() || "";
  STATE.github.branch = document.getElementById("si_ghbranch")?.value.trim() || "main";
  localStorage.setItem("devai_github", JSON.stringify(STATE.github));
  showToast("✓ GitHub details saved!", "success");
}

// ── EXPOSE to HTML onclick ──
window.appFns = {
  toggleSidebar, toggleTheme, handleAuth,
  openSettings, closePanel, openEditor, openTerminal,
  toggleTokenBar, hideTokenBar, toggleTokenVisibility, saveInlineToken,
  togglePlusMenu, uploadImage, uploadFile, openCamera,
  handleImageUpload, handleFileUpload,
  saveSI, toggleSI, saveGithubDetails,
  saveAllFiles, pushToGithub, newChat, sendMessage
};

// Also expose directly for inline HTML onclick
Object.assign(window, window.appFns);
    
