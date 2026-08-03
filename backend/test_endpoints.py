import unittest
import requests
import json
import time

BASE_URL = "http://localhost:8000/api"

class TestSafeNovaAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # We assume local server is running on 8000
        # Check nominal service status first
        try:
            r = requests.get("http://localhost:8000/")
            cls.server_online = (r.status_code == 200)
        except Exception:
            cls.server_online = False
            
    def test_01_server_status(self):
        if not self.server_online:
            self.skipTest("Backend server is not running at http://localhost:8000")
        r = requests.get("http://localhost:8000/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("online", r.json()["status"])

    def test_02_registration_and_login(self):
        if not self.server_online:
            self.skipTest("Backend server offline")
            
        test_email = f"test_{int(time.time())}@safenova.com"
        
        # 1. Register User
        reg_payload = {
            "name": "Integration Tester",
            "email": test_email,
            "password": "integration-test-key"
        }
        r_reg = requests.post(f"{BASE_URL}/auth/register", json=reg_payload)
        self.assertEqual(r_reg.status_code, 200)
        user_res = r_reg.json()
        self.assertEqual(user_res["name"], "Integration Tester")
        self.assertIsNotNone(user_res["tracking_code"])
        
        # 2. Login User
        login_payload = {
            "email": test_email,
            "password": "integration-test-key"
        }
        r_login = requests.post(f"{BASE_URL}/auth/login", json=login_payload)
        self.assertEqual(r_login.status_code, 200)
        auth_res = r_login.json()
        self.assertIn("access_token", auth_res)
        
        # Verify Token in secure headers
        token = auth_res["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        r_me = requests.get(f"{BASE_URL}/auth/me", headers=headers)
        self.assertEqual(r_me.status_code, 200)
        self.assertEqual(r_me.json()["email"], test_email)

    def test_03_ai_safety_scoring(self):
        if not self.server_online:
            self.skipTest("Backend server offline")
            
        # We query the AI safety engine for downtown coordinates
        # Logged in headers not required or standard auth setup
        # Register a quick dummy session to query
        test_email = f"dummy_{int(time.time())}@safenova.com"
        r_reg = requests.post(f"{BASE_URL}/auth/register", json={
            "name": "Dummy Query", "email": test_email, "password": "pass"
        })
        token = requests.post(f"{BASE_URL}/auth/login", json={
            "email": test_email, "password": "pass"
        }).json()["access_token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Retrieve score
        r_score = requests.get(f"{BASE_URL}/ai/safety-score?latitude=12.9716&longitude=77.5946", headers=headers)
        self.assertEqual(r_score.status_code, 200)
        score_data = r_score.json()
        self.assertIn("overall_score", score_data)
        self.assertIn("rating", score_data)
        
        # Retrieve paths
        route_payload = {
            "start_lat": 12.9716, "start_lng": 77.5946,
            "end_lat": 12.9850, "end_lng": 77.6050
        }
        r_route = requests.post(f"{BASE_URL}/ai/safe-route", json=route_payload, headers=headers)
        self.assertEqual(r_route.status_code, 200)
        route_data = r_route.json()
        self.assertIn("shortest_route", route_data)
        self.assertIn("safest_route", route_data)

if __name__ == "__main__":
    unittest.main()
