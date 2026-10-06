"""
quiz_routes.py
MCQ practice: category list, starting a randomized quiz, submitting and
scoring it, and quiz history. Works entirely without AI.
"""
import random
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from auth import get_current_user

router = APIRouter(prefix="/api/quiz", tags=["quiz"])

CATEGORIES = [
    "Python", "Java", "C++", "JavaScript", "SQL", "DBMS",
    "Data Structures", "Web Development", "Cybersecurity",
    "Software Engineering", "System Design",
]

VALID_COUNTS = {10, 20, 30}


@router.get("/categories")
def get_categories(db: Session = Depends(get_db)):
    counts = {c: 0 for c in CATEGORIES}
    rows = db.query(models.MCQQuestion.category, models.MCQQuestion.id).all()
    for cat, _id in rows:
        if cat in counts:
            counts[cat] += 1
    return [{"name": c, "question_count": counts[c]} for c in CATEGORIES]


@router.get("/bank")
def question_bank(search: str = "", category: str = "", difficulty: str = "", bookmarked_only: bool = False,
                   page: int = 1, page_size: int = 20,
                   db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Browsable question bank with full answers/explanations shown - this is
    a study reference, not a scored quiz, so answers are visible upfront."""
    bookmarked_ids = {
        b.mcq_question_id for b in
        db.query(models.Bookmark).filter(models.Bookmark.user_id == current_user.id).all()
    }

    query = db.query(models.MCQQuestion)
    if search:
        query = query.filter(models.MCQQuestion.question.ilike(f"%{search}%"))
    if category:
        query = query.filter(models.MCQQuestion.category == category)
    if difficulty:
        query = query.filter(models.MCQQuestion.difficulty == difficulty)
    if bookmarked_only:
        if not bookmarked_ids:
            return {"total": 0, "page": 1, "page_size": page_size, "questions": []}
        query = query.filter(models.MCQQuestion.id.in_(bookmarked_ids))

    total = query.count()
    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    questions = query.order_by(models.MCQQuestion.category, models.MCQQuestion.id).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "total": total, "page": page, "page_size": page_size,
        "questions": [
            {"id": q.id, "category": q.category, "difficulty": q.difficulty, "question": q.question,
             "option_a": q.option_a, "option_b": q.option_b, "option_c": q.option_c, "option_d": q.option_d,
             "correct_answer": q.correct_answer, "explanation": q.explanation,
             "is_bookmarked": q.id in bookmarked_ids}
            for q in questions
        ],
    }


@router.post("/bookmark/{question_id}")
def toggle_bookmark(question_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    question = db.query(models.MCQQuestion).filter(models.MCQQuestion.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found.")

    existing = db.query(models.Bookmark).filter(
        models.Bookmark.user_id == current_user.id, models.Bookmark.mcq_question_id == question_id
    ).first()
    if existing:
        db.delete(existing)
        db.commit()
        return {"is_bookmarked": False}
    else:
        db.add(models.Bookmark(user_id=current_user.id, mcq_question_id=question_id))
        db.commit()
        return {"is_bookmarked": True}


@router.post("/start")
def start_quiz(data: schemas.StartQuizRequest, current_user: models.User = Depends(get_current_user),
               db: Session = Depends(get_db)):
    if data.num_questions not in VALID_COUNTS:
        raise HTTPException(status_code=400, detail="num_questions must be 10, 20 or 30.")

    pool = db.query(models.MCQQuestion).filter(
        models.MCQQuestion.category == data.category, models.MCQQuestion.difficulty == data.difficulty
    ).all()
    if not pool:
        raise HTTPException(status_code=404, detail="No questions available for this category/difficulty yet.")

    count = min(data.num_questions, len(pool))
    selected = random.sample(pool, count)

    return {
        "category": data.category, "difficulty": data.difficulty, "total_questions": len(selected),
        "questions": [
            {"id": q.id, "question": q.question, "option_a": q.option_a, "option_b": q.option_b,
             "option_c": q.option_c, "option_d": q.option_d}
            for q in selected
        ],
    }


@router.post("/submit")
def submit_quiz(data: schemas.SubmitQuizRequest, current_user: models.User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    if not data.answers:
        raise HTTPException(status_code=400, detail="No answers submitted.")

    question_ids = [a.question_id for a in data.answers]
    questions = {q.id: q for q in db.query(models.MCQQuestion).filter(models.MCQQuestion.id.in_(question_ids)).all()}

    attempt = models.MCQAttempt(
        user_id=current_user.id, category=data.category, difficulty=data.difficulty,
        total_questions=len(data.answers), time_taken_seconds=data.time_taken_seconds,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    correct_count = 0
    review = []
    for a in data.answers:
        q = questions.get(a.question_id)
        if not q:
            continue
        is_correct = bool(a.selected_answer) and a.selected_answer.upper() == q.correct_answer.upper()
        if is_correct:
            correct_count += 1
        db.add(models.MCQAnswer(attempt_id=attempt.id, question_id=q.id,
                                 selected_answer=a.selected_answer, is_correct=is_correct))
        review.append({
            "question": q.question,
            "options": {"A": q.option_a, "B": q.option_b, "C": q.option_c, "D": q.option_d},
            "correct_answer": q.correct_answer, "your_answer": a.selected_answer,
            "is_correct": is_correct, "explanation": q.explanation,
        })

    total = len(data.answers)
    wrong_count = total - correct_count
    score_percent = round((correct_count / total) * 100, 1) if total else 0

    attempt.correct_answers = correct_count
    attempt.wrong_answers = wrong_count
    attempt.score_percent = score_percent
    db.commit()

    perf = db.query(models.Performance).filter(models.Performance.user_id == current_user.id).first()
    all_attempts = db.query(models.MCQAttempt).filter(models.MCQAttempt.user_id == current_user.id).all()
    if perf:
        perf.total_mcq_attempts = len(all_attempts)
        perf.avg_mcq_score = round(sum(a.score_percent or 0 for a in all_attempts) / len(all_attempts), 1)
        db.commit()

    if score_percent >= 80:
        performance_label = "Excellent"
    elif score_percent >= 50:
        performance_label = "Good"
    else:
        performance_label = "Needs Improvement"

    return {
        "attempt_id": attempt.id, "total_questions": total, "correct_answers": correct_count,
        "wrong_answers": wrong_count, "score_percent": score_percent, "performance_label": performance_label,
        "time_taken_seconds": data.time_taken_seconds, "review": review,
    }


@router.get("/history")
def quiz_history(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    attempts = (
        db.query(models.MCQAttempt)
        .filter(models.MCQAttempt.user_id == current_user.id)
        .order_by(models.MCQAttempt.created_at.desc())
        .all()
    )
    return [
        {
            "id": a.id, "category": a.category, "difficulty": a.difficulty,
            "total_questions": a.total_questions, "correct_answers": a.correct_answers,
            "score_percent": a.score_percent, "date": a.created_at.isoformat() if a.created_at else None,
        }
        for a in attempts
    ]
