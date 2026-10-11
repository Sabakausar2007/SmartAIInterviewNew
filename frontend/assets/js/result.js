/**
 * result.js - loads and renders the final interview report for ?id=
 */
document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;
  buildAppShell("Interview Result");
  document.getElementById("page-content").appendChild(document.getElementById("result-template").content.cloneNode(true));

  const id = new URLSearchParams(window.location.search).get("id");

  // Direct visit without an interview id: never leave a spinner, show a clear empty state.
  if (!id || !/^\d+$/.test(id)) {
    showResultState("fa-clipboard-list", "No interview selected",
      "Open a result from your History, or complete a mock interview to see your score here.",
      [{ href: "mock-interview.html", label: "Start Mock Interview", primary: true }, { href: "history.html", label: "View History" }]);
    return;
  }

  try {
    const result = await API.getInterviewResult(id);
    if (result.status !== "completed") {
      showResultState("fa-hourglass-half", "This interview isn't finished yet",
        "Finish the interview to see your score and feedback.",
        [{ href: "mock-interview.html", label: "Start a New Interview", primary: true }, { href: "history.html", label: "View History" }]);
      return;
    }
    renderResult(result);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      showResultState("fa-circle-question", "Result not found",
        "We couldn't find that interview. It may have been removed, or the link may be wrong.",
        [{ href: "history.html", label: "View History", primary: true }, { href: "mock-interview.html", label: "Start Mock Interview" }]);
    } else {
      showResultState("fa-triangle-exclamation", "We couldn't load this result",
        err instanceof ApiError ? err.message : "Something went wrong. Please try again.",
        [{ href: "#", label: "Try again", primary: true, reload: true }, { href: "history.html", label: "View History" }]);
    }
  }
});

function showResultState(icon, title, text, actions) {
  document.getElementById("result-loading").classList.add("hidden");
  document.getElementById("result-body").classList.add("hidden");
  document.getElementById("result-state-icon").className = `fa-solid ${icon}`;
  document.getElementById("result-state-title").textContent = title;
  document.getElementById("result-state-text").textContent = text;
  const wrap = document.getElementById("result-state-actions");
  wrap.innerHTML = actions.map((a) => `<a href="${a.href}" class="btn ${a.primary ? "btn-primary" : "btn-secondary"}" ${a.reload ? 'data-reload="1"' : ""}>${escapeHtml(a.label)}</a>`).join("");
  wrap.querySelectorAll("[data-reload]").forEach((el) => el.addEventListener("click", (e) => { e.preventDefault(); window.location.reload(); }));
  document.getElementById("result-state").classList.remove("hidden");
}

function renderResult(r) {
  document.getElementById("result-loading").classList.add("hidden");
  document.getElementById("result-body").classList.remove("hidden");
  document.getElementById("result-hero-robot-slot").innerHTML = robotAvatarSVG(64, "#F59E0B");

  if (r.is_demo_evaluation) {
    document.getElementById("demo-banner-wrap").innerHTML = demoBanner(
      "This interview was scored using Demo/Fallback evaluation (rule-based), not a live AI model, because no AI API key is configured."
    );
  }

  const label = document.getElementById("result-label");
  label.textContent = r.performance_label || "";
  label.style.color = r.performance_label === "Excellent" ? "#4ADE80" : r.performance_label === "Good" ? "#FBBF24" : "#F87171";
  document.getElementById("count-answered").textContent = r.answered_count ?? 0;
  document.getElementById("count-skipped").textContent = r.skipped_count ?? 0;
  document.getElementById("count-total").textContent = r.total_questions ?? (r.question_review || []).length;

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

  document.getElementById("question-review-wrap").innerHTML = (r.question_review || []).map((q, idx) => `
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
