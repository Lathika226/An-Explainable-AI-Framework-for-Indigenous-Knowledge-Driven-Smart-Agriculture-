from datetime import date
from typing import Optional, Any, List, Literal
from pydantic import BaseModel, Field
from pydantic import field_validator

class FarmCreate(BaseModel):
    user_id: Optional[int] = 1
    state: str
    district: str
    mandal: Optional[str] = None
    village: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    land_size: float = 2.0
    land_unit: str = "acres"
    soil_type: str = "Red Soil"
    water_availability: str = "Medium"

class FarmResponse(BaseModel):
    id: int
    user_id: int
    state: str
    district: str
    mandal: Optional[str] = None
    village: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    land_size: float = 2.0
    land_unit: str = "acres"
    soil_type: str = "Red Soil"
    water_availability: str = "Medium"

class CropRecommendationRequest(BaseModel):
    farm_id: Optional[int] = None
    state: Optional[str] = "Telangana"
    district: Optional[str] = "Medchal-Malkajgiri"
    mandal: Optional[str] = None
    village: Optional[str] = None
    land_size: Optional[float] = 2.0
    land_unit: Optional[str] = "acres"
    soil_type: Optional[str] = "Red Soil"
    season: str = "Kharif"
    previous_crop: Optional[str] = None
    current_crop: Optional[str] = None
    weather_summary: Optional[dict[str, Any]] = None
    technical_features: dict[str, Any] = Field(default_factory=dict)

class RecommendedCropItem(BaseModel):
    crop: str
    confidence: float
    suitability_label: str
    why: str
    water_requirement: str
    risk_factor: str

class CropRecommendationResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    prediction: Optional[str]
    recommendation_id: Optional[int] = None
    confidence: Optional[float] = None
    suitability_label: Optional[str] = "High Suitability"
    model_version: str = "XGBoost + Agronomic ML Engine"
    demo_mode: bool = False
    message: str = ""
    shap: List[dict[str, Any]] = []
    reason: Optional[str] = None
    reasons_breakdown: List[str] = []
    soil_type_detected: Optional[str] = None
    is_soil_estimated: bool = False
    suitable_crops: List[RecommendedCropItem] = []
    inputs_used: dict[str, Any] = Field(default_factory=dict)

class RecommendationFeedbackCreate(BaseModel):
    recommendation_id: Optional[int] = Field(default=None, gt=0)
    crop: str = Field(min_length=1, max_length=100)
    model_version: Optional[str] = Field(default=None, max_length=100)
    rating: Literal["helpful", "partly_helpful", "not_helpful"]
    comment: Optional[str] = Field(default=None, max_length=1000)

    @field_validator("crop", "model_version")
    @classmethod
    def strip_feedback_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank.")
        return value

    @field_validator("comment")
    @classmethod
    def normalize_feedback_comment(cls, value: Optional[str]) -> Optional[str]:
        return value.strip() if value and value.strip() else None

class SoilEstimateRequest(BaseModel):
    state: str
    district: str
    mandal: Optional[str] = None
    village: Optional[str] = None

class SoilEstimateResponse(BaseModel):
    estimated_soil_type: str
    confidence: str
    source: str
    explanation: str


class CropCreate(BaseModel):
    farm_id: int = Field(gt=0)
    crop_name: str = Field(min_length=1, max_length=100)
    is_custom: bool = False
    land_size: float = Field(gt=0, allow_inf_nan=False)
    land_unit: Literal["acres", "hectares", "cents", "square_metres", "square_feet"]
    sowing_date: Optional[date] = None
    current_stage: str = Field(min_length=1, max_length=100)

    @field_validator("crop_name", "current_stage")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank.")
        return value

class VoiceTextRequest(BaseModel):
    text: str
    language: str = "en"

class KnowledgeSearchRequest(BaseModel):
    query: str
    state: Optional[str] = None
    crop: Optional[str] = None
    stage: Optional[str] = None

class FarmAIRequest(BaseModel):
    user_id: int = 1
    farm_id: Optional[int] = None
    message: str
    language: str = "en"

class RegisterRequest(BaseModel):
    full_name: str
    mobile_number: str
    password: str
    confirm_password: str

class LoginRequest(BaseModel):
    mobile_number: str
    password: str

class UserResponse(BaseModel):
    id: int
    full_name: str
    mobile_number: str
    role: str = "farmer"
    language: Optional[str] = "en"

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
