"""
performance_routes.py
Aggregated performance analytics used by the Dashboard, Result &
Performance, and History pages.
"""
from datetime import date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
import models
from auth import get_current_user

router = APIRouter(prefix="/api/performance", tags=["performance"])


def _compute_streak(db: Session, user_id: int) -> int:
    """Consecutive days (including today) with at least one interview,
    quiz attempt, or coding submission. Purely derived from real
    timestamps already in the database - nothing hardcoded."""
    dates = set()
    for row in db.query(models.Interview.created_at).filter(models.Interview.user_id == user_id).all():
        if row[0]:
            dates.add(row[0].date())
    for row in db.query(models.MCQAttempt.created_at).filter(models.MCQAttempt.user_id == user_id).all():
        if row[0]:
            dates.add(row[0].date())
    for row in db.query(models.CodingSubmission.created_at).filter(models.CodingSubmission.user_id == user_id).all():
        if row[0]:
            dates.add(row[0].date())

    if not dates:
        return 0

    streak = 0
    cursor = date.today()
    while cursor in dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


@router.get("/summary")
def performance_summary(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    perf = db.query(models.Performance).filter(models.Performance.user_id == current_user.id).first()
    coding_solved = db.query(models.CodingSubmission.coding_question_id).filter(
        models.CodingSubmission.user_id == current_user.id, models.CodingSubmission.status == "passed"
    ).distinct().count()

    resumes = db.query(models.ResumeAnalysis).filter(models.ResumeAnalysis.user_id == current_user.id).order_by(
        models.ResumeAnalysis.created_at.desc()
    ).first()

    streak = _compute_streak(db, current_user.id)

    if not perf:
        return {
            "total_interviews": 0, "total_mcq_attempts": 0, "avg_interview_score": 0, "avg_mcq_score": 0,
            "coding_solved": coding_solved, "latest_resume_score": resumes.strength_score if resumes else None,
            "practice_streak_days": streak,
        }
    return {
        "total_interviews": perf.total_interviews, "total_mcq_attempts": perf.total_mcq_attempts,
        "avg_interview_score": perf.avg_interview_score, "avg_mcq_score": perf.avg_mcq_score,
        "coding_solved": coding_solved, "latest_resume_score": resumes.strength_score if resumes else None,
        "practice_streak_days": streak,
    }


@router.get("/trends")
def performance_trends(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    interviews = (
        db.query(models.Interview)
        .filter(models.Interview.user_id == current_user.id, models.Interview.status == "completed")
        .order_by(models.Interview.completed_at.asc())
        .all()
    )
    attempts = (
        db.query(models.MCQAttempt)
        .filter(models.MCQAttempt.user_id == current_user.id)
        .order_by(models.MCQAttempt.created_at.asc())
        .all()
    )

    interview_trend = [
        {"date": (i.completed_at or i.created_at).isoformat(), "score": i.overall_score, "job_role": i.job_role}
        for i in interviews
    ]
    quiz_trend = [
        {"date": a.created_at.isoformat() if a.created_at else None, "score": a.score_percent, "category": a.category}
        for a in attempts
    ]

    technical_scores = [i.technical_score for i in interviews if i.technical_score is not None]
    communication_scores = [i.communication_score for i in interviews if i.communication_score is not None]
    problem_solving_scores = [i.problem_solving_score for i in interviews if i.problem_solving_score is not None]

    def safe_avg(vals):
        return round(sum(vals) / len(vals), 1) if vals else 0

    by_cat = {}
    for a in attempts:
        by_cat.setdefault(a.category, []).append(a.score_percent)
    topic_averages = {cat: round(sum(v) / len(v), 1) for cat, v in by_cat.items()}
    sorted_topics = sorted(topic_averages.items(), key=lambda x: x[1], reverse=True)

    return {
        "interview_trend": interview_trend, "quiz_trend": quiz_trend,
        "avg_technical": safe_avg(technical_scores), "avg_communication": safe_avg(communication_scores),
        "avg_problem_solving": safe_avg(problem_solving_scores),
        "topic_averages": topic_averages,
        # Strong = average >= 70, weak = average < 70, so one topic is never in both lists.
        "strongest_topics": [t[0] for t in sorted_topics if t[1] >= 70][:3],
        "weakest_topics": [t[0] for t in reversed(sorted_topics) if t[1] < 70][:3],
    }


@router.get("/recommendations")
def performance_recommendations(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """
    "Your AI Preparation Plan" - a short rule-based list generated from the
    user's actual activity (never hardcoded/fake). If AI is configured this
    still uses the same real data as input; the logic itself is transparent
    and reproducible either way, which is more honest for a scoring feature
    than a live AI call would be.
    """
    total_interviews = db.query(models.Interview).filter(models.Interview.user_id == current_user.id).count()
    coding_solved = db.query(models.CodingSubmission.coding_question_id).filter(
        models.CodingSubmission.user_id == current_user.id, models.CodingSubmission.status == "passed"
    ).distinct().count()
    resume_count = db.query(models.ResumeAnalysis).filter(models.ResumeAnalysis.user_id == current_user.id).count()
    attempts = db.query(models.MCQAttempt).filter(models.MCQAttempt.user_id == current_user.id).all()

    recommendations = []

    if total_interviews == 0:
        recommendations.append("Complete your first mock interview to get a baseline score.")
    if not attempts:
        recommendations.append("Take a Practice Interview (MCQ) quiz to see your starting knowledge level.")
    if coding_solved == 0:
        recommendations.append("Solve at least one Coding Practice problem - start with an Easy one.")
    if resume_count == 0:
        recommendations.append("Upload your resume to the Resume Analyzer for a strength score and tips.")

    if attempts:
        by_cat = {}
        for a in attempts:
            by_cat.setdefault(a.category, []).append(a.score_percent or 0)
        topic_avgs = {c: sum(v) / len(v) for c, v in by_cat.items()}
        weak = sorted(topic_avgs.items(), key=lambda x: x[1])[:2]
        for category, avg_score in weak:
            if avg_score < 70:
                recommendations.append(f"Improve {category} - your average there is {round(avg_score)}%. Try more questions in Question Bank or Practice Interview.")

    if not recommendations:
        recommendations.append("Great progress! Keep practicing regularly across all modules to stay sharp.")

    return {"recommendations": recommendations[:5]}
