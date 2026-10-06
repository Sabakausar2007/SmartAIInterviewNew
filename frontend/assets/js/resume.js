/**
 * resume.js - upload, list, delete resume analyses.
 */
document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;
  buildAppShell("Resume Analyzer");
  document.getElementById("page-content").appendChild(document.getElementById("resume-template").content.cloneNode(true));
  document.getElementById("resume-robot-slot").innerHTML = robotAvatarSVG(64, "#A855F7");

  const dropzone = document.getElementById("dropzone"), fileInput = document.getElementById("resume-input");
  dropzone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => { if (fileInput.files.length) uploadResume(fileInput.files[0]); });
  dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("dragover"); });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
  dropzone.addEventListener("drop", (e) => { e.preventDefault(); dropzone.classList.remove("dragover"); if (e.dataTransfer.files.length) uploadResume(e.dataTransfer.files[0]); });

  loadResumes();
});

async function uploadResume(file) {
  const ext = "." + file.name.split(".").pop().toLowerCase();
  if (![".pdf", ".docx"].includes(ext)) { showToast("Only PDF and DOCX files are supported.", "error"); return; }
  if (file.size > 5 * 1024 * 1024) { showToast("File is too large. Maximum size is 5MB.", "error"); return; }

  document.getElementById("upload-progress").classList.remove("hidden");
  const formData = new FormData();
  formData.append("file", file);
  try {
    await API.uploadResume(formData);
    showToast("Resume uploaded and analyzed.", "success");
    document.getElementById("resume-input").value = "";
    loadResumes();
  } catch (err) { showToast(err instanceof ApiError ? err.message : "Could not upload resume.", "error"); }
  finally { document.getElementById("upload-progress").classList.add("hidden"); }
}

async function loadResumes() {
  const wrap = document.getElementById("resume-list-wrap");
  try {
    const resumes = await API.listResumes();
    if (!resumes.length) { wrap.innerHTML = `<div class="empty-state"><i class="fa-solid fa-file-lines"></i><h3>No resumes yet</h3><p>Upload your resume to get an instant strength score.</p></div>`; return; }
    wrap.innerHTML = "";
    resumes.forEach((r) => wrap.appendChild(renderResumeItem(r)));
  } catch (err) { wrap.innerHTML = `<div class="error-state">Could not load your resumes.</div>`; }
}

function renderResumeItem(r) {
  const node = document.getElementById("resume-item-template").content.cloneNode(true);
  node.querySelector(".r-filename").textContent = r.file_name;
  node.querySelector(".score-ring-sm").style.setProperty("--pct", Math.round(r.strength_score || 0));
  node.querySelector(".r-score").textContent = Math.round(r.strength_score || 0);
  node.querySelector(".r-skills").textContent = r.skills || "Not detected";
  node.querySelector(".r-education").textContent = r.education || "Not detected";
  node.querySelector(".r-projects").textContent = r.projects || "Not detected";
  node.querySelector(".r-experience").textContent = r.experience || "Not detected";
  node.querySelector(".r-certifications").textContent = r.certifications || "Not detected";
  node.querySelector(".r-doing-well").innerHTML = (r.doing_well.length ? r.doing_well : ["—"]).map((i) => `<li>${escapeHtml(i)}</li>`).join("");
  node.querySelector(".r-improve").innerHTML = (r.improve.length ? r.improve : ["—"]).map((i) => `<li>${escapeHtml(i)}</li>`).join("");
  if (r.is_demo_evaluation) node.querySelector(".r-demo-badge").innerHTML = `<span class="badge badge-amber"><i class="fa-solid fa-flask"></i> Demo analysis</span>`;
  node.querySelector(".r-delete").addEventListener("click", async () => {
    const ok = await confirmModal({ title: "Delete this analysis?", body: "This will permanently remove it.", okLabel: "Delete" });
    if (!ok) return;
    try { await API.deleteResume(r.id); showToast("Deleted.", "success"); loadResumes(); }
    catch (err) { showToast(err instanceof ApiError ? err.message : "Could not delete.", "error"); }
  });
  return node;
}
