import sys
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.api.deps import get_current_user
from app.api import routes
from app.db import Base, get_db
from app.main import app
from app.models import Farm, User, RecommendationFeedback


def _recommendation_result():
    return {
        "prediction": "Maize",
        "confidence": 0.84,
        "suitability_label": "Good suitability",
        "model_version": "test-model",
        "demo_mode": False,
        "message": "Test recommendation",
        "shap": [],
        "reason": "Test reason",
        "reasons_breakdown": [],
        "soil_type_detected": "Red Soil",
        "is_soil_estimated": False,
        "suitable_crops": [],
        "inputs_used": {},
    }


def test_farmer_can_submit_feedback_for_owned_recommendation(tmp_path, monkeypatch):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'feedback.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    test_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with test_session() as db:
        user = User(full_name="Feedback Farmer", mobile_number="9876543001", password_hash="test")
        db.add(user)
        db.commit()
        db.refresh(user)
        farm = Farm(
            user_id=user.id,
            state="Telangana",
            district="Medchal",
            land_size=2,
            land_unit="acres",
            soil_type="Red Soil",
            water_availability="Medium",
        )
        db.add(farm)
        db.commit()
        db.refresh(farm)
        farmer_id = user.id

    def override_get_db():
        db = test_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: User(id=farmer_id)
    monkeypatch.setattr(routes.crop_service, "predict", lambda _: _recommendation_result())
    try:
        with TestClient(app) as client:
            recommendation_response = client.post(
                "/api/recommendations",
                json={
                    "state": "Telangana",
                    "district": "Medchal",
                    "land_size": 2,
                    "land_unit": "acres",
                    "soil_type": "Red Soil",
                    "season": "Kharif",
                    "weather_summary": {},
                },
            )
            assert recommendation_response.status_code == 200
            recommendation_id = recommendation_response.json()["recommendation_id"]
            assert recommendation_id is not None

            feedback_response = client.post(
                "/api/recommendation-feedback",
                json={
                    "recommendation_id": recommendation_id,
                    "crop": "Maize",
                    "model_version": "test-model",
                    "rating": "helpful",
                    "comment": "Clear and useful.",
                },
            )

        assert feedback_response.status_code == 201
        response_data = feedback_response.json()
        assert response_data["review_status"] == "PENDING_REVIEW"
        assert "not automatically retrain" in response_data["message"]
        with test_session() as db:
            stored = db.query(RecommendationFeedback).one()
            assert stored.user_id == farmer_id
            assert stored.recommendation_id == recommendation_id
            assert stored.rating == "helpful"
            assert stored.comment == "Clear and useful."
            assert stored.review_status == "PENDING_REVIEW"
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)
        engine.dispose()


def test_feedback_cannot_reference_another_users_recommendation(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'feedback-owner.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    test_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with test_session() as db:
        owner = User(full_name="Owner", mobile_number="9876543002", password_hash="test")
        other_user = User(full_name="Other", mobile_number="9876543003", password_hash="test")
        db.add_all([owner, other_user])
        db.commit()
        db.refresh(owner)
        db.refresh(other_user)
        other_user_id = other_user.id
        farm = Farm(
            user_id=owner.id,
            state="Telangana",
            district="Medchal",
            land_size=2,
            land_unit="acres",
            soil_type="Red Soil",
            water_availability="Medium",
        )
        db.add(farm)
        db.commit()
        db.refresh(farm)
        recommendation = routes.Recommendation(
            farm_id=farm.id,
            crop="Maize",
            prediction="Maize",
            model_version="test-model",
        )
        db.add(recommendation)
        db.commit()
        db.refresh(recommendation)
        recommendation_id = recommendation.id

    def override_get_db():
        db = test_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: User(id=other_user_id)
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/recommendation-feedback",
                json={
                    "recommendation_id": recommendation_id,
                    "crop": "Maize",
                    "rating": "helpful",
                },
            )
        assert response.status_code == 404
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)
        engine.dispose()


def test_feedback_rejects_invalid_rating(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'feedback-validation.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    test_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    user = User(id=1, full_name="Validation", mobile_number="9876543004", password_hash="test")

    def override_get_db():
        db = test_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/recommendation-feedback",
                json={"crop": "Maize", "rating": "excellent"},
            )
        assert response.status_code == 422
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)
        engine.dispose()
