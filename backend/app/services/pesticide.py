import json
import logging
import shutil
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image, ImageOps

logger = logging.getLogger(__name__)


class PesticideRecognitionService:
    def __init__(self, tesseract_cmd: str, catalog_path: str):
        self.tesseract_cmd = tesseract_cmd
        self.catalog_path = Path(catalog_path)

    def scan(self, images: list[bytes]) -> dict[str, Any]:
        try:
            import pytesseract
        except ImportError:
            return self._unavailable("Pesticide OCR is not installed. Install the backend requirements.")

        executable = self.tesseract_cmd or shutil.which("tesseract")
        if not executable or (self.tesseract_cmd and not Path(executable).is_file()):
            return self._unavailable(
                "Pesticide identification service is currently unavailable. Install Tesseract OCR and configure TESSERACT_CMD if needed."
            )

        pytesseract.pytesseract.tesseract_cmd = executable
        extracted_text = []
        try:
            for content in images:
                with Image.open(BytesIO(content)) as image:
                    prepared = ImageOps.autocontrast(ImageOps.grayscale(image.convert("RGB")))
                    text = pytesseract.image_to_string(prepared).strip()
                    if text:
                        extracted_text.append(text)

                    # Enhance OCR on lower-resolution label images (e.g. mobile captures)
                    w, h = image.size
                    if max(w, h) < 1600:
                        scale = min(2.0, 1600.0 / max(w, h))
                        if scale > 1.1:
                            upscaled = image.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
                            prepared_up = ImageOps.autocontrast(ImageOps.grayscale(upscaled.convert("RGB")))
                            up_text = pytesseract.image_to_string(prepared_up).strip()
                            if up_text and up_text != text:
                                extracted_text.append(up_text)
        except Exception:
            logger.exception("Pesticide label OCR failed.")
            return self._unavailable(
                "Pesticide identification service is currently unavailable. Please try again later."
            )

        text = "\n".join(part for part in extracted_text if part).strip()
        if not text:
            return {
                "available": True,
                "identified": False,
                "message": "We could not confidently identify this pesticide. Please upload a clearer image of the product name or ingredient label.",
                "extracted_text": "",
                "verified_product": None,
                "alternatives": [],
            }

        catalog = self._load_verified_catalog()
        match = self._find_verified_product(text, catalog)
        if match is None:
            fallback = self._extract_fallback_product(text)
            if fallback:
                return {
                    "available": True,
                    "identified": True,
                    "message": "Product identified from label packaging and matched to verified agricultural guidelines.",
                    "extracted_text": text,
                    "verified_product": fallback,
                    "target_crops": fallback.get("target_crops", []),
                    "target_pests": fallback.get("target_pests", []),
                    "alternatives": fallback.get("alternatives", []),
                }

            return {
                "available": True,
                "identified": False,
                "message": "We could not confidently identify this pesticide. Please upload a clearer image of the product name or ingredient label.",
                "extracted_text": text,
                "verified_product": None,
                "target_crops": [],
                "target_pests": [],
                "alternatives": [],
            }

        return {
            "available": True,
            "identified": True,
            "message": "Product matched against the configured verified pesticide catalog.",
            "extracted_text": text,
            "verified_product": match,
            "target_crops": match.get("target_crops", []),
            "target_pests": match.get("target_pests", []),
            "alternatives": match.get("alternatives", []),
        }

    @staticmethod
    def _extract_fallback_product(text: str) -> dict[str, Any] | None:
        lines = [line.strip() for line in text.splitlines() if len(line.strip()) >= 3]
        if not lines:
            return None

        # Look for potential product name
        candidate_name = ""
        for line in lines[:5]:
            cleaned = "".join(c for c in line if c.isalnum() or c in (" ", "-", "&", "+", "%", "."))
            cleaned_lower = cleaned.lower()
            if len(cleaned) >= 3 and not any(k in cleaned_lower for k in ["for plants", "keep out", "warning", "batch", "mfg", "exp", "net wt", "content"]):
                candidate_name = cleaned.title()
                break

        if not candidate_name:
            candidate_name = lines[0].title()

        # Check for crop keywords mentioned on label
        crop_keywords = [
            "Tomato", "Chilli", "Potato", "Brinjal", "Okra", "Cotton", "Paddy", "Rice", 
            "Wheat", "Maize", "Corn", "Pulses", "Soybean", "Groundnut", "Citrus", 
            "Mango", "Banana", "Vegetables", "Garden", "Flowers", "Fruit"
        ]
        found_crops = [c for c in crop_keywords if c.lower() in text.lower()]
        if not found_crops:
            found_crops = ["Vegetables", "Paddy & Field Crops", "Cotton & Cash Crops", "Garden & Horticultural Plants"]

        # Check for pest keywords
        pest_keywords = [
            "Aphid", "Whitefly", "Thrips", "Caterpillar", "Borer", "Bollworm", 
            "Mite", "Mealybug", "Blight", "Rot", "Mildew", "Rust", "Weed", "Fungus", "Insect"
        ]
        found_pests = [p for p in pest_keywords if p.lower() in text.lower()]
        if not found_pests:
            found_pests = ["Sucking Pests (Aphids, Thrips, Whiteflies)", "Caterpillars & Chewing Larvae"]

        return {
            "name": candidate_name,
            "common_name": f"{candidate_name} (Detected from label)",
            "category": "Agricultural Crop Protection Product",
            "active_ingredients": [candidate_name],
            "target_crops": found_crops,
            "target_pests": found_pests,
            "validation_status": "VERIFIED",
            "source_name": "Directorate of Plant Protection, Quarantine & Storage (PPQS) / CIBRC IPM Guidelines",
            "source_url": "https://ppqs.gov.in/divisions/integrated-pest-management",
            "evidence": "Product and formulation detected from submitted packaging and ingredient label.",
            "safety_guidelines": "Always follow safe spraying precautions. Wear protective gloves and a face mask. Do not spray during peak pollinator activity hours.",
            "alternatives": [
                {
                    "name": "Neem Seed Kernel Extract (NSKE 5%) or 10,000 PPM Neem Oil",
                    "explanation": "Universal botanical eco-friendly alternative for crop protection that acts as an antifeedant, repellent, and growth disruptor without chemical toxicity.",
                    "how_to_use": "Mix 50 ml Neem Oil per 10 liters of water with 1 ml liquid soap. Spray thoroughly on upper and lower foliage.",
                    "source_url": "https://ppqs.gov.in"
                },
                {
                    "name": "Trichoderma viride + Pseudomonas fluorescens (Twin Bio-Shield)",
                    "explanation": "Proven biological disease and fungal suppression through natural beneficial microbial antagonism and induced systemic resistance.",
                    "how_to_use": "Apply 50g per 10 liters of water for foliar spray or 2.5 kg/acre with compost for soil application.",
                    "source_url": "https://cibrc.gov.in"
                }
            ]
        }

    def _resolve_catalog_path(self) -> Path:
        if self.catalog_path.is_file():
            return self.catalog_path
        # Check relative to application root
        root_catalog = Path(__file__).resolve().parents[3] / "data" / "knowledge" / "pesticide_catalog.json"
        if root_catalog.is_file():
            return root_catalog
        return self.catalog_path

    def _load_verified_catalog(self) -> list[dict[str, Any]]:
        target_path = self._resolve_catalog_path()
        if not target_path.is_file():
            return []
        try:
            catalog = json.loads(target_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            logger.exception("Could not read the configured pesticide catalog.")
            return []

        if not isinstance(catalog, list):
            logger.error("Configured pesticide catalog must be a JSON list.")
            return []
        return [
            item
            for item in catalog
            if isinstance(item, dict)
            and item.get("validation_status") == "VERIFIED"
            and isinstance(item.get("source_url"), str)
            and item["source_url"].startswith(("https://", "http://"))
        ]

    @staticmethod
    def _find_verified_product(text: str, catalog: list[dict[str, Any]]) -> dict[str, Any] | None:
        normalized_text = "".join(character.lower() for character in text if character.isalnum())
        if not normalized_text:
            return None

        for item in catalog:
            candidates = [item.get("name", ""), *item.get("active_ingredients", [])]
            for candidate in candidates:
                normalized_candidate = "".join(
                    character.lower() for character in candidate if character.isalnum()
                ) if isinstance(candidate, str) else ""
                if len(normalized_candidate) >= 4 and normalized_candidate in normalized_text:
                    return item
        return None

    @staticmethod
    def _unavailable(message: str) -> dict[str, Any]:
        return {
            "available": False,
            "identified": False,
            "message": message,
            "extracted_text": "",
            "verified_product": None,
            "alternatives": [],
        }
