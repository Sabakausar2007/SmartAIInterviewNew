/**
 * api.js - central API client. Every page includes this first.
 */
const API_BASE = "/api";

function getToken() { return localStorage.getItem("smartai_token"); }
function setToken(t) { localStorage.setItem("smartai_token", t); }
function clearToken() { localStorage.removeItem("smartai_token"); localStorage.removeItem("smartai_user"); }
function getStoredUser() { try { return JSON.parse(localStorage.getItem("smartai_user")); } catch (e) { return null; } }
function setStoredUser(u) { localStorage.setItem("smartai_user", JSON.stringify(u)); }

class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function apiRequest(method, path, body, { isForm = false, auth = true } = {}) {
  const headers = {};
  if (!isForm) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { method, headers, body: body ? (isForm ? body : JSON.stringify(body)) : undefined });
  } catch (e) {
    throw new ApiError("Can't reach the server. Make sure the backend is running (run.bat) and try again.", 0);
  }
  let data = null;
  const text = await response.text();
  if (text) { try { data = JSON.parse(text); } catch (e) { data = null; } }

  if (!response.ok) {
    if (response.status === 401 && auth) {
      clearToken();
      const p = window.location.pathname;
      if (!p.endsWith("login.html") && !p.endsWith("index.html") && p !== "/") {
        window.location.href = "login.html?expired=1";
      }
    }
    const message = (data && data.detail) ? data.detail : `Request failed (${response.status}).`;
    throw new ApiError(typeof message === "string" ? message : "Something went wrong.", response.status);
  }
  return data;
}

const API = {
  signup: (p) => apiRequest("POST", "/auth/signup", p, { auth: false }),
  login: (p) => apiRequest("POST", "/auth/login", p, { auth: false }),
  adminLogin: (p) => apiRequest("POST", "/auth/admin-login", p, { auth: false }),
  me: () => apiRequest("GET", "/auth/me"),
  updateProfile: (p) => apiRequest("PUT", "/auth/profile", p),
  changePassword: (p) => apiRequest("PUT", "/auth/change-password", p),

  startInterview: (p) => apiRequest("POST", "/interview/start", p),
  submitAnswer: (p) => apiRequest("POST", "/interview/answer", p),
  finishInterview: (id) => apiRequest("POST", `/interview/${id}/finish`),
  getInterviewResult: (id) => apiRequest("GET", `/interview/${id}/result`),
  getInterviewHistory: () => apiRequest("GET", "/interview/history"),

  getQuizCategories: () => apiRequest("GET", "/quiz/categories"),
  getQuestionBank: (search = "", category = "", difficulty = "", page = 1, pageSize = 20, bookmarkedOnly = false) =>
    apiRequest("GET", `/quiz/bank?search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}&difficulty=${encodeURIComponent(difficulty)}&bookmarked_only=${bookmarkedOnly}&page=${page}&page_size=${pageSize}`),
  toggleBookmark: (id) => apiRequest("POST", `/quiz/bookmark/${id}`),
  startQuiz: (p) => apiRequest("POST", "/quiz/start", p),
  submitQuiz: (p) => apiRequest("POST", "/quiz/submit", p),
  getQuizHistory: () => apiRequest("GET", "/quiz/history"),

  uploadResume: (fd) => apiRequest("POST", "/resume/upload", fd, { isForm: true }),
  listResumes: () => apiRequest("GET", "/resume/list"),
  getResume: (id) => apiRequest("GET", `/resume/${id}`),
  deleteResume: (id) => apiRequest("DELETE", `/resume/${id}`),

  getPerformanceSummary: () => apiRequest("GET", "/performance/summary"),
  getPerformanceTrends: () => apiRequest("GET", "/performance/trends"),
  getRecommendations: () => apiRequest("GET", "/performance/recommendations"),

  askAssistant: (message) => apiRequest("POST", "/assistant/ask", { message }),

  listCodingQuestions: () => apiRequest("GET", "/coding/questions"),
  getCodingQuestion: (slug) => apiRequest("GET", `/coding/questions/${slug}`),
  submitCode: (slug, p) => apiRequest("POST", `/coding/questions/${slug}/submit`, p),

  getAdminStats: () => apiRequest("GET", "/admin/stats"),
  getAdminUsers: (search = "", page = 1, pageSize = 10) => apiRequest("GET", `/admin/users?search=${encodeURIComponent(search)}&page=${page}&page_size=${pageSize}`),
  toggleUserActive: (id) => apiRequest("PUT", `/admin/users/${id}/toggle-active`),
  toggleUserAdmin: (id) => apiRequest("PUT", `/admin/users/${id}/toggle-admin`),
  getAdminInterviews: (page = 1, pageSize = 10) => apiRequest("GET", `/admin/interviews?page=${page}&page_size=${pageSize}`),
  getAdminMcqQuestions: (category = "", page = 1, pageSize = 20) => apiRequest("GET", `/admin/mcq-questions?category=${encodeURIComponent(category)}&page=${page}&page_size=${pageSize}`),
  deleteMcqQuestion: (id) => apiRequest("DELETE", `/admin/mcq-questions/${id}`),
  createMcqQuestion: (p) => apiRequest("POST", "/admin/mcq-questions", p),
  updateMcqQuestion: (id, p) => apiRequest("PUT", `/admin/mcq-questions/${id}`, p),

  health: () => apiRequest("GET", "/health", null, { auth: false }),
};

window.API = API;
window.ApiError = ApiError;
window.AuthStore = { getToken, setToken, clearToken, getStoredUser, setStoredUser };
