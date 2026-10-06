"""
resume_routes.py
Resume upload, text extraction, AI/fallback analysis, and listing past
resume analyses.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from database import get_db
import models
import ai_service
import resume_service
from auth import get_current_user

router = APIRouter(prefix="/api/resume", tags=["resume"])


@router.post("/upload")
async def upload_resume(file: UploadFile = File(...), db: Session = Depends(get_db),
                         current_user: models.User = Depends(get_current_user)):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    ext = resume_service.validate_resume_file(file, content)
    saved_path = resume_service.save_resume_file(content, ext)
    extracted_text = resume_service.extract_resume_text(saved_path, ext) or ""

    analysis, is_demo = ai_service.analyze_resume(extracted_text) if extracted_text else (
        {
            "skills": "Could not extract text from this file.", "education": "Could not extract text from this file.",
            "projects": "Could not extract text from this file.", "experience": "Could not extract text from this file.",
            "certifications": "Could not extract text from this file.", "keywords": "Could not extract text from this file.",
            "formatting_notes": "No text could be read from this file.", "strength_score": 0,
            "doing_well": [], "improve": ["Try uploading a text-based PDF or DOCX file instead of a scanned image."],
        }, True
    )

    resume = models.ResumeAnalysis(
        user_id=current_user.id, file_name=file.filename, file_path=saved_path, extracted_text=extracted_text,
        skills=analysis.get("skills"), education=analysis.get("education"), projects=analysis.get("projects"),
        experience=analysis.get("experience"), certifications=analysis.get("certifications"),
        keywords=analysis.get("keywords"), formatting_notes=analysis.get("formatting_notes"),
        strength_score=analysis.get("strength_score"),
        doing_well="\n".join(analysis.get("doing_well", [])),
        improve="\n".join(analysis.get("improve", [])),
        is_demo_evaluation=is_demo,
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)

    return _resume_payload(resume)


def _resume_payload(r: models.ResumeAnalysis):
    return {
        "id": r.id, "file_name": r.file_name, "skills": r.skills, "education": r.education,
        "projects": r.projects, "experience": r.experience, "certifications": r.certifications,
        "keywords": r.keywords, "formatting_notes": r.formatting_notes, "strength_score": r.strength_score,
        "doing_well": (r.doing_well or "").split("\n") if r.doing_well else [],
        "improve": (r.improve or "").split("\n") if r.improve else [],
        "is_demo_evaluation": r.is_demo_evaluation,
        "uploaded_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.get("/list")
def list_resumes(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    resumes = (
        db.query(models.ResumeAnalysis)
        .filter(models.ResumeAnalysis.user_id == current_user.id)
        .order_by(models.ResumeAnalysis.created_at.desc())
        .all()
    )
    return [_resume_payload(r) for r in resumes]


@router.get("/{resume_id}")
def get_resume(resume_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    resume = db.query(models.ResumeAnalysis).filter(
        models.ResumeAnalysis.id == resume_id, models.ResumeAnalysis.user_id == current_user.id
    ).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume analysis not found.")
    return _resume_payload(resume)


@router.delete("/{resume_id}")
def delete_resume(resume_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    resume = db.query(models.ResumeAnalysis).filter(
        models.ResumeAnalysis.id == resume_id, models.ResumeAnalysis.user_id == current_user.id
    ).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume analysis not found.")
    db.delete(resume)
    db.commit()
    return {"message": "Resume analysis deleted."}
