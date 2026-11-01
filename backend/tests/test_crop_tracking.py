import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

import app.db as db_module
from app.db import Base, get_db
from app.main import app


@pytest.fixture
def crop_api(tmp_path):
    test_engine = create_engine(
        f"sqlite:///{tmp_path / 'crop_tracking.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=test_engine)
    test_session = sessionmaker(bind=test_engine, autoflush=False, autocommit=False)

    def override_get_db():
        db = test_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        registration = client.post(
            "/api/auth/register",
            json={
                "full_name": "Crop Tracking Test",
                "mobile_number": "9876543210",
                "password": "test-password",
                "confirm_password": "test-password",
            },
        )
        assert registration.status_code == 200
        headers = {"Authorization": f"Bearer {registration.json()['access_token']}"}
        farm_response = client.post(
            "/api/farms",
            headers=headers,
            json={
                "state": "Telangana",
                "district": "Medchal-Malkajgiri",
                "land_size": 5,
                "land_unit": "acres",
                "soil_type": "Red Soil",
                "water_availability": "Medium",
            },
        )
        assert farm_response.status_code == 200
        yield client, headers, farm_response.json()["id"]

    app.dependency_overrides.pop(get_db, None)
    test_engine.dispose()


def test_create_custom_crop_persists_crop_land_and_planting_details(crop_api):
    client, headers, farm_id = crop_api

    response = client.post(
        "/api/crops",
        headers=headers,
        json={
            "farm_id": farm_id,
            "crop_name": "  Turmeric  ",
            "is_custom": True,
            "land_size": 0.75,
            "land_unit": "hectares",
            "sowing_date": "2026-10-25",
            "current_stage": "Vegetative Growth",
        },
    )

    assert response.status_code == 200
    crop = response.json()
    assert crop["crop_name"] == "Turmeric"
    assert crop["is_custom"] is True
    assert crop["land_size"] == 0.75
    assert crop["land_unit"] == "hectares"
    assert crop["sowing_date"] == "2026-10-25"
    assert crop["current_stage"] == "Vegetative Growth"
    assert crop["created_at"] is not None
    assert crop["updated_at"] is not None

    listed = client.get("/api/crops", headers=headers)
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [crop["id"]]


@pytest.mark.parametrize(
    "changes",
    [
        {"crop_name": "   "},
        {"land_size": 0},
        {"land_size": -1},
        {"land_unit": "unknown"},
        {"current_stage": "   "},
    ],
)
def test_create_crop_rejects_invalid_fields(crop_api, changes):
    client, headers, farm_id = crop_api
    payload = {
        "farm_id": farm_id,
        "crop_name": "Tomato",
        "is_custom": False,
        "land_size": 1.5,
        "land_unit": "acres",
        "sowing_date": "2026-10-25",
        "current_stage": "Flowering",
    }
    payload.update(changes)

    response = client.post("/api/crops", headers=headers, json=payload)

    assert response.status_code == 422


def test_user_cannot_create_crop_on_another_users_farm(crop_api):
    client, headers, _ = crop_api
    registration = client.post(
        "/api/auth/register",
        json={
            "full_name": "Another Farmer",
            "mobile_number": "9876543211",
            "password": "test-password",
            "confirm_password": "test-password",
        },
    )
    other_headers = {"Authorization": f"Bearer {registration.json()['access_token']}"}
    farm_response = client.post(
        "/api/farms",
        headers=other_headers,
        json={
            "state": "Telangana",
            "district": "Nalgonda",
            "land_size": 3,
            "land_unit": "acres",
            "soil_type": "Black Soil",
            "water_availability": "Medium",
        },
    )

    response = client.post(
        "/api/crops",
        headers=headers,
        json={
            "farm_id": farm_response.json()["id"],
            "crop_name": "Tomato",
            "is_custom": False,
            "land_size": 1,
            "land_unit": "acres",
            "sowing_date": "2026-10-25",
            "current_stage": "Seedling Stage",
        },
    )

    assert farm_response.status_code == 200
    assert response.status_code == 404
    assert response.json()["detail"] == "Farm not found."


def test_existing_crop_table_is_migrated_without_dropping_data(tmp_path, monkeypatch):
    legacy_engine = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    with legacy_engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE crops ("
                "id INTEGER PRIMARY KEY, farm_id INTEGER NOT NULL, "
                "crop_name VARCHAR(100) NOT NULL, sowing_date VARCHAR(30), "
                "current_stage VARCHAR(100), status VARCHAR(30), created_at DATETIME)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO crops (id, farm_id, crop_name) "
                "VALUES (1, 7, 'Rice (Paddy)')"
            )
        )

    monkeypatch.setattr(db_module, "engine", legacy_engine)
    db_module.migrate_crop_tracking_columns()
    db_module.migrate_crop_tracking_columns()

    columns = {column["name"] for column in inspect(legacy_engine).get_columns("crops")}
    with legacy_engine.connect() as connection:
        original_crop = connection.execute(
            text("SELECT id, crop_name FROM crops WHERE id = 1")
        ).one()

    assert {"is_custom", "land_size", "land_unit", "updated_at"} <= columns
    assert tuple(original_crop) == (1, "Rice (Paddy)")
    legacy_engine.dispose()
