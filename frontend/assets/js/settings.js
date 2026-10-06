/**
 * settings.js
 */
document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;
  buildAppShell("Settings");
  document.getElementById("page-content").appendChild(document.getElementById("settings-template").content.cloneNode(true));

  document.getElementById("password-form").addEventListener("submit", changePassword);
  document.getElementById("logout-btn").addEventListener("click", async () => {
    const ok = await confirmModal({ title: "Log out?", body: "You'll need to log in again to continue.", okLabel: "Logout", danger: false });
    if (ok) logout();
  });
});

async function changePassword(e) {
  e.preventDefault();
  const btn = document.getElementById("password-save-btn");
  const original = btn.textContent;
  const current_password = document.getElementById("current_password").value;
  const new_password = document.getElementById("new_password").value;
  if (new_password.length < 6) { showToast("New password must be at least 6 characters.", "error"); return; }
  btn.disabled = true; btn.textContent = "Updating…";
  try {
    await API.changePassword({ current_password, new_password });
    showToast("Password changed successfully.", "success");
    document.getElementById("password-form").reset();
  } catch (err) { showToast(err instanceof ApiError ? err.message : "Could not change password.", "error"); }
  finally { btn.disabled = false; btn.textContent = original; }
}
