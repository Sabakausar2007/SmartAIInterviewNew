"""
schemas.py
Pydantic request/response models.
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List


# ---------- AUTH ----------
class SignupRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)
    confirm_password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6, max_length=100)


# ---------- PROFILE ----------
class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    education: Optional[str] = None
    college: Optional[str] = None
    skills: Optional[str] = None
    languages: Optional[str] = None
    job_role: Optional[str] = None
    experience: Optional[str] = None


class SettingsUpdateRequest(BaseModel):
    default_job_role: Optional[str] = None


# ---------- INTERVIEW ----------
class StartInterviewRequest(BaseModel):
    mode: str  # "resume_based" | "job_interview"
    job_role: Optional[str] = "Software Developer"
    experience_level: Optional[str] = "Fresher"
    interview_type: Optional[str] = "Technical"
    num_questions: int = 5
    resume_id: Optional[int] = None


class SubmitAnswerRequest(BaseModel):
    question_id: int
    answer_text: Optional[str] = None
    skipped: bool = False


# ---------- MCQ ----------
class StartQuizRequest(BaseModel):
    category: str
    difficulty: str = "Medium"
    num_questions: int = 10


class QuizAnswerSubmit(BaseModel):
    question_id: int
    selected_answer: Optional[str] = None


class SubmitQuizRequest(BaseModel):
    category: str
    difficulty: str = "Medium"
    answers: List[QuizAnswerSubmit]
    time_taken_seconds: int = 0


# ---------- CODING ----------
class SubmitCodeRequest(BaseModel):
    code: str


# ---------- ADMIN MCQ MANAGEMENT ----------
class MCQCreateRequest(BaseModel):
    category: str
    difficulty: str
    question: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_answer: str = Field(..., min_length=1, max_length=1)
    explanation: Optional[str] = None
