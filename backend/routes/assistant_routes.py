"""
assistant_routes.py
The floating "Ask AI" assistant available on every authenticated page.
Uses ai_service.ask_assistant(), which itself falls back to rule-based
replies when no AI_API_KEY is configured - the assistant is never broken,
just less dynamic.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
import models
import ai_service
from auth import get_current_user

router = APIRouter(prefix="/api/assistant", tags=["assistant"])


class AskRequest(BaseModel):
    message: str


@router.post("/ask")
def ask(data: AskRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Give the assistant a little real context so fallback replies are relevant.
    attempts = db.query(models.MCQAttempt).filter(models.MCQAttempt.user_id == current_user.id).all()
    by_cat = {}
    for a in attempts:
        by_cat.setdefault(a.category, []).append(a.score_percent or 0)
    topic_avgs = {c: sum(v) / len(v) for c, v in by_cat.items()}
    weak_topics = [c for c, v in sorted(topic_avgs.items(), key=lambda x: x[1]) if v < 60][:3]

    context = {"weak_topics": weak_topics}
    reply, is_demo = ai_service.ask_assistant(data.message, context)
    return {"reply": reply, "is_demo": is_demo}
