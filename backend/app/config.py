import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Settings:
    PROJECT_NAME: str = "SafeNova AI Backend"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-nova-guardian-key-128-bits")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./safenova.db")
    
    # Evidence uploads
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "uploads")
    
    # CORS
    ALLOWED_ORIGINS: list = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

    # SMTP Settings (for Email alerts)
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT")) if os.getenv("SMTP_PORT", "").isdigit() else 587
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "")

    # Twilio Settings (for SMS & WhatsApp alerts)
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_PHONE_NUMBER: str = os.getenv("TWILIO_PHONE_NUMBER", "")
    TWILIO_WHATSAPP_NUMBER: str = os.getenv("TWILIO_WHATSAPP_NUMBER", "")
    DEFAULT_COUNTRY_CODE: str = os.getenv("DEFAULT_COUNTRY_CODE", "+1")

settings = Settings()

# Ensure uploads directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
