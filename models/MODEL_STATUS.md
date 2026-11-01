# Model status

## Crop recommendation
- `crop_xgboost_dev.json`: development-only model trained on generated development data. **Do not use for research claims or real farmer decisions.**
- `crop_xgboost.json`: expected output of `backend/scripts/train_crop_xgboost.py` after a real crop dataset is supplied.

## Plant disease
- `disease_model.pt`: output of `backend/scripts/train_plant_disease.py` after downloading the PlantVillage dataset with `backend/scripts/download_plantvillage.py`.
- The classifier uses PlantVillage's official leaf-grouped train/test split. Its class mapping, training manifest, and test metrics are written beside the weights.
- Dataset source/license/citation and image-domain limitations are documented in `data/plantvillage/README.md`.
- No fabricated disease weights are included.

## Research rule
Only report metrics from `crop_model_metrics.json` / `disease_model_metrics.json` after training on the documented dataset and split.
