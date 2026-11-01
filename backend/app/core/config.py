import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

def _default_tesseract() -> str:
    standard_path = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    if os.name == "nt" and Path(standard_path).is_file():
        return standard_path
    return ""

class Settings(BaseSettings):
    database_url: str = ""
    jwt_secret: str = ""
    frontend_origin: str = "http://localhost:5173"

    firebase_project_id: str = ""
    firebase_private_key: str = ""
    firebase_client_email: str = ""

    llm_api_key: str = ""
    llm_model: str = ""

    weather_api_key: str = ""
    weather_provider: str = ""

    stt_api_key: str = ""
    stt_provider: str = ""

    tts_api_key: str = ""
    tts_provider: str = ""

    google_client_id: str = ""
    google_client_secret: str = ""

    otp_provider: str = ""
    otp_api_key: str = ""

    model_path: str = "../models/crop_xgboost.json"
    disease_model_path: str = "../models/disease_model.pt"
    tesseract_cmd: str = _default_tesseract()
    pesticide_catalog_path: str = "../data/knowledge/pesticide_catalog.json"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
