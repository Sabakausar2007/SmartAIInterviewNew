/**
 * common.js - toasts, confirm modal, app shell (sidebar+topbar), auth guards.
 */
function ensureToastContainer() {
  let el = document.getElementById("toast-container");
  if (!el) { el = document.createElement("div"); el.id = "toast-container"; document.body.appendChild(el); }
  return el;
}
function showToast(message, type = "info", duration = 4200) {
  const container = ensureToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const icon = type === "success" ? "fa-circle-check" : type === "error" ? "fa-circle-exclamation" : "fa-circle-info";
  toast.innerHTML = `<i class="fa-solid ${icon}" style="margin-top:2px;color:${type === "success" ? "#4ADE80" : type === "error" ? "#F87171" : "#60A5FA"}"></i><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.transition = "opacity 0.25s ease"; toast.style.opacity = "0"; setTimeout(() => toast.remove(), 250); }, duration);
}
function escapeHtml(str) { const d = document.createElement("div"); d.textContent = str == null ? "" : String(str); return d.innerHTML; }

function ensureModalRoot() {
  let el = document.getElementById("confirm-modal-root");
  if (!el) {
    el = document.createElement("div"); el.id = "confirm-modal-root"; el.className = "modal-backdrop";
    el.innerHTML = `<div class="modal"><h3 id="confirm-modal-title">Are you sure?</h3><p id="confirm-modal-body">This action cannot be undone.</p>
      <div class="modal-actions"><button class="btn btn-secondary" id="confirm-modal-cancel">Cancel</button><button class="btn btn-danger" id="confirm-modal-ok">Confirm</button></div></div>`;
    document.body.appendChild(el);
  }
  return el;
}
function confirmModal({ title = "Are you sure?", body = "This action cannot be undone.", okLabel = "Confirm", danger = true } = {}) {
  return new Promise((resolve) => {
    const root = ensureModalRoot();
    root.querySelector("#confirm-modal-title").textContent = title;
    root.querySelector("#confirm-modal-body").textContent = body;
    const okBtn = root.querySelector("#confirm-modal-ok"), cancelBtn = root.querySelector("#confirm-modal-cancel");
    okBtn.textContent = okLabel; okBtn.className = danger ? "btn btn-danger" : "btn btn-primary";
    root.classList.add("show");
    const cleanup = (r) => { root.classList.remove("show"); okBtn.onclick = null; cancelBtn.onclick = null; resolve(r); };
    okBtn.onclick = () => cleanup(true); cancelBtn.onclick = () => cleanup(false);
    root.onclick = (e) => { if (e.target === root) cleanup(false); };
  });
}

function isLoggedIn() { return Boolean(AuthStore.getToken()); }
function redirectIfLoggedIn(dest = "dashboard.html") { if (isLoggedIn()) window.location.href = dest; }

async function requireAuth() {
  if (!isLoggedIn()) { window.location.href = "login.html"; return null; }
  try {
    const user = await API.me();
    AuthStore.setStoredUser(user);
    return user;
  } catch (e) { window.location.href = "login.html"; return null; }
}
async function requireAdmin() {
  const user = await requireAuth();
  if (user && !user.is_admin) { showToast("Admin access required.", "error"); window.location.href = "dashboard.html"; return null; }
  return user;
}
function logout() { AuthStore.clearToken(); window.location.href = "index.html"; }

const SIDEBAR_LINKS = [
  { href: "dashboard.html", icon: "fa-grid-2", label: "Dashboard" },
  { href: "mock-interview.html", icon: "fa-comments", label: "Mock Interview" },
  { href: "resume.html", icon: "fa-file-lines", label: "Resume Analyzer" },
  { href: "practice.html", icon: "fa-list-check", label: "Practice Interview" },
  { href: "question-bank.html", icon: "fa-layer-group", label: "Question Bank" },
  { href: "coding-practice.html", icon: "fa-code", label: "Coding Practice" },
  { href: "performance.html", icon: "fa-chart-line", label: "Result & Progress" },
  { href: "profile.html", icon: "fa-user", label: "My Profile" },
  { href: "settings.html", icon: "fa-gear", label: "Settings" },
];

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || name[0].toUpperCase();
}

function buildAppShell(pageTitle) {
  const shell = document.getElementById("app-shell-root");
  if (!shell) return;
  const currentPage = window.location.pathname.split("/").pop();
  const links = SIDEBAR_LINKS.map((l) => `<a href="${l.href}" class="${currentPage === l.href ? "active" : ""}"><i class="fa-solid ${l.icon}"></i>${l.label}</a>`).join("");

  shell.innerHTML = `
    <div class="sidebar-overlay" id="sidebar-overlay"></div>
    <aside class="sidebar" id="app-sidebar">
      <div class="brand"><span class="brand-mark"><i class="fa-solid fa-brain"></i></span>Smart AI<br>Interview</div>
      <nav class="sidebar-nav">
        ${links}
        <a href="#" id="logout-link" style="margin-top:14px;border-top:1px solid var(--border);padding-top:16px;"><i class="fa-solid fa-right-from-bracket"></i>Logout</a>
      </nav>
      <div class="sidebar-foot">
        <div class="user-chip"><div class="avatar" id="shell-avatar">--</div><div><div class="name" id="shell-username">Loading…</div><div class="email" id="shell-email"></div></div></div>
      </div>
    </aside>
    <div class="main-area">
      <div class="topbar">
        <div class="flex gap-16" style="align-items:center;"><button class="sidebar-toggle" id="sidebar-toggle"><i class="fa-solid fa-bars"></i></button><h1>${pageTitle || ""}</h1></div>
        <div class="flex gap-12" style="align-items:center;"><span class="badge badge-amber" id="shell-mode-badge" style="display:none;"><i class="fa-solid fa-flask"></i> Demo Mode</span></div>
      </div>
      <div class="page-content" id="page-content"></div>
    </div>`;

  document.getElementById("logout-link").addEventListener("click", (e) => { e.preventDefault(); logout(); });
  const toggle = document.getElementById("sidebar-toggle"), overlay = document.getElementById("sidebar-overlay"), sidebar = document.getElementById("app-sidebar");
  toggle.addEventListener("click", () => { sidebar.classList.toggle("open"); overlay.classList.toggle("show"); });
  overlay.addEventListener("click", () => { sidebar.classList.remove("open"); overlay.classList.remove("show"); });

  const user = AuthStore.getStoredUser();
  if (user) fillShellUser(user);
  API.health().then((h) => { if (h.ai_mode === "fallback") document.getElementById("shell-mode-badge").style.display = "inline-flex"; }).catch(() => {});

  mountAiAssistant();
}

/* =========================================================================
   Robot avatar component - one consistent inline SVG, recolored per module
   so every page shares the same visual identity.
   ========================================================================= */
function robotAvatarSVG(size = 96, accentColor = "#3B82F6") {
  const gid = "robotGrad" + Math.random().toString(36).slice(2, 8);
  return `
  <div class="robot-avatar" style="width:${size}px;height:${size}px;">
    <svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${accentColor}" />
          <stop offset="100%" stop-color="#A855F7" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="46" fill="url(#${gid})" opacity="0.12" />
      <rect x="28" y="4" width="6" height="14" rx="3" fill="url(#${gid})" />
      <circle cx="31" cy="4" r="5" fill="${accentColor}" />
      <rect x="22" y="26" width="56" height="46" rx="16" fill="#0F1526" stroke="url(#${gid})" stroke-width="2.5" />
      <rect x="32" y="40" width="14" height="12" rx="6" fill="url(#${gid})" />
      <rect x="54" y="40" width="14" height="12" rx="6" fill="url(#${gid})" />
      <rect x="38" y="58" width="24" height="5" rx="2.5" fill="url(#${gid})" opacity="0.7" />
      <rect x="10" y="42" width="10" height="22" rx="5" fill="#0F1526" stroke="url(#${gid})" stroke-width="2" />
      <rect x="80" y="42" width="10" height="22" rx="5" fill="#0F1526" stroke="url(#${gid})" stroke-width="2" />
    </svg>
  </div>`;
}
window.robotAvatarSVG = robotAvatarSVG;

/* =========================================================================
   Floating "Ask AI" assistant - added once per authenticated page.
   ========================================================================= */
function mountAiAssistant() {
  if (document.getElementById("ai-assistant-fab")) return;

  const fab = document.createElement("button");
  fab.id = "ai-assistant-fab";
  fab.innerHTML = `<i class="fa-solid fa-robot"></i>`;
  fab.title = "Ask AI";
  document.body.appendChild(fab);

  const panel = document.createElement("div");
  panel.id = "ai-assistant-panel";
  panel.innerHTML = `
    <div class="ai-panel-header">
      ${robotAvatarSVG(40, "#22D3EE")}
      <div><h4>AI Assistant</h4><p>Ask about interviews, topics, or your results</p></div>
      <button class="ai-panel-close" id="ai-panel-close"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div id="ai-chat-log">
      <div class="ai-msg bot">Hi! I'm your AI Assistant. Ask me anything about interview prep, a topic like SQL or OOP, your resume, or your last score.</div>
    </div>
    <div class="ai-panel-suggestions">
      <span class="ai-suggestion-chip">Explain OOP</span>
      <span class="ai-suggestion-chip">Improve my resume</span>
      <span class="ai-suggestion-chip">Give me SQL questions</span>
      <span class="ai-suggestion-chip">Why is my score low?</span>
    </div>
    <div class="ai-panel-input">
      <input type="text" id="ai-chat-input" placeholder="Type your question…" />
      <button id="ai-chat-send"><i class="fa-solid fa-paper-plane"></i></button>
    </div>`;
  document.body.appendChild(panel);

  fab.addEventListener("click", () => panel.classList.toggle("show"));
  document.getElementById("ai-panel-close").addEventListener("click", () => panel.classList.remove("show"));

  const input = document.getElementById("ai-chat-input");
  const send = () => sendAssistantMessage(input.value.trim());
  document.getElementById("ai-chat-send").addEventListener("click", send);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
  document.querySelectorAll(".ai-suggestion-chip").forEach((chip) => {
    chip.addEventListener("click", () => sendAssistantMessage(chip.textContent));
  });
}

async function sendAssistantMessage(message) {
  if (!message) return;
  const log = document.getElementById("ai-chat-log");
  const input = document.getElementById("ai-chat-input");
  input.value = "";

  log.innerHTML += `<div class="ai-msg user">${escapeHtml(message)}</div>`;
  const thinkingId = "thinking-" + Date.now();
  log.innerHTML += `<div class="ai-msg bot" id="${thinkingId}"><span class="spinner" style="width:14px;height:14px;border-width:2px;vertical-align:-2px;"></span> Thinking…</div>`;
  log.scrollTop = log.scrollHeight;

  try {
    const result = await API.askAssistant(message);
    document.getElementById(thinkingId).innerHTML = escapeHtml(result.reply) + (result.is_demo ? ` <span class="badge badge-amber" style="margin-left:6px;"><i class="fa-solid fa-flask"></i> Demo</span>` : "");
  } catch (err) {
    document.getElementById(thinkingId).textContent = "Sorry, I couldn't reach the assistant right now. Please try again.";
  }
  log.scrollTop = log.scrollHeight;
}

function fillShellUser(user) {
  const n = document.getElementById("shell-username"), e = document.getElementById("shell-email"), a = document.getElementById("shell-avatar");
  if (n) n.textContent = user.full_name || "User";
  if (e) e.textContent = user.email || "";
  if (a) a.textContent = initials(user.full_name);
}

function formatDate(iso) { if (!iso) return "—"; const d = new Date(iso); return isNaN(d) ? "—" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
function formatDateTime(iso) { if (!iso) return "—"; const d = new Date(iso); return isNaN(d) ? "—" : d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
function scoreBadge(score) { const s = Math.round(score || 0); if (s >= 75) return `<span class="badge badge-green">${s}%</span>`; if (s >= 50) return `<span class="badge badge-amber">${s}%</span>`; return `<span class="badge badge-red">${s}%</span>`; }
function statusBadge(status) { return status === "completed" ? `<span class="badge badge-green">Completed</span>` : `<span class="badge badge-amber">In progress</span>`; }
function formatSeconds(t) { const m = Math.floor(t / 60), s = t % 60; return `${m}:${String(s).padStart(2, "0")}`; }
function demoBanner(text) { return `<div class="demo-banner mb-16"><i class="fa-solid fa-flask"></i> ${escapeHtml(text)}</div>`; }

window.showToast = showToast; window.confirmModal = confirmModal; window.isLoggedIn = isLoggedIn;
window.redirectIfLoggedIn = redirectIfLoggedIn; window.requireAuth = requireAuth; window.requireAdmin = requireAdmin;
window.logout = logout; window.buildAppShell = buildAppShell; window.fillShellUser = fillShellUser;
window.formatDate = formatDate; window.formatDateTime = formatDateTime; window.scoreBadge = scoreBadge;
window.statusBadge = statusBadge; window.formatSeconds = formatSeconds; window.escapeHtml = escapeHtml;
window.demoBanner = demoBanner; window.initials = initials;
