/**
 * dashboard.js
 */
document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;
  buildAppShell("Dashboard");
  document.getElementById("page-content").appendChild(document.getElementById("dashboard-template").content.cloneNode(true));
  document.getElementById("welcome-heading").textContent = `Welcome back, ${user.full_name.split(" ")[0]} 👋`;
  document.getElementById("dashboard-robot-slot").innerHTML = robotAvatarSVG(72, "#3B82F6");
  document.getElementById("recommendation-robot-slot").innerHTML = robotAvatarSVG(56, "#22D3EE");

  loadStats();
  loadRecentInterviews();
  loadRecentQuizzes();
  loadRecommendations();
});

async function loadRecommendations() {
  const list = document.getElementById("recommendation-list");
  try {
    const result = await API.getRecommendations();
    list.innerHTML = result.recommendations.map((r) => `<li style="margin-bottom:6px;">${escapeHtml(r)}</li>`).join("");
  } catch (err) { list.innerHTML = `<li class="text-muted">Could not load recommendations.</li>`; }
}

function animateCounter(el, targetValue, suffix = "") {
  const isDecimal = !Number.isInteger(targetValue);
  const duration = 800;
  const start = performance.now();
  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const value = targetValue * progress;
    el.textContent = (isDecimal ? value.toFixed(0) : Math.round(value)) + suffix;
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = Math.round(targetValue) + suffix;
  }
  requestAnimationFrame(tick);
}

async function loadStats() {
  try {
    const perf = await API.getPerformanceSummary();
    animateCounter(document.getElementById("stat-interviews"), perf.total_interviews || 0);
    animateCounter(document.getElementById("stat-avg-score"), perf.avg_interview_score || 0, "%");
    animateCounter(document.getElementById("stat-mcq"), perf.total_mcq_attempts || 0);
    animateCounter(document.getElementById("stat-coding"), perf.coding_solved || 0);
    document.getElementById("stat-resume").textContent = perf.latest_resume_score != null ? `${Math.round(perf.latest_resume_score)}%` : "—";
    const streakEl = document.getElementById("stat-streak");
    streakEl.textContent = `${perf.practice_streak_days || 0}${perf.practice_streak_days === 1 ? " day" : " days"}`;
  } catch (err) { showToast(err instanceof ApiError ? err.message : "Could not load stats.", "error"); }
}

async function loadRecentInterviews() {
  const wrap = document.getElementById("recent-interviews-wrap");
  try {
    const interviews = await API.getInterviewHistory();
    if (!interviews.length) { wrap.innerHTML = `<div class="empty-state" style="padding:24px 0;"><i class="fa-solid fa-comments"></i><p style="margin:0;">No interviews yet. <a href="mock-interview.html">Start your first one</a>.</p></div>`; return; }
    const rows = interviews.slice(0, 5).map((i) => `<tr><td>${formatDate(i.date)}</td><td>${escapeHtml(i.job_role || i.mode)}</td><td>${i.score != null ? scoreBadge(i.score) : "—"}</td><td>${statusBadge(i.status)}</td></tr>`).join("");
    wrap.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Role</th><th>Score</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  } catch (err) { wrap.innerHTML = `<div class="error-state">Could not load recent interviews.</div>`; }
}

async function loadRecentQuizzes() {
  const wrap = document.getElementById("recent-quizzes-wrap");
  try {
    const quizzes = await API.getQuizHistory();
    if (!quizzes.length) { wrap.innerHTML = `<div class="empty-state" style="padding:24px 0;"><i class="fa-solid fa-list-check"></i><p style="margin:0;">No quizzes yet. <a href="practice.html">Take your first quiz</a>.</p></div>`; return; }
    const rows = quizzes.slice(0, 5).map((q) => `<tr><td>${escapeHtml(q.category)}</td><td>${q.correct_answers}/${q.total_questions}</td><td>${scoreBadge(q.score_percent)}</td></tr>`).join("");
    wrap.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Category</th><th>Score</th><th>%</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  } catch (err) { wrap.innerHTML = `<div class="error-state">Could not load recent quiz results.</div>`; }
}
