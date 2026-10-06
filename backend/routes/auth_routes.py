"""
auth_routes.py
Signup, login, admin login, current-user info, profile and settings.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _user_payload(user: models.User):
    return {
        "id": user.id, "full_name": user.full_name, "email": user.email,
        "is_admin": user.is_admin,
    }


@router.post("/signup", response_model=schemas.TokenResponse)
def signup(data: schemas.SignupRequest, db: Session = Depends(get_db)):
    if data.password != data.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match.")
    existing = db.query(models.User).filter(models.User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    user = models.User(full_name=data.full_name, email=data.email, password_hash=hash_password(data.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    db.add(models.Profile(user_id=user.id))
    db.add(models.Performance(user_id=user.id))
    db.commit()

    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "user": _user_payload(user)}


@router.post("/login", response_model=schemas.TokenResponse)
def login(data: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account has been deactivated.")
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "user": _user_payload(user)}


@router.post("/admin-login", response_model=schemas.TokenResponse)
def admin_login(data: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid admin credentials.")
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="This account does not have admin access.")
    token = create_access_token({"sub": str(user.id), "type": "admin"})
    return {"access_token": token, "user": _user_payload(user)}


@router.get("/me")
def get_me(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(models.Profile).filter(models.Profile.user_id == current_user.id).first()
    payload = _user_payload(current_user)
    if profile:
        payload.update({
            "phone": profile.phone, "education": profile.education, "college": profile.college,
            "skills": profile.skills, "languages": profile.languages,
            "job_role": profile.job_role, "experience": profile.experience,
        })
    return payload


@router.put("/profile")
def update_profile(data: schemas.ProfileUpdateRequest, current_user: models.User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    if data.full_name:
        current_user.full_name = data.full_name

    profile = db.query(models.Profile).filter(models.Profile.user_id == current_user.id).first()
    if not profile:
        profile = models.Profile(user_id=current_user.id)
        db.add(profile)

    for field in ["phone", "education", "college", "skills", "languages", "job_role", "experience"]:
        value = getattr(data, field)
        if value is not None:
            setattr(profile, field, value)

    db.commit()
    return {"message": "Profile updated successfully."}


@router.put("/change-password")
def change_password(data: schemas.ChangePasswordRequest, current_user: models.User = Depends(get_current_user),
                     db: Session = Depends(get_db)):
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    current_user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"message": "Password changed successfully."}
