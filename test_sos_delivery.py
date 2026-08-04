import requests
import json
import time

BASE_URL = "http://127.0.0.1:8000/api"

def run_test():
    email = f"test_sos_{int(time.time())}@example.com"
    password = "test-password-123"
    
    print(f"1. Registering user {email}...")
    reg_res = requests.post(f"{BASE_URL}/auth/register", json={
        "name": "SOS Tester User",
        "email": email,
        "password": password
    })
    print(f"Status: {reg_res.status_code}")
    if reg_res.status_code != 200:
        print(reg_res.text)
        return
    user_data = reg_res.json()
    token_url = f"{BASE_URL}/auth/login"
    
    print("\n2. Logging in...")
    login_res = requests.post(token_url, json={
        "email": email,
        "password": password
    })
    print(f"Status: {login_res.status_code}")
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    print("\n3. Adding emergency contact...")
    contact_res = requests.post(f"{BASE_URL}/users/contacts", headers=headers, json={
        "name": "Primary Guardian",
        "phone": "+15550199",
        "email": "guardian@example.com",
        "whatsapp": "+15550199",
        "notify_sms": True,
        "notify_whatsapp": True,
        "notify_email": True,
        "notify_call": True,
        "priority": 1
    })
    print(f"Status: {contact_res.status_code}, Body: {contact_res.json()}")
    
    print("\n4. Triggering SOS panic...")
    trigger_res = requests.post(f"{BASE_URL}/emergency/trigger", headers=headers, data={
        "emergency_type": "manual",
        "latitude": 12.9716,
        "longitude": 77.5946,
        "battery": 90,
        "signal_status": "Excellent",
        "address": "123 Test Street, Bangalore"
    })
    print(f"Status: {trigger_res.status_code}, Body: {trigger_res.json()}")
    
    print("\nWaiting 2 seconds for worker thread to process...")
    time.sleep(2)
    
    print("\n5. Checking notification logs...")
    logs_res = requests.get(f"{BASE_URL}/emergency/notification-logs", headers=headers)
    print(f"Status: {logs_res.status_code}")
    for item in logs_res.json():
        print(f"[{item['channel']}] to {item['recipient']}: {item['message'][:150]}")

if __name__ == "__main__":
    run_test()
