# Smart AI Interview Assistance

Your Personal AI Guide to Interview Success — a complete AI-powered interview
preparation platform built with FastAPI, SQLite, and plain HTML/CSS/JavaScript.
Practice mock interviews, MCQs, coding problems, and get resume feedback —
all from one account, running from a single server.

---

## Project Structure

```
SmartAIInterview/
├── setup.bat              <- Run this ONCE to set everything up
├── run.bat                <- Run this every time you want to start the app
├── requirements.txt
├── .env.example
├── .gitignore
│
├── backend/
│   ├── main.py              FastAPI entry point (also serves the frontend)
│   ├── database.py          SQLite by default via SQLAlchemy
│   ├── models.py            Database tables
│   ├── schemas.py           Request/response validation
│   ├── auth.py               Password hashing (bcrypt) + JWT auth
│   ├── ai_service.py         AI integration with built-in fallback/demo mode
│   ├── resume_service.py     PDF/DOCX text extraction
│   └── routes/
│       ├── auth_routes.py
│       ├── interview_routes.py
│       ├── quiz_routes.py
│       ├── resume_routes.py
│       ├── performance_routes.py
│       ├── coding_routes.py
│       └── admin_routes.py
│
├── frontend/                 Plain HTML/CSS/JS, no build step
│   ├── index.html, login.html, signup.html, dashboard.html, ...
│   └── assets/{css,js,images}/
│
├── database/
│   ├── mcq_seed_data.py       122 MCQ questions (auto-loaded on first run)
│   └── coding_seed_data.py    6 coding problems (auto-loaded on first run)
│
└── uploads/resumes/           Uploaded resume files are stored here
```

---

## 1. Installation

You need **Python 3.10+** installed (download from python.org, and check
"Add Python to PATH" during install). No Node.js, no MySQL, no separate
database server needed.

## 2. Virtual Environment & Dependencies (automatic)

Double-click **`setup.bat`**. It will:
- Detect Python (`python` or `py`, whichever works on your system)
- Create a virtual environment in `venv/`
- Install everything in `requirements.txt`
- Create your `.env` file from `.env.example`
- Start the app

You only need to run this once.

## 3. Environment Variables

Copy `.env.example` to `.env` (done automatically by `setup.bat`). Values:

| Variable | Purpose | Required? |
|---|---|---|
| `SECRET_KEY` | Signs login tokens (JWT) | Yes — set any long random string |
| `AI_API_KEY` | Enables live AI question generation & scoring | No — leave blank for demo/fallback mode |
| `AI_MODEL` | Which AI model to call, if a key is set | No |
| `APP_HOST` / `APP_PORT` | Where the server listens locally | No — defaults are fine |
| `MAX_RESUME_SIZE_MB` | Resume upload size limit | No — defaults to 5 |
| `DATABASE_URL` | Overrides the default SQLite file | No — leave unset for zero-config SQLite |

**No API keys or secrets are ever sent to the frontend JavaScript** — the
browser only ever talks to your own backend, which holds the real key.

## 4. Local Run

Double-click **`run.bat`** any time after setup. It activates the virtual
environment, starts the server, and opens your browser automatically at
`http://127.0.0.1:8000`.

## 5. Database Initialization (automatic)

SQLite is used by default — a single file (`smart_ai_interview.db`) created
automatically in the project folder the first time you run the app. All
tables are created on startup, and the 122 MCQ questions plus 6 coding
problems are inserted automatically the first time the database is empty.
**No manual database setup is required.**

## 6. AI API Configuration

- **With `AI_API_KEY` set**: mock interview questions and answer scoring,
  and resume analysis, are generated live by the configured AI model.
- **Without it (default)**: the app runs in **Fallback / Demo Mode** —
  interview questions come from a built-in question bank, answers are
  scored with transparent rule-based logic, and resumes are analyzed with
  keyword matching. Every demo-generated result is clearly labeled as such
  in the UI (a "Demo Mode" badge in the top bar, and a demo banner on
  results) — the app never claims a live AI evaluation happened when it
  didn't.
- MCQ practice, the question bank, and coding practice **never** depend on
  AI — they always work identically either way.

## 7. GitHub Upload

1. Create a free account at https://github.com if you don't have one.
2. Create a new repository (Public or Private).
3. On the repo page, click "uploading an existing file" and drag in your
   whole project folder — **except** `venv/` and your local `.env` file
   (the included `.gitignore` keeps these out automatically if you use
   `git` instead of the web uploader).
4. Commit the changes.

## 8. Deployment (Render — free tier)

1. Create a free account at https://render.com (sign in with GitHub).
2. Dashboard → **New +** → **Web Service** → connect your repository.
3. Fill in:

   | Field | Value |
   |---|---|
   | **Runtime** | Python 3 |
   | **Build Command** | `pip install -r requirements.txt` |
   | **Start Command** | `uvicorn main:app --app-dir backend --host 0.0.0.0 --port $PORT` |
   | **Instance Type** | Free |

4. Add environment variables in the Render dashboard:
   - `SECRET_KEY` → any long random string you make up
   - `AI_API_KEY` → your key, or leave unset for demo mode
   - Do **not** set `DATABASE_URL` — leaving it unset keeps SQLite active,
     which is exactly what the free tier needs (no external database
     required).
5. Click **Create Web Service**. After the build finishes, your public
   link appears at the top of the page (e.g. `https://your-app.onrender.com`).

**Note on Render's free tier:** the SQLite database file resets whenever
the service restarts or redeploys (it auto-reseeds the 122 MCQs and 6
coding problems each time), and the service sleeps after 15 minutes of
inactivity, waking up in 30–50 seconds on the next visit. This is expected
and fine for a class demo; it is not intended as permanent production
storage.

---

## Login Credentials for Testing

There are no pre-created accounts — sign up your own from the Sign Up page.
To test the **Admin Dashboard**, promote a user to admin from the SQLite
database (using a tool like "DB Browser for SQLite", free, or Python):

```python
import sqlite3
conn = sqlite3.connect("smart_ai_interview.db")
conn.execute("UPDATE users SET is_admin = 1 WHERE email = 'your_email@example.com'")
conn.commit()
```

Then use the **Admin Login** tab on the Login page with that account.

---

## Important Notes & Limitations

- **Coding Practice uses a demo execution sandbox.** Submitted code runs in
  a plain Python subprocess with a short timeout for practice purposes
  only. It is **not** a secure, isolated, multi-tenant code execution
  environment — do not extend this as-is to run untrusted code at scale
  in a real product.
- **AI features are clearly labeled.** Whenever fallback/demo logic was
  used instead of a live AI call (because no `AI_API_KEY` is set, or the
  AI request failed), the result includes an `is_demo_evaluation` /
  `is_demo_execution` flag, and the UI shows a visible "Demo Mode" badge —
  the app never pretends a real AI evaluation happened when it didn't.
- Passwords are hashed with **bcrypt** — never stored in plain text.
- Login uses **JWT** tokens; admin routes require `is_admin = true` and
  reject regular users with a 403 error.
- All database queries use SQLAlchemy's parameterized queries (no manual
  SQL string concatenation), which protects against SQL injection.
- Resume uploads are validated for file type (PDF/DOCX only) and size
  (5MB default, configurable via `MAX_RESUME_SIZE_MB`).
- Unhandled server errors always return a friendly JSON message — raw
  Python stack tracebacks are never sent to the browser (they're logged
  to the server console for debugging instead).

---

## Common Errors and Fixes

**"Python was not found"** — Install Python from python.org with "Add
Python to PATH" checked, then restart your terminal.

**The app starts but pages show "Can't reach the server"** — The backend
isn't running. Check the terminal window from `run.bat` for errors.

**Signup/login fails immediately** — Check the terminal log; on startup the
server prints whether the database connected successfully.

**AI features aren't generating dynamic content** — Check `AI_API_KEY` in
`.env`. If intentionally blank, this is expected (demo mode).

**Port 8000 already in use** — Change `APP_PORT` in `.env` to something
else (e.g. `8080`) and restart with `run.bat`.

**Render shows "Application failed to respond"** — Double-check the Start
Command is exactly `uvicorn main:app --app-dir backend --host 0.0.0.0 --port $PORT`.
