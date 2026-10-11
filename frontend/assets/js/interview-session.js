/**
 * interview-session.js - question loop for an active interview started on
 * mock-interview.html. On completion, redirects to result.html.
 */
let sessionState = { interview: null, index: 0, answeredCount: 0, timer: null, seconds: 0 };
const PROGRESS_KEY = "smartai_interview_progress";

function saveProgress() {
  sessionStorage.setItem(PROGRESS_KEY, JSON.stringify({ id: sessionState.interview.interview_id, index: sessionState.index, answered: sessionState.answeredCount }));
}

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  const raw = sessionStorage.getItem("smartai_active_interview");
  if (!raw) { showToast("No active interview found.", "error"); window.location.href = "mock-interview.html"; return; }
  sessionState.interview = JSON.parse(raw);

  // Resume where the user left off after a refresh (never restart at question 1).
  try {
    const saved = JSON.parse(sessionStorage.getItem(PROGRESS_KEY) || "null");
    if (saved && saved.id === sessionState.interview.interview_id) {
      sessionState.index = Math.min(Math.max(saved.index || 0, 0), sessionState.interview.questions.length - 1);
      sessionState.answeredCount = saved.answered || 0;
    }
  } catch (e) { /* ignore corrupt saved progress */ }

  buildAppShell("Interview Session");
  document.getElementById("page-content").appendChild(document.getElementById("session-template").content.cloneNode(true));

  document.getElementById("submit-btn").addEventListener("click", () => submitAnswer(false));
  document.getElementById("skip-btn").addEventListener("click", () => submitAnswer(true));
  document.getElementById("end-btn").addEventListener("click", endEarly);

  showQuestion();
});

function showQuestion() {
  const q = sessionState.interview.questions[sessionState.index];
  document.getElementById("question-text").textContent = q.question_text;
  document.getElementById("question-counter").textContent = `Question ${sessionState.index + 1} / ${sessionState.interview.questions.length}`;
  document.getElementById("session-progress").style.width = `${Math.round((sessionState.index / sessionState.interview.questions.length) * 100)}%`;
  document.getElementById("answer-box").value = "";
  saveProgress();
  startTimer();
}

function startTimer() {
  clearInterval(sessionState.timer);
  sessionState.seconds = 0;
  const el = document.getElementById("session-timer");
  el.classList.remove("warn");
  sessionState.timer = setInterval(() => {
    sessionState.seconds++;
    el.innerHTML = `<i class="fa-regular fa-clock"></i> ${formatSeconds(sessionState.seconds)}`;
    if (sessionState.seconds >= 180) el.classList.add("warn");
  }, 1000);
}

async function submitAnswer(skipped) {
  const answerBox = document.getElementById("answer-box");
  const answerText = answerBox.value.trim();
  if (!skipped && !answerText) { showToast("Please write an answer or use Skip.", "error"); return; }
  clearInterval(sessionState.timer);

  const q = sessionState.interview.questions[sessionState.index];
  const btn = document.getElementById("submit-btn");
  btn.disabled = true;
  try {
    await API.submitAnswer({ question_id: q.id, answer_text: skipped ? null : answerText, skipped });
    sessionState.answeredCount++;
    goNext();
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : "Could not submit answer.", "error");
  } finally { btn.disabled = false; }
}

async function goNext() {
  const isLast = sessionState.index >= sessionState.interview.questions.length - 1;
  if (isLast) { await finishInterview(); return; }
  sessionState.index++;
  showQuestion();
}

async function finishInterview() {
  try {
    await API.finishInterview(sessionState.interview.interview_id);
    sessionStorage.removeItem("smartai_active_interview");
    sessionStorage.removeItem(PROGRESS_KEY);
    window.location.href = `result.html?id=${sessionState.interview.interview_id}`;
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : "Could not finalize the interview.", "error");
  }
}

async function endEarly() {
  const noAnswers = sessionState.answeredCount === 0;
  const ok = await confirmModal({
    title: "End interview early?",
    body: noAnswers ? "You haven't answered any question yet, so no result will be saved." : "You'll get a result based on the questions you've already answered.",
    okLabel: "End Interview",
  });
  if (!ok) return;
  clearInterval(sessionState.timer);
  if (noAnswers) {
    // Nothing to score: leave cleanly instead of failing on an empty interview.
    sessionStorage.removeItem("smartai_active_interview");
    sessionStorage.removeItem(PROGRESS_KEY);
    showToast("Interview ended. No answers were submitted, so no result was saved.", "info");
    setTimeout(() => { window.location.href = "mock-interview.html"; }, 900);
    return;
  }
  await finishInterview();
}
