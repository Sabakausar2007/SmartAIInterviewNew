"""
interview_routes.py
AI Mock Interview: start an interview, submit/skip answers, finish and get
the scored result, and view interview history.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
import ai_service
from auth import get_current_user

router = APIRouter(prefix="/api/interview", tags=["interview"])

VALID_COUNTS = {5, 10, 15}


@router.post("/start")
def start_interview(data: schemas.StartInterviewRequest, current_user: models.User = Depends(get_current_user),
                     db: Session = Depends(get_db)):
    if data.num_questions not in VALID_COUNTS:
        raise HTTPException(status_code=400, detail="num_questions must be 5, 10 or 15.")

    resume_context = None
    if data.mode == "resume_based":
        if not data.resume_id:
            raise HTTPException(status_code=400, detail="resume_id is required for a resume-based interview.")
        resume = db.query(models.ResumeAnalysis).filter(
            models.ResumeAnalysis.id == data.resume_id, models.ResumeAnalysis.user_id == current_user.id
        ).first()
        if not resume:
            raise HTTPException(status_code=404, detail="Resume not found.")
        resume_context = f"Skills: {resume.skills}; Projects: {resume.projects}; Experience: {resume.experience}"

    questions_text, is_demo = ai_service.generate_interview_questions(
        mode=data.mode, job_role=data.job_role, experience_level=data.experience_level,
        interview_type=data.interview_type, num_questions=data.num_questions, resume_context=resume_context,
    )

    interview = models.Interview(
        user_id=current_user.id, mode=data.mode, job_role=data.job_role,
        experience_level=data.experience_level, interview_type=data.interview_type,
        total_questions=len(questions_text), status="in_progress", is_demo_evaluation=is_demo,
    )
    db.add(interview)
    db.commit()
    db.refresh(interview)

    questions_out = []
    for i, qtext in enumerate(questions_text, start=1):
        q = models.InterviewQuestion(interview_id=interview.id, question_number=i, question_text=qtext)
        db.add(q)
        db.commit()
        db.refresh(q)
        questions_out.append({"id": q.id, "question_number": q.question_number, "question_text": q.question_text})

    return {"interview_id": interview.id, "total_questions": len(questions_out), "questions": questions_out,
            "is_demo_evaluation": is_demo}


@router.post("/answer")
def submit_answer(data: schemas.SubmitAnswerRequest, current_user: models.User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    question = db.query(models.InterviewQuestion).filter(models.InterviewQuestion.id == data.question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found.")
    interview = db.query(models.Interview).filter(
        models.Interview.id == question.interview_id, models.Interview.user_id == current_user.id
    ).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found.")

    evaluation, is_demo = ai_service.evaluate_answer(
        question=question.question_text, answer=data.answer_text or "",
        job_role=interview.job_role, skipped=data.skipped,
    )

    answer = models.InterviewAnswer(
        question_id=question.id, answer_text=data.answer_text, was_skipped=data.skipped,
        score=evaluation["score"], technical_score=evaluation["technical_score"],
        communication_score=evaluation["communication_score"], problem_solving_score=evaluation["problem_solving_score"],
        feedback=evaluation["feedback"],
    )
    db.add(answer)
    db.commit()

    return {**evaluation, "is_demo_evaluation": is_demo}


@router.post("/{interview_id}/finish")
def finish_interview(interview_id: int, current_user: models.User = Depends(get_current_user),
                      db: Session = Depends(get_db)):
    interview = db.query(models.Interview).filter(
        models.Interview.id == interview_id, models.Interview.user_id == current_user.id
    ).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found.")

    answers = (
        db.query(models.InterviewAnswer)
        .join(models.InterviewQuestion, models.InterviewAnswer.question_id == models.InterviewQuestion.id)
        .filter(models.InterviewQuestion.interview_id == interview_id)
        .all()
    )
    if not answers:
        raise HTTPException(status_code=400, detail="No answers submitted yet - cannot finish an empty interview.")

    def avg(key):
        vals = [getattr(a, key) for a in answers if getattr(a, key) is not None]
        return round(sum(vals) / len(vals), 1) if vals else 0

    interview.overall_score = avg("score")
    interview.technical_score = avg("technical_score")
    interview.communication_score = avg("communication_score")
    interview.problem_solving_score = avg("problem_solving_score")

    feedback, feedback_is_demo = ai_service.generate_feedback({
        "overall_score": interview.overall_score, "technical_score": interview.technical_score,
        "communication_score": interview.communication_score,
    })
    interview.strengths = "\n".join(feedback["strengths"])
    interview.improvements = "\n".join(feedback["improvements"])
    interview.recommended_practice = "\n".join(feedback["recommended_practice"])
    interview.is_demo_evaluation = interview.is_demo_evaluation or feedback_is_demo
    interview.status = "completed"

    from sqlalchemy.sql import func
    interview.completed_at = func.now()
    db.commit()

    perf = db.query(models.Performance).filter(models.Performance.user_id == current_user.id).first()
    completed = db.query(models.Interview).filter(
        models.Interview.user_id == current_user.id, models.Interview.status == "completed"
    ).all()
    if perf:
        perf.total_interviews = len(completed)
        perf.avg_interview_score = round(sum(i.overall_score or 0 for i in completed) / len(completed), 1)
        db.commit()

    return {"message": "Interview completed.", "interview_id": interview.id}


@router.get("/{interview_id}/result")
def get_interview_result(interview_id: int, current_user: models.User = Depends(get_current_user),
                          db: Session = Depends(get_db)):
    interview = db.query(models.Interview).filter(
        models.Interview.id == interview_id, models.Interview.user_id == current_user.id
    ).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found.")

    review = []
    for q in sorted(interview.questions, key=lambda x: x.question_number):
        a = q.answer
        review.append({
            "question": q.question_text,
            "answer": a.answer_text if a else None,
            "skipped": a.was_skipped if a else True,
            "score": a.score if a else 0,
            "feedback": a.feedback if a else None,
        })

    return {
        "id": interview.id, "mode": interview.mode, "job_role": interview.job_role,
        "experience_level": interview.experience_level, "interview_type": interview.interview_type,
        "status": interview.status, "overall_score": interview.overall_score,
        "technical_score": interview.technical_score, "communication_score": interview.communication_score,
        "problem_solving_score": interview.problem_solving_score,
        "strengths": (interview.strengths or "").split("\n") if interview.strengths else [],
        "improvements": (interview.improvements or "").split("\n") if interview.improvements else [],
        "recommended_practice": (interview.recommended_practice or "").split("\n") if interview.recommended_practice else [],
        "is_demo_evaluation": interview.is_demo_evaluation,
        "created_at": interview.created_at.isoformat() if interview.created_at else None,
        "question_review": review,
    }


@router.get("/history")
def interview_history(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    interviews = (
        db.query(models.Interview)
        .filter(models.Interview.user_id == current_user.id)
        .order_by(models.Interview.created_at.desc())
        .all()
    )
    return [
        {
            "id": i.id, "date": i.created_at.isoformat() if i.created_at else None,
            "mode": i.mode, "job_role": i.job_role, "interview_type": i.interview_type,
            "score": i.overall_score, "status": i.status, "is_demo_evaluation": i.is_demo_evaluation,
        }
        for i in interviews
    ]
