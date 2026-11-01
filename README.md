# AI Agriculture Platform

**AN EXPLAINABLE AI FRAMEWORK FOR INDIGENOUS KNOWLEDGE-DRIVEN SMART AGRICULTURE**

A full-stack starter implementation for a farmer-facing agricultural decision-support platform.

## Core modules

- Mobile OTP / Google authentication architecture
- Multilingual farmer onboarding
- Voice input and text-to-speech adapters
- XGBoost-ready crop recommendation service
- SHAP-ready explanation service
- Indigenous Knowledge RAG architecture using PostgreSQL + pgvector
- LLM orchestration layer
- Weather service adapter
- Continuous crop lifecycle monitoring
- Weather/crop alerts
- Pesticide scanner + knowledge retrieval
- Plant disease CNN/Grad-CAM adapter
- Farm AI assistant
- React + TypeScript + Tailwind frontend
- FastAPI + PostgreSQL backend

## Important

This repository intentionally uses **service adapters** for external providers and trained ML models. It does not fake live weather, authentication, model predictions, disease diagnoses, or indigenous knowledge.

When integrations are not configured, the API returns explicit `demo_mode` / configuration messages.
The AI assistant only returns matching, verified local knowledge records with their evidence sources; an external LLM provider is not connected.

## Structure

```text
ai-agriculture-platform/
├── frontend/
├── backend/
├── start-dev.mjs
├── data/
├── models/
├── docs/
├── docker-compose.yml
├── .env.example
└── README.md
```

## Quick start

### Run both services together in one terminal

For a first-time setup, install the backend and frontend dependencies once:

```powershell
if (-not (Test-Path .\backend\.env)) { Copy-Item .\backend\.env.example .\backend\.env }
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
cd ..\frontend
npm install
cd ..
```

Set a unique `JWT_SECRET` in `.env` before using login or registration. Use a randomly generated secret with at least 32 characters; do not commit `.env`.

Then build and start the unified application from the project root:

```powershell
node .\start-dev.mjs
```

The frontend is production-built and served by FastAPI on the same origin. Open `http://localhost:8000`; API documentation remains at `http://localhost:8000/docs`. The one startup command is `node .\start-dev.mjs`. Press `Ctrl+C` to stop the server.

The mobile QR feature requires the computer and phone to share a network and the host firewall to allow inbound connections on port 8000.

Pesticide label OCR also requires the Tesseract executable (`TESSERACT_CMD` may point to it; `pytesseract` alone is not the OCR engine) and a locally configured verified catalog at `PESTICIDE_CATALOG_PATH`. The catalog is a JSON list. Each product must include `name`, `active_ingredients` (a list), `validation_status` set to `VERIFIED`, and an `https://` or `http://` `source_url`; `source_name` and evidence-backed `alternatives` are optional. Only enter product claims and alternatives after checking authoritative sources. Disease screening requires the trained model file. These features report unavailable when their real model/provider is not configured; they do not substitute mock results.

After a crop recommendation, farmers can submit a helpfulness rating and optional note. Feedback is linked to the saved recommendation when available, stored with `PENDING_REVIEW` status, and never used to update farm data or retrain a model automatically. Model training requires a separate reviewed, labeled dataset and an explicit retraining/validation workflow.

### 3. PostgreSQL

The included Docker Compose file starts PostgreSQL with pgvector:

```bash
docker compose up -d db
```

Then configure `DATABASE_URL` in `.env`.

## Real integrations to connect

- OTP provider
- Google OAuth
- LLM provider
- Speech-to-text
- Text-to-speech
- Weather provider
- Object storage
- Trained XGBoost model
- Trained CNN disease model

See `docs/INTEGRATION_GUIDE.md`.

## Train the real models

### Crop XGBoost
Use a real CSV containing `N,P,K,temperature,humidity,ph,rainfall,label` (or `Crop`).

```bash
cd backend
python scripts/train_crop_xgboost.py --csv ../data/crop_recommendation/Crop_recommendation.csv --out ../models
```

This creates `crop_xgboost.json`, `crop_label_encoder.joblib`, metrics and a model manifest. The API then uses the real model when `MODEL_PATH=../models/crop_xgboost.json`.

### Plant disease classifier

The project can download the public PlantVillage color dataset (54,306 images, approximately 2 GB) and train a MobileNetV3-Small image classifier. It uses the official leaf-grouped train/test split, not a random image split.

From the project root in PowerShell, install the optional ML dependencies:

```powershell
.\backend\.venv\Scripts\python.exe -m pip install -r .\backend\requirements-ml.txt
```

Download and cache the real dataset locally:

```powershell
Set-Location .\backend
.\.venv\Scripts\python.exe .\scripts\download_plantvillage.py
```

For a quick CPU baseline, train on 40 randomly selected images per class and evaluate on up to 40 official test-split images per class. This saves the TorchScript model, class mapping, manifest and sampled metrics under `models\`. The result is a preliminary baseline, not a substitute for full-data training.

```powershell
.\.venv\Scripts\python.exe .\scripts\train_plant_disease.py --epochs 1 --image-size 96 --batch-size 64 --samples-per-class 40
Set-Location ..
```

The FastAPI process reads `DISEASE_MODEL_PATH=../models/disease_model.pt` from `backend\.env`. Restart `node .\start-dev.mjs` after training so it loads the new model. The dataset is licensed CC BY-SA 3.0; see [data/plantvillage/README.md](data/plantvillage/README.md) for attribution and limits. Results are preliminary screening classifications and may not generalize to field images; they are not confirmed diagnoses or treatment prescriptions.

## Dataset provenance

A commonly used public crop recommendation dataset contains 2,200 records with seven inputs (N, P, K, temperature, humidity, pH and rainfall) and 22 crop classes. See the Kaggle dataset linked from the project's documentation and the PlantVillage repository for the disease dataset.
