import re
import socket
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.db import get_db
from app.models import Farm, Crop, Recommendation, RecommendationFeedback, User
from app.schemas import (
    FarmCreate, CropRecommendationRequest, CropRecommendationResponse,
    CropCreate, KnowledgeSearchRequest, FarmAIRequest,
    RegisterRequest, LoginRequest, UserResponse, TokenResponse, RecommendationFeedbackCreate,
    SoilEstimateRequest, SoilEstimateResponse
)
from app.core.config import settings
from app.core.security import hash_password, verify_password, create_access_token
from app.api.deps import get_current_user
from app.services.crop_recommendation import CropRecommendationService, detect_soil_from_location
from app.services.knowledge import KnowledgeService
from app.services.weather import WeatherService
from app.services.voice import VoiceService
from app.services.disease import DiseaseDetectionService
from app.services.image_uploads import read_validated_image
from app.services.llm import LLMService
from app.services.pesticide import PesticideRecognitionService

api_router = APIRouter()

def clean_and_validate_mobile(mobile: str) -> str:
    cleaned = re.sub(r"[^\d]", "", mobile)
    if cleaned.startswith("91") and len(cleaned) == 12:
        cleaned = cleaned[2:]
    if not re.match(r"^[6-9]\d{9}$", cleaned):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter a valid 10-digit Indian mobile number."
        )
    return cleaned

def get_system_lan_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('10.255.255.255', 1))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

@api_router.post("/auth/register", response_model=TokenResponse)
def register_user(payload: RegisterRequest, db: Session = Depends(get_db)):
    if not payload.full_name or not payload.full_name.strip():
        raise HTTPException(status_code=400, detail="Full name is required.")
    if not payload.mobile_number:
        raise HTTPException(status_code=400, detail="Mobile number is required.")
    if not payload.password or len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match.")

    mobile = clean_and_validate_mobile(payload.mobile_number)

    existing = db.query(User).filter(User.mobile_number == mobile).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this mobile number already exists.")

    pwd_hash = hash_password(payload.password)
    user = User(
        full_name=payload.full_name.strip(),
        mobile_number=mobile,
        password_hash=pwd_hash,
        role="farmer",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id), "mobile": user.mobile_number})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            full_name=user.full_name or "Farmer",
            mobile_number=user.mobile_number or mobile,
            role=user.role or "farmer",
            language=user.language or "en",
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
def login_user(payload: LoginRequest, db: Session = Depends(get_db)):
    if not payload.mobile_number or not payload.password:
        raise HTTPException(status_code=400, detail="Mobile number and password are required.")

    mobile = clean_and_validate_mobile(payload.mobile_number)
    user = db.query(User).filter(User.mobile_number == mobile).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="Account not found with this mobile number. Please click 'Create Account' below to register."
        )

    if not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect password. Please verify and try again.")

    token = create_access_token({"sub": str(user.id), "mobile": user.mobile_number})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            full_name=user.full_name or "Farmer",
            mobile_number=user.mobile_number or mobile,
            role=user.role or "farmer",
            language=user.language or "en",
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        full_name=current_user.full_name or current_user.name or "Farmer",
        mobile_number=current_user.mobile_number or "",
        role=current_user.role or "farmer",
        language=current_user.language or "en",
    )

@api_router.get("/system/lan-info")
def get_lan_info():
    ip = get_system_lan_ip()
    return {
        "lan_ip": ip,
        "frontend_port": 8000,
        "lan_url": f"http://{ip}:8000"
    }

crop_service = CropRecommendationService(settings.model_path)
knowledge_service = KnowledgeService()
weather_service = WeatherService(settings.weather_api_key, settings.weather_provider)
voice_service = VoiceService(
    settings.stt_api_key, settings.stt_provider,
    settings.tts_api_key, settings.tts_provider
)
disease_service = DiseaseDetectionService(settings.disease_model_path)
pesticide_service = PesticideRecognitionService(
    settings.tesseract_cmd,
    settings.pesticide_catalog_path,
)
llm_service = LLMService(settings.llm_api_key, settings.llm_model)

@api_router.post("/soil/estimate", response_model=SoilEstimateResponse)
def estimate_soil(payload: SoilEstimateRequest):
    soil_type, is_est, explanation = detect_soil_from_location(
        state=payload.state,
        district=payload.district,
        mandal=payload.mandal or ""
    )
    return SoilEstimateResponse(
        estimated_soil_type=soil_type,
        confidence="High" if not is_est else "Regional Estimate",
        source="Location-based agro-climatic database",
        explanation=explanation
    )

@api_router.post("/farms")
def create_farm(payload: FarmCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    farm_data = payload.model_dump()
    farm_data["user_id"] = current_user.id
    farm = Farm(**farm_data)
    db.add(farm)
    db.commit()
    db.refresh(farm)
    return {
        "id": farm.id,
        "user_id": farm.user_id,
        "state": farm.state,
        "district": farm.district,
        "mandal": farm.mandal,
        "village": farm.village,
        "latitude": farm.latitude,
        "longitude": farm.longitude,
        "land_size": farm.land_size,
        "land_unit": farm.land_unit,
        "soil_type": farm.soil_type,
        "water_availability": farm.water_availability,
    }

@api_router.get("/farms")
def list_farms(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    farms = db.query(Farm).filter(Farm.user_id == current_user.id).order_by(Farm.id.desc()).all()
    return [
        {
            "id": f.id,
            "user_id": f.user_id,
            "state": f.state,
            "district": f.district,
            "mandal": f.mandal,
            "village": f.village,
            "latitude": f.latitude,
            "longitude": f.longitude,
            "land_size": f.land_size,
            "land_unit": f.land_unit,
            "soil_type": f.soil_type,
            "water_availability": f.water_availability,
        }
        for f in farms
    ]

@api_router.post("/recommendations", response_model=CropRecommendationResponse)
def recommend(payload: CropRecommendationRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # 1. Resolve farm instance if available
    farm = None
    if payload.farm_id:
        f = db.get(Farm, payload.farm_id)
        if f and f.user_id == current_user.id:
            farm = f

    if not farm:
        # Check if user has an existing farm
        farm = db.query(Farm).filter(Farm.user_id == current_user.id).order_by(Farm.id.desc()).first()

    # 2. Extract and merge features cleanly
    state = payload.state or (farm.state if farm else "Telangana")
    district = payload.district or (farm.district if farm else "Medchal-Malkajgiri")
    mandal = payload.mandal or (farm.mandal if farm else "")
    village = payload.village or (farm.village if farm else "")
    land_size = float(payload.land_size if payload.land_size is not None else (farm.land_size if farm else 2.0))
    land_unit = payload.land_unit or (farm.land_unit if farm else "acres")
    soil_type = payload.soil_type or (farm.soil_type if farm else "Red Soil")
    water_availability = farm.water_availability if farm else "Medium"

    features = {
        "soil_type": soil_type,
        "land_size": land_size,
        "land_unit": land_unit,
        "water_availability": water_availability,
        "state": state,
        "district": district,
        "mandal": mandal,
        "village": village,
        "season": payload.season or "Kharif",
        "previous_crop": payload.previous_crop,
        "weather_summary": payload.weather_summary or {},
        **payload.technical_features,
    }

    result = crop_service.predict(features)

    # 3. Save recommendation record if we have an active farm
    if farm and result.get("prediction"):
        rec = Recommendation(
            farm_id=farm.id,
            crop=result["prediction"],
            inputs_json=features,
            prediction=result["prediction"],
            confidence=result.get("confidence"),
            model_version=result.get("model_version", "ML Engine"),
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)
        result["recommendation_id"] = rec.id

    return result

@api_router.post("/recommendation-feedback", status_code=status.HTTP_201_CREATED)
def submit_recommendation_feedback(
    payload: RecommendationFeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.recommendation_id is not None:
        recommendation = db.query(Recommendation).join(
            Farm, Recommendation.farm_id == Farm.id
        ).filter(
            Recommendation.id == payload.recommendation_id,
            Farm.user_id == current_user.id,
        ).first()
        if not recommendation:
            raise HTTPException(status_code=404, detail="Recommendation not found.")
        if recommendation.prediction != payload.crop:
            raise HTTPException(status_code=400, detail="Feedback crop does not match the recommendation.")

    feedback = RecommendationFeedback(
        user_id=current_user.id,
        recommendation_id=payload.recommendation_id,
        crop=payload.crop,
        model_version=payload.model_version,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return {
        "id": feedback.id,
        "review_status": feedback.review_status,
        "message": "Thank you. Your feedback was saved for review and will not automatically retrain the model.",
    }

@api_router.post("/crops")
def add_crop(payload: CropCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    farm = db.query(Farm).filter(
        Farm.id == payload.farm_id,
        Farm.user_id == current_user.id
    ).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found.")

    crop = Crop(
        farm_id=farm.id,
        crop_name=payload.crop_name,
        is_custom=payload.is_custom,
        land_size=payload.land_size,
        land_unit=payload.land_unit,
        sowing_date=payload.sowing_date.isoformat() if payload.sowing_date else None,
        current_stage=payload.current_stage,
        status="active"
    )
    db.add(crop)
    db.commit()
    db.refresh(crop)
    return crop

@api_router.get("/crops")
def list_crops(farm_id: int = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Crop).join(Farm, Crop.farm_id == Farm.id).filter(Farm.user_id == current_user.id, Crop.status == "active")
    if farm_id:
        query = query.filter(Crop.farm_id == farm_id)
    return query.all()

@api_router.patch("/crops/{crop_id}/stage")
def update_crop_stage(crop_id: int, stage: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    crop = db.query(Crop).join(Farm, Crop.farm_id == Farm.id).filter(
        Crop.id == crop_id,
        Farm.user_id == current_user.id
    ).first()
    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found")
    crop.current_stage = stage
    db.commit()
    db.refresh(crop)
    return crop

@api_router.delete("/crops/{crop_id}")
def delete_crop(crop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    crop = db.query(Crop).join(Farm, Crop.farm_id == Farm.id).filter(
        Crop.id == crop_id,
        Farm.user_id == current_user.id
    ).first()
    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found")
    crop.status = "archived"
    db.commit()
    return {"message": "Crop archived successfully"}

@api_router.get("/knowledge/search")
def search_knowledge(payload: KnowledgeSearchRequest = Depends(), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = knowledge_service.search(
        db, payload.query, payload.state, payload.crop, payload.stage
    )
    return [
        {
            "id": x.id,
            "title": x.title,
            "crop": x.crop,
            "state": x.state,
            "practice": x.practice,
            "evidence": x.evidence,
            "source": x.source,
            "source_url": x.source_url,
            "validation_status": x.validation_status,
        }
        for x in rows
    ]

@api_router.post("/ai/ask")
async def farm_ai(payload: FarmAIRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if payload.farm_id:
        farm = db.get(Farm, payload.farm_id)
        if not farm or farm.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to access this farm")
    
    context = {"user_id": current_user.id, "farm_id": payload.farm_id, "language": payload.language}

    knowledge = knowledge_service.search(db, payload.message)
    context["knowledge"] = [
        {
            "title": x.title,
            "practice": x.practice,
            "evidence": x.evidence,
            "source": x.source,
            "source_url": x.source_url,
        }
        for x in knowledge
    ]

    return await llm_service.answer(payload.message, context)

@api_router.post("/voice/transcribe")
async def transcribe(
    language: str = "en",
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    audio = await file.read()
    return await voice_service.transcribe(audio, language)

@api_router.post("/voice/synthesize")
async def synthesize(text: str, language: str = "en", current_user: User = Depends(get_current_user)):
    return await voice_service.synthesize(text, language)

@api_router.post("/disease/predict")
async def disease_predict(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    image = await read_validated_image(file)
    result = await disease_service.predict(image)
    if not result.get("available"):
        raise HTTPException(status_code=503, detail=result["message"])
    return result

@api_router.post("/pesticide/scan")
async def pesticide_scan(
    files: list[UploadFile] = File(default=[]),
    file: UploadFile | None = File(default=None),
    current_user: User = Depends(get_current_user),
):
    uploads = files or ([file] if file else [])
    if not uploads:
        raise HTTPException(status_code=400, detail="Upload one or two pesticide label images.")
    if len(uploads) > 2:
        raise HTTPException(status_code=400, detail="Upload at most two label images per scan.")

    images = [await read_validated_image(upload) for upload in uploads]
    result = await run_in_threadpool(pesticide_service.scan, images)
    if not result.get("available"):
        raise HTTPException(status_code=503, detail=result["message"])
    return result

@api_router.get("/weather/current")
async def weather_current(latitude: float, longitude: float, current_user: User = Depends(get_current_user)):
    return await weather_service.current(latitude, longitude)
