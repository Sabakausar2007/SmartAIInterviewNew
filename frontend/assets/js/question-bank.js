/**
 * question-bank.js - searchable/filterable question bank with pagination.
 */
let qbState = { search: "", category: "", difficulty: "", page: 1, pageSize: 20, bookmarkedOnly: false };

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;
  buildAppShell("Question Bank");
  document.getElementById("page-content").appendChild(document.getElementById("qbank-template").content.cloneNode(true));

  try {
    const cats = await API.getQuizCategories();
    const sel = document.getElementById("qb-category-filter");
    cats.forEach((c) => { const opt = document.createElement("option"); opt.value = c.name; opt.textContent = `${c.name} (${c.question_count})`; sel.appendChild(opt); });
  } catch (e) {}

  let debounce;
  document.getElementById("qb-search").addEventListener("input", (e) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { qbState.search = e.target.value.trim(); qbState.page = 1; loadBank(); }, 350);
  });
  document.getElementById("qb-category-filter").addEventListener("change", (e) => { qbState.category = e.target.value; qbState.page = 1; loadBank(); });
  document.getElementById("qb-difficulty-filter").addEventListener("change", (e) => { qbState.difficulty = e.target.value; qbState.page = 1; loadBank(); });

  const bookmarkToggle = document.getElementById("qb-bookmark-toggle");
  bookmarkToggle.addEventListener("click", () => {
    qbState.bookmarkedOnly = !qbState.bookmarkedOnly;
    bookmarkToggle.classList.toggle("active", qbState.bookmarkedOnly);
    bookmarkToggle.innerHTML = qbState.bookmarkedOnly ? `<i class="fa-solid fa-star"></i> Bookmarked Only` : `<i class="fa-regular fa-star"></i> Bookmarked Only`;
    qbState.page = 1;
    loadBank();
  });

  loadBank();
});

async function loadBank() {
  const wrap = document.getElementById("qb-results");
  wrap.innerHTML = `<div class="loading-block"><span class="spinner"></span> Searching…</div>`;
  try {
    const result = await API.getQuestionBank(qbState.search, qbState.category, qbState.difficulty, qbState.page, qbState.pageSize, qbState.bookmarkedOnly);
    if (!result.questions.length) {
      wrap.innerHTML = qbState.bookmarkedOnly
        ? `<div class="empty-state"><i class="fa-solid fa-star"></i><h3>No bookmarked questions yet</h3><p>Click the star on any question to save it here.</p></div>`
        : `<div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i><h3>No questions found</h3><p>Try a different search or filter.</p></div>`;
      return;
    }

    const items = result.questions.map((q) => `
      <div class="card qb-item">
        <div class="flex-between mb-8">
          <span class="badge badge-blue">${escapeHtml(q.category)}</span><span class="badge badge-neutral">${escapeHtml(q.difficulty)}</span>
          <button class="qb-bookmark-btn ${q.is_bookmarked ? "active" : ""}" data-qid="${q.id}" title="Bookmark this question">
            <i class="fa-${q.is_bookmarked ? "solid" : "regular"} fa-star"></i>
          </button>
        </div>
        <p style="font-weight:600;color:#fff;margin-bottom:10px;">${escapeHtml(q.question)}</p>
        <div style="font-size:0.85rem;color:var(--text-muted);">
          <div>A. ${escapeHtml(q.option_a)}</div><div>B. ${escapeHtml(q.option_b)}</div>
          <div>C. ${escapeHtml(q.option_c)}</div><div>D. ${escapeHtml(q.option_d)}</div>
        </div>
        <p class="mt-8" style="margin:8px 0 0;font-size:0.85rem;"><span class="badge badge-green">Answer: ${q.correct_answer}</span></p>
        ${q.explanation ? `<p class="text-muted mt-8" style="margin:8px 0 0;font-size:0.83rem;">${escapeHtml(q.explanation)}</p>` : ""}
      </div>`).join("");

    const totalPages = Math.max(1, Math.ceil(result.total / result.page_size));
    wrap.innerHTML = `<p class="text-muted mb-16">${result.total} questions found</p>${items}
      <div class="flex-between mt-16">
        <button class="btn btn-secondary btn-sm" id="qb-prev" ${result.page <= 1 ? "disabled" : ""}>Previous</button>
        <span class="text-muted" style="font-size:0.85rem;">Page ${result.page} of ${totalPages}</span>
        <button class="btn btn-secondary btn-sm" id="qb-next" ${result.page >= totalPages ? "disabled" : ""}>Next</button>
      </div>`;
    document.getElementById("qb-prev")?.addEventListener("click", () => { qbState.page--; loadBank(); });
    document.getElementById("qb-next")?.addEventListener("click", () => { qbState.page++; loadBank(); });
    wrap.querySelectorAll(".qb-bookmark-btn").forEach((btn) => btn.addEventListener("click", () => toggleQuestionBookmark(btn)));
  } catch (err) { wrap.innerHTML = `<div class="error-state">Could not load the question bank.</div>`; }
}

async function toggleQuestionBookmark(btn) {
  const qid = btn.dataset.qid;
  btn.disabled = true;
  try {
    const result = await API.toggleBookmark(qid);
    if (qbState.bookmarkedOnly && !result.is_bookmarked) { loadBank(); return; }
    btn.classList.toggle("active", result.is_bookmarked);
    btn.innerHTML = `<i class="fa-${result.is_bookmarked ? "solid" : "regular"} fa-star"></i>`;
    showToast(result.is_bookmarked ? "Added to bookmarks." : "Removed from bookmarks.", "success");
  } catch (err) { showToast(err instanceof ApiError ? err.message : "Could not update bookmark.", "error"); }
  finally { btn.disabled = false; }
}
