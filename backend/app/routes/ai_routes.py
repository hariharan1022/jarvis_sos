from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from ..database import get_db
from .. import models, schemas, auth
from ..services.ai_service import AISafetyEngine, MOCK_POLICE_STATIONS, MOCK_HOSPITALS, MOCK_CRIME_ZONES

router = APIRouter(prefix="/api/ai", tags=["ai"])

@router.get("/safety-score", response_model=schemas.SafetyScoreResponse)
def get_safety_score(
    latitude: float,
    longitude: float,
    current_user: models.User = Depends(auth.get_current_user)
):
    return AISafetyEngine.calculate_safety_score(latitude, longitude)

@router.post("/safe-route")
def get_safe_route(
    req: schemas.RouteRequest,
    current_user: models.User = Depends(auth.get_current_user)
):
    return AISafetyEngine.get_safe_routing(
        req.start_lat, req.start_lng,
        req.end_lat, req.end_lng
    )

@router.get("/safe-zones")
def get_safe_zones(current_user: models.User = Depends(auth.get_current_user)):
    return {
        "police_stations": MOCK_POLICE_STATIONS,
        "hospitals": MOCK_HOSPITALS
    }

@router.get("/incidents")
def get_incident_heatmap(current_user: models.User = Depends(auth.get_current_user)):
    # Returns crime hotspots for mapping overlays
    return MOCK_CRIME_ZONES
