/**
 * history.js
 */
document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;
  buildAppShell("History");
  document.getElementById("page-content").appendChild(document.getElementById("history-template").content.cloneNode(true));

  document.querySelectorAll(".tab-btn").forEach((btn) => btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
    document.getElementById("tab-interviews").classList.toggle("hidden", btn.dataset.tab !== "interviews");
    document.getElementById("tab-quizzes").classList.toggle("hidden", btn.dataset.tab !== "quizzes");
  }));

  loadInterviewHistory();
  loadQuizHistory();
});

async function loadInterviewHistory() {
  const wrap = document.getElementById("history-interviews-wrap");
  try {
    const interviews = await API.getInterviewHistory();
    if (!interviews.length) { wrap.innerHTML = `<div class="empty-state"><i class="fa-solid fa-comments"></i><h3>No interviews yet</h3><a href="mock-interview.html" class="btn btn-primary mt-16">Start an Interview</a></div>`; return; }
    const rows = interviews.map((i) => `<tr><td>${formatDate(i.date)}</td><td>${escapeHtml(i.job_role || i.mode)}</td><td>${escapeHtml(i.interview_type || i.mode)}</td><td>${i.score != null ? scoreBadge(i.score) : "—"}</td><td>${statusBadge(i.status)}</td><td>${i.status === "completed" ? `<a href="result.html?id=${i.id}" class="btn btn-secondary btn-sm">View Result</a>` : `<span class="text-muted" style="font-size:0.82rem;">In progress</span>`}</td></tr>`).join("");
    wrap.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Role</th><th>Type</th><th>Score</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  } catch (err) { wrap.innerHTML = `<div class="error-state">Could not load interview history.</div>`; }
}

async function loadQuizHistory() {
  const wrap = document.getElementById("history-quizzes-wrap");
  try {
    const quizzes = await API.getQuizHistory();
    if (!quizzes.length) { wrap.innerHTML = `<div class="empty-state"><i class="fa-solid fa-list-check"></i><h3>No quizzes yet</h3><a href="practice.html" class="btn btn-primary mt-16">Practice Now</a></div>`; return; }
    const rows = quizzes.map((q) => `<tr><td>${formatDate(q.date)}</td><td>${escapeHtml(q.category)}</td><td>${escapeHtml(q.difficulty)}</td><td>${q.correct_answers}/${q.total_questions}</td><td>${scoreBadge(q.score_percent)}</td></tr>`).join("");
    wrap.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Category</th><th>Difficulty</th><th>Score</th><th>%</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  } catch (err) { wrap.innerHTML = `<div class="error-state">Could not load quiz history.</div>`; }
}
