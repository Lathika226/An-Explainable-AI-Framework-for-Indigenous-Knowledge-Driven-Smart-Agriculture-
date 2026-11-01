import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db import Base, engine

client = TestClient(app)

def test_soil_estimation():
    res = client.post("/api/soil/estimate", json={
        "state": "Telangana",
        "district": "Medchal-Malkajgiri",
        "mandal": "Ghatkesar"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["estimated_soil_type"] == "Red Soil"
    assert "agro-climatic" in data["source"]

def test_user_auth_and_farm_flow():
    mobile = "9988776655"
    # 1. Register
    reg_res = client.post("/api/auth/register", json={
        "full_name": "Ramesh Farmer",
        "mobile_number": mobile,
        "password": "password123",
        "confirm_password": "password123"
    })
    if reg_res.status_code == 400:
        # Already exists, login
        login_res = client.post("/api/auth/login", json={
            "mobile_number": mobile,
            "password": "password123"
        })
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
    else:
        assert reg_res.status_code == 200
        token = reg_res.json()["access_token"]

    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create Farm
    farm_res = client.post("/api/farms", headers=headers, json={
        "state": "Telangana",
        "district": "Medchal-Malkajgiri",
        "mandal": "Ghatkesar",
        "village": "Bogaram",
        "land_size": 2.5,
        "land_unit": "acres",
        "soil_type": "Red Soil",
        "water_availability": "Medium"
    })
    assert farm_res.status_code == 200
    farm_id = farm_res.json()["id"]

    # 3. Recommend Crops (with farm_id)
    rec_res = client.post("/api/recommendations", headers=headers, json={
        "farm_id": farm_id,
        "season": "Kharif",
        "land_size": 2.5,
        "soil_type": "Red Soil",
        "weather_summary": {"temperature": 28.0, "humidity": 68.0, "rainfall": 190.0}
    })
    assert rec_res.status_code == 200
    rec_data = rec_res.json()
    assert rec_data["prediction"] is not None
    assert rec_data["prediction"] != "Live model not connected"
    assert "Farm not found" not in rec_data["message"]
    assert len(rec_data["reasons_breakdown"]) > 0
    assert rec_data["confidence"] is not None
    assert rec_data["confidence"] > 0
    assert len(rec_data["shap"]) > 0

    # 4. Recommend Crops without farm_id (Direct payload)
    direct_rec = client.post("/api/recommendations", headers=headers, json={
        "state": "Andhra Pradesh",
        "district": "Guntur",
        "mandal": "Tenali",
        "village": "Nandivelugu",
        "season": "Kharif",
        "land_size": 3.0,
        "soil_type": "I don't know my soil type",
        "weather_summary": {"temperature": 29.0, "humidity": 70.0, "rainfall": 210.0}
    })
    assert direct_rec.status_code == 200
    direct_data = direct_rec.json()
    assert direct_data["prediction"] is not None
    assert direct_data["is_soil_estimated"] == True
    assert "Black Soil" in direct_data["soil_type_detected"]

    # 5. Multilingual Q&A (Telugu, Hindi, English)
    te_qa = client.post("/api/ai/ask", headers=headers, json={
        "farm_id": farm_id,
        "message": "ఈ పంట ఎందుకు అనుకూలం?",
        "language": "te-IN"
    })
    assert te_qa.status_code == 200
    assert len(te_qa.json()["answer"]) > 20

    hi_qa = client.post("/api/ai/ask", headers=headers, json={
        "farm_id": farm_id,
        "message": "कपास क्यों नहीं?",
        "language": "hi-IN"
    })
    assert hi_qa.status_code == 200
    assert len(hi_qa.json()["answer"]) > 20
