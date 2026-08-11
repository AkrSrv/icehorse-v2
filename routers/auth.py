from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
import database, schemas, crud
import os
from auth import verify_password, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES, create_reset_token, verify_reset_token, get_password_hash
from email_service import send_password_reset_email

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = crud.get_user_by_email(db, email=form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    expires_minutes = 60 * 24 * 30 if form_data.scopes and "remember_me" in form_data.scopes else ACCESS_TOKEN_EXPIRE_MINUTES
    access_token_expires = timedelta(minutes=expires_minutes)
    
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/register", response_model=schemas.UserOut)
def register_user(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        if not verify_password(user.password, db_user.hashed_password):
            raise HTTPException(status_code=400, detail="Emailen er allerede registreret med en anden adgangskode.")
        crud.create_club(db=db, club=schemas.ClubCreate(name=user.club_name), user_id=db_user.id)
        return db_user
    return crud.create_user_and_club(db=db, user=user)

@router.post("/forgot-password")
def forgot_password(req: schemas.ForgotPasswordRequest, db: Session = Depends(database.get_db)):
    user = crud.get_user_by_email(db, email=req.email)
    if user:
        token = create_reset_token(email=user.email)
        frontend_url = os.environ.get("FRONTEND_URL", "http://192.168.1.59:3000").rstrip("/")
        reset_link = f"{frontend_url}/?reset_token={token}"
        try:
            send_password_reset_email(to_email=user.email, reset_link=reset_link)
        except Exception as e:
            print(f"Error sending reset email: {e}")
            # We still return success to prevent email enumeration, but log the error
    return {"message": "Hvis e-mailen findes i vores system, har vi sendt et link til at nulstille adgangskoden."}

@router.post("/reset-password")
def reset_password(req: schemas.ResetPasswordRequest, db: Session = Depends(database.get_db)):
    email = verify_reset_token(req.token)
    if not email:
        raise HTTPException(status_code=400, detail="Ugyldigt eller udløbet link.")
    
    user = crud.get_user_by_email(db, email=email)
    if not user:
        raise HTTPException(status_code=400, detail="Bruger ikke fundet.")
    
    user.hashed_password = get_password_hash(req.new_password)
    db.commit()
    return {"message": "Adgangskode opdateret. Du kan nu logge ind."}
