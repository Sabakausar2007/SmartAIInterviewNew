"""
admin_routes.py
Admin dashboard: platform stats, user management, interview records, and
question management. All endpoints require is_admin=True.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from database import get_db
import models
import schemas
from auth import get_current_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _log(db: Session, admin: models.User, action: str, target: str = None):
    db.add(models.AdminActivityLog(admin_user_id=admin.id, action=action, target=target))
    db.commit()


@router.get("/stats")
def admin_stats(db: Session = Depends(get_db), current_admin: models.User = Depends(get_current_admin)):
    total_users = db.query(models.User).count()
    total_interviews = db.query(models.Interview).count()
    total_mcq_questions = db.query(models.MCQQuestion).count()
    total_coding_questions = db.query(models.CodingQuestion).count()

    completed = db.query(models.Interview).filter(models.Interview.status == "completed").all()
    avg_performance = round(sum(i.overall_score or 0 for i in completed) / len(completed), 1) if completed else 0

    return {
        "total_users": total_users, "total_interviews": total_interviews,
        "total_questions": total_mcq_questions + total_coding_questions,
        "total_mcq_questions": total_mcq_questions, "total_coding_questions": total_coding_questions,
        "average_performance": avg_performance,
    }


@router.get("/users")
def list_users(search: str = Query(default=""), page: int = Query(default=1, ge=1),
                page_size: int = Query(default=10, ge=1, le=100),
                db: Session = Depends(get_db), current_admin: models.User = Depends(get_current_admin)):
    query = db.query(models.User)
    if search:
        like = f"%{search}%"
        query = query.filter(or_(models.User.full_name.like(like), models.User.email.like(like)))
    total = query.count()
    users = query.order_by(models.User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "total": total, "page": page, "page_size": page_size,
        "users": [
            {"id": u.id, "full_name": u.full_name, "email": u.email, "is_admin": u.is_admin,
             "is_active": u.is_active, "created_at": u.created_at.isoformat() if u.created_at else None}
            for u in users
        ],
    }


@router.put("/users/{user_id}/toggle-active")
def toggle_active(user_id: int, db: Session = Depends(get_db), current_admin: models.User = Depends(get_current_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    user.is_active = not user.is_active
    db.commit()
    _log(db, current_admin, "toggle_active", f"user:{user_id}")
    return {"message": "Updated.", "is_active": user.is_active}


@router.put("/users/{user_id}/toggle-admin")
def toggle_admin(user_id: int, db: Session = Depends(get_db), current_admin: models.User = Depends(get_current_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    user.is_admin = not user.is_admin
    db.commit()
    _log(db, current_admin, "toggle_admin", f"user:{user_id}")
    return {"message": "Updated.", "is_admin": user.is_admin}


@router.get("/interviews")
def list_interviews(page: int = Query(default=1, ge=1), page_size: int = Query(default=10, ge=1, le=100),
                     db: Session = Depends(get_db), current_admin: models.User = Depends(get_current_admin)):
    query = db.query(models.Interview)
    total = query.count()
    interviews = query.order_by(models.Interview.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "total": total, "page": page, "page_size": page_size,
        "interviews": [
            {"id": i.id, "user_id": i.user_id, "job_role": i.job_role, "mode": i.mode,
             "status": i.status, "overall_score": i.overall_score,
             "created_at": i.created_at.isoformat() if i.created_at else None}
            for i in interviews
        ],
    }


@router.get("/mcq-questions")
def list_mcq_questions(category: str = Query(default=""), page: int = Query(default=1, ge=1),
                        page_size: int = Query(default=20, ge=1, le=100),
                        db: Session = Depends(get_db), current_admin: models.User = Depends(get_current_admin)):
    query = db.query(models.MCQQuestion)
    if category:
        query = query.filter(models.MCQQuestion.category == category)
    total = query.count()
    questions = query.order_by(models.MCQQuestion.id.asc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "total": total, "page": page, "page_size": page_size,
        "questions": [
            {"id": q.id, "category": q.category, "difficulty": q.difficulty,
             "question": q.question, "option_a": q.option_a, "option_b": q.option_b,
             "option_c": q.option_c, "option_d": q.option_d,
             "correct_answer": q.correct_answer, "explanation": q.explanation}
            for q in questions
        ],
    }


@router.post("/mcq-questions")
def create_mcq_question(data: schemas.MCQCreateRequest, db: Session = Depends(get_db),
                         current_admin: models.User = Depends(get_current_admin)):
    correct = data.correct_answer.strip().upper()
    if correct not in ("A", "B", "C", "D"):
        raise HTTPException(status_code=400, detail="correct_answer must be A, B, C or D.")
    q = models.MCQQuestion(
        category=data.category, difficulty=data.difficulty, question=data.question,
        option_a=data.option_a, option_b=data.option_b, option_c=data.option_c, option_d=data.option_d,
        correct_answer=correct, explanation=data.explanation,
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    _log(db, current_admin, "create_mcq_question", f"question:{q.id}")
    return {"message": "Question created.", "id": q.id}


@router.put("/mcq-questions/{question_id}")
def update_mcq_question(question_id: int, data: schemas.MCQCreateRequest, db: Session = Depends(get_db),
                         current_admin: models.User = Depends(get_current_admin)):
    q = db.query(models.MCQQuestion).filter(models.MCQQuestion.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found.")
    correct = data.correct_answer.strip().upper()
    if correct not in ("A", "B", "C", "D"):
        raise HTTPException(status_code=400, detail="correct_answer must be A, B, C or D.")
    q.category, q.difficulty, q.question = data.category, data.difficulty, data.question
    q.option_a, q.option_b, q.option_c, q.option_d = data.option_a, data.option_b, data.option_c, data.option_d
    q.correct_answer, q.explanation = correct, data.explanation
    db.commit()
    _log(db, current_admin, "update_mcq_question", f"question:{question_id}")
    return {"message": "Question updated."}


@router.delete("/mcq-questions/{question_id}")
def delete_mcq_question(question_id: int, db: Session = Depends(get_db), current_admin: models.User = Depends(get_current_admin)):
    q = db.query(models.MCQQuestion).filter(models.MCQQuestion.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found.")
    db.delete(q)
    db.commit()
    _log(db, current_admin, "delete_mcq_question", f"question:{question_id}")
    return {"message": "Question deleted."}
