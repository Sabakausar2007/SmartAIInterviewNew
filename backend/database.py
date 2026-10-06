"""
database.py
SQLite by default (zero setup) via SQLAlchemy. Set DATABASE_URL in .env to
point elsewhere if you ever want a different database - nothing else in the
app needs to change.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DB_PATH = os.path.join(PROJECT_ROOT, "smart_ai_interview.db")
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}").strip()

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_database_connection():
    try:
        with engine.connect():
            pass
        return True, f"Database connection OK ({DATABASE_URL.split(':')[0]})"
    except Exception as e:
        return False, str(e)
