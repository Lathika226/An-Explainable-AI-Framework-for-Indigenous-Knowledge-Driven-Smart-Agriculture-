# Integration Guide

## 1. Crop recommendation

Train XGBoost on a documented dataset. Save:

- preprocessing pipeline
- feature order
- categorical encoders
- model version
- metrics

Then implement the same transformation in `backend/app/services/crop_recommendation.py`.

SHAP must use the transformed feature vector actually passed to the model.

## 2. Indigenous knowledge RAG

1. Collect source-backed agricultural documents.
2. Verify provenance.
3. Chunk documents.
4. Generate embeddings.
5. Store embeddings in pgvector.
6. Add metadata filters for state, district, crop, stage and season.
7. Retrieve evidence before calling the LLM.
8. Instruct the LLM to answer only from retrieved evidence plus explicit model/API context.
9. Return source information with the answer.

## 3. LLM

Add provider-specific implementation to `LLMService`.

The LLM should:
- parse farmer language
- ask clarifying questions
- explain model output
- synthesize retrieved evidence
- translate
- produce simple language

It should not invent agricultural facts.

## 4. Voice

The frontend currently uses browser speech recognition where supported and browser speech synthesis for quick local development.

For production:
- connect a multilingual STT provider
- add server-side transcription
- add TTS provider
- store no voice recordings unless necessary and explicitly handled

## 5. Weather

Implement `WeatherService` for your chosen weather provider.

Never return hard-coded live weather.

## 6. Disease detection

Connect a trained CNN and exact class mapping.

Add:
- preprocessing
- inference
- confidence
- Grad-CAM
- image quality validation

Do not show a diagnosis if the model is not configured.

## 7. Authentication

Replace the starter architecture with:
- real OTP provider
- Google OAuth
- secure session/JWT management
- user ownership checks on every farm/crop resource

## 8. Notifications

Add a background scheduler for:
- weather updates
- crop stage checks
- relevant alerts

Avoid alert spam.
