import io
import json
import logging
from pathlib import Path
from typing import Any


logger = logging.getLogger(__name__)


class DiseaseDetectionService:
    def __init__(self, model_path: str):
        self.model_path = Path(model_path)
        self.model = None
        self.classes: list[str] = []
        self.device = None
        self.model_version = "Configured TorchScript plant model"
        self.image_size = 224
        self.normalization_mean = [0.485, 0.456, 0.406]
        self.normalization_std = [0.229, 0.224, 0.225]
        self.load_error: str | None = None
        self._load()

    def _load(self) -> None:
        if not self.model_path.is_file():
            return

        try:
            import torch

            class_path = self.model_path.with_name("disease_classes.json")
            if not class_path.is_file():
                raise FileNotFoundError(f"Model class mapping not found: {class_path}")
            classes = json.loads(class_path.read_text(encoding="utf-8"))
            if not isinstance(classes, list) or not classes or not all(
                isinstance(label, str) and label.strip() for label in classes
            ):
                raise ValueError("Disease model class mapping must be a non-empty list of strings.")

            manifest_path = self.model_path.with_name("disease_model_manifest.json")
            if manifest_path.is_file():
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                if not isinstance(manifest, dict):
                    raise ValueError("Disease model manifest must be a JSON object.")
                self.model_version = str(
                    manifest.get("model_version") or self.model_version
                )
                image_size = manifest.get("image_size", self.image_size)
                if not isinstance(image_size, int) or image_size < 32:
                    raise ValueError("Disease model manifest image_size must be an integer of at least 32.")
                self.image_size = image_size
                mean = manifest.get("normalization_mean", self.normalization_mean)
                std = manifest.get("normalization_std", self.normalization_std)
                if (
                    not isinstance(mean, list)
                    or not isinstance(std, list)
                    or len(mean) != 3
                    or len(std) != 3
                    or not all(isinstance(value, (int, float)) for value in [*mean, *std])
                ):
                    raise ValueError("Disease model normalization values must each contain three numbers.")
                self.normalization_mean = mean
                self.normalization_std = std

            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            model = torch.jit.load(str(self.model_path), map_location=self.device)
            model.eval()
            self.classes = classes
            self.model = model
        except Exception as exc:
            logger.exception("Could not load the plant disease model.")
            self.load_error = str(exc)
            self.model = None

    async def predict(self, image_bytes: bytes) -> dict[str, Any]:
        if not image_bytes:
            return {
                "available": False,
                "message": "No image data received. Please upload a clear photo of a plant leaf.",
            }

        if self.model is None:
            return {
                "available": False,
                "message": (
                    "Plant disease screening is currently unavailable because a trained model "
                    "and class mapping are not configured."
                    if not self.load_error
                    else "Plant disease screening is currently unavailable because the configured "
                    "model could not be loaded."
                ),
            }

        try:
            import torch
            from PIL import Image
            from torchvision import transforms

            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            image_transform = transforms.Compose(
                [
                    transforms.Resize((self.image_size, self.image_size)),
                    transforms.ToTensor(),
                    transforms.Normalize(
                        self.normalization_mean,
                        self.normalization_std,
                    ),
                ]
            )
            tensor = image_transform(image).unsqueeze(0).to(self.device)
            with torch.inference_mode():
                logits = self.model(tensor)
                if logits.ndim != 2 or logits.shape[1] != len(self.classes):
                    raise ValueError("Model output does not match the configured class mapping.")
                probabilities = torch.softmax(logits, dim=1)[0]

            index = int(probabilities.argmax().item())
            label = self.classes[index]
            confidence = float(probabilities[index].item())
            return self._format_result(label, confidence)
        except Exception:
            logger.exception("Plant disease model inference failed.")
            return {
                "available": False,
                "message": (
                    "Plant disease screening failed while processing this image. "
                    "Please try another clear leaf photo or consult an agricultural expert."
                ),
            }

    def _format_result(self, label: str, confidence: float) -> dict[str, Any]:
        crop_label, separator, condition_label = label.partition("___")
        crop = crop_label.replace("_", " ").strip() if separator else "Unspecified crop"
        condition = (
            condition_label.replace("_", " ").strip()
            if separator
            else label.replace("_", " ").strip()
        )
        confidence_percentage = round(confidence * 100)
        message = (
            f"The model classifies this image as {condition} for {crop} "
            f"(model confidence {confidence_percentage}%). This is a preliminary "
            "screening result from controlled-background dataset classes, not a confirmed "
            "field diagnosis."
        )
        return {
            "available": True,
            "prediction": condition,
            "condition": condition,
            "crop": crop,
            "class_label": label,
            "confidence": confidence,
            "confidence_percentage": confidence_percentage,
            "model_version": self.model_version,
            "message": message,
            "explanation": {
                "type": "model-classification",
                "available": True,
                "summary": message,
            },
            "treatment_guidance": None,
            "treatment_message": (
                "This classifier does not prescribe treatments. Confirm the result with a "
                "local agricultural extension expert before taking action."
            ),
        }
