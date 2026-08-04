from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas, auth
from typing import List

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.post("/login", response_model=schemas.Token)
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == credentials.email).first()
    if not user or not auth.verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password"
        )
    
    if user.role not in ["SUPER_ADMIN", "ADMIN", "MODERATOR"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied. Administrator account required."
        )
    
    access_token = auth.create_admin_access_token(data={"sub": user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.post("/logout")
def logout():
    return {"message": "Admin logged out successfully"}

@router.get("/me", response_model=schemas.UserResponse)
def get_me(current_admin: models.User = Depends(auth.get_current_admin)):
    return current_admin

@router.get("/dashboard")
def get_dashboard(db: Session = Depends(get_db), current_admin: models.User = Depends(auth.get_current_admin)):
    total_users = db.query(models.User).count()
    active_emergencies = db.query(models.EmergencySession).filter(models.EmergencySession.active == True).count()
    resolved_emergencies = db.query(models.EmergencySession).filter(models.EmergencySession.active == False).count()
    
    return {
        "totalUsers": total_users,
        "onlineUsers": total_users, # placeholder for demo
        "activeEmergencies": active_emergencies,
        "resolvedEmergencies": resolved_emergencies,
        "sosAlertsToday": active_emergencies + resolved_emergencies, # simplified for demo
        "serverHealth": "Good",
        "databaseStatus": "Connected",
        "apiStatus": "Online"
    }

@router.get("/users", response_model=List[schemas.UserResponse])
def get_users(db: Session = Depends(get_db), current_admin: models.User = Depends(auth.get_current_admin)):
    return db.query(models.User).order_by(models.User.created_at.desc()).all()

@router.put("/users/{user_id}", response_model=schemas.UserResponse)
def update_user(user_id: int, user_update: dict, db: Session = Depends(get_db), current_admin: models.User = Depends(auth.get_current_admin)):
    if current_admin.role not in ["SUPER_ADMIN", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Insufficient privileges")
        
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if "role" in user_update:
        user.role = user_update["role"]
    if "name" in user_update:
        user.name = user_update["name"]
        
    db.commit()
    db.refresh(user)
    return user

@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_admin: models.User = Depends(auth.get_current_admin)):
    if current_admin.role != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Super Admin privileges required to delete users")
        
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    db.delete(user)
    db.commit()
    return {"message": "User deleted"}

@router.get("/incidents", response_model=List[schemas.EmergencySessionResponse])
def get_incidents(db: Session = Depends(get_db), current_admin: models.User = Depends(auth.get_current_admin)):
    return db.query(models.EmergencySession).order_by(models.EmergencySession.start_time.desc()).all()

@router.get("/reports")
def get_reports(current_admin: models.User = Depends(auth.get_current_admin)):
    from ..services.notifier import notification_logs
    return notification_logs
