from pydantic import BaseModel, EmailStr
from typing import Optional, List
import datetime

class UserBase(BaseModel):
    name: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    medical_notes: Optional[str] = None
    blood_group: Optional[str] = None
    custom_wake_word: Optional[str] = None

class UserResponse(UserBase):
    id: int
    role: str
    tracking_code: Optional[str] = None
    battery_level: int
    is_emergency: bool
    medical_notes: Optional[str] = None
    blood_group: Optional[str] = None
    custom_wake_word: Optional[str] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class ContactBase(BaseModel):
    name: str
    phone: str
    email: EmailStr
    notify_email: bool = True
    priority: int = 1

class ContactCreate(ContactBase):
    pass

class ContactResponse(ContactBase):
    id: int
    user_id: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class LocationLogCreate(BaseModel):
    latitude: float
    longitude: float
    speed: Optional[float] = 0.0
    direction: Optional[float] = 0.0
    battery: Optional[int] = 100
    accuracy: Optional[float] = 10.0

class LocationLogResponse(LocationLogCreate):
    id: int
    session_id: int
    timestamp: datetime.datetime

    class Config:
        from_attributes = True

class EvidenceResponse(BaseModel):
    id: int
    session_id: int
    type: str
    filepath: str
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    timestamp: datetime.datetime

    class Config:
        from_attributes = True

class EmergencySessionResponse(BaseModel):
    id: int
    user_id: int
    active: bool
    start_time: datetime.datetime
    end_time: Optional[datetime.datetime] = None
    tracking_code: str
    emergency_type: str
    last_lat: Optional[float] = None
    last_lng: Optional[float] = None
    last_address: Optional[str] = None
    battery: int
    signal_status: str
    location_logs: List[LocationLogResponse] = []
    evidence_items: List[EvidenceResponse] = []

    class Config:
        from_attributes = True

class RouteRequest(BaseModel):
    start_lat: float
    start_lng: float
    end_lat: float
    end_lng: float

class SafetyScoreResponse(BaseModel):
    overall_score: int # 0-100
    rating: str # Safe, Medium Risk, High Risk, Critical
    crime_score: int
    lighting_score: int
    density_score: int
    nearby_police: int
    nearby_hospitals: int
