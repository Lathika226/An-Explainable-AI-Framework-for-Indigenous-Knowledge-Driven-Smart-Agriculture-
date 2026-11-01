from typing import Any


class LLMService:
    def __init__(self, api_key: str = "", model: str = ""):
        self.api_key = api_key
        self.model = model

    async def answer(self, message: str, context: dict[str, Any]) -> dict[str, Any]:
        knowledge = context.get("knowledge") or []
        if not knowledge:
            response = (
                "No verified agricultural guidance was found for this question. "
                "Please consult a local agricultural extension service. "
                "This assistant does not provide pesticide dosage or confirmed disease diagnoses."
            )
            return {
                "available": False,
                "demo_mode": False,
                "provider": None,
                "message": response,
                "answer": response,
            }

        entries = []
        for item in knowledge:
            parts = [str(item.get("title") or "").strip(), str(item.get("practice") or "").strip()]
            evidence = str(item.get("evidence") or "").strip()
            source = str(item.get("source") or "").strip()
            source_url = str(item.get("source_url") or "").strip()
            if evidence:
                parts.append(f"Evidence: {evidence}")
            if source:
                parts.append(f"Source: {source}")
            if source_url:
                parts.append(f"Source URL: {source_url}")
            entries.append("\n".join(part for part in parts if part))

        return {
            "available": True,
            "demo_mode": False,
            "provider": "verified-local-knowledge",
            "message": "Response contains matching verified knowledge entries; it is not a generated diagnosis or treatment prescription.",
            "answer": "\n\n".join(entries),
        }
