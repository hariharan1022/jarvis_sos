from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("/profile", response_model=schemas.UserResponse)
def get_profile(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@router.put("/profile", response_model=schemas.UserResponse)
def update_profile(
    profile_data: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if profile_data.name is not None:
        current_user.name = profile_data.name
    if profile_data.email is not None:
        # Check if already taken
        existing = db.query(models.User).filter(models.User.email == profile_data.email).first()
        if existing and existing.id != current_user.id:
            raise HTTPException(status_code=400, detail="Email already registered")
        current_user.email = profile_data.email
    if profile_data.medical_notes is not None:
        current_user.medical_notes = profile_data.medical_notes
    if profile_data.blood_group is not None:
        current_user.blood_group = profile_data.blood_group
    if profile_data.custom_wake_word is not None:
        current_user.custom_wake_word = profile_data.custom_wake_word
        
    db.commit()
    db.refresh(current_user)
    return current_user

@router.get("/contacts", response_model=List[schemas.ContactResponse])
def get_contacts(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return db.query(models.Contact).filter(models.Contact.user_id == current_user.id).order_by(models.Contact.priority.asc()).all()

@router.post("/contacts", response_model=schemas.ContactResponse)
def create_contact(
    contact_in: schemas.ContactCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    new_contact = models.Contact(
        user_id=current_user.id,
        name=contact_in.name,
        phone=contact_in.phone,
        email=contact_in.email,
        whatsapp=contact_in.whatsapp,
        notify_sms=contact_in.notify_sms,
        notify_whatsapp=contact_in.notify_whatsapp,
        notify_email=contact_in.notify_email,
        notify_call=contact_in.notify_call,
        priority=contact_in.priority
    )
    db.add(new_contact)
    db.commit()
    db.refresh(new_contact)
    return new_contact

@router.put("/contacts/{contact_id}", response_model=schemas.ContactResponse)
def update_contact(
    contact_id: int,
    contact_in: schemas.ContactCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    contact = db.query(models.Contact).filter(models.Contact.id == contact_id, models.Contact.user_id == current_user.id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
        
    contact.name = contact_in.name
    contact.phone = contact_in.phone
    contact.email = contact_in.email
    contact.whatsapp = contact_in.whatsapp
    contact.notify_sms = contact_in.notify_sms
    contact.notify_whatsapp = contact_in.notify_whatsapp
    contact.notify_email = contact_in.notify_email
    contact.notify_call = contact_in.notify_call
    contact.priority = contact_in.priority
    
    db.commit()
    db.refresh(contact)
    return contact

@router.delete("/contacts/{contact_id}")
def delete_contact(
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    contact = db.query(models.Contact).filter(models.Contact.id == contact_id, models.Contact.user_id == current_user.id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
        
    db.delete(contact)
    db.commit()
    return {"status": "success", "message": "Contact deleted successfully"}
