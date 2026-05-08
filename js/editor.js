// js/editor.js
import { STATE, showToast } from "./app.js";
import { openPanel } from "./app.js";

// ── OPEN EDITOR PANEL ──
export function openEditorPanel() {
  renderTabs();
  updateContent();
  openPanel("editorPanel");
  setupEditorEvents();
}

// ── TABS ──
function renderTabs() {
  const bar = document.getElementById("editorTabsBar");
  if (!bar) return;

  bar.innerHTML = Object.keys(STATE.files).map(f => `
    <div class="etab${f === STATE.activeFile ? " active" : ""}" onclick="window.switchTab('${f}')">
      ${getIcon(f)} ${f}
      <span class="etab-close" onclick="window.deleteTab('${f}', event)">×</span>
    </div>
  `).join("") + `<div class="etab-new" onclick="window.newEditorFile()">＋</div>`;
}

function getIcon(name) {
  if (name.endsWith(".html")) return "🌐";
  if (name.endsWith(".css")) return "🎨";
  if (name.endsWith(".js") || name.endsWith(".jsx")) return "📜";
  if (name.endsWith(".ts") || name.endsWith(".tsx")) return "🔷";
  if (name.endsWith(".py")) return "🐍";
  if (name.endsWith(".json")) return "{}";
  if (name.endsWith(".md")) return "📝";
  return "📄";
}

// ── CONTENT ──
function updateContent() {
  const ed = document.getElementById("codeEditor");
  if (!ed) return;
  ed.value = STATE.files[STATE.activeFile] || "";
  updateLineNums();
  updateStatus();
}

function updateLineNums() {
  const ed = document.getElementById("codeEditor");
  const nums = document.getElementById("lineNums");
  if (!ed || !nums) return;
  const count = (ed.value.match(/\n/g) || []).length + 1;
  nums.innerHTML = Array.from({ length: count }, (_, i) => i + 1).join("<br>");
}

function updateStatus() {
  const ed = document.getElementById("codeEditor");
  if (!ed) return;
  const lines = ed.value.substr(0, ed.selectionStart).split("\n");
  const cursor = document.getElementById("editorCursor");
  const lang = document.getElementById("editorLang");
  if (cursor) cursor.textContent = `Ln ${lines.length}, Col ${lines[lines.length - 1].length + 1}`;
  if (lang) {
    const ext = STATE.activeFile.split(".").pop();
    const map = { js: "JavaScript", jsx: "React JSX", ts: "TypeScript", tsx: "React TSX", html: "HTML", css: "CSS", py: "Python", json: "JSON", md: "Markdown" };
    lang.textContent = map[ext] || ext.toUpperCase();
  }
}

// ── EVENTS ──
function setupEditorEvents() {
  const ed = document.getElementById("codeEditor");
  if (!ed || ed._eventsSet) return;
  ed._eventsSet = true;

  ed.addEventListener("input", () => {
    STATE.files[STATE.activeFile] = ed.value;
    updateLineNums();
  });

  ed.addEventListener("keydown", e => {
    if (e.key === "Tab") {
      e.preventDefault();
      const s = ed.selectionStart;
      ed.value = ed.value.substring(0, s) + "  " + ed.value.substring(ed.selectionEnd);
      ed.selectionStart = ed.selectionEnd = s + 2;
    }
    if (e.ctrlKey && e.key === "s") {
      e.preventDefault();
      saveAllFiles();
    }
  });

  ed.addEventListener("keyup", updateStatus);
  ed.addEventListener("click", updateStatus);
  ed.addEventListener("scroll", () => {
    const nums = document.getElementById("lineNums");
    if (nums) nums.scrollTop = ed.scrollTop;
  });
}

// ── TAB ACTIONS ──
window.switchTab = function (fname) {
  const ed = document.getElementById("codeEditor");
  if (ed) STATE.files[STATE.activeFile] = ed.value;
  STATE.activeFile = fname;
  renderTabs();
  updateContent();
};

window.deleteTab = function (fname, e) {
  e.stopPropagation();
  if (Object.keys(STATE.files).length <= 1) {
    showToast("Last file delete नहीं हो सकता!", "error");
    return;
  }
  delete STATE.files[fname];
  if (STATE.activeFile === fname) STATE.activeFile = Object.keys(STATE.files)[0];
  renderTabs();
  updateContent();
};

window.newEditorFile = function () {
  const name = prompt("File name (e.g. app.js, style.css):");
  if (!name?.trim()) return;
  STATE.files[name.trim()] = "";
  STATE.activeFile = name.trim();
  renderTabs();
  updateContent();
};

// ── SAVE ALL ──
export function saveAllFiles() {
  const ed = document.getElementById("codeEditor");
  if (ed) STATE.files[STATE.activeFile] = ed.value;
  showToast("✓ All files saved!", "success");

  // Save to Firebase
  if (STATE.uid) {
    import("./firebase.js").then(m =>
      m.saveProjectFiles(STATE.uid, "default", STATE.files)
    );
  }
}

// ── REFRESH (called when AI creates files) ──
export function refreshEditor() {
  const panel = document.getElementById("editorPanel");
  if (panel?.classList.contains("open")) {
    renderTabs();
    updateContent();
  }
                                               }
    
