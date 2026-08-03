import math
from datetime import datetime
from typing import List, Dict, Any

# Mock databases for demonstration. In production, these are loaded from GIS databases.
MOCK_POLICE_STATIONS = [
    {"name": "Metro Police HQ", "lat": 12.9716, "lng": 77.5946, "phone": "+1-555-0199"},
    {"name": "Central Circle Police Station", "lat": 12.9805, "lng": 77.6020, "phone": "+1-555-0122"},
    {"name": "North Precinct Command", "lat": 12.9602, "lng": 77.5732, "phone": "+1-555-0177"}
]

MOCK_HOSPITALS = [
    {"name": "City General Hospital", "lat": 12.9750, "lng": 77.5890, "phone": "+1-555-0211"},
    {"name": "St. Luke Emergency Care", "lat": 12.9650, "lng": 77.6110, "phone": "+1-555-0244"}
]

MOCK_CRIME_ZONES = [
    {"name": "Industrial Yard Dark Alley", "lat": 12.9850, "lng": 77.5990, "risk_multiplier": 1.8},
    {"name": "Old Abandoned Subway", "lat": 12.9550, "lng": 77.5820, "risk_multiplier": 1.9},
    {"name": "Highway Underpass Corridor", "lat": 12.9680, "lng": 77.6050, "risk_multiplier": 1.5}
]

def haversine_distance(lat1, lng1, lat2, lng2):
    """
    Calculate distance between two coordinates in kilometers.
    """
    R = 6371.0 # Earth radius
    
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c

class AISafetyEngine:
    @staticmethod
    def calculate_safety_score(lat: float, lng: float, hour: int = None) -> Dict[str, Any]:
        if hour is None:
            hour = datetime.now().hour
            
        # 1. Base Score starts at 85
        score = 85.0
        
        # 2. Proximity to police station increases safety (up to +15)
        min_police_dist = min([haversine_distance(lat, lng, p["lat"], p["lng"]) for p in MOCK_POLICE_STATIONS])
        if min_police_dist < 1.0: # Close to police
            score += 15
        elif min_police_dist < 3.0:
            score += 8
            
        # 3. Proximity to hospitals increases safety (up to +10)
        min_hospital_dist = min([haversine_distance(lat, lng, h["lat"], h["lng"]) for h in MOCK_HOSPITALS])
        if min_hospital_dist < 1.0:
            score += 10
        elif min_hospital_dist < 3.0:
            score += 5
            
        # 4. Proximity to high crime risk zones heavily penalizes safety
        for crime in MOCK_CRIME_ZONES:
            dist = haversine_distance(lat, lng, crime["lat"], crime["lng"])
            if dist < 0.5: # Inside danger radius
                score -= 35 * crime["risk_multiplier"]
            elif dist < 1.5: # Near danger radius
                score -= 15 * crime["risk_multiplier"]
                
        # 5. Time Penalty (Darkness Factor)
        # Night times (20:00 to 05:00) penalize lighting & base safety score
        is_night = hour >= 20 or hour <= 5
        if is_night:
            score -= 15
            lighting_score = 30 # Dark
            density_score = 25 # Empty streets
        else:
            lighting_score = 90
            density_score = 75
            
        # Clamp score between 0 and 100
        score = max(5.0, min(100.0, score))
        
        # Determine rating
        if score >= 75:
            rating = "Safe"
        elif score >= 50:
            rating = "Medium Risk"
        elif score >= 30:
            rating = "High Risk"
        else:
            rating = "Critical"
            
        return {
            "overall_score": int(score),
            "rating": rating,
            "crime_score": max(5, int(score + 10 if not is_night else score - 5)),
            "lighting_score": lighting_score,
            "density_score": density_score,
            "nearby_police": len([p for p in MOCK_POLICE_STATIONS if haversine_distance(lat, lng, p["lat"], p["lng"]) < 3.0]),
            "nearby_hospitals": len([h for h in MOCK_HOSPITALS if haversine_distance(lat, lng, h["lat"], h["lng"]) < 3.0])
        }

    @classmethod
    def get_safe_routing(cls, start_lat: float, start_lng: float, end_lat: float, end_lng: float) -> Dict[str, Any]:
        """
        Recommends two paths: Direct (Shortest) and Nova Guarded (Safest).
        Calculates safety score for each path, highlighting safe zones, crime nodes, and ETA.
        """
        # Distance calculation
        direct_distance = haversine_distance(start_lat, start_lng, end_lat, end_lng)
        
        # Average speed assumed: 50 km/h for driving, 5 km/h for walking
        shortest_eta = int((direct_distance / 5.0) * 60) # in minutes
        
        # Base safety calculations
        start_safety = cls.calculate_safety_score(start_lat, start_lng)
        end_safety = cls.calculate_safety_score(end_lat, end_lng)
        avg_base_safety = (start_safety["overall_score"] + end_safety["overall_score"]) / 2
        
        # Shortest Route Waypoints (direct line with slight noise)
        shortest_waypoints = [
            {"lat": start_lat, "lng": start_lng},
            {"lat": start_lat + (end_lat - start_lat) * 0.3, "lng": start_lng + (end_lng - start_lng) * 0.3},
            {"lat": start_lat + (end_lat - start_lat) * 0.7, "lng": start_lng + (end_lng - start_lng) * 0.7},
            {"lat": end_lat, "lng": end_lng}
        ]
        
        # Check if shortest path passes close to any crime zones
        crime_conflict = False
        conflict_zone = None
        for wp in shortest_waypoints:
            for crime in MOCK_CRIME_ZONES:
                if haversine_distance(wp["lat"], wp["lng"], crime["lat"], crime["lng"]) < 1.0:
                    crime_conflict = True
                    conflict_zone = crime
                    break
            if crime_conflict:
                break
                
        # Safest Route Waypoints (designed to detour away from crime zones and pass by police/hospitals)
        safest_waypoints = [{"lat": start_lat, "lng": start_lng}]
        
        # If there is a crime conflict on the shortest route, route around it
        mid_lat = start_lat + (end_lat - start_lat) * 0.5
        mid_lng = start_lng + (end_lng - start_lng) * 0.5
        
        if crime_conflict and conflict_zone:
            # Shift the waypoint away from the conflict zone
            # Push it towards the nearest police station or general safe direction
            police = MOCK_POLICE_STATIONS[0]
            safest_waypoints.append({"lat": police["lat"], "lng": police["lng"]})
            safest_safety_score = int(min(98, avg_base_safety + 15))
            safest_distance = direct_distance * 1.25 # 25% longer
        else:
            # No major conflict, route passes close to nearest safe zone
            hosp = MOCK_HOSPITALS[0]
            safest_waypoints.append({"lat": hosp["lat"], "lng": hosp["lng"]})
            safest_safety_score = int(min(98, avg_base_safety + 10))
            safest_distance = direct_distance * 1.12
            
        safest_waypoints.append({"lat": end_lat, "lng": end_lng})
        safest_eta = int((safest_distance / 5.0) * 60)
        
        shortest_score = int(max(15, avg_base_safety - 20 if crime_conflict else avg_base_safety))
        
        return {
            "shortest_route": {
                "distance_km": round(direct_distance, 2),
                "eta_minutes": shortest_eta,
                "safety_score": shortest_score,
                "waypoints": shortest_waypoints,
                "warning": f"Passes through high risk area near {conflict_zone['name']}" if crime_conflict else "Standard path"
            },
            "safest_route": {
                "distance_km": round(safest_distance, 2),
                "eta_minutes": safest_eta,
                "safety_score": safest_safety_score,
                "waypoints": safest_waypoints,
                "benefit": "Nova Guided: Rerouted via safe zones and high-illumination streets"
            }
        }
