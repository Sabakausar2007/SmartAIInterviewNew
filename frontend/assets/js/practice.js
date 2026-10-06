/**
 * practice.js - category select -> options -> quiz -> inline result.
 */
const CAT_ICONS = {
  "Python": "fa-brands fa-python", "Java": "fa-brands fa-java", "C++": "fa-solid fa-code",
  "JavaScript": "fa-brands fa-js", "SQL": "fa-solid fa-database", "DBMS": "fa-solid fa-server",
  "Data Structures": "fa-solid fa-diagram-project", "Web Development": "fa-solid fa-globe",
  "Cybersecurity": "fa-solid fa-shield-halved", "Software Engineering": "fa-solid fa-gears",
  "System Design": "fa-solid fa-sitemap",
};

let pState = { category: null, difficulty: "Easy", count: 10, questions: [], answers: {}, index: 0, timer: null, seconds: 0 };

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;
  buildAppShell("Practice Interview");
  document.getElementById("page-content").appendChild(document.getElementById("practice-template").content.cloneNode(true));

  loadCategories();
  setupRadio("difficulty-options", (v) => (pState.difficulty = v));
  setupRadio("count-options", (v) => (pState.count = parseInt(v, 10)));
  document.getElementById("back-btn").addEventListener("click", () => { document.getElementById("options-view").classList.add("hidden"); document.getElementById("category-view").classList.remove("hidden"); });
  document.getElementById("start-quiz-btn").addEventListener("click", startQuiz);
  document.getElementById("prev-btn").addEventListener("click", () => navigate(-1));
  document.getElementById("next-btn").addEventListener("click", () => navigate(1));
  document.getElementById("submit-quiz-btn").addEventListener("click", submitQuiz);
});

function setupRadio(id, onChange) {
  const cards = document.querySelectorAll(`#${id} .radio-card`);
  cards.forEach((c) => c.addEventListener("click", () => { cards.forEach((x) => x.classList.remove("selected")); c.classList.add("selected"); onChange(c.dataset.value); }));
}

async function loadCategories() {
  const grid = document.getElementById("category-grid");
  try {
    const cats = await API.getQuizCategories();
    grid.innerHTML = cats.map((c) => `<div class="card card-hover category-card" data-cat="${escapeHtml(c.name)}"><div class="cat-icon"><i class="${CAT_ICONS[c.name] || "fa-solid fa-list"}"></i></div><h4 style="margin-bottom:4px;">${escapeHtml(c.name)}</h4><div class="text-muted" style="font-size:0.78rem;">${c.question_count} questions</div></div>`).join("");
    grid.querySelectorAll(".category-card").forEach((c) => c.addEventListener("click", () => selectCategory(c.dataset.cat)));
  } catch (err) { grid.innerHTML = `<div class="error-state" style="grid-column:1/-1;">Could not load categories.</div>`; }
}

function selectCategory(cat) {
  pState.category = cat;
  document.getElementById("selected-cat-title").textContent = cat;
  document.getElementById("category-view").classList.add("hidden");
  document.getElementById("options-view").classList.remove("hidden");
}

async function startQuiz() {
  const btn = document.getElementById("start-quiz-btn");
  btn.disabled = true; btn.textContent = "Preparing…";
  try {
    const result = await API.startQuiz({ category: pState.category, difficulty: pState.difficulty, num_questions: pState.count });
    pState.questions = result.questions; pState.answers = {}; pState.index = 0;
    document.getElementById("panel-setup").classList.add("hidden");
    document.getElementById("panel-quiz").classList.remove("hidden");
    renderQuestion(); startTimer();
  } catch (err) { showToast(err instanceof ApiError ? err.message : "Could not start quiz.", "error"); }
  finally { btn.disabled = false; btn.textContent = "Start Quiz"; }
}

function startTimer() {
  clearInterval(pState.timer); pState.seconds = 0;
  pState.timer = setInterval(() => { pState.seconds++; document.getElementById("q-timer").innerHTML = `<i class="fa-regular fa-clock"></i> ${formatSeconds(pState.seconds)}`; }, 1000);
}

function renderQuestion() {
  const q = pState.questions[pState.index];
  document.getElementById("q-counter").textContent = `Question ${pState.index + 1} / ${pState.questions.length}`;
  document.getElementById("q-progress").style.width = `${Math.round((pState.index / pState.questions.length) * 100)}%`;
  document.getElementById("q-text").textContent = q.question;
  const opts = [["A", q.option_a], ["B", q.option_b], ["C", q.option_c], ["D", q.option_d]];
  const selected = pState.answers[q.id];
  document.getElementById("q-options").innerHTML = opts.map(([letter, text]) => `<button type="button" class="option-btn ${selected === letter ? "selected" : ""}" data-letter="${letter}"><span class="opt-letter">${letter}</span>${escapeHtml(text)}</button>`).join("");
  document.querySelectorAll(".option-btn").forEach((b) => b.addEventListener("click", () => { pState.answers[q.id] = b.dataset.letter; renderQuestion(); }));
  document.getElementById("prev-btn").disabled = pState.index === 0;
  const isLast = pState.index === pState.questions.length - 1;
  document.getElementById("next-btn").classList.toggle("hidden", isLast);
  document.getElementById("submit-quiz-btn").classList.toggle("hidden", !isLast);
}

function navigate(delta) {
  const newIndex = pState.index + delta;
  if (newIndex < 0 || newIndex >= pState.questions.length) return;
  pState.index = newIndex; renderQuestion();
}

async function submitQuiz() {
  clearInterval(pState.timer);
  const answers = pState.questions.map((q) => ({ question_id: q.id, selected_answer: pState.answers[q.id] || null }));
  const unanswered = answers.filter((a) => !a.selected_answer).length;
  if (unanswered > 0) {
    const proceed = await confirmModal({ title: "Submit with unanswered questions?", body: `${unanswered} question(s) unanswered - they'll be marked incorrect.`, okLabel: "Submit Anyway", danger: false });
    if (!proceed) { startTimer(); return; }
  }
  const btn = document.getElementById("submit-quiz-btn");
  btn.disabled = true; btn.textContent = "Scoring…";
  try {
    const result = await API.submitQuiz({ category: pState.category, difficulty: pState.difficulty, answers, time_taken_seconds: pState.seconds });
    renderResult(result);
  } catch (err) { showToast(err instanceof ApiError ? err.message : "Could not submit quiz.", "error"); btn.disabled = false; btn.textContent = "Submit Quiz"; }
}

function renderResult(result) {
  document.getElementById("panel-quiz").classList.add("hidden");
  document.getElementById("panel-result").classList.remove("hidden");
  document.getElementById("qr-correct").textContent = result.correct_answers;
  document.getElementById("qr-total").textContent = result.total_questions;
  document.getElementById("qr-percent").textContent = result.score_percent;
  const label = document.getElementById("qr-label");
  label.textContent = result.performance_label;
  label.style.color = result.performance_label === "Excellent" ? "#4ADE80" : result.performance_label === "Good" ? "#FBBF24" : "#F87171";

  document.getElementById("result-robot-slot").innerHTML = robotAvatarSVG(64, "#22D3EE");
  const aiMsg = document.getElementById("qr-ai-message");
  aiMsg.textContent = result.performance_label === "Excellent"
    ? "Great work! Keep this up and try a harder difficulty next time."
    : "Great work! Let's improve your weak areas — check Question Bank or your Dashboard for topic-specific tips.";

  document.getElementById("qr-review").innerHTML = result.review.map((r, idx) => {
    const rows = Object.entries(r.options).map(([letter, text]) => {
      let cls = ""; if (letter === r.correct_answer) cls = "correct"; else if (letter === r.your_answer && !r.is_correct) cls = "wrong";
      return `<div class="opt-row ${cls}"><span class="opt-letter">${letter}</span>${escapeHtml(text)}</div>`;
    }).join("");
    return `<div class="card mb-16"><div class="flex-between mb-8"><strong>${idx + 1}. ${escapeHtml(r.question)}</strong>${r.is_correct ? '<span class="badge badge-green">Correct</span>' : '<span class="badge badge-red">Incorrect</span>'}</div>${rows}${r.explanation ? `<p class="text-muted mt-8" style="font-size:0.85rem;">${escapeHtml(r.explanation)}</p>` : ""}</div>`;
  }).join("");
}
