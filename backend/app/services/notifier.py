import logging
import re
import urllib.request
import urllib.parse
import json
import base64
import asyncio
from datetime import datetime, timedelta
from .websocket_manager import manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SafeNovaNotifier")

# Store sent messages in a list for dashboard operational logs
notification_logs = []
email_queue = asyncio.Queue()
sent_cache = {}
_worker_task = None

def log_notification(channel: str, recipient: str, message: str, priority: int = 1):
    log_entry = {
        "channel": channel,
        "recipient": recipient,
        "message": message[:200] + ("..." if len(message) > 200 else ""),
        "priority": priority,
        "timestamp": datetime.utcnow().isoformat()
    }
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

def validate_email_address(email: str) -> bool:
    if not email:
        return False
    # Standard email regex pattern check
    pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    if not re.match(pattern, email):
        return False
    
    # Try importing optional email-validator package if present
    try:
        from email_validator import validate_email, EmailNotValidError
        validate_email(email, check_deliverability=False)
        return True
    except (ImportError, EmailNotValidError):
        pass
    
    return True

async def email_queue_worker():
    """Background task loop that processes email deliveries, retrying failures up to 3 times."""
    while True:
        try:
            item = await email_queue.get()
            
            # Check for retry backoff time
            now = datetime.utcnow()
            if item.get("next_attempt") and item["next_attempt"] > now:
                # Put back into queue and wait
                await asyncio.sleep(1)
                await email_queue.put(item)
                continue
            
            # Dispatch
            success, err_msg = await NotifierService._dispatch_email_direct(
                email=item["email"],
                subject=item["subject"],
                plain_message=item["plain"],
                html_message=item["html"],
                priority=item["priority"]
            )
            
            if success:
                logger.info(f"Email queue item successfully delivered to {item['email']}")
                await manager.broadcast_to_session(item.get('tracking_code', ''), {
                    "type": "notification_status",
                    "channel": "email",
                    "status": "success",
                    "recipient": item['email']
                })
                email_queue.task_done()
            else:
                item["attempts"] += 1
                if item["attempts"] >= 3:
                    logger.error(f"Email queue item failed permanently after 3 attempts to {item['email']}")
                    await manager.broadcast_to_session(item.get('tracking_code', ''), {
                        "type": "notification_status",
                        "channel": "email",
                        "status": "failed",
                        "recipient": item['email'],
                        "error": err_msg or "Failed after 3 attempts"
                    })
                    email_queue.task_done()
                else:
                    # Exponential backoff retry: 5s, 15s, 45s
                    backoff = 5 * (3 ** (item["attempts"] - 1))
                    item["next_attempt"] = datetime.utcnow() + timedelta(seconds=backoff)
                    logger.warning(f"Retrying email to {item['email']} in {backoff}s (Attempt {item['attempts']}/3)")
                    await manager.broadcast_to_session(item.get('tracking_code', ''), {
                        "type": "notification_status",
                        "channel": "email",
                        "status": "retrying",
                        "recipient": item['email'],
                        "error": err_msg or "Delivery failed, retrying"
                    })
                    await email_queue.put(item)
                    
        except Exception as e:
            logger.error(f"Error inside background email queue worker: {e}")
            await asyncio.sleep(2)

def ensure_worker_started():
    global _worker_task
    if _worker_task is None:
        try:
            loop = asyncio.get_running_loop()
            _worker_task = loop.create_task(email_queue_worker())
            logger.info("Background email queue worker task created successfully.")
        except RuntimeError:
            pass

class NotifierService:
    @staticmethod
    async def send_sms(phone: str, message: str, priority: int = 1):
        normalized_phone = normalize_phone(phone)
        logger.info(f"[SMS ALERT] [Priority {priority}] To: {normalized_phone} - Message: {message}")
        log_notification("SMS", normalized_phone, message, priority)

        from ..config import settings
        is_configured = all([
            settings.TWILIO_ACCOUNT_SID,
            settings.TWILIO_AUTH_TOKEN,
            settings.TWILIO_PHONE_NUMBER
        ]) and "your-twilio" not in settings.TWILIO_ACCOUNT_SID and settings.TWILIO_ACCOUNT_SID != ""

        if not is_configured:
            logger.error("Twilio credentials not configured. SMS failing explicitly.")
            raise ValueError("Twilio API credentials not configured in environment.")

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
            
            def do_sms_request():
                with urllib.request.urlopen(req, timeout=10) as response:
                    return response.read().decode("utf-8")
                    
            res_body = await asyncio.to_thread(do_sms_request)
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

        is_configured = all([
            settings.TWILIO_ACCOUNT_SID,
            settings.TWILIO_AUTH_TOKEN,
            settings.TWILIO_WHATSAPP_NUMBER
        ]) and "your-twilio" not in settings.TWILIO_ACCOUNT_SID and settings.TWILIO_ACCOUNT_SID != ""

        if not is_configured:
            logger.error("Twilio WhatsApp credentials not configured. Failing explicitly.")
            raise ValueError("Twilio WhatsApp API credentials not configured.")

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
            
            def do_wa_request():
                with urllib.request.urlopen(req, timeout=10) as response:
                    return response.read().decode("utf-8")
                    
            res_body = await asyncio.to_thread(do_wa_request)
            res_json = json.loads(res_body)
            logger.info(f"WhatsApp successfully sent to {normalized_phone}. SID: {res_json.get('sid')}")
        except Exception as e:
            logger.error(f"Error executing WhatsApp delivery to {normalized_phone}: {e}")
            raise

    @staticmethod
    async def send_email(email: str, subject: str, plain_message: str, html_message: str, priority: int = 1, tracking_code: str = ''):
        """Enqueues an email to the background worker queue after validating the recipient."""
        if not validate_email_address(email):
            logger.error(f"Failed to queue email: Recipient address '{email}' is invalid.")
            return False
            
        ensure_worker_started()
        
        await email_queue.put({
            "email": email,
            "subject": subject,
            "plain": plain_message,
            "html": html_message,
            "priority": priority,
            "tracking_code": tracking_code,
            "attempts": 0,
            "next_attempt": None
        })
        logger.info(f"Email successfully added to queue for {email}")
        return True

    @staticmethod
    async def _dispatch_email_direct(email: str, subject: str, plain_message: str, html_message: str, priority: int = 1):
        """Processes actual delivery using the email provider selected in settings. Returns (bool, str)."""
        logger.info(f"[EMAIL SENDING] Provider-dispatching to: {email} | Subject: {subject}")
        log_notification("Email", email, f"Subject: {subject}\n{plain_message}", priority)

        from ..config import settings
        provider = (settings.EMAIL_PROVIDER or "smtp").lower()
        
        if provider == "resend":
            return await NotifierService._dispatch_resend(email, subject, plain_message, html_message)
        elif provider == "sendgrid":
            return await NotifierService._dispatch_sendgrid(email, subject, plain_message, html_message)
        else:
            return await NotifierService._dispatch_smtp(email, subject, plain_message, html_message)

    @staticmethod
    async def _dispatch_resend(email: str, subject: str, plain_message: str, html_message: str):
        from ..config import settings
        if not settings.RESEND_API_KEY:
            logger.error("Resend API Key is missing. Fallback to standard SMTP.")
            return await NotifierService._dispatch_smtp(email, subject, plain_message, html_message)

        try:
            url = "https://api.resend.com/emails"
            headers = {
                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                "Content-Type": "application/json"
            }
            payload = {
                "from": settings.SMTP_FROM or "alerts@resend.dev",
                "to": [email],
                "subject": subject,
                "html": html_message,
                "text": plain_message
            }
            if settings.SMTP_REPLY_TO:
                payload["reply_to"] = settings.SMTP_REPLY_TO

            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(url, data=data, headers=headers, method="POST")
            
            def do_resend():
                with urllib.request.urlopen(req, timeout=10) as response:
                    return response.read().decode("utf-8")
                    
            res_body = await asyncio.to_thread(do_resend)
            res_json = json.loads(res_body)
            logger.info(f"Resend email dispatched successfully. ID: {res_json.get('id')}")
            return True, ""
        except Exception as e:
            logger.error(f"Resend API error dispatching email to {email}: {e}")
            return False, f"Resend API Error: {str(e)}"

    @staticmethod
    async def _dispatch_sendgrid(email: str, subject: str, plain_message: str, html_message: str):
        from ..config import settings
        if not settings.SENDGRID_API_KEY:
            logger.error("SendGrid API Key is missing. Fallback to standard SMTP.")
            return await NotifierService._dispatch_smtp(email, subject, plain_message, html_message)

        try:
            url = "https://api.sendgrid.com/v3/mail/send"
            headers = {
                "Authorization": f"Bearer {settings.SENDGRID_API_KEY}",
                "Content-Type": "application/json"
            }
            
            from_email = settings.SMTP_FROM.split("<")[-1].replace(">", "").strip() if "<" in settings.SMTP_FROM else settings.SMTP_FROM
            from_name = settings.SMTP_FROM.split("<")[0].strip() if "<" in settings.SMTP_FROM else "SafeNova Alerts"

            payload = {
                "personalizations": [
                    {
                        "to": [{"email": email}]
                    }
                ],
                "from": {
                    "email": from_email,
                    "name": from_name
                },
                "subject": subject,
                "content": [
                    {"type": "text/plain", "value": plain_message},
                    {"type": "text/html", "value": html_message}
                ]
            }
            
            if settings.SMTP_REPLY_TO:
                payload["reply_to"] = {"email": settings.SMTP_REPLY_TO}

            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(url, data=data, headers=headers, method="POST")
            
            def do_sendgrid():
                with urllib.request.urlopen(req, timeout=10) as response:
                    return response.read().decode("utf-8")
                    
            await asyncio.to_thread(do_sendgrid)
            logger.info(f"SendGrid email dispatched successfully.")
            return True, ""
        except Exception as e:
            logger.error(f"SendGrid API error dispatching email to {email}: {e}")
            return False, f"SendGrid API Error: {str(e)}"

    @staticmethod
    async def _dispatch_smtp(email: str, subject: str, plain_message: str, html_message: str):
        from ..config import settings
        
        # ALWAYS save email HTML locally to make the Sandbox Inbox preview work in UI
        mock_filename = f"received_email_{email}.html"
        try:
            import os
            os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
            mock_filepath = os.path.join(settings.UPLOAD_DIR, mock_filename)
            with open(mock_filepath, "w", encoding="utf-8") as f:
                f.write(html_message)
            logger.info(f"Saved local email copy for sandbox preview to: {mock_filepath}")
        except Exception as e:
            logger.error(f"Error saving sandbox copy of email: {e}")

        # Check if SMTP is configured with actual credentials (not placeholders or empty strings)
        is_configured = all([
            settings.SMTP_HOST,
            settings.SMTP_USER,
            settings.SMTP_PASSWORD,
            settings.SMTP_FROM
        ]) and "your-email" not in settings.SMTP_USER and settings.SMTP_USER != ""
        
        if not is_configured:
            log_notification("Email (Mock)", email, f"[Saved locally: /api/emergency/evidence-file/{mock_filename}] Subject: {subject}\n{plain_message}", 1)
            return True, ""

        import smtplib
        from email.utils import formatdate, make_msgid
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        try:
            msg = MIMEMultipart("alternative")
            msg["From"] = settings.SMTP_FROM
            msg["To"] = email
            msg["Subject"] = subject
            msg["Date"] = formatdate(localtime=True)
            msg["Message-ID"] = make_msgid(domain=settings.SMTP_HOST)
            msg["MIME-Version"] = "1.0"
            
            if settings.SMTP_REPLY_TO:
                msg["Reply-To"] = settings.SMTP_REPLY_TO
            if settings.SMTP_RETURN_PATH:
                msg["Return-Path"] = settings.SMTP_RETURN_PATH

            part1 = MIMEText(plain_message, "plain", "utf-8")
            part2 = MIMEText(html_message, "html", "utf-8")
            msg.attach(part1)
            msg.attach(part2)

            def do_smtp():
                server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)
                server.quit()
                
            await asyncio.to_thread(do_smtp)
            logger.info(f"SMTP email successfully delivered to {email}")
            return True, ""
        except Exception as e:
            logger.error(f"SMTP error dispatching email to {email}: {e}")
            return False, f"SMTP Error: {str(e)}"

    @staticmethod
    async def send_voice_call(phone: str, text: str, priority: int = 1):
        normalized_phone = normalize_phone(phone)
        logger.info(f"[VOICE CALL ALERT] [Priority {priority}] Calling {normalized_phone} - TTS Script: {text}")
        log_notification("Voice Call", normalized_phone, text, priority)

    @classmethod
    async def trigger_emergency_notifications(cls, user_name: str, contacts: list, session_details: dict):
        """Dispatches alerts across channels. Normalizes templates to prevent spam boxes."""
        tracking_code = session_details.get('tracking_code', '')
        tracking_link = f"http://localhost:5173/guardian?code={tracking_code}"
        maps_link = f"https://www.google.com/maps?q={session_details.get('lat')},{session_details.get('lng')}"
        
        # Deduplication check: limit alerts to once every 3 minutes per recipient/session
        now = datetime.utcnow()
        
        sms_body = (
            f"ALERT: {user_name} is in danger! Emergency Type: {session_details.get('type')}. "
            f"Location: {session_details.get('address')}. "
            f"Battery: {session_details.get('battery')}%. "
            f"Live track: {tracking_link} "
            f"Maps: {maps_link}"
        )
        
        # Refactored warm personal templates (plain text + html alternative formats)
        email_subject = f"Emergency Alert from {user_name} - Please Check Immediately"
        
        email_plain = (
            f"Hi,\n\n"
            f"I have triggered an emergency alert. Please check on me as soon as possible.\n\n"
            f"Here are my current details:\n"
            f"- My location: {session_details.get('address')}\n"
            f"- GPS Coordinates: {session_details.get('lat')}, {session_details.get('lng')}\n"
            f"- Device Battery: {session_details.get('battery')}%\n"
            f"- Medical Info: {session_details.get('blood_group', 'N/A')} ({session_details.get('medical_notes', 'N/A')})\n\n"
            f"You can track my live updates and location here:\n"
            f"{tracking_link}\n\n"
            f"Or view my position on Google Maps:\n"
            f"{maps_link}\n\n"
            f"Please reach out to me immediately.\n\n"
            f"Best regards,\n"
            f"{user_name}"
        )
        
        # High quality spam-compliant HTML Template
        email_html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SafeNova Safety Status Update</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f6f9fc; margin: 0; padding: 0; color: #333333; }}
    .container {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 24px; border-radius: 8px; border: 1px solid #e1e8ed; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }}
    .header {{ font-size: 18px; font-weight: bold; margin-bottom: 20px; color: #1a202c; border-bottom: 2px solid #edf2f7; padding-bottom: 12px; }}
    .status-alert {{ background-color: #fffaf0; border-left: 4px solid #dd6b20; padding: 12px; border-radius: 4px; margin-bottom: 20px; font-size: 14px; line-height: 1.5; color: #7b341e; }}
    .table {{ width: 100%; border-collapse: collapse; margin-bottom: 24px; }}
    .table td {{ padding: 8px 0; border-bottom: 1px solid #edf2f7; font-size: 14px; }}
    .table td.label {{ font-weight: 600; color: #4a5568; width: 150px; }}
    .table td.value {{ color: #1a202c; }}
    .btn-container {{ text-align: center; margin-bottom: 24px; }}
    .btn {{ display: inline-block; background-color: #1a202c; color: #ffffff !important; padding: 12px 24px; border-radius: 6px; font-weight: bold; text-decoration: none; font-size: 14px; }}
    .footer {{ font-size: 12px; color: #718096; border-top: 1px solid #edf2f7; padding-top: 12px; line-height: 1.4; }}
  </style>
</head>
<body>
  <div style="background-color: #f6f9fc; padding: 20px 0;">
    <div class="container">
      <div class="header">SafeNova Safety Alert</div>
      <div class="status-alert">
        I have triggered an emergency alert. Please check on me as soon as possible.
      </div>
      <table class="table">
        <tr>
          <td class="label">User Name</td>
          <td class="value">{user_name}</td>
        </tr>
        <tr>
          <td class="label">Incident Type</td>
          <td class="value">{session_details.get('type', 'manual')}</td>
        </tr>
        <tr>
          <td class="label">Current Location</td>
          <td class="value">{session_details.get('address', 'Unknown')}</td>
        </tr>
        <tr>
          <td class="label">Coordinates</td>
          <td class="value">{session_details.get('lat')}, {session_details.get('lng')}</td>
        </tr>
        <tr>
          <td class="label">Battery Status</td>
          <td class="value">{session_details.get('battery')}%</td>
        </tr>
        <tr>
          <td class="label">Medical Info</td>
          <td class="value">{session_details.get('blood_group', 'N/A')} | Notes: {session_details.get('medical_notes', 'N/A')}</td>
        </tr>
      </table>
      <div class="btn-container">
        <a href="{tracking_link}" class="btn">View Live Tracking Portal</a>
      </div>
      <div style="font-size: 13px; color: #4a5568; margin-bottom: 20px;">
        To open coordinates directly in satellite navigation, visit: <a href="{maps_link}" style="color: #3182ce; text-decoration: underline;">Google Maps Link</a>.
      </div>
      <div class="footer">
        SafeNova Guard Services. This email was triggered by user command or trigger conditions set on the device. Please verify the contact's safety.
      </div>
    </div>
  </div>
</body>
</html>"""

        tasks = []
        
        for contact in contacts:
            dedup_key = (contact.email, tracking_code)
            if dedup_key in sent_cache:
                last_sent = sent_cache[dedup_key]
                if now - last_sent < timedelta(minutes=3):
                    logger.info(f"Duplicate email detection for {contact.email}. Skipping notification.")
                    continue
            
            # Record sent timestamp for deduplication
            sent_cache[dedup_key] = now

            if contact.notify_sms:
                async def _send_sms_task(c=contact):
                    try:
                        await cls.send_sms(c.phone, sms_body, c.priority)
                        await manager.broadcast_to_session(tracking_code, {
                            "type": "notification_status", "channel": "sms", "status": "success", "recipient": c.phone
                        })
                    except Exception as e:
                        logger.error(f"Failed to send SMS to {c.phone}: {e}")
                        await manager.broadcast_to_session(tracking_code, {
                            "type": "notification_status", "channel": "sms", "status": "failed", "recipient": c.phone, "error": str(e)
                        })
                tasks.append(asyncio.create_task(_send_sms_task()))

            if contact.notify_whatsapp:
                async def _send_wa_task(c=contact):
                    whatsapp_phone = c.whatsapp if c.whatsapp else c.phone
                    try:
                        await cls.send_whatsapp(whatsapp_phone, sms_body, c.priority)
                        await manager.broadcast_to_session(tracking_code, {
                            "type": "notification_status", "channel": "whatsapp", "status": "success", "recipient": whatsapp_phone
                        })
                    except Exception as e:
                        logger.error(f"Failed to send WhatsApp to {whatsapp_phone}: {e}")
                        await manager.broadcast_to_session(tracking_code, {
                            "type": "notification_status", "channel": "whatsapp", "status": "failed", "recipient": whatsapp_phone, "error": str(e)
                        })
                tasks.append(asyncio.create_task(_send_wa_task()))

            if contact.notify_email:
                async def _send_email_task(c=contact):
                    try:
                        await cls.send_email(c.email, email_subject, email_plain, email_html, c.priority, tracking_code)
                    except Exception as e:
                        logger.error(f"Failed to send Email to {c.email}: {e}")
                        await manager.broadcast_to_session(tracking_code, {
                            "type": "notification_status", "channel": "email", "status": "failed", "recipient": c.email, "error": str(e)
                        })
                tasks.append(asyncio.create_task(_send_email_task()))

            if contact.notify_call:
                async def _send_call_task(c=contact):
                    try:
                        await cls.send_voice_call(c.phone, f"Emergency alert. Your contact {user_name} is in danger. We have sent you a text with their live location.", c.priority)
                    except Exception as e:
                        logger.error(f"Failed to make voice call to {c.phone}: {e}")
                tasks.append(asyncio.create_task(_send_call_task()))
                
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
