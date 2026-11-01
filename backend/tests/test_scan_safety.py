import asyncio
from io import BytesIO
import sys
from pathlib import Path

from fastapi import HTTPException, UploadFile
from fastapi.testclient import TestClient
from fastapi.security import HTTPAuthorizationCredentials
from PIL import Image
from starlette.datastructures import Headers

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.api import deps, routes
from app.core.config import settings
from app.core.security import get_jwt_secret
from app.main import app
from app.services.disease import DiseaseDetectionService
from app.services.image_uploads import read_validated_image
from app.services.knowledge import KnowledgeService
from app.services.llm import LLMService
from app.models import IndigenousKnowledge
from app.services.pesticide import PesticideRecognitionService
from sqlalchemy import create_engine
from sqlalchemy.orm import Session


def _png_bytes() -> bytes:
    image = Image.new("RGB", (8, 8), color="green")
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def test_image_upload_accepts_valid_png():
    image = _png_bytes()
    upload = UploadFile(
        file=BytesIO(image),
        filename="leaf.png",
        headers=Headers({"content-type": "image/png"}),
    )

    assert asyncio.run(read_validated_image(upload)) == image


def test_image_upload_rejects_mismatched_content():
    upload = UploadFile(
        file=BytesIO(b"not an image"),
        filename="leaf.png",
        headers=Headers({"content-type": "image/png"}),
    )

    try:
        asyncio.run(read_validated_image(upload))
    except HTTPException as error:
        assert error.status_code == 400
        assert "signature" in error.detail
    else:
        raise AssertionError("Invalid image signature was accepted.")


def test_pesticide_service_reports_unavailable_without_tesseract(tmp_path, monkeypatch):
    monkeypatch.setattr("app.services.pesticide.shutil.which", lambda _: None)
    service = PesticideRecognitionService("", str(tmp_path / "catalog.json"))

    result = service.scan([_png_bytes()])

    assert result["available"] is False
    assert result["identified"] is False
    assert result["verified_product"] is None
    assert "Tesseract OCR" in result["message"]


def test_disease_service_reports_unavailable_without_model(tmp_path):
    service = DiseaseDetectionService(str(tmp_path / "missing-model.pt"))

    result = asyncio.run(service.predict(_png_bytes()))

    assert result["available"] is False
    assert "trained model and class mapping are not configured" in result["message"]


def test_disease_result_formats_dataset_classes_without_treatment_claims(tmp_path):
    service = DiseaseDetectionService(str(tmp_path / "not-present.pt"))

    result = service._format_result("Tomato___Tomato_Yellow_Leaf_Curl_Virus", 0.91)

    assert result["crop"] == "Tomato"
    assert result["condition"] == "Tomato Yellow Leaf Curl Virus"
    assert result["class_label"] == "Tomato___Tomato_Yellow_Leaf_Curl_Virus"
    assert result["confidence_percentage"] == 91
    assert "preliminary" in result["message"]
    assert result["treatment_guidance"] is None


def test_disease_endpoint_returns_clear_unavailable_status(monkeypatch):
    async def unavailable(_image):
        return {
            "available": False,
            "message": "Plant disease screening is currently unavailable because a trained model is not configured.",
        }

    monkeypatch.setattr(routes.disease_service, "predict", unavailable)
    app.dependency_overrides[deps.get_current_user] = lambda: None
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/disease/predict",
                files={"file": ("leaf.png", _png_bytes(), "image/png")},
            )
    finally:
        app.dependency_overrides.pop(deps.get_current_user, None)

    assert response.status_code == 503
    assert "trained model is not configured" in response.json()["detail"]


def test_demo_token_is_not_accepted_as_authentication():
    token = HTTPAuthorizationCredentials(scheme="Bearer", credentials="demo-token")

    try:
        deps.get_current_user(db=None, token=token)
    except HTTPException as error:
        assert error.status_code == 401
    else:
        raise AssertionError("The demo token was accepted as an authenticated user.")


def test_jwt_secret_must_be_configured(monkeypatch):
    monkeypatch.setattr(settings, "jwt_secret", "")

    try:
        get_jwt_secret()
    except RuntimeError as error:
        assert "JWT_SECRET must be configured" in str(error)
    else:
        raise AssertionError("Authentication used an implicit fallback JWT secret.")


def test_ai_assistant_does_not_invent_guidance_without_verified_sources():
    result = asyncio.run(LLMService().answer("What should I apply?", {"knowledge": []}))

    assert result["available"] is False
    assert "No verified agricultural guidance" in result["answer"]
    assert "dosage" in result["answer"]


def test_knowledge_search_requires_evidence_and_https_source():
    engine = create_engine("sqlite://")
    IndigenousKnowledge.__table__.create(bind=engine)
    with Session(engine) as db:
        db.add_all(
            [
                IndigenousKnowledge(
                    title="Verified blight guidance",
                    practice="Practice from an identified source.",
                    evidence="Evidence summary.",
                    source="Agricultural authority",
                    source_url="https://example.org/guidance",
                    validation_status="VERIFIED",
                ),
                IndigenousKnowledge(
                    title="Unsourced blight claim",
                    practice="Unsubstantiated practice.",
                    validation_status="VERIFIED",
                ),
            ]
        )
        db.commit()

        results = KnowledgeService().search(db, "blight")

    assert [item.title for item in results] == ["Verified blight guidance"]
    engine.dispose()


def test_pesticide_endpoint_accepts_two_images(monkeypatch):
    captured_images = []

    def scan(images):
        captured_images.extend(images)
        return {
            "available": True,
            "identified": False,
            "message": "No verified catalog match.",
            "extracted_text": "",
            "verified_product": None,
            "alternatives": [],
        }

    monkeypatch.setattr(routes.pesticide_service, "scan", scan)
    app.dependency_overrides[deps.get_current_user] = lambda: None
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/pesticide/scan",
                files=[
                    ("files", ("front.png", _png_bytes(), "image/png")),
                    ("files", ("ingredients.png", _png_bytes(), "image/png")),
                ],
            )
    finally:
        app.dependency_overrides.pop(deps.get_current_user, None)

    assert response.status_code == 200
    assert response.json()["identified"] is False
    assert len(captured_images) == 2


def test_pesticide_endpoint_rejects_more_than_two_images():
    app.dependency_overrides[deps.get_current_user] = lambda: None
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/pesticide/scan",
                files=[
                    ("files", ("one.png", _png_bytes(), "image/png")),
                    ("files", ("two.png", _png_bytes(), "image/png")),
                    ("files", ("three.png", _png_bytes(), "image/png")),
                ],
            )
    finally:
        app.dependency_overrides.pop(deps.get_current_user, None)

    assert response.status_code == 400
    assert "at most two" in response.json()["detail"]
