/**
 * performance.js - Result & Progress page.
 * Every section loads independently (own try/catch), so a failure in one
 * (e.g. a chart) can never blank out the others or leave a spinner running.
 */
document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;
  buildAppShell("Result & Performance");
  document.getElementById("page-content").appendChild(document.getElementById("performance-template").content.cloneNode(true));
  document.getElementById("progress-robot-slot").innerHTML = robotAvatarSVG(64, "#22D3EE");

  loadSummary();
  loadTrends();
  loadRecommendations();
});

const CHART_COLORS = { grid: "rgba(255,255,255,0.08)", tick: "#9AA5C0" };

function show(id, visible) { const el = document.getElementById(id); if (el) el.classList.toggle("hidden", !visible); }

async function loadSummary() {
  try {
    const p = await API.getPerformanceSummary();
    document.getElementById("perf-interviews").textContent = p.total_interviews ?? 0;
    document.getElementById("perf-avg-interview").textContent = p.avg_interview_score ? `${p.avg_interview_score}%` : "—";
    document.getElementById("perf-avg-quiz").textContent = p.avg_mcq_score ? `${p.avg_mcq_score}%` : "—";
    document.getElementById("perf-coding").textContent = p.coding_solved ?? 0;
    const days = p.practice_streak_days || 0;
    document.getElementById("perf-streak").textContent = `${days} ${days === 1 ? "day" : "days"}`;

    const isNewUser = !p.total_interviews && !p.total_mcq_attempts && !p.coding_solved;
    const banner = document.getElementById("new-user-banner");
    banner.classList.toggle("hidden", !isNewUser);
    banner.style.display = isNewUser ? "flex" : "none";
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : "Could not load your summary.", "error");
  }
}

async function loadTrends() {
  let t;
  try {
    t = await API.getPerformanceTrends();
  } catch (err) {
    const msg = err instanceof ApiError ? err.message : "Could not load your trends.";
    ["trend", "dim"].forEach((k) => { show(`${k}-loading`, false); const e = document.getElementById(`${k}-error`); e.textContent = msg; show(`${k}-error`, true); });
    renderTopicLists(null);
    return;
  }
  // Each renderer is isolated so one failure cannot stop the others.
  safeRender("trend", () => renderTrendChart(t));
  safeRender("dim", () => renderDimensionChart(t));
  try { renderTopicLists(t); } catch (e) { console.error("topic list render failed", e); }
}

function safeRender(key, fn) {
  try { fn(); }
  catch (e) {
    console.error(`${key} chart failed`, e);
    show(`${key}-loading`, false); show(`${key}-chart`, false);
    const box = document.getElementById(`${key}-error`);
    box.textContent = "The chart couldn't be displayed. Your data is safe - try refreshing the page.";
    show(`${key}-error`, true);
  }
}

function renderTrendChart(t) {
  show("trend-loading", false);
  const hasData = (t.interview_trend || []).length || (t.quiz_trend || []).length;
  if (!hasData) { show("trend-empty", true); show("trend-chart", false); return; }
  if (typeof Chart === "undefined") throw new Error("Chart library not available");
  show("trend-empty", false); show("trend-chart", true);
  const labels = [...new Set([...(t.interview_trend || []).map((i) => formatDate(i.date)), ...(t.quiz_trend || []).map((q) => formatDate(q.date))])];
  new Chart(document.getElementById("trend-chart"), {
    type: "line",
    data: { labels, datasets: [
      { label: "Interview Score", data: (t.interview_trend || []).map((i) => i.score), borderColor: "#3B82F6", backgroundColor: "rgba(59,130,246,0.15)", tension: 0.35, fill: true },
      { label: "Quiz Score", data: (t.quiz_trend || []).map((q) => q.score), borderColor: "#22D3EE", backgroundColor: "rgba(34,211,238,0.15)", tension: 0.35, fill: true },
    ]},
    options: { responsive: true, plugins: { legend: { position: "bottom", labels: { color: CHART_COLORS.tick } } }, scales: { y: { beginAtZero: true, max: 100, grid: { color: CHART_COLORS.grid }, ticks: { color: CHART_COLORS.tick } }, x: { grid: { color: CHART_COLORS.grid }, ticks: { color: CHART_COLORS.tick } } } },
  });
}

function renderDimensionChart(t) {
  show("dim-loading", false);
  if (!t.avg_technical && !t.avg_communication && !t.avg_problem_solving) { show("dim-empty", true); show("dim-chart", false); return; }
  if (typeof Chart === "undefined") throw new Error("Chart library not available");
  show("dim-empty", false); show("dim-chart", true);
  new Chart(document.getElementById("dim-chart"), {
    type: "bar",
    data: { labels: ["Technical", "Communication", "Problem Solving"], datasets: [{ data: [t.avg_technical, t.avg_communication, t.avg_problem_solving], backgroundColor: ["#3B82F6", "#22D3EE", "#A855F7"], borderRadius: 8 }] },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100, grid: { color: CHART_COLORS.grid }, ticks: { color: CHART_COLORS.tick } }, x: { grid: { color: CHART_COLORS.grid }, ticks: { color: CHART_COLORS.tick } } } },
  });
}

function renderTopicLists(t) {
  const strong = document.getElementById("strongest-wrap"), weak = document.getElementById("weakest-wrap");
  if (!t) {
    strong.innerHTML = weak.innerHTML = `<p class="text-muted" style="margin:0;">Couldn't load topics right now.</p>`;
    return;
  }
  const avgs = t.topic_averages || {};
  const pill = (topic, cls) => `<div class="topic-pill"><span>${escapeHtml(topic)}</span><span class="badge ${cls}">${avgs[topic]}%</span></div>`;
  const hasQuizzes = Object.keys(avgs).length > 0;
  strong.innerHTML = (t.strongest_topics || []).length
    ? t.strongest_topics.map((x) => pill(x, "badge-green")).join("")
    : `<p class="text-muted" style="margin:0;">${hasQuizzes ? "No topic is above 70% yet - keep practicing!" : "Complete a quiz to see your strongest topics."}</p>`;
  weak.innerHTML = (t.weakest_topics || []).length
    ? t.weakest_topics.map((x) => pill(x, "badge-amber")).join("")
    : `<p class="text-muted" style="margin:0;">${hasQuizzes ? "Great - no weak topics right now." : "Complete a quiz to see topics to improve."}</p>`;
}

async function loadRecommendations() {
  const list = document.getElementById("perf-recommendations");
  try {
    const r = await API.getRecommendations();
    list.innerHTML = (r.recommendations || []).map((x) => `<li style="margin-bottom:6px;">${escapeHtml(x)}</li>`).join("") || `<li class="text-muted">No recommendations yet.</li>`;
  } catch (err) {
    list.innerHTML = `<li class="text-muted">Couldn't load recommendations right now.</li>`;
  }
}
