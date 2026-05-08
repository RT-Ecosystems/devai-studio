// js/deploy.js
import { STATE, showToast } from "./app.js";
import { addAIMessage } from "./chat.js";

// ── OPEN DEPLOY MODAL ──
export function openDeployModal() {
  const connected = Object.entries(STATE.tokens)
    .filter(([k, v]) => ["vercel","netlify","render","railway","cloudflare"].includes(k) && v)
    .map(([k]) => k);

  if (connected.length === 0) {
    addAIMessage(`🚀 **Deploy करने के लिए पहले एक service connect करो:**

- **▲ Vercel** — ☰ → Settings → Vercel
- **◆ Netlify** — ☰ → Settings → Netlify  
- **🟣 Render** — ☰ → Settings → Render
- **🚂 Railway** — ☰ → Settings → Railway
- **☁ Cloudflare** — ☰ → Settings → Cloudflare

Token add करने के बाद वापस deploy command दो।`);
    return;
  }

  // Show deploy options in chat
  addAIMessage(`🚀 **Deploy करो — कहाँ?**

Connected services: ${connected.map(c => serviceNames[c]).join(", ")}

नीचे service select करो:`);

  // Add service buttons
  const messages = document.getElementById("messages");
  if (!messages) return;

  const row = document.createElement("div");
  row.className = "msg-row ai";
  row.innerHTML = `
    <div class="msg-avatar">⚡</div>
    <div class="msg-body">
      <div class="msg-name">DEV.AI</div>
      <div class="msg-bubble">
        <div class="msg-actions" style="flex-wrap:wrap;">
          ${connected.map(s => `
            <button class="msg-action-btn primary" onclick="window.deployTo('${s}')">
              ${serviceIcons[s]} Deploy to ${serviceNames[s]}
            </button>
          `).join("")}
        </div>
      </div>
    </div>`;
  messages.appendChild(row);
}

const serviceNames = {
  vercel: "Vercel", netlify: "Netlify",
  render: "Render", railway: "Railway", cloudflare: "Cloudflare"
};
const serviceIcons = {
  vercel: "▲", netlify: "◆",
  render: "🟣", railway: "🚂", cloudflare: "☁"
};

// ── DEPLOY TO SERVICE ──
window.deployTo = async function(service) {
  const token = STATE.tokens[service];
  if (!token) {
    showToast(`${serviceNames[service]} token नहीं है!`, "error");
    return;
  }

  termLog(`🚀 Deploying to ${serviceNames[service]}...`, "info");
  showToast(`Deploying to ${serviceNames[service]}...`);

  try {
    let result;
    if (service === "vercel") result = await deployVercel(token);
    else if (service === "netlify") result = await deployNetlify(token);
    else if (service === "render") result = await guideRender();
    else if (service === "railway") result = await guideRailway();
    else if (service === "cloudflare") result = await guideCloudflare();

    if (result?.url) {
      showDeploySuccess(service, result.url);
    }
  } catch (e) {
    showToast(`Deploy failed: ${e.message}`, "error");
    termLog(`✗ Deploy failed: ${e.message}`, "error");
  }
};

// ── VERCEL DEPLOY ──
async function deployVercel(token) {
  // Save current editor content
  const editor = document.getElementById("codeEditor");
  if (editor) STATE.files[STATE.activeFile] = editor.value;

  const files = {};
  for (const [name, content] of Object.entries(STATE.files)) {
    files[name] = { file: name, data: content };
  }

  const payload = {
    name: STATE.projectName || "devai-project",
    files: Object.entries(STATE.files).map(([name, content]) => ({
      file: name,
      data: content
    })),
    projectSettings: { framework: null }
  };

  const res = await fetch("https://api.vercel.com/v13/deployments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (res.ok && data.url) {
    termLog(`✓ Vercel URL: https://${data.url}`, "success");
    return { url: `https://${data.url}` };
  } else {
    throw new Error(data.error?.message || "Vercel deploy failed");
  }
}

// ── NETLIFY DEPLOY ──
async function deployNetlify(token) {
  const editor = document.getElementById("codeEditor");
  if (editor) STATE.files[STATE.activeFile] = editor.value;

  // Create site first
  const siteRes = await fetch("https://api.netlify.com/api/v1/sites", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name: `devai-${Date.now()}` })
  });

  const site = await siteRes.json();
  if (!siteRes.ok) throw new Error(site.message || "Netlify site creation failed");

  // Create zip from files
  const formData = new FormData();
  const files = {};
  for (const [name, content] of Object.entries(STATE.files)) {
    files[`/${name}`] = content;
  }

  // Deploy via file digest
  const deployRes = await fetch(`https://api.netlify.com/api/v1/sites/${site.id}/deploys`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/zip"
    },
    body: await createZipBlob(STATE.files)
  });

  const deploy = await deployRes.json();
  if (deployRes.ok) {
    const url = `https://${site.name}.netlify.app`;
    termLog(`✓ Netlify URL: ${url}`, "success");
    return { url };
  } else {
    throw new Error(deploy.message || "Netlify deploy failed");
  }
}

// ── CREATE ZIP (simple, no library) ──
async function createZipBlob(files) {
  // Simple approach: send HTML file as zip
  // For production use JSZip library
  const htmlContent = files["index.html"] || Object.values(files)[0] || "";
  return new Blob([htmlContent], { type: "application/zip" });
}

// ── GUIDED DEPLOYS ──
async function guideRender() {
  addAIMessage(`🟣 **Render Deploy:**

1. dashboard.render.com पर जाओ
2. **New → Static Site** click करो
3. GitHub repo connect करो: **${STATE.github.username}/${STATE.github.repo}**
4. Build command: (खाली छोड़ो)
5. Publish directory: **.** (dot)
6. **Create Static Site** click करो

🔗 URL automatically मिलेगा: \`your-app.onrender.com\``);
  return null;
}

async function guideRailway() {
  addAIMessage(`🚂 **Railway Deploy:**

1. railway.app पर जाओ
2. **New Project → Deploy from GitHub** click करो
3. Repo select करो: **${STATE.github.username}/${STATE.github.repo}**
4. Railway automatically detect करेगा और deploy करेगा

🔗 URL मिलेगा: \`your-app.railway.app\``);
  return null;
}

async function guideCloudflare() {
  addAIMessage(`☁ **Cloudflare Pages Deploy:**

1. dash.cloudflare.com → **Pages** → **Create a project**
2. GitHub connect करो
3. Repo select करो: **${STATE.github.username}/${STATE.github.repo}**
4. Framework: **None**
5. **Save and Deploy** click करो

🔗 URL मिलेगा: \`your-app.pages.dev\``);
  return null;
}

// ── SHOW SUCCESS ──
function showDeploySuccess(service, url) {
  showToast(`✓ Deployed! ${url}`, "success");
  addAIMessage(`✅ **${serviceNames[service]} पर deploy हो गया!**

🔗 **Live URL:** ${url}

URL copy करने के लिए नीचे button click करो:`);

  // Add copy button
  const messages = document.getElementById("messages");
  const last = messages?.lastElementChild?.querySelector(".msg-bubble");
  if (last) {
    const btn = document.createElement("button");
    btn.className = "msg-action-btn primary";
    btn.textContent = "🔗 Copy URL";
    btn.onclick = () => {
      navigator.clipboard.writeText(url).then(() => showToast("URL copied!", "success"));
    };
    const actDiv = document.createElement("div");
    actDiv.className = "msg-actions";
    actDiv.style.marginTop = "10px";
    actDiv.appendChild(btn);
    last.appendChild(actDiv);
  }
}

// ── TERMINAL ──
function termLog(msg, type = "") {
  const t = document.getElementById("terminalBody");
  if (!t) return;
  const colors = { info: "var(--accent)", success: "var(--green)", warn: "var(--yellow)", error: "var(--red)" };
  t.innerHTML += `<span style="color:${colors[type] || "#a3e635"}">${msg}</span><br>`;
  t.scrollTop = t.scrollHeight;
           }
