/**
 * mock-interview.js - setup screen; starts an interview then redirects
 * to interview-session.html with the interview id.
 */
let miState = { mode: "job_interview", experience: "Fresher", type: "Technical", count: 5 };

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;
  buildAppShell("Mock Interview");
  document.getElementById("page-content").appendChild(document.getElementById("mock-interview-template").content.cloneNode(true));
  document.getElementById("interviewer-robot-slot").innerHTML = robotAvatarSVG(56, "#F59E0B");

  document.querySelectorAll(".mode-card").forEach((card) => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".mode-card").forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      miState.mode = card.dataset.mode;
      const isResume = miState.mode === "resume_based";
      document.getElementById("resume-field").classList.toggle("hidden", !isResume);
      document.getElementById("job-role-select").closest(".field").classList.toggle("hidden", isResume);
      if (isResume) loadResumeOptions();
    });
  });

  setupRadioGroup("experience-options", (v) => (miState.experience = v));
  setupRadioGroup("type-options", (v) => (miState.type = v));
  setupRadioGroup("count-options", (v) => (miState.count = parseInt(v, 10)));

  document.getElementById("start-interview-btn").addEventListener("click", startInterview);
});

function setupRadioGroup(id, onChange) {
  const cards = document.querySelectorAll(`#${id} .radio-card`);
  cards.forEach((c) => c.addEventListener("click", () => { cards.forEach((x) => x.classList.remove("selected")); c.classList.add("selected"); onChange(c.dataset.value); }));
}

async function loadResumeOptions() {
  const select = document.getElementById("resume-select");
  select.innerHTML = `<option>Loading…</option>`;
  try {
    const resumes = await API.listResumes();
    select.innerHTML = resumes.length ? resumes.map((r) => `<option value="${r.id}">${escapeHtml(r.file_name)}</option>`).join("") : `<option value="">No resumes uploaded yet</option>`;
  } catch (e) { select.innerHTML = `<option value="">Could not load resumes</option>`; }
}

async function startInterview() {
  const btn = document.getElementById("start-interview-btn");
  const payload = { mode: miState.mode, num_questions: miState.count };

  if (miState.mode === "resume_based") {
    const resumeId = document.getElementById("resume-select").value;
    if (!resumeId) { showToast("Please upload a resume first, or choose Job Interview instead.", "error"); return; }
    payload.resume_id = parseInt(resumeId, 10);
  } else {
    payload.job_role = document.getElementById("job-role-select").value;
    payload.experience_level = miState.experience;
    payload.interview_type = miState.type;
  }

  btn.disabled = true;
  btn.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;vertical-align:-3px;margin-right:6px;"></span> Generating questions…`;
  try {
    const result = await API.startInterview(payload);
    sessionStorage.setItem("smartai_active_interview", JSON.stringify(result));
    window.location.href = "interview-session.html";
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : "Could not start the interview.", "error");
    btn.disabled = false;
    btn.textContent = "Start Now";
  }
}
