/**
 * profile.js
 */
document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;
  buildAppShell("My Profile");
  document.getElementById("page-content").appendChild(document.getElementById("profile-template").content.cloneNode(true));
  fillForm(user);
  document.getElementById("profile-form").addEventListener("submit", save);
});

function fillForm(user) {
  document.getElementById("profile-name-display").textContent = user.full_name;
  document.getElementById("profile-email-display").textContent = user.email;
  document.getElementById("profile-avatar").textContent = initials(user.full_name);
  document.getElementById("full_name").value = user.full_name || "";
  document.getElementById("email").value = user.email || "";
  document.getElementById("phone").value = user.phone || "";
  document.getElementById("education").value = user.education || "";
  document.getElementById("college").value = user.college || "";
  document.getElementById("skills").value = user.skills || "";
  document.getElementById("languages").value = user.languages || "";
  document.getElementById("job_role").value = user.job_role || "";
  document.getElementById("experience").value = user.experience || "";
}

async function save(e) {
  e.preventDefault();
  const btn = document.getElementById("profile-save-btn");
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = "Saving…";
  const payload = {
    full_name: document.getElementById("full_name").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    education: document.getElementById("education").value.trim(),
    college: document.getElementById("college").value.trim(),
    skills: document.getElementById("skills").value.trim(),
    languages: document.getElementById("languages").value.trim(),
    job_role: document.getElementById("job_role").value.trim(),
    experience: document.getElementById("experience").value.trim(),
  };
  try {
    await API.updateProfile(payload);
    const user = await API.me();
    AuthStore.setStoredUser(user);
    fillShellUser(user);
    fillForm(user);
    showToast("Profile updated.", "success");
  } catch (err) { showToast(err instanceof ApiError ? err.message : "Could not update profile.", "error"); }
  finally { btn.disabled = false; btn.textContent = original; }
}
