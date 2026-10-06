/**
 * result.js - loads and renders the final interview report for ?id=
 */
document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;
  buildAppShell("Interview Result");
  document.getElementById("page-content").appendChild(document.getElementById("result-template").content.cloneNode(true));

  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) { showToast("No interview specified.", "error"); window.location.href = "history.html"; return; }

  try {
    const result = await API.getInterviewResult(id);
    renderResult(result);
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : "Could not load this result.", "error");
    document.getElementById("result-loading").innerHTML = `<div class="error-state">Could not load this interview result.</div>`;
  }
});

function renderResult(r) {
  document.getElementById("result-loading").classList.add("hidden");
  document.getElementById("result-body").classList.remove("hidden");
  document.getElementById("result-hero-robot-slot").innerHTML = robotAvatarSVG(64, "#F59E0B");

  if (r.is_demo_evaluation) {
    document.getElementById("demo-banner-wrap").innerHTML = demoBanner(
      "This interview was scored using Demo/Fallback evaluation (rule-based), not a live AI model, because no AI API key is configured."
    );
  }

  const score = Math.round(r.overall_score || 0);
  document.getElementById("score-ring").style.setProperty("--pct", score);
  document.getElementById("overall-score").textContent = score;
  document.getElementById("result-meta").textContent = `${r.interview_type || r.mode} · ${r.job_role || "Resume-based"} · ${formatDate(r.created_at)}`;

  document.getElementById("score-technical").textContent = `${Math.round(r.technical_score || 0)}%`;
  document.getElementById("score-communication").textContent = `${Math.round(r.communication_score || 0)}%`;
  document.getElementById("score-problem-solving").textContent = `${Math.round(r.problem_solving_score || 0)}%`;

  fillList("strengths-list", r.strengths, "Nothing recorded yet.");
  fillList("improvements-list", r.improvements, "Nothing recorded yet.");
  fillList("recommended-list", r.recommended_practice, "Keep practicing regularly.");

  document.getElementById("question-review-wrap").innerHTML = r.question_review.map((q, idx) => `
    <div class="card qr-item">
      <div class="flex-between mb-8"><strong>${idx + 1}. ${escapeHtml(q.question)}</strong>${q.skipped ? '<span class="badge badge-neutral">Skipped</span>' : scoreBadge(q.score)}</div>
      <p style="margin:0;font-size:0.88rem;">${q.answer ? escapeHtml(q.answer) : "<em>No answer submitted.</em>"}</p>
      ${q.feedback ? `<p class="text-muted mt-8" style="margin:8px 0 0;font-size:0.83rem;">${escapeHtml(q.feedback)}</p>` : ""}
    </div>
  `).join("");
}

function fillList(id, items, emptyText) {
  const el = document.getElementById(id);
  el.innerHTML = (!items || !items.length) ? `<li>${emptyText}</li>` : items.map((i) => `<li>${escapeHtml(i)}</li>`).join("");
}
