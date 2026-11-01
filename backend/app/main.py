from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.api.routes import api_router
from app.db import engine, Base, migrate_crop_tracking_columns
from app import models

Base.metadata.create_all(bind=engine)
migrate_crop_tracking_columns()

# AI Agriculture Unified Service v1.3 (MyCrops Enabled)
app = FastAPI(
    title="AI Agriculture Platform API",
    version="0.1.0",
    description="Explainable AI framework for indigenous knowledge-driven smart agriculture.",
)

app.include_router(api_router, prefix="/api")

@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-agriculture-api"}

root_dir = Path(__file__).resolve().parents[2]
dist_dir = root_dir / "frontend" / "dist"

if dist_dir.is_dir():
    assets_path = dist_dir / "assets"
    if assets_path.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

    @app.get("/")
    def serve_index():
        return FileResponse(dist_dir / "index.html")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API route not found")

        file_path = (dist_dir / full_path).resolve()
        try:
            file_path.relative_to(dist_dir.resolve())
        except ValueError:
            raise HTTPException(status_code=404, detail="File not found")

        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(dist_dir / "index.html")
