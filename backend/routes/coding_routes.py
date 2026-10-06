"""
coding_routes.py
Coding Practice: lists problems, and runs submitted Python code against
each problem's test cases.

IMPORTANT - DEMO CODE EXECUTION:
Submitted code is run in a plain Python subprocess with a short timeout.
This is a practice/demo sandbox only - it is NOT a secure, isolated,
multi-tenant execution environment. Do not deploy this as-is to run
arbitrary untrusted code at scale. This limitation is also shown in the
UI and README.
"""
import json
import subprocess
import sys
import tempfile
import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from auth import get_current_user

router = APIRouter(prefix="/api/coding", tags=["coding"])

EXECUTION_TIMEOUT_SECONDS = 5


@router.get("/questions")
def list_coding_questions(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    questions = db.query(models.CodingQuestion).order_by(models.CodingQuestion.id.asc()).all()
    return [
        {"id": q.id, "title": q.title, "slug": q.slug, "difficulty": q.difficulty, "category": q.category}
        for q in questions
    ]


@router.get("/questions/{slug}")
def get_coding_question(slug: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    q = db.query(models.CodingQuestion).filter(models.CodingQuestion.slug == slug).first()
    if not q:
        raise HTTPException(status_code=404, detail="Coding question not found.")
    test_cases = json.loads(q.test_cases_json)
    return {
        "id": q.id, "title": q.title, "slug": q.slug, "statement": q.statement,
        "difficulty": q.difficulty, "category": q.category, "starter_code": q.starter_code,
        "test_case_inputs": [tc["input"] for tc in test_cases],  # inputs shown, expected kept server-side
    }


@router.post("/questions/{slug}/submit")
def submit_code(slug: str, data: schemas.SubmitCodeRequest, db: Session = Depends(get_db),
                 current_user: models.User = Depends(get_current_user)):
    q = db.query(models.CodingQuestion).filter(models.CodingQuestion.slug == slug).first()
    if not q:
        raise HTTPException(status_code=404, detail="Coding question not found.")

    test_cases = json.loads(q.test_cases_json)
    results = []
    passed_count = 0

    for tc in test_cases:
        result = _run_demo_code(data.code, tc["input"])
        is_pass = result["ok"] and result["output"] == tc["expected"]
        if is_pass:
            passed_count += 1
        results.append({
            "input": tc["input"], "expected": tc["expected"],
            "actual": result["output"] if result["ok"] else result["error"],
            "passed": is_pass,
        })

    total = len(test_cases)
    status = "passed" if passed_count == total else ("error" if any(not r["passed"] and "Error" in str(r["actual"]) for r in results) else "failed")

    submission = models.CodingSubmission(
        user_id=current_user.id, coding_question_id=q.id, code=data.code,
        passed_count=passed_count, total_count=total, status=status,
        output_log=json.dumps(results),
    )
    db.add(submission)
    db.commit()

    return {
        "passed_count": passed_count, "total_count": total, "status": status,
        "results": results, "is_demo_execution": True,
    }


def _run_demo_code(user_code: str, call_expression: str):
    """
    Runs the user's function definition plus one call expression in a fresh
    Python subprocess and captures printed output. Demo-grade only: uses a
    short timeout and a temp file, but does not sandbox filesystem/network
    access. Never deploy this to execute untrusted code at scale.
    """
    wrapper = f"{user_code}\n\nprint({call_expression})\n"
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(wrapper)
        temp_path = f.name

    try:
        proc = subprocess.run(
            [sys.executable, temp_path],
            capture_output=True, text=True, timeout=EXECUTION_TIMEOUT_SECONDS,
        )
        if proc.returncode != 0:
            return {"ok": False, "error": (proc.stderr or "Unknown error").strip().splitlines()[-1] if proc.stderr else "Runtime error"}
        return {"ok": True, "output": proc.stdout.strip()}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "Code took too long to run (possible infinite loop)."}
    except Exception as e:
        return {"ok": False, "error": f"Execution error: {e}"}
    finally:
        try:
            os.unlink(temp_path)
        except OSError:
            pass
