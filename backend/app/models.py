from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
import datetime
from .database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="user") # user, guardian, admin
    tracking_code = Column(String, unique=True, index=True, nullable=True) # Public key for guardians to track
    battery_level = Column(Integer, default=100)
    is_emergency = Column(Boolean, default=False)
    medical_notes = Column(String, nullable=True)
    blood_group = Column(String, nullable=True)
    custom_wake_word = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    contacts = relationship("Contact", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("EmergencySession", back_populates="user", cascade="all, delete-orphan")

class Contact(Base):
    __tablename__ = "contacts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    email = Column(String, nullable=False)
    whatsapp = Column(String, nullable=True)
    notify_sms = Column(Boolean, default=True)
    notify_whatsapp = Column(Boolean, default=False)
    notify_email = Column(Boolean, default=True)
    notify_call = Column(Boolean, default=False)
    priority = Column(Integer, default=1) # 1 = high, 2 = medium, etc.
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    user = relationship("User", back_populates="contacts")

class EmergencySession(Base):
    __tablename__ = "emergency_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    active = Column(Boolean, default=True)
    start_time = Column(DateTime, default=datetime.datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    tracking_code = Column(String, index=True)
    emergency_type = Column(String, default="unknown") # voice_activation, panic_button, fall_detected, etc.
    last_lat = Column(Float, nullable=True)
    last_lng = Column(Float, nullable=True)
    last_address = Column(String, nullable=True)
    battery = Column(Integer, default=100)
    signal_status = Column(String, default="Good")
    
    user = relationship("User", back_populates="sessions")
    location_logs = relationship("LocationLog", back_populates="session", cascade="all, delete-orphan")
    evidence_items = relationship("Evidence", back_populates="session", cascade="all, delete-orphan")

class LocationLog(Base):
    __tablename__ = "location_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("emergency_sessions.id"))
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    speed = Column(Float, default=0.0)
    direction = Column(Float, default=0.0)
    battery = Column(Integer, default=100)
    accuracy = Column(Float, default=10.0)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    
    session = relationship("EmergencySession", back_populates="location_logs")

class Evidence(Base):
    __tablename__ = "evidence"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("emergency_sessions.id"))
    type = Column(String, nullable=False) # audio, image_front, image_rear, video
    filepath = Column(String, nullable=False)
    location_lat = Column(Float, nullable=True)
    location_lng = Column(Float, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    
    session = relationship("EmergencySession", back_populates="evidence_items")

class CrimeIncident(Base):
    __tablename__ = "crime_incidents"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    severity = Column(String, default="medium") # low, medium, high
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class SafeZone(Base):
    __tablename__ = "safe_zones"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False) # police, hospital, shelter
    address = Column(String, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    phone = Column(String, nullable=True)
