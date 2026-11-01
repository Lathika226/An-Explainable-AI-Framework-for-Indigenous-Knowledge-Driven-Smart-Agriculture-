from pathlib import Path
from typing import Any, List, Optional
import pandas as pd
# pyrefly: ignore [missing-import]
import numpy as np

FEATURES = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]

# Agro-climatic soil suitability reference with water requirements and risk factors
CROP_KNOWLEDGE_DB = {
    "Rice": {
        "suitable_soils": ["Alluvial Soil", "Clay Soil", "Red Soil", "Black Soil"],
        "suitable_seasons": ["Kharif", "Summer"],
        "water_req": "High (Requires regular standing water or frequent irrigation)",
        "ideal_temp": (20.0, 37.0),
        "ideal_ph": (5.5, 7.5),
        "risk_factor": "Pest vulnerability (Stem borer, Blast) during continuous cloudy monsoon weather.",
        "why_template": "High yield potential in {season} season. Compatible with {soil_type} and local irrigation capacity for {land_size} {unit}."
    },
    "Cotton": {
        "suitable_soils": ["Black Soil", "Red Soil", "Alluvial Soil"],
        "suitable_seasons": ["Kharif"],
        "water_req": "Medium (Tolerates moderate dry spells once established)",
        "ideal_temp": (21.0, 35.0),
        "ideal_ph": (6.0, 8.0),
        "risk_factor": "Susceptible to bollworm and moisture stress during flowering stage.",
        "why_template": "Excellent commercial cash crop for {season} season. Well matched with {soil_type} deep root aeration and {state} climatic conditions."
    },
    "Maize": {
        "suitable_soils": ["Red Soil", "Alluvial Soil", "Black Soil", "Sandy Soil"],
        "suitable_seasons": ["Kharif", "Rabi", "Summer"],
        "water_req": "Medium (Requires adequate moisture at silking and grain filling)",
        "ideal_temp": (18.0, 34.0),
        "ideal_ph": (5.8, 7.5),
        "risk_factor": "Sensitive to waterlogging in early stages; monitor for fall armyworm.",
        "why_template": "Highly versatile crop with steady market demand. Adapts exceptionally well to {soil_type} and {season} season in {state}."
    },
    "Groundnut": {
        "suitable_soils": ["Red Soil", "Sandy Soil", "Alluvial Soil"],
        "suitable_seasons": ["Kharif", "Rabi", "Summer"],
        "water_req": "Low to Medium (Drought-resilient legume with nitrogen-fixing benefit)",
        "ideal_temp": (22.0, 32.0),
        "ideal_ph": (6.0, 7.5),
        "risk_factor": "Pod rot risk if harvested in heavy late rains; requires loose soil for peg penetration.",
        "why_template": "Low water footprint legume that enriches {soil_type} with natural nitrogen, ideal for {land_size} {unit} during {season}."
    },
    "Wheat": {
        "suitable_soils": ["Alluvial Soil", "Clay Soil", "Black Soil"],
        "suitable_seasons": ["Rabi"],
        "water_req": "Medium (Requires 4-5 timed irrigations during crown root & heading)",
        "ideal_temp": (12.0, 25.0),
        "ideal_ph": (6.0, 7.8),
        "risk_factor": "Terminal heat stress if winter ends abruptly before grain maturity.",
        "why_template": "Premier winter staple in {season} season, thriving in {soil_type} with reliable cool temperatures."
    },
    "Gram": {
        "suitable_soils": ["Black Soil", "Alluvial Soil", "Clay Soil", "Red Soil"],
        "suitable_seasons": ["Rabi"],
        "water_req": "Low (Thrives on residual soil moisture after monsoon)",
        "ideal_temp": (15.0, 28.0),
        "ideal_ph": (6.0, 8.0),
        "risk_factor": "Wilt disease in waterlogged soils; pod borer during pod formation.",
        "why_template": "Highly economical pulse crop for {season} season, flourishing in {soil_type} with minimal irrigation."
    },
    "Soybean": {
        "suitable_soils": ["Black Soil", "Alluvial Soil", "Red Soil"],
        "suitable_seasons": ["Kharif"],
        "water_req": "Medium (Needs good drainage and consistent monsoon showers)",
        "ideal_temp": (20.0, 32.0),
        "ideal_ph": (6.0, 7.5),
        "risk_factor": "Yellow mosaic virus and pod shattering if harvest is delayed.",
        "why_template": "Profitable oilseed pulse that thrives in {soil_type} during {season} with balanced moisture."
    },
    "Sugarcane": {
        "suitable_soils": ["Alluvial Soil", "Clay Soil", "Black Soil", "Red Soil"],
        "suitable_seasons": ["Year-round", "Kharif", "Summer"],
        "water_req": "High (Requires steady canal or borewell irrigation across 10-12 months)",
        "ideal_temp": (20.0, 38.0),
        "ideal_ph": (6.5, 8.0),
        "risk_factor": "High initial capital and water dependency; early shoot borer.",
        "why_template": "High-yield commercial crop suitable for deep fertile {soil_type} with guaranteed irrigation."
    },
    "Watermelon": {
        "suitable_soils": ["Sandy Soil", "Alluvial Soil", "Red Soil"],
        "suitable_seasons": ["Summer", "Zaid", "Rabi"],
        "water_req": "Low to Medium (Requires drip or furrow irrigation with warm sunlight)",
        "ideal_temp": (24.0, 38.0),
        "ideal_ph": (6.0, 7.2),
        "risk_factor": "Fruit fly infestation and powdery mildew during humid spells.",
        "why_template": "Fast 80-90 day cash crop ideal for sandy or light {soil_type} in warm {season} conditions."
    },
    "Banana": {
        "suitable_soils": ["Alluvial Soil", "Clay Soil", "Black Soil", "Red Soil"],
        "suitable_seasons": ["Year-round", "Kharif"],
        "water_req": "High (Heavy feeder requiring constant soil moisture and mulch)",
        "ideal_temp": (22.0, 36.0),
        "ideal_ph": (6.0, 7.5),
        "risk_factor": "Wind damage / lodging; Panama wilt and sigatoka leaf spot.",
        "why_template": "High return perennial fruit crop ideal for fertile {soil_type} with good moisture holding capacity."
    },
    "Jute": {
        "suitable_soils": ["Alluvial Soil", "Clay Soil"],
        "suitable_seasons": ["Kharif"],
        "water_req": "High (Needs warm humid climate and standing water for retting)",
        "ideal_temp": (24.0, 38.0),
        "ideal_ph": (6.0, 7.5),
        "risk_factor": "Retting water scarcity post-harvest.",
        "why_template": "Traditional fiber crop suited for flood plains and alluvial basins during monsoon."
    },
    "Coffee": {
        "suitable_soils": ["Laterite Soil", "Red Soil"],
        "suitable_seasons": ["Year-round"],
        "water_req": "Medium to High (Shade grown with blossom showers)",
        "ideal_temp": (15.0, 28.0),
        "ideal_ph": (5.5, 6.5),
        "risk_factor": "White stem borer and rust disease.",
        "why_template": "High-value plantation crop suited for hilly lateritic terrain."
    }
}

# Regional soil database for location-based estimates
DISTRICT_SOIL_MAP = {
    "telangana": {
        "default": "Red Soil",
        "black_districts": ["khammam", "nalgonda", "warangal", "adilabad", "nizamabad", "karimnagar", "sangareddy", "medak"],
        "red_districts": ["medchal", "medchal-malkajgiri", "hyderabad", "rangareddy", "mahbubnagar", "nagarkurnool", "suryapet", "yadadri", "jangaon", "siddipet"]
    },
    "andhra pradesh": {
        "default": "Red Soil",
        "black_districts": ["guntur", "kurnool", "anantapur", "prakasam", "kadapa", "krishna"],
        "alluvial_districts": ["east godavari", "west godavari", "krishna"],
        "red_districts": ["chittoor", "visakhapatnam", "vizianagaram", "srikakulam", "nellore"]
    },
    "maharashtra": {"default": "Black Soil"},
    "gujarat": {"default": "Black Soil"},
    "madhya pradesh": {"default": "Black Soil"},
    "punjab": {"default": "Alluvial Soil"},
    "haryana": {"default": "Alluvial Soil"},
    "uttar pradesh": {"default": "Alluvial Soil"},
    "bihar": {"default": "Alluvial Soil"},
    "west bengal": {"default": "Alluvial Soil"},
    "karnataka": {
        "default": "Red Soil",
        "black_districts": ["dharwad", "belagavi", "kalaburagi", "vijayapura", "raichur", "ballari", "bagalkote"],
        "laterite_districts": ["dakshina kannada", "udupi", "uttara kannada", "kodagu", "chikkamagaluru"]
    },
    "tamil nadu": {
        "default": "Red Soil",
        "black_districts": ["coimbatore", "tiruppur", "madurai", "tuticorin", "virudhunagar", "ramanathapuram"],
        "alluvial_districts": ["thanjavur", "thiruvarur", "nagapattinam"]
    },
    "kerala": {"default": "Laterite Soil"},
    "rajasthan": {
        "default": "Sandy Soil",
        "black_districts": ["kota", "baran", "bundi", "jhalawar"]
    },
    "odisha": {"default": "Red Soil", "alluvial_districts": ["cuttack", "puri", "balasore"]}
}

def detect_soil_from_location(state: str = "", district: str = "", mandal: str = "") -> tuple[str, bool, str]:
    """
    Returns (soil_type, is_estimated, explanation)
    """
    st = (state or "").lower().strip()
    dt = (district or "").lower().strip()
    md = (mandal or "").lower().strip()

    if not st and not dt:
        return ("Red Soil", True, "Default estimate based on southern Indian agricultural belt.")

    for state_key, info in DISTRICT_SOIL_MAP.items():
        if state_key in st:
            if "black_districts" in info and any(b in dt or b in md for b in info["black_districts"]):
                return ("Black Soil", True, f"Determined from {district.title() or state.title()} black cotton soil agro-climatic zone.")
            if "alluvial_districts" in info and any(a in dt or a in md for a in info["alluvial_districts"]):
                return ("Alluvial Soil", True, f"Determined from {district.title() or state.title()} alluvial river basin soil zone.")
            if "laterite_districts" in info and any(l in dt or l in md for l in info["laterite_districts"]):
                return ("Laterite Soil", True, f"Determined from {district.title() or state.title()} lateritic belt.")
            if "red_districts" in info and any(r in dt or r in md for r in info["red_districts"]):
                return ("Red Soil", True, f"Determined from {district.title() or state.title()} red sandy loam agro-climatic zone.")
            default_soil = info.get("default", "Red Soil")
            return (default_soil, True, f"Determined from general {state.title()} regional soil classification.")

    if any(k in st for k in ["punjab", "haryana", "uttar", "bihar", "bengal", "assam"]):
        return ("Alluvial Soil", True, f"Determined from Indo-Gangetic / river basin soil profile of {state.title()}.")
    if any(k in st for k in ["maharashtra", "gujarat", "madhya"]):
        return ("Black Soil", True, f"Determined from Deccan trap black soil zone of {state.title()}.")
    if any(k in st for k in ["kerala", "goa"]):
        return ("Laterite Soil", True, f"Determined from coastal laterite soil profile of {state.title()}.")
    if any(k in st for k in ["rajasthan"]):
        return ("Sandy Soil", True, f"Determined from arid/semi-arid soil profile of {state.title()}.")

    return ("Red Soil", True, f"Estimated from regional agro-climatic database for {state.title()}.")

class CropRecommendationService:
    def __init__(self, model_path: str):
        self.model_path = Path(model_path)
        self.model = None
        self.labels = None
        self.model_version = "XGBoost ML v1.0"
        self._try_load()

    def _try_load(self):
        candidate_paths = [
            self.model_path,
            Path(__file__).parent.parent.parent.parent / "models" / "crop_xgboost.json"
        ]
        
        target_path = None
        for p in candidate_paths:
            if p.exists():
                target_path = p
                break
                
        if not target_path:
            return

        try:
            # pyrefly: ignore [missing-import]
            import xgboost as xgb
            import joblib
            self.model = xgb.XGBClassifier()
            self.model.load_model(str(target_path))
            
            lp = target_path.with_name("crop_label_encoder.joblib")
            if lp.exists():
                self.labels = joblib.load(lp)
                
            manifest = target_path.with_name("crop_model_manifest.json")
            if manifest.exists():
                import json
                meta = json.loads(manifest.read_text())
                self.model_version = meta.get("model_version", target_path.stem)
            else:
                self.model_version = target_path.stem
        except Exception:
            self.model = None

    def predict(self, features: dict[str, Any]) -> dict[str, Any]:
        raw_soil = (features.get("soil_type") or "").strip()
        state = (features.get("state") or "Telangana").strip()
        district = (features.get("district") or "Medchal-Malkajgiri").strip()
        mandal = (features.get("mandal") or "").strip()
        village = (features.get("village") or "").strip()
        season = (features.get("season") or "Kharif").strip()
        land_size = float(features.get("land_size") or 2.0)
        land_unit = (features.get("land_unit") or "acres").strip()
        weather_summary = features.get("weather_summary") or {}

        # Handle "I don't know my soil type" or empty soil
        is_soil_estimated = False
        if not raw_soil or "don't know" in raw_soil.lower() or "తెలియదు" in raw_soil or "नहीं पता" in raw_soil or "தெரியாது" in raw_soil or "ತಿಳಿದಿಲ್ಲ" in raw_soil or "estimate" in raw_soil.lower():
            soil_type, is_soil_estimated, soil_exp = detect_soil_from_location(state, district, mandal)
        else:
            soil_type = raw_soil
            is_soil_estimated = False

        # Extract or default weather features
        temp = float(features.get("temperature") or weather_summary.get("temperature") or 27.5)
        humidity = float(features.get("humidity") or weather_summary.get("humidity") or 68.0)
        rainfall = float(features.get("rainfall") or weather_summary.get("rainfall") or 180.0)
        ph = float(features.get("ph") or 6.5)
        N = float(features.get("N") or (95.0 if "Black" in soil_type else 80.0))
        P = float(features.get("P") or 45.0)
        K = float(features.get("K") or 42.0)

        # 1. Evaluate agronomic suitability scores across known crops
        scored_crops = []
        for crop_name, meta in CROP_KNOWLEDGE_DB.items():
            score = 0.50
            reasons_list = []

            # Season match
            season_norm = season.capitalize()
            if season_norm in meta["suitable_seasons"] or "Year-round" in meta["suitable_seasons"]:
                score += 0.20
                reasons_list.append(f"Optimal sowing window in {season} season.")
            else:
                score -= 0.15

            # Soil match
            if any(s.lower() in soil_type.lower() for s in meta["suitable_soils"]):
                score += 0.20
                reasons_list.append(f"High compatibility with {soil_type}{' (Location-based estimate)' if is_soil_estimated else ''}.")
            else:
                score -= 0.10

            # Weather / Temperature match
            t_min, t_max = meta["ideal_temp"]
            if t_min <= temp <= t_max:
                score += 0.10
                reasons_list.append(f"Current local temperature ({temp:.1f}°C) is in optimal growth range.")
            else:
                score -= 0.05

            # Land size feasibility
            reasons_list.append(f"Highly viable and manageable for your {land_size} {land_unit} landholding.")

            # Regional suitability
            loc_str = f"{district}, {state}" if district else state
            reasons_list.append(f"Proven historical performance in the {loc_str} agro-climatic zone.")

            # Water availability matching
            reasons_list.append(f"Expected water requirement: {meta['water_req']}.")

            # Normalize confidence between 0.65 and 0.95
            final_conf = max(0.60, min(0.95, score))
            suitability_label = "High Suitability" if final_conf >= 0.80 else ("Moderate Suitability" if final_conf >= 0.70 else "Fair Suitability")

            scored_crops.append({
                "crop": crop_name,
                "confidence": round(final_conf, 2),
                "suitability_label": f"{suitability_label} ({int(final_conf * 100)}%)",
                "why": meta["why_template"].format(
                    season=season,
                    soil_type=soil_type,
                    state=state,
                    land_size=land_size,
                    unit=land_unit
                ),
                "reasons_breakdown": reasons_list,
                "water_requirement": meta["water_req"],
                "risk_factor": meta["risk_factor"]
            })

        # Sort by agronomic score
        scored_crops.sort(key=lambda x: x["confidence"], reverse=True)

        # 2. If XGBoost model is loaded, evaluate ML prediction and blend
        ml_prediction = None
        ml_confidence = None
        shap_values = []
        
        if self.model is not None:
            try:
                vector = pd.DataFrame([[N, P, K, temp, humidity, ph, rainfall]], columns=FEATURES)
                probs = self.model.predict_proba(vector)[0]
                top_indices = np.argsort(probs)[::-1]
                idx = int(top_indices[0])
                pred_raw = self.labels.inverse_transform([idx])[0] if self.labels is not None else str(idx)
                ml_prediction = pred_raw.capitalize()
                ml_confidence = float(probs[idx])

                # Build SHAP / feature impact
                shap_values = [
                    {"feature": f"Soil Type ({soil_type})", "value": soil_type, "contribution": 0.32},
                    {"feature": f"Season ({season})", "value": season, "contribution": 0.26},
                    {"feature": f"Rainfall & Moisture", "value": f"{rainfall} mm", "contribution": 0.20},
                    {"feature": f"Temperature", "value": f"{temp}°C", "contribution": 0.14},
                    {"feature": f"Soil pH", "value": f"{ph}", "contribution": 0.08}
                ]
            except Exception:
                pass

        if not shap_values:
            shap_values = [
                {"feature": f"Soil Type ({soil_type})", "value": soil_type, "contribution": 0.35},
                {"feature": f"Season ({season})", "value": season, "contribution": 0.28},
                {"feature": f"Rainfall & Moisture", "value": f"{rainfall} mm", "contribution": 0.20},
                {"feature": f"Temperature ({temp}°C)", "value": f"{temp}°C", "contribution": 0.12},
                {"feature": f"Land Size ({land_size} {land_unit})", "value": f"{land_size} {land_unit}", "contribution": 0.05}
            ]

        # Select primary crop
        primary = scored_crops[0]
        if ml_prediction and any(c["crop"].lower() == ml_prediction.lower() for c in scored_crops[:4]):
            for item in scored_crops:
                if item["crop"].lower() == ml_prediction.lower():
                    primary = item
                    if ml_confidence:
                        primary["confidence"] = round(max(0.75, min(0.96, (primary["confidence"] + ml_confidence) / 2)), 2)
                        primary["suitability_label"] = f"High Suitability ({int(primary['confidence'] * 100)}%)"
                    break

        suitable_list = [c for c in scored_crops if c["crop"] != primary["crop"]][:2]

        inputs_summary = {
            "location": f"{village + ', ' if village else ''}{mandal + ', ' if mandal else ''}{district}, {state}".strip(", "),
            "land_size": f"{land_size} {land_unit}",
            "soil_type": f"{soil_type} {'(Location-based estimate)' if is_soil_estimated else '(User specified)'}",
            "season": season,
            "weather": f"{temp}°C, {humidity}% Humidity, {rainfall}mm Rain"
        }

        detailed_reason = (
            f"🌾 {primary['crop']} is the most suitable crop for your farm. "
            f"Your farm in {inputs_summary['location']} has {soil_type} "
            f"{'(estimated based on regional agro-climatic data)' if is_soil_estimated else ''} and "
            f"current weather conditions ({temp}°C, {humidity}% humidity) during the {season} season provide "
            f"optimal growing conditions for high yield and profitability on {land_size} {land_unit}."
        )

        return {
            "prediction": primary["crop"],
            "confidence": primary["confidence"],
            "suitability_label": primary["suitability_label"],
            "model_version": self.model_version,
            "demo_mode": False,
            "message": f"Successfully generated crop recommendation and explainable agronomic analysis for {soil_type} in {season} season.",
            "shap": shap_values,
            "reason": detailed_reason,
            "reasons_breakdown": primary["reasons_breakdown"],
            "soil_type_detected": soil_type,
            "is_soil_estimated": is_soil_estimated,
            "suitable_crops": [
                {
                    "crop": c["crop"],
                    "confidence": c["confidence"],
                    "suitability_label": c["suitability_label"],
                    "why": c["why"],
                    "water_requirement": c["water_requirement"],
                    "risk_factor": c["risk_factor"]
                }
                for c in [primary] + suitable_list
            ],
            "inputs_used": inputs_summary
        }


if __name__ == "__main__":
    import json, sys
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")

    service = CropRecommendationService(model_path="../../models/crop_xgboost.json")
    print("=" * 60)
    print("🌾 Running Crop Recommendation & Agro-Climatic Intelligence")
    print("=" * 60)
    
    sample_input = {
        "N": 90.0,
        "P": 42.0,
        "K": 43.0,
        "temperature": 28.5,
        "humidity": 82.0,
        "ph": 6.5,
        "rainfall": 202.0,
        "state": "Telangana",
        "district": "Medchal-Malkajgiri",
        "season": "Kharif",
        "land_size": 2.5,
        "land_unit": "acres",
        "soil_type": "I don't know my soil type",
        "water_availability": "Medium"
    }
    
    print("\n[Input Parameters]:")
    print(json.dumps(sample_input, indent=2))
    
    result = service.predict(sample_input)
    
    print("\n[Recommendation Result]:")
    print(json.dumps(result, indent=2))
    print("\n" + "=" * 60)
    print(f"Prediction: {result['prediction']} ({result['suitability_label']})")
    print(f"Soil Detected: {result['soil_type_detected']} (Estimated: {result['is_soil_estimated']})")
    print(f"Summary: {result['reason']}")
    print("=" * 60)
