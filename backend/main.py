"""
main.py
FastAPI application entry point for Smart AI Interview Assistance.
Wires up CORS, auto-creates database tables + seed data, all routers,
static frontend hosting, and global error handling.
"""
import os
import sys
import traceback
import importlib.util

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

load_dotenv()

from database import engine, Base, SessionLocal, check_database_connection
import models  # noqa: F401
import ai_service

from routes import (
    auth_routes, interview_routes, quiz_routes, resume_routes,
    performance_routes, coding_routes, admin_routes, assistant_routes,
)

APP_HOST = os.getenv("APP_HOST", "127.0.0.1")
APP_PORT = int(os.getenv("APP_PORT", "8000"))

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend")

app = FastAPI(title="Smart AI Interview Assistance", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print("=" * 60, file=sys.stderr)
    print(f"Unhandled error on {request.method} {request.url}", file=sys.stderr)
    traceback.print_exc()
    print("=" * 60, file=sys.stderr)
    return JSONResponse(status_code=500, content={"detail": "Something went wrong on our end. Please try again."})


def _load_module(rel_path, mod_name):
    path = os.path.join(PROJECT_ROOT, rel_path)
    if not os.path.isfile(path):
        return None
    spec = importlib.util.spec_from_file_location(mod_name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def seed_if_empty():
    db = SessionLocal()
    try:
        if db.query(models.MCQQuestion).count() == 0:
            seed_mod = _load_module("database/mcq_seed_data.py", "mcq_seed_data")
            if seed_mod:
                for category, difficulty, question, a, b, c, d, correct, expl in seed_mod.MCQ_SEED_DATA:
                    db.add(models.MCQQuestion(
                        category=category, difficulty=difficulty, question=question,
                        option_a=a, option_b=b, option_c=c, option_d=d,
                        correct_answer=correct, explanation=expl,
                    ))
                db.commit()
                print(f"[startup] Auto-seeded {len(seed_mod.MCQ_SEED_DATA)} MCQ questions.")

        if db.query(models.CodingQuestion).count() == 0:
            coding_mod = _load_module("database/coding_seed_data.py", "coding_seed_data")
            if coding_mod:
                for p in coding_mod.CODING_SEED_DATA:
                    db.add(models.CodingQuestion(
                        title=p["title"], slug=p["slug"], statement=p["statement"],
                        difficulty=p["difficulty"], category=p.get("category"),
                        starter_code=p.get("starter_code"), test_cases_json=p["test_cases_json"],
                    ))
                db.commit()
                print(f"[startup] Auto-seeded {len(coding_mod.CODING_SEED_DATA)} coding problems.")
    except Exception as e:
        print(f"[startup] Could not auto-seed data: {e}")
    finally:
        db.close()


@app.on_event("startup")
def on_startup():
    ok, message = check_database_connection()
    if not ok:
        print("!" * 70)
        print(f"DATABASE CONNECTION FAILED: {message}")
        print("!" * 70)
    else:
        try:
            Base.metadata.create_all(bind=engine)
            print("[startup] Database connected and tables verified.")
            seed_if_empty()
        except Exception as e:
            print(f"[startup] Could not verify/create tables: {e}")

    if ai_service.FALLBACK_MODE:
        print("=" * 70)
        print("AI_API_KEY is not set. Running in FALLBACK / DEMO MODE.")
        print("Mock interviews use predefined questions + rule-based scoring.")
        print("MCQs and coding practice are unaffected and always work.")
        print("=" * 70)
    else:
        print("[startup] AI API key detected. Full AI features enabled.")


app.include_router(auth_routes.router)
app.include_router(interview_routes.router)
app.include_router(quiz_routes.router)
app.include_router(resume_routes.router)
app.include_router(performance_routes.router)
app.include_router(coding_routes.router)
app.include_router(admin_routes.router)
app.include_router(assistant_routes.router)


@app.get("/api/health")
def health_check():
    db_ok, db_message = check_database_connection()
    return {
        "status": "ok",
        "database_connected": db_ok,
        "database_message": db_message,
        "ai_mode": "fallback" if ai_service.FALLBACK_MODE else "live",
    }


if os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
else:
    @app.get("/")
    def frontend_missing():
        return JSONResponse(status_code=500, content={"detail": f"Frontend folder not found at {FRONTEND_DIR}"})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=APP_HOST, port=APP_PORT, reload=True)
