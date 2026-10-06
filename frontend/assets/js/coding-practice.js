/**
 * coding-practice.js - list of problems, or detail+editor when ?slug= is present.
 */
document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;
  buildAppShell("Coding Practice");

  const slug = new URLSearchParams(window.location.search).get("slug");
  if (slug) loadDetail(slug);
  else loadList();
});

async function loadList() {
  document.getElementById("page-content").appendChild(document.getElementById("coding-list-template").content.cloneNode(true));
  const wrap = document.getElementById("cp-list-wrap");
  try {
    const questions = await API.listCodingQuestions();
    const diffColor = { Easy: "badge-green", Medium: "badge-amber", Hard: "badge-red" };
    wrap.innerHTML = questions.map((q) => `
      <div class="card card-hover cp-list-item" onclick="window.location.href='coding-practice.html?slug=${q.slug}'">
        <div><strong>${escapeHtml(q.title)}</strong><div class="text-muted" style="font-size:0.8rem;">${escapeHtml(q.category || "")}</div></div>
        <span class="badge ${diffColor[q.difficulty] || "badge-neutral"}">${q.difficulty}</span>
      </div>`).join("");
  } catch (err) { wrap.innerHTML = `<div class="error-state">Could not load coding problems.</div>`; }
}

async function loadDetail(slug) {
  document.getElementById("page-content").appendChild(document.getElementById("coding-detail-template").content.cloneNode(true));
  document.getElementById("mentor-robot-slot").innerHTML = robotAvatarSVG(40, "#4ADE80");
  try {
    const q = await API.getCodingQuestion(slug);
    document.getElementById("cp-title").textContent = q.title;
    document.getElementById("cp-difficulty").textContent = q.difficulty;
    document.getElementById("cp-statement").textContent = q.statement + "\n\nTest calls that will be run:\n" + q.test_case_inputs.map((t) => "  " + t).join("\n");
    document.getElementById("code-editor").value = q.starter_code || "";

    document.getElementById("run-btn").addEventListener("click", () => runOrSubmit(slug, false));
    document.getElementById("submit-code-btn").addEventListener("click", () => runOrSubmit(slug, true));
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : "Could not load this problem.", "error");
    window.location.href = "coding-practice.html";
  }
}

async function runOrSubmit(slug, isSubmit) {
  const code = document.getElementById("code-editor").value;
  if (!code.trim()) { showToast("Write some code first.", "error"); return; }
  const btn = document.getElementById(isSubmit ? "submit-code-btn" : "run-btn");
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner" style="width:14px;height:14px;border-width:2px;vertical-align:-2px;margin-right:6px;"></span> Running…`;
  try {
    const result = await API.submitCode(slug, { code });
    renderResults(result, isSubmit);
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : "Could not run your code.", "error");
  } finally { btn.disabled = false; btn.innerHTML = originalText; }
}

function renderResults(result, isSubmit) {
  const statusColor = result.status === "passed" ? "badge-green" : result.status === "error" ? "badge-red" : "badge-amber";
  const rows = result.results.map((r) => `
    <div class="tc-row ${r.passed ? "pass" : "fail"}">
      <span>${escapeHtml(r.input)}</span><span>${r.passed ? "✓ Passed" : `✗ Got: ${escapeHtml(String(r.actual))}`}</span>
    </div>`).join("");

  document.getElementById("cp-results").innerHTML = `
    <div class="flex-between mb-8"><strong>${isSubmit ? "Submission" : "Run"} Result</strong><span class="badge ${statusColor}">${result.passed_count}/${result.total_count} passed</span></div>
    ${rows}
    <p class="text-muted mt-8" style="font-size:0.78rem;"><i class="fa-solid fa-flask"></i> Demo execution — ran in a restricted local subprocess.</p>`;

  if (isSubmit && result.status === "passed") showToast("All test cases passed! 🎉", "success");
  else if (isSubmit) showToast(`${result.passed_count}/${result.total_count} test cases passed.`, result.passed_count > 0 ? "info" : "error");
}
