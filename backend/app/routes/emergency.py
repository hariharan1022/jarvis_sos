from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
import os
import uuid
import datetime
from typing import List, Optional
from ..database import get_db
from .. import models, schemas, auth
from ..config import settings
from ..services.notifier import NotifierService, notification_logs
from ..services.websocket_manager import manager

router = APIRouter(prefix="/api/emergency", tags=["emergency"])

@router.post("/trigger", response_model=schemas.EmergencySessionResponse)
async def trigger_emergency(
    background_tasks: BackgroundTasks,
    emergency_type: str = Form("manual"),
    latitude: float = Form(...),
    longitude: float = Form(...),
    battery: int = Form(100),
    signal_status: str = Form("Good"),
    address: str = Form("Unknown Location"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Set user emergency state
    current_user.is_emergency = True
    current_user.battery_level = battery
    db.commit()
    
    # Check if there is already an active session
    active_session = db.query(models.EmergencySession).filter(
        models.EmergencySession.user_id == current_user.id,
        models.EmergencySession.active == True
    ).first()
    
    if active_session:
        # Re-use active session
        active_session.emergency_type = emergency_type
        active_session.last_lat = latitude
        active_session.last_lng = longitude
        active_session.last_address = address
        active_session.battery = battery
        active_session.signal_status = signal_status
        db.commit()
        session = active_session
    else:
        # Create new session
        session = models.EmergencySession(
            user_id=current_user.id,
            active=True,
            tracking_code=current_user.tracking_code or str(uuid.uuid4())[:8].upper(),
            emergency_type=emergency_type,
            last_lat=latitude,
            last_lng=longitude,
            last_address=address,
            battery=battery,
            signal_status=signal_status
        )
        db.add(session)
        db.commit()
        db.refresh(session)
    
    # Log initial location
    location_log = models.LocationLog(
        session_id=session.id,
        latitude=latitude,
        longitude=longitude,
        battery=battery,
        accuracy=10.0,
        speed=0.0,
        direction=0.0
    )
    db.add(location_log)
    db.commit()
    
    # Retrieve emergency contacts
    contacts = db.query(models.Contact).filter(models.Contact.user_id == current_user.id).all()
    
    # Trigger notifications asynchronously (or synchronous logs for now)
    session_data = {
        "tracking_code": session.tracking_code,
        "lat": latitude,
        "lng": longitude,
        "address": address,
        "battery": battery,
        "signal": signal_status,
        "type": emergency_type,
        "medical_notes": current_user.medical_notes,
        "blood_group": current_user.blood_group
    }
    
    background_tasks.add_task(
        NotifierService.trigger_emergency_notifications,
        user_name=current_user.name,
        contacts=contacts,
        session_details=session_data
    )
    
    # Broadcast to websocket
    await manager.broadcast_to_admins({
        "type": "new_emergency",
        "session_id": session.id,
        "user_name": current_user.name,
        "tracking_code": session.tracking_code,
        "latitude": latitude,
        "longitude": longitude,
        "emergency_type": emergency_type,
        "address": address
    })
    
    # Refresh to load relationships
    db.refresh(session)
    return session

@router.post("/log-location")
async def log_location(
    latitude: float = Form(...),
    longitude: float = Form(...),
    speed: float = Form(0.0),
    direction: float = Form(0.0),
    battery: int = Form(100),
    accuracy: float = Form(10.0),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    current_user.battery_level = battery
    db.commit()
    
    # Get active session
    session = db.query(models.EmergencySession).filter(
        models.EmergencySession.user_id == current_user.id,
        models.EmergencySession.active == True
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="No active emergency session found")
        
    # Update session details
    session.last_lat = latitude
    session.last_lng = longitude
    session.battery = battery
    db.commit()
    
    # Create location entry
    log_entry = models.LocationLog(
        session_id=session.id,
        latitude=latitude,
        longitude=longitude,
        speed=speed,
        direction=direction,
        battery=battery,
        accuracy=accuracy
    )
    db.add(log_entry)
    db.commit()
    
    # Broadcast position to all listening sockets
    update_payload = {
        "type": "location_update",
        "latitude": latitude,
        "longitude": longitude,
        "speed": speed,
        "direction": direction,
        "battery": battery,
        "accuracy": accuracy,
        "timestamp": datetime.datetime.utcnow().isoformat()
    }
    await manager.broadcast_to_session(session.tracking_code, update_payload)
    
    return {"status": "success", "logged_at": log_entry.timestamp}

@router.post("/upload-evidence")
async def upload_evidence(
    type: str = Form(...), # audio, image_front, image_rear, video
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    session = db.query(models.EmergencySession).filter(
        models.EmergencySession.user_id == current_user.id,
        models.EmergencySession.active == True
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="No active emergency session found")
        
    # Generate path
    ext = os.path.splitext(file.filename)[1] or (".jpg" if "image" in type else ".webm")
    filename = f"{session.tracking_code}_{type}_{uuid.uuid4().hex[:6]}{ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, filename)
    
    with open(filepath, "wb") as buffer:
        buffer.write(await file.read())
        
    # Create Evidence object
    evidence = models.Evidence(
        session_id=session.id,
        type=type,
        filepath=filepath,
        location_lat=latitude or session.last_lat,
        location_lng=longitude or session.last_lng
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)
    
    # Broadcast evidence upload event
    evidence_payload = {
        "type": "evidence_update",
        "evidence_type": type,
        "filepath": f"/api/emergency/evidence-file/{filename}",
        "timestamp": evidence.timestamp.isoformat(),
        "lat": evidence.location_lat,
        "lng": evidence.location_lng
    }
    await manager.broadcast_to_session(session.tracking_code, evidence_payload)
    
    return {"status": "success", "evidence_id": evidence.id, "file_url": evidence_payload["filepath"]}

@router.post("/resolve", response_model=schemas.EmergencySessionResponse)
async def resolve_emergency(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Set user emergency state
    current_user.is_emergency = False
    db.commit()
    
    # Get active session
    session = db.query(models.EmergencySession).filter(
        models.EmergencySession.user_id == current_user.id,
        models.EmergencySession.active == True
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="No active emergency session found")
        
    session.active = False
    session.end_time = datetime.datetime.utcnow()
    db.commit()
    
    # Broadcast resolution to WebSockets
    res_payload = {
        "type": "emergency_resolved",
        "resolved_at": session.end_time.isoformat()
    }
    await manager.broadcast_to_session(session.tracking_code, res_payload)
    
    db.refresh(session)
    return session

@router.get("/track/{tracking_code}", response_model=schemas.EmergencySessionResponse)
def get_tracking_session(tracking_code: str, db: Session = Depends(get_db)):
    session = db.query(models.EmergencySession).filter(
        models.EmergencySession.tracking_code == tracking_code
    ).order_by(models.EmergencySession.start_time.desc()).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Active session not found for this tracking code")
        
    return session

@router.get("/active", response_model=List[schemas.EmergencySessionResponse])
def get_active_emergencies(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Admin only
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin permissions required")
        
    return db.query(models.EmergencySession).filter(models.EmergencySession.active == True).order_by(models.EmergencySession.start_time.desc()).all()

@router.get("/history", response_model=List[schemas.EmergencySessionResponse])
def get_history(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return db.query(models.EmergencySession).filter(models.EmergencySession.user_id == current_user.id).order_by(models.EmergencySession.start_time.desc()).all()

@router.get("/notification-logs")
def get_notifications(current_user: models.User = Depends(auth.get_current_user)):
    # Helpful for user to see outbound dispatches in real-time
    return notification_logs

# Static files route for files
from fastapi.responses import FileResponse

@router.get("/evidence-file/{filename}")
def get_evidence_file(filename: str):
    filepath = os.path.join(settings.UPLOAD_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Evidence file not found")
    return FileResponse(filepath)

@router.get("/mock-emails")
def get_mock_emails():
    import glob
    # Search for received_email prefix in the uploads folder
    files = glob.glob(os.path.join(settings.UPLOAD_DIR, "received_email_*.html"))
    emails = []
    for f in sorted(files, key=os.path.getmtime, reverse=True):
        filename = os.path.basename(f)
        recipient = filename.replace("received_email_", "").replace(".html", "")
        emails.append({
            "filename": filename,
            "recipient": recipient,
            "url": f"/api/emergency/evidence-file/{filename}",
            "last_modified": os.path.getmtime(f)
        })
    return emails

@router.get("/health/email")
async def email_health_check():
    """Tests SMTP connectivity and returns detailed diagnostics. No auth required for diagnostics."""
    import smtplib
    import asyncio
    from ..config import settings

    host = settings.SMTP_HOST
    configured_port = settings.SMTP_PORT
    user = settings.SMTP_USER
    smtp_from = settings.SMTP_FROM

    result = {
        "smtp_host": host,
        "smtp_port": configured_port,
        "smtp_user": user,
        "smtp_from": smtp_from,
        "has_password": bool(settings.SMTP_PASSWORD),
        "credentials_present": all([host, user, settings.SMTP_PASSWORD, smtp_from]),
        "port_tests": {},
        "working_port": None,
        "status": "unchecked"
    }

    ports_to_test = list(dict.fromkeys([configured_port, 587, 465, 25]))

    for port in ports_to_test:
        def test_port(p=port):
            try:
                if p == 465:
                    s = smtplib.SMTP_SSL(host, p, timeout=8)
                else:
                    s = smtplib.SMTP(host, p, timeout=8)
                s.ehlo()
                caps = list(s.esmtp_features.keys()) if hasattr(s, 'esmtp_features') else []
                s.quit()
                return {"status": "open", "capabilities": caps}
            except Exception as e:
                return {"status": "blocked", "error": str(e)}

        port_result = await asyncio.to_thread(test_port)
        result["port_tests"][str(port)] = port_result
        if port_result["status"] == "open" and result["working_port"] is None:
            result["working_port"] = port

    if result["working_port"] and result["credentials_present"]:
        result["status"] = "healthy"
        result["message"] = f"SMTP reachable on port {result['working_port']}. Ready to send emails."
    elif result["working_port"] and not result["credentials_present"]:
        result["status"] = "missing_credentials"
        result["message"] = "SMTP server reachable but credentials are not set in .env"
    else:
        result["status"] = "unreachable"
        result["message"] = "All SMTP ports are blocked on this network."

    return result
