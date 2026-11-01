from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, JSON, Boolean
from app.db import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    full_name = Column(String(255), nullable=True)
    mobile_number = Column(String(30), unique=True, nullable=True, index=True)
    password_hash = Column(String(255), nullable=True)
    role = Column(String(50), default="farmer")
    language = Column(String(20), default="en")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @property
    def name(self):
        return self.full_name or "Farmer"

    @name.setter
    def name(self, value):
        self.full_name = value

class Farm(Base):
    __tablename__ = "farms"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    state = Column(String(100))
    district = Column(String(100))
    mandal = Column(String(100), nullable=True)
    village = Column(String(150))
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    land_size = Column(Float)
    land_unit = Column(String(30))
    soil_type = Column(String(80))
    water_availability = Column(String(80))
    created_at = Column(DateTime, default=datetime.utcnow)

class Crop(Base):
    __tablename__ = "crops"
    id = Column(Integer, primary_key=True)
    farm_id = Column(Integer, ForeignKey("farms.id"), nullable=False)
    crop_name = Column(String(100), nullable=False)
    is_custom = Column(Boolean, nullable=False, default=False)
    land_size = Column(Float, nullable=True)
    land_unit = Column(String(30), nullable=True)
    sowing_date = Column(String(30), nullable=True)
    current_stage = Column(String(100), nullable=True)
    status = Column(String(30), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Recommendation(Base):
    __tablename__ = "recommendations"
    id = Column(Integer, primary_key=True)
    farm_id = Column(Integer, ForeignKey("farms.id"), nullable=False)
    crop = Column(String(100))
    inputs_json = Column(JSON)
    prediction = Column(String(100))
    confidence = Column(Float, nullable=True)
    model_version = Column(String(50), default="demo")
    created_at = Column(DateTime, default=datetime.utcnow)

class RecommendationFeedback(Base):
    __tablename__ = "recommendation_feedback"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    recommendation_id = Column(Integer, ForeignKey("recommendations.id"), nullable=True, index=True)
    crop = Column(String(100), nullable=False)
    model_version = Column(String(100), nullable=True)
    rating = Column(String(30), nullable=False)
    comment = Column(Text, nullable=True)
    review_status = Column(String(30), nullable=False, default="PENDING_REVIEW")
    created_at = Column(DateTime, default=datetime.utcnow)

class IndigenousKnowledge(Base):
    __tablename__ = "indigenous_knowledge"
    id = Column(Integer, primary_key=True)
    title = Column(String(255))
    region = Column(String(150))
    state = Column(String(100))
    district = Column(String(100), nullable=True)
    crop = Column(String(100))
    crop_stage = Column(String(100), nullable=True)
    season = Column(String(100), nullable=True)
    soil_type = Column(String(100), nullable=True)
    problem = Column(Text, nullable=True)
    practice = Column(Text)
    purpose = Column(Text, nullable=True)
    evidence = Column(Text, nullable=True)
    source = Column(String(255), nullable=True)
    source_url = Column(Text, nullable=True)
    doi = Column(String(255), nullable=True)
    validation_status = Column(String(50), default="UNDER_REVIEW")
    reviewer = Column(String(255), nullable=True)
    language = Column(String(30), default="en")
    created_at = Column(DateTime, default=datetime.utcnow)

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True)
    farm_id = Column(Integer, ForeignKey("farms.id"), nullable=False)
    crop_id = Column(Integer, ForeignKey("crops.id"), nullable=True)
    type = Column(String(50))
    severity = Column(String(30))
    message = Column(Text)
    read_status = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
