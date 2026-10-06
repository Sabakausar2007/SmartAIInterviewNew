/**
 * performance.js
 */
document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;
  buildAppShell("Result & Performance");
  document.getElementById("page-content").appendChild(document.getElementById("performance-template").content.cloneNode(true));
  loadSummary();
  loadTrends();
});

async function loadSummary() {
  try {
    const p = await API.getPerformanceSummary();
    document.getElementById("perf-interviews").textContent = p.total_interviews;
    document.getElementById("perf-avg-interview").textContent = p.avg_interview_score ? `${p.avg_interview_score}%` : "—";
    document.getElementById("perf-avg-quiz").textContent = p.avg_mcq_score ? `${p.avg_mcq_score}%` : "—";
    document.getElementById("perf-coding").textContent = p.coding_solved;
  } catch (err) { showToast(err instanceof ApiError ? err.message : "Could not load performance summary.", "error"); }
}

async function loadTrends() {
  try {
    const t = await API.getPerformanceTrends();
    renderTrendChart(t);
    renderDimensionChart(t);
    renderTopics(t);
  } catch (err) { showToast(err instanceof ApiError ? err.message : "Could not load trends.", "error"); }
}

function chartColors() {
  return { grid: "rgba(255,255,255,0.08)", tick: "#9AA5C0" };
}

function renderTrendChart(t) {
  const canvas = document.getElementById("trend-chart"), empty = document.getElementById("trend-empty");
  if (!t.interview_trend.length && !t.quiz_trend.length) { canvas.classList.add("hidden"); empty.classList.remove("hidden"); return; }
  const labels = [...new Set([...t.interview_trend.map((i) => formatDate(i.date)), ...t.quiz_trend.map((q) => formatDate(q.date))])];
  const c = chartColors();
  new Chart(canvas, {
    type: "line",
    data: { labels, datasets: [
      { label: "Interview Score", data: t.interview_trend.map((i) => i.score), borderColor: "#3B82F6", backgroundColor: "rgba(59,130,246,0.15)", tension: 0.35, fill: true },
      { label: "Quiz Score", data: t.quiz_trend.map((q) => q.score), borderColor: "#22D3EE", backgroundColor: "rgba(34,211,238,0.15)", tension: 0.35, fill: true },
    ]},
    options: { responsive: true, plugins: { legend: { position: "bottom", labels: { color: c.tick } } }, scales: { y: { beginAtZero: true, max: 100, grid: { color: c.grid }, ticks: { color: c.tick } }, x: { grid: { color: c.grid }, ticks: { color: c.tick } } } },
  });
}

function renderDimensionChart(t) {
  const canvas = document.getElementById("dim-chart"), empty = document.getElementById("dim-empty");
  if (!t.avg_technical && !t.avg_communication && !t.avg_problem_solving) { canvas.classList.add("hidden"); empty.classList.remove("hidden"); return; }
  const c = chartColors();
  new Chart(canvas, {
    type: "bar",
    data: { labels: ["Technical", "Communication", "Problem Solving"], datasets: [{ data: [t.avg_technical, t.avg_communication, t.avg_problem_solving], backgroundColor: ["#3B82F6", "#22D3EE", "#A855F7"], borderRadius: 8 }] },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100, grid: { color: c.grid }, ticks: { color: c.tick } }, x: { grid: { color: c.grid }, ticks: { color: c.tick } } } },
  });
}

function renderTopics(t) {
  const strong = document.getElementById("strongest-wrap"), weak = document.getElementById("weakest-wrap");
  if (!t.strongest_topics.length) { strong.innerHTML = `<p class="text-muted" style="margin:0;">Complete some quizzes to see strong topics.</p>`; weak.innerHTML = `<p class="text-muted" style="margin:0;">Complete some quizzes to see weak topics.</p>`; return; }
  strong.innerHTML = t.strongest_topics.map((topic) => `<div class="topic-pill"><span>${escapeHtml(topic)}</span><span class="badge badge-green">${t.topic_averages[topic]}%</span></div>`).join("");
  weak.innerHTML = t.weakest_topics.map((topic) => `<div class="topic-pill"><span>${escapeHtml(topic)}</span><span class="badge badge-amber">${t.topic_averages[topic]}%</span></div>`).join("");
}
