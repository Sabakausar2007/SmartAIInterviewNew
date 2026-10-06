/**
 * admin.js
 */
let adminState = { usersPage: 1, usersSearch: "", interviewsPage: 1, mcqPage: 1, mcqCategory: "", pageSize: 10 };

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAdmin();
  if (!user) return;
  buildAppShell("Admin Dashboard");
  document.getElementById("page-content").appendChild(document.getElementById("admin-template").content.cloneNode(true));

  loadStats();
  loadUsers();

  try {
    const cats = await API.getQuizCategories();
    const sel = document.getElementById("mcq-category-filter");
    cats.forEach((c) => { const opt = document.createElement("option"); opt.value = c.name; opt.textContent = c.name; sel.appendChild(opt); });
  } catch (e) {}

  document.querySelectorAll(".tab-btn").forEach((btn) => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));
  let t;
  document.getElementById("user-search").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { adminState.usersSearch = e.target.value.trim(); adminState.usersPage = 1; loadUsers(); }, 350); });
  document.getElementById("mcq-category-filter").addEventListener("change", (e) => { adminState.mcqCategory = e.target.value; adminState.mcqPage = 1; loadMcq(); });

  document.getElementById("page-content").appendChild(document.getElementById("mcq-form-template").content.cloneNode(true));
  document.getElementById("mcq-add-btn").addEventListener("click", () => openMcqForm());
  document.getElementById("mcq-form-cancel").addEventListener("click", () => document.getElementById("mcq-modal-backdrop").classList.remove("show"));
  document.getElementById("mcq-form").addEventListener("submit", saveMcqForm);
});

function openMcqForm(question) {
  const backdrop = document.getElementById("mcq-modal-backdrop");
  document.getElementById("mcq-form-title").textContent = question ? "Edit Question" : "Add Question";
  document.getElementById("mcq-form-id").value = question ? question.id : "";
  document.getElementById("mcq-form-category").value = question ? question.category : "Python";
  document.getElementById("mcq-form-difficulty").value = question ? question.difficulty : "Easy";
  document.getElementById("mcq-form-question").value = question ? question.question : "";
  document.getElementById("mcq-form-a").value = question ? question.option_a : "";
  document.getElementById("mcq-form-b").value = question ? question.option_b : "";
  document.getElementById("mcq-form-c").value = question ? question.option_c : "";
  document.getElementById("mcq-form-d").value = question ? question.option_d : "";
  document.getElementById("mcq-form-correct").value = question ? question.correct_answer : "A";
  document.getElementById("mcq-form-explanation").value = question ? (question.explanation || "") : "";
  backdrop.classList.add("show");
}
window.openMcqForm = openMcqForm;

async function saveMcqForm(e) {
  e.preventDefault();
  const id = document.getElementById("mcq-form-id").value;
  const payload = {
    category: document.getElementById("mcq-form-category").value,
    difficulty: document.getElementById("mcq-form-difficulty").value,
    question: document.getElementById("mcq-form-question").value.trim(),
    option_a: document.getElementById("mcq-form-a").value.trim(),
    option_b: document.getElementById("mcq-form-b").value.trim(),
    option_c: document.getElementById("mcq-form-c").value.trim(),
    option_d: document.getElementById("mcq-form-d").value.trim(),
    correct_answer: document.getElementById("mcq-form-correct").value,
    explanation: document.getElementById("mcq-form-explanation").value.trim(),
  };
  const btn = document.getElementById("mcq-form-submit");
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = "Saving…";
  try {
    if (id) await API.updateMcqQuestion(id, payload);
    else await API.createMcqQuestion(payload);
    showToast(id ? "Question updated." : "Question added.", "success");
    document.getElementById("mcq-modal-backdrop").classList.remove("show");
    loadMcq();
    loadStats();
  } catch (err) { showToast(err instanceof ApiError ? err.message : "Could not save question.", "error"); }
  finally { btn.disabled = false; btn.textContent = original; }
}

function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".admin-tab").forEach((t) => t.classList.toggle("hidden", t.id !== `tab-${tab}`));
  if (tab === "interviews") loadInterviews();
  if (tab === "mcq") loadMcq();
}

async function loadStats() {
  try {
    const s = await API.getAdminStats();
    document.getElementById("admin-users-count").textContent = s.total_users;
    document.getElementById("admin-interviews-count").textContent = s.total_interviews;
    document.getElementById("admin-questions-count").textContent = s.total_questions;
    document.getElementById("admin-avg-performance").textContent = `${s.average_performance}%`;
  } catch (err) { showToast(err instanceof ApiError ? err.message : "Could not load admin stats.", "error"); }
}

async function loadUsers() {
  const wrap = document.getElementById("users-table-wrap");
  try {
    const result = await API.getAdminUsers(adminState.usersSearch, adminState.usersPage, adminState.pageSize);
    if (!result.users.length) { wrap.innerHTML = `<div class="empty-state"><i class="fa-solid fa-users"></i><h3>No users found</h3></div>`; document.getElementById("users-pagination").innerHTML = ""; return; }
    const rows = result.users.map((u) => `<tr><td>${escapeHtml(u.full_name)}</td><td>${escapeHtml(u.email)}</td><td>${u.is_admin ? '<span class="badge badge-blue">Admin</span>' : '<span class="badge badge-neutral">User</span>'}</td><td>${u.is_active ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-red">Inactive</span>'}</td><td>${formatDate(u.created_at)}</td>
      <td class="flex gap-8"><button class="btn btn-secondary btn-sm" onclick="toggleActive(${u.id})">${u.is_active ? "Deactivate" : "Activate"}</button><button class="btn btn-ghost btn-sm" onclick="toggleAdmin(${u.id})">${u.is_admin ? "Remove Admin" : "Make Admin"}</button></td></tr>`).join("");
    wrap.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
    renderPagination("users-pagination", result, loadUsers, "usersPage");
  } catch (err) { wrap.innerHTML = `<div class="error-state">Could not load users.</div>`; }
}

async function toggleActive(id) { try { await API.toggleUserActive(id); showToast("Updated.", "success"); loadUsers(); } catch (err) { showToast(err instanceof ApiError ? err.message : "Could not update.", "error"); } }
async function toggleAdmin(id) {
  const ok = await confirmModal({ title: "Change admin status?", body: "This changes the user's access level immediately.", okLabel: "Confirm", danger: false });
  if (!ok) return;
  try { await API.toggleUserAdmin(id); showToast("Updated.", "success"); loadUsers(); } catch (err) { showToast(err instanceof ApiError ? err.message : "Could not update.", "error"); }
}
window.toggleActive = toggleActive; window.toggleAdmin = toggleAdmin;

async function loadInterviews() {
  const wrap = document.getElementById("interviews-table-wrap");
  try {
    const result = await API.getAdminInterviews(adminState.interviewsPage, adminState.pageSize);
    if (!result.interviews.length) { wrap.innerHTML = `<div class="empty-state"><i class="fa-solid fa-comments"></i><h3>No interviews yet</h3></div>`; document.getElementById("interviews-pagination").innerHTML = ""; return; }
    const rows = result.interviews.map((i) => `<tr><td>#${i.user_id}</td><td>${escapeHtml(i.job_role || "—")}</td><td>${escapeHtml(i.mode)}</td><td>${i.overall_score != null ? scoreBadge(i.overall_score) : "—"}</td><td>${statusBadge(i.status)}</td><td>${formatDate(i.created_at)}</td></tr>`).join("");
    wrap.innerHTML = `<div class="table-wrap"><table><thead><tr><th>User</th><th>Job Role</th><th>Mode</th><th>Score</th><th>Status</th><th>Date</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    renderPagination("interviews-pagination", result, loadInterviews, "interviewsPage");
  } catch (err) { wrap.innerHTML = `<div class="error-state">Could not load interviews.</div>`; }
}

async function loadMcq() {
  const wrap = document.getElementById("mcq-table-wrap");
  try {
    const result = await API.getAdminMcqQuestions(adminState.mcqCategory, adminState.mcqPage, 20);
    if (!result.questions.length) { wrap.innerHTML = `<div class="empty-state"><i class="fa-solid fa-list-check"></i><h3>No questions found</h3></div>`; document.getElementById("mcq-pagination").innerHTML = ""; return; }
    adminState.mcqQuestionsById = {};
    result.questions.forEach((q) => { adminState.mcqQuestionsById[q.id] = q; });
    const rows = result.questions.map((q) => `<tr><td>${escapeHtml(q.category)}</td><td>${escapeHtml(q.difficulty)}</td><td style="max-width:420px;">${escapeHtml(q.question)}</td><td><span class="badge badge-neutral">${q.correct_answer}</span></td>
      <td class="flex gap-8"><button class="btn btn-ghost btn-sm" onclick="editMcq(${q.id})"><i class="fa-solid fa-pen"></i></button><button class="btn btn-ghost btn-sm" onclick="deleteMcq(${q.id})"><i class="fa-solid fa-trash"></i></button></td></tr>`).join("");
    wrap.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Category</th><th>Difficulty</th><th>Question</th><th>Answer</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
    renderPagination("mcq-pagination", result, loadMcq, "mcqPage");
  } catch (err) { wrap.innerHTML = `<div class="error-state">Could not load MCQ questions.</div>`; }
}

async function deleteMcq(id) {
  const ok = await confirmModal({ title: "Delete this question?", body: "This cannot be undone.", okLabel: "Delete" });
  if (!ok) return;
  try { await API.deleteMcqQuestion(id); showToast("Deleted.", "success"); loadMcq(); loadStats(); } catch (err) { showToast(err instanceof ApiError ? err.message : "Could not delete.", "error"); }
}

function editMcq(id) {
  const question = (adminState.mcqQuestionsById || {})[id];
  if (!question) { showToast("Could not find that question.", "error"); return; }
  openMcqForm(question);
}
window.editMcq = editMcq;
window.deleteMcq = deleteMcq;

function renderPagination(containerId, result, reloadFn, stateKey) {
  const container = document.getElementById(containerId);
  const totalPages = Math.max(1, Math.ceil(result.total / result.page_size));
  container.innerHTML = `<button class="btn btn-ghost btn-sm" id="${containerId}-prev" ${result.page <= 1 ? "disabled" : ""}><i class="fa-solid fa-chevron-left"></i></button><span>Page ${result.page} of ${totalPages} (${result.total} total)</span><button class="btn btn-ghost btn-sm" id="${containerId}-next" ${result.page >= totalPages ? "disabled" : ""}><i class="fa-solid fa-chevron-right"></i></button>`;
  document.getElementById(`${containerId}-prev`).addEventListener("click", () => { adminState[stateKey] = Math.max(1, adminState[stateKey] - 1); reloadFn(); });
  document.getElementById(`${containerId}-next`).addEventListener("click", () => { adminState[stateKey] = adminState[stateKey] + 1; reloadFn(); });
}
