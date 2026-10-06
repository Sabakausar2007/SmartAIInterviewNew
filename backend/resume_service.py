"""
resume_service.py
Resume file validation, storage, and text extraction (PDF/DOCX).
"""
import os
import uuid
from fastapi import UploadFile, HTTPException
from dotenv import load_dotenv

load_dotenv()

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads", "resumes")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".docx"}
MAX_FILE_SIZE_MB = float(os.getenv("MAX_RESUME_SIZE_MB", "5"))


def validate_resume_file(file: UploadFile, content: bytes) -> str:
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported.")
    size_mb = len(content) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(status_code=400, detail=f"File is too large. Maximum size is {MAX_FILE_SIZE_MB}MB.")
    return ext


def save_resume_file(content: bytes, ext: str) -> str:
    filename = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(UPLOAD_DIR, filename)
    with open(path, "wb") as f:
        f.write(content)
    return path


def extract_resume_text(path: str, ext: str) -> str:
    try:
        if ext == ".pdf":
            from pypdf import PdfReader
            reader = PdfReader(path)
            return "\n".join((page.extract_text() or "") for page in reader.pages)
        elif ext == ".docx":
            import docx
            doc = docx.Document(path)
            return "\n".join(p.text for p in doc.paragraphs)
    except Exception as e:
        print(f"[resume_service] Could not extract text: {e}")
        return ""
    return ""
