import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SafeNovaNotifier")

# Store sent messages in a list for demo dashboard viewing
notification_logs = []

def log_notification(channel: str, recipient: str, message: str, priority: int = 1):
    log_entry = {
        "channel": channel,
        "recipient": recipient,
        "message": message,
        "priority": priority,
        "timestamp": datetime.now().isoformat() if 'datetime' in globals() else ""
    }
    # Dynamic datetime import if needed
    from datetime import datetime
    log_entry["timestamp"] = datetime.utcnow().isoformat()
    notification_logs.append(log_entry)
    
    # Prune list to last 200 logs
    if len(notification_logs) > 200:
        notification_logs.pop(0)

def normalize_phone(phone: str) -> str:
    if not phone:
        return ""
    # Retain only digits and '+'
    cleaned = "".join(c for c in phone if c.isdigit() or c == "+")
    if not cleaned.startswith("+"):
        from ..config import settings
        default_code = settings.DEFAULT_COUNTRY_CODE or "+1"
        if not default_code.startswith("+"):
            default_code = "+" + default_code
        cleaned = f"{default_code}{cleaned}"
    return cleaned

class NotifierService:
    @staticmethod
    async def send_sms(phone: str, message: str, priority: int = 1):
        normalized_phone = normalize_phone(phone)
        logger.info(f"[SMS ALERT] [Priority {priority}] To: {normalized_phone} - Message: {message}")
        log_notification("SMS", normalized_phone, message, priority)

        from ..config import settings
        if not all([settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN, settings.TWILIO_PHONE_NUMBER]):
            logger.warning("Twilio configuration for SMS is incomplete. Skipping actual SMS delivery.")
            return

        import urllib.request
        import urllib.parse
        import json
        import base64

        try:
            url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
            data = urllib.parse.urlencode({
                "To": normalized_phone,
                "From": settings.TWILIO_PHONE_NUMBER,
                "Body": message
            }).encode("utf-8")
            
            req = urllib.request.Request(url, data=data, method="POST")
            auth_str = f"{settings.TWILIO_ACCOUNT_SID}:{settings.TWILIO_AUTH_TOKEN}"
            auth_b64 = base64.b64encode(auth_str.encode("utf-8")).decode("utf-8")
            req.add_header("Authorization", f"Basic {auth_b64}")
            req.add_header("Content-Type", "application/x-www-form-urlencoded")
            
            with urllib.request.urlopen(req, timeout=10) as response:
                res_body = response.read().decode("utf-8")
                res_json = json.loads(res_body)
                logger.info(f"SMS successfully sent to {normalized_phone}. SID: {res_json.get('sid')}")
        except Exception as e:
            logger.error(f"Error executing SMS delivery to {normalized_phone}: {e}")
            raise

    @staticmethod
    async def send_whatsapp(phone: str, message: str, priority: int = 1):
        normalized_phone = normalize_phone(phone)
        to_whatsapp = f"whatsapp:{normalized_phone}"
        
        from ..config import settings
        from_whatsapp = settings.TWILIO_WHATSAPP_NUMBER
        if from_whatsapp and not from_whatsapp.startswith("whatsapp:"):
            from_whatsapp = f"whatsapp:{from_whatsapp}"

        logger.info(f"[WHATSAPP ALERT] [Priority {priority}] To: {normalized_phone} - Message: {message}")
        log_notification("WhatsApp", normalized_phone, message, priority)

        if not all([settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN, settings.TWILIO_WHATSAPP_NUMBER]):
            logger.warning("Twilio configuration for WhatsApp is incomplete. Skipping actual WhatsApp delivery.")
            return

        import urllib.request
        import urllib.parse
        import json
        import base64

        try:
            url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
            data = urllib.parse.urlencode({
                "To": to_whatsapp,
                "From": from_whatsapp,
                "Body": message
            }).encode("utf-8")
            
            req = urllib.request.Request(url, data=data, method="POST")
            auth_str = f"{settings.TWILIO_ACCOUNT_SID}:{settings.TWILIO_AUTH_TOKEN}"
            auth_b64 = base64.b64encode(auth_str.encode("utf-8")).decode("utf-8")
            req.add_header("Authorization", f"Basic {auth_b64}")
            req.add_header("Content-Type", "application/x-www-form-urlencoded")
            
            with urllib.request.urlopen(req, timeout=10) as response:
                res_body = response.read().decode("utf-8")
                res_json = json.loads(res_body)
                logger.info(f"WhatsApp successfully sent to {normalized_phone}. SID: {res_json.get('sid')}")
        except Exception as e:
            logger.error(f"Error executing WhatsApp delivery to {normalized_phone}: {e}")
            raise

    @staticmethod
    async def send_email(email: str, subject: str, message: str, priority: int = 1):
        logger.info(f"[EMAIL ALERT] [Priority {priority}] To: {email} | Subject: {subject} - Body: {message}")
        log_notification("Email", email, f"Subject: {subject}\n{message}", priority)

        from ..config import settings
        if not all([settings.SMTP_HOST, settings.SMTP_USER, settings.SMTP_PASSWORD, settings.SMTP_FROM]):
            logger.warning("SMTP configuration is incomplete. Skipping actual email delivery.")
            return

        import smtplib
        from email.utils import formatdate, make_msgid
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        try:
            msg = MIMEMultipart()
            msg["From"] = settings.SMTP_FROM
            msg["To"] = email
            msg["Subject"] = subject
            msg["Date"] = formatdate(localtime=True)
            msg["Message-ID"] = make_msgid(domain=settings.SMTP_HOST)
            msg.attach(MIMEText(message, "plain", "utf-8"))

            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
            server.quit()
            logger.info(f"Email successfully delivered to {email}")
        except Exception as e:
            logger.error(f"Error executing email delivery to {email}: {e}")
            raise

    @staticmethod
    async def send_voice_call(phone: str, text: str, priority: int = 1):
        normalized_phone = normalize_phone(phone)
        logger.info(f"[VOICE CALL ALERT] [Priority {priority}] Calling {normalized_phone} - TTS Script: {text}")
        log_notification("Voice Call", normalized_phone, text, priority)
        # Integration point: e.g. Twilio Voice

    @classmethod
    async def trigger_emergency_notifications(cls, user_name: str, contacts: list, session_details: dict):
        """
        Dispatches alerts across all channels configured by the user's emergency contacts.
        """
        tracking_link = f"http://localhost:5173/guardian?code={session_details.get('tracking_code')}"
        maps_link = f"https://www.google.com/maps?q={session_details.get('lat')},{session_details.get('lng')}"
        
        sms_body = (
            f"ALERT: {user_name} is in danger! Emergency Type: {session_details.get('type')}. "
            f"Location: {session_details.get('address')}. "
            f"Battery: {session_details.get('battery')}%. "
            f"Live track: {tracking_link} "
            f"Maps: {maps_link}"
        )
        
        email_subject = f"SafeNova Security Alert - Active Incident for {user_name}"
        email_body = (
            f"Dear Emergency Contact,\n\n"
            f"This is an automated security dispatch from the SafeNova Guard network on behalf of: {user_name}.\n\n"
            f"--- SECURITY REPORT DETAILS ---\n"
            f"Incident Trigger: {session_details.get('type')}\n"
            f"Last Reported Location: {session_details.get('address')}\n"
            f"GPS Coordinates: {session_details.get('lat')}, {session_details.get('lng')}\n"
            f"Device Battery Level: {session_details.get('battery')}%\n"
            f"Signal Level: {session_details.get('signal')}\n"
            f"Blood Group & Medical Card: {session_details.get('blood_group', 'N/A')} | Notes: {session_details.get('medical_notes', 'N/A')}\n\n"
            f"--- EMERGENCY LOCAL CHANNELS ---\n"
            f"Secure local tracking: {tracking_link}\n"
            f"Map coordinate: {maps_link}\n\n"
            f"This is a system-generated alert message. Please verify their safety."
        )

        for contact in contacts:
            if contact.notify_sms:
                try:
                    await cls.send_sms(contact.phone, sms_body, contact.priority)
                except Exception as e:
                    logger.error(f"Failed to send SMS to {contact.phone}: {e}")
            if contact.notify_whatsapp:
                whatsapp_phone = contact.whatsapp if contact.whatsapp else contact.phone
                try:
                    await cls.send_whatsapp(whatsapp_phone, sms_body, contact.priority)
                except Exception as e:
                    logger.error(f"Failed to send WhatsApp to {whatsapp_phone}: {e}")
            if contact.notify_email:
                try:
                    await cls.send_email(contact.email, email_subject, email_body, contact.priority)
                except Exception as e:
                    logger.error(f"Failed to send Email to {contact.email}: {e}")
            if contact.notify_call:
                try:
                    await cls.send_voice_call(contact.phone, f"Emergency alert. Your contact {user_name} is in danger. We have sent you a text with their live location.", contact.priority)
                except Exception as e:
                    logger.error(f"Failed to make voice call to {contact.phone}: {e}")
