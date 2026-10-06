"""
models.py
SQLAlchemy ORM models - one class per database table. Tables are created
automatically on startup (see main.py) - no manual migration step needed.
"""
from sqlalchemy import Column, Integer, String, Text, Float, Boolean, TIMESTAMP, ForeignKey, CHAR
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    is_admin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    profile = relationship("Profile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    interviews = relationship("Interview", back_populates="user", cascade="all, delete-orphan")
    mcq_attempts = relationship("MCQAttempt", back_populates="user", cascade="all, delete-orphan")
    resumes = relationship("ResumeAnalysis", back_populates="user", cascade="all, delete-orphan")
    coding_submissions = relationship("CodingSubmission", back_populates="user", cascade="all, delete-orphan")


class Profile(Base):
    __tablename__ = "profiles"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    phone = Column(String(30), nullable=True)
    education = Column(String(150), nullable=True)
    college = Column(String(200), nullable=True)
    skills = Column(Text, nullable=True)
    languages = Column(String(255), nullable=True)
    job_role = Column(String(150), nullable=True)
    experience = Column(String(100), nullable=True)
    profile_image_path = Column(String(500), nullable=True)

    user = relationship("User", back_populates="profile")


class Interview(Base):
    __tablename__ = "interviews"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    mode = Column(String(30), nullable=False)          # resume_based | job_interview
    job_role = Column(String(150), nullable=True)
    experience_level = Column(String(30), nullable=True)
    interview_type = Column(String(50), nullable=True)
    total_questions = Column(Integer, nullable=False)
    status = Column(String(20), default="in_progress")  # in_progress | completed
    overall_score = Column(Float, nullable=True)
    technical_score = Column(Float, nullable=True)
    communication_score = Column(Float, nullable=True)
    problem_solving_score = Column(Float, nullable=True)
    strengths = Column(Text, nullable=True)
    improvements = Column(Text, nullable=True)
    recommended_practice = Column(Text, nullable=True)
    is_demo_evaluation = Column(Boolean, default=True)   # True = fallback/rule-based, False = real AI
    created_at = Column(TIMESTAMP, server_default=func.now())
    completed_at = Column(TIMESTAMP, nullable=True)

    user = relationship("User", back_populates="interviews")
    questions = relationship("InterviewQuestion", back_populates="interview", cascade="all, delete-orphan")


class InterviewQuestion(Base):
    __tablename__ = "interview_questions"
    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(Integer, ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False)
    question_number = Column(Integer, nullable=False)
    question_text = Column(Text, nullable=False)

    interview = relationship("Interview", back_populates="questions")
    answer = relationship("InterviewAnswer", back_populates="question", uselist=False, cascade="all, delete-orphan")


class InterviewAnswer(Base):
    __tablename__ = "interview_answers"
    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("interview_questions.id", ondelete="CASCADE"), nullable=False)
    answer_text = Column(Text, nullable=True)
    was_skipped = Column(Boolean, default=False)
    score = Column(Float, nullable=True)
    technical_score = Column(Float, nullable=True)
    communication_score = Column(Float, nullable=True)
    problem_solving_score = Column(Float, nullable=True)
    feedback = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    question = relationship("InterviewQuestion", back_populates="answer")


class MCQQuestion(Base):
    __tablename__ = "mcq_questions"
    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(50), nullable=False)
    difficulty = Column(String(20), nullable=False)
    question = Column(Text, nullable=False)
    option_a = Column(String(500), nullable=False)
    option_b = Column(String(500), nullable=False)
    option_c = Column(String(500), nullable=False)
    option_d = Column(String(500), nullable=False)
    correct_answer = Column(CHAR(1), nullable=False)
    explanation = Column(Text, nullable=True)


class MCQAttempt(Base):
    __tablename__ = "mcq_attempts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category = Column(String(50), nullable=False)
    difficulty = Column(String(20), nullable=False)
    total_questions = Column(Integer, nullable=False)
    correct_answers = Column(Integer, default=0)
    wrong_answers = Column(Integer, default=0)
    score_percent = Column(Float, default=0)
    time_taken_seconds = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, server_default=func.now())

    user = relationship("User", back_populates="mcq_attempts")
    answers = relationship("MCQAnswer", back_populates="attempt", cascade="all, delete-orphan")


class MCQAnswer(Base):
    __tablename__ = "mcq_answers"
    id = Column(Integer, primary_key=True, index=True)
    attempt_id = Column(Integer, ForeignKey("mcq_attempts.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(Integer, ForeignKey("mcq_questions.id", ondelete="CASCADE"), nullable=False)
    selected_answer = Column(CHAR(1), nullable=True)
    is_correct = Column(Boolean, default=False)

    attempt = relationship("MCQAttempt", back_populates="answers")


class ResumeAnalysis(Base):
    __tablename__ = "resume_analyses"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    extracted_text = Column(Text, nullable=True)
    skills = Column(Text, nullable=True)
    education = Column(Text, nullable=True)
    projects = Column(Text, nullable=True)
    experience = Column(Text, nullable=True)
    certifications = Column(Text, nullable=True)
    keywords = Column(Text, nullable=True)
    formatting_notes = Column(Text, nullable=True)
    strength_score = Column(Float, nullable=True)
    doing_well = Column(Text, nullable=True)
    improve = Column(Text, nullable=True)
    is_demo_evaluation = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    user = relationship("User", back_populates="resumes")


class Performance(Base):
    __tablename__ = "performance"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    total_interviews = Column(Integer, default=0)
    total_mcq_attempts = Column(Integer, default=0)
    avg_interview_score = Column(Float, default=0)
    avg_mcq_score = Column(Float, default=0)
    coding_solved = Column(Integer, default=0)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


class CodingQuestion(Base):
    __tablename__ = "coding_questions"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(150), nullable=False)
    slug = Column(String(150), unique=True, nullable=False)
    statement = Column(Text, nullable=False)
    difficulty = Column(String(20), nullable=False)
    category = Column(String(50), nullable=True)
    starter_code = Column(Text, nullable=True)
    test_cases_json = Column(Text, nullable=False)   # JSON string: [{"input":..., "expected":...}]


class CodingSubmission(Base):
    __tablename__ = "coding_submissions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    coding_question_id = Column(Integer, ForeignKey("coding_questions.id", ondelete="CASCADE"), nullable=False)
    code = Column(Text, nullable=False)
    passed_count = Column(Integer, default=0)
    total_count = Column(Integer, default=0)
    status = Column(String(20), default="failed")   # passed | failed | error
    output_log = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    user = relationship("User", back_populates="coding_submissions")


class AdminActivityLog(Base):
    __tablename__ = "admin_activity_log"
    id = Column(Integer, primary_key=True, index=True)
    admin_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(255), nullable=False)
    target = Column(String(255), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())


class Bookmark(Base):
    """A user's saved/favorited question in the Question Bank."""
    __tablename__ = "bookmarks"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    mcq_question_id = Column(Integer, ForeignKey("mcq_questions.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

