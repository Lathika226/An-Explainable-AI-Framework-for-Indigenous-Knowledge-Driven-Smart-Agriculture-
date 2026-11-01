# PlantVillage model data

The full image dataset is downloaded locally by `backend/scripts/download_plantvillage.py` and cached under this directory. The image files and cache are intentionally not copied into the source repository.

- Dataset: [mohanty/PlantVillage on Hugging Face](https://huggingface.co/datasets/mohanty/PlantVillage)
- Dataset source repository: [spMohanty/PlantVillage-Dataset](https://github.com/spMohanty/PlantVillage-Dataset)
- Declared license: CC BY-SA 3.0
- Citation: Mohanty, Hughes & Salathé (2016), [Using deep learning for image-based plant disease detection](https://doi.org/10.3389/fpls.2016.01419)
- Dataset card: reports 54,306 images across 38 labels, approximately 2 GB.
- Official color splits used here: 43,596 training and 10,709 test images (54,305 split entries).
- Training/evaluation use the dataset's official leaf-grouped train/test split.

The model is an image classifier trained on controlled PlantVillage images. It is not a confirmed field diagnosis and may not generalize to field conditions.
