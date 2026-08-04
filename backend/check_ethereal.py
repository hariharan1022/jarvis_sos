import imaplib
import email
from email.header import decode_header
import json

def check_emails():
    try:
        mail = imaplib.IMAP4_SSL('imap.ethereal.email')
        mail.login('png7f2oetdn5m2os@ethereal.email', '1JhMxWrAF3PNWDgz8A')
        mail.select('inbox')
        
        status, messages = mail.search(None, 'ALL')
        if status != 'OK':
            print("No messages found!")
            return
            
        email_ids = messages[0].split()
        print(f"Total Emails in Sandbox Inbox: {len(email_ids)}")
        
        out = []
        for eid in email_ids:
            res, data = mail.fetch(eid, '(RFC822)')
            if res != 'OK':
                continue
                
            msg = email.message_from_bytes(data[0][1])
            
            subject, encoding = decode_header(msg["Subject"])[0]
            if isinstance(subject, bytes):
                subject = subject.decode(encoding or "utf-8")
                
            from_ = msg.get("From")
            to_ = msg.get("To")
            date_ = msg.get("Date")
            
            out.append({
                "id": eid.decode(),
                "from": from_,
                "to": to_,
                "subject": subject,
                "date": date_
            })
            
        print(json.dumps(out, indent=2))
    except Exception as e:
        print("Error checking Ethereal Mail:", e)

if __name__ == "__main__":
    check_emails()
