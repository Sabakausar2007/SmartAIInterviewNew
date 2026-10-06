/**
 * auth.js - powers login.html and signup.html
 */
function showFieldError(input, show) { const f = input.closest(".field"); if (f) f.classList.toggle("has-error", show); }
function isValidEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function setBtnLoading(btn, label, loading, loadingText, normalText) {
  btn.disabled = loading;
  label.innerHTML = loading ? `<span class="spinner" style="width:16px;height:16px;border-width:2px;vertical-align:-3px;margin-right:6px;"></span>${loadingText}` : normalText;
}

document.addEventListener("DOMContentLoaded", () => {
  redirectIfLoggedIn();

  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    let mode = "user";
    const tabUser = document.getElementById("tab-user"), tabAdmin = document.getElementById("tab-admin");
    const title = document.getElementById("form-title"), sub = document.getElementById("form-sub");
    tabUser.addEventListener("click", () => { mode = "user"; tabUser.classList.add("active"); tabAdmin.classList.remove("active"); title.textContent = "Welcome back"; sub.textContent = "Log in to continue practicing."; });
    tabAdmin.addEventListener("click", () => { mode = "admin"; tabAdmin.classList.add("active"); tabUser.classList.remove("active"); title.textContent = "Admin Login"; sub.textContent = "Log in with an admin-enabled account."; });

    const params = new URLSearchParams(window.location.search);
    if (params.get("expired") === "1") document.getElementById("expired-banner").classList.remove("hidden");

    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById("email"), passwordInput = document.getElementById("password");
      const email = emailInput.value.trim(), password = passwordInput.value;
      let valid = true;
      if (!isValidEmail(email)) { showFieldError(emailInput, true); valid = false; } else showFieldError(emailInput, false);
      if (!password) { showFieldError(passwordInput, true); valid = false; } else showFieldError(passwordInput, false);
      if (!valid) return;

      const btn = document.getElementById("login-submit"), label = document.getElementById("login-submit-label");
      setBtnLoading(btn, label, true, "Logging in…", "Log In");
      try {
        const result = mode === "admin" ? await API.adminLogin({ email, password }) : await API.login({ email, password });
        AuthStore.setToken(result.access_token); AuthStore.setStoredUser(result.user);
        showToast(`Welcome back, ${result.user.full_name || "there"}!`, "success");
        setTimeout(() => { window.location.href = mode === "admin" ? "admin.html" : "dashboard.html"; }, 350);
      } catch (err) {
        showToast(err instanceof ApiError ? err.message : "Login failed.", "error");
        setBtnLoading(btn, label, false, "", "Log In");
      }
    });
  }

  const signupForm = document.getElementById("signup-form");
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nameInput = document.getElementById("full_name"), emailInput = document.getElementById("email");
      const passwordInput = document.getElementById("password"), confirmInput = document.getElementById("confirm_password");
      const full_name = nameInput.value.trim(), email = emailInput.value.trim();
      const password = passwordInput.value, confirm_password = confirmInput.value;
      let valid = true;
      if (full_name.length < 2) { showFieldError(nameInput, true); valid = false; } else showFieldError(nameInput, false);
      if (!isValidEmail(email)) { showFieldError(emailInput, true); valid = false; } else showFieldError(emailInput, false);
      if (password.length < 6) { showFieldError(passwordInput, true); valid = false; } else showFieldError(passwordInput, false);
      if (confirm_password !== password) { showFieldError(confirmInput, true); valid = false; } else showFieldError(confirmInput, false);
      if (!valid) return;

      const btn = document.getElementById("signup-submit"), label = document.getElementById("signup-submit-label");
      setBtnLoading(btn, label, true, "Creating account…", "Create Account");
      try {
        const result = await API.signup({ full_name, email, password, confirm_password });
        AuthStore.setToken(result.access_token); AuthStore.setStoredUser(result.user);
        showToast("Account created! Welcome.", "success");
        setTimeout(() => { window.location.href = "dashboard.html"; }, 350);
      } catch (err) {
        showToast(err instanceof ApiError ? err.message : "Sign up failed.", "error");
        setBtnLoading(btn, label, false, "", "Create Account");
      }
    });
  }
});
