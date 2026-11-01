"""Train an image classifier with PlantVillage's leaf-grouped train/test split."""

import argparse
import json
import random
from pathlib import Path
from pathlib import PurePosixPath
from typing import Any

import torch
from PIL import Image
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
from torch import nn
from torch.utils.data import DataLoader, Dataset
from torchvision import models, transforms


DATASET_ID = "mohanty/PlantVillage"
DATASET_CITATION = "Mohanty, Hughes & Salathé (2016), doi:10.3389/fpls.2016.01419"


class PlantVillageSplit(Dataset):
    def __init__(self, samples: list[tuple[Path, int]], image_transform: Any):
        self.samples = samples
        self.image_transform = image_transform

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, index: int) -> tuple[torch.Tensor, int]:
        image_path, label = self.samples[index]
        with Image.open(image_path) as image:
            return self.image_transform(image.convert("RGB")), label


def load_official_split(
    split_file: Path,
    image_root: Path,
    class_to_index: dict[str, int],
) -> list[tuple[Path, int]]:
    samples = []
    for raw_path in split_file.read_text(encoding="utf-8").splitlines():
        relative_path = raw_path.strip()
        if not relative_path:
            continue
        parts = PurePosixPath(relative_path).parts
        if len(parts) < 4 or parts[:2] != ("raw", "color"):
            raise ValueError(f"Unexpected PlantVillage split path: {relative_path}")
        class_name = parts[2]
        image_path = image_root.joinpath(*parts[2:])
        if class_name not in class_to_index or not image_path.is_file():
            raise FileNotFoundError(f"PlantVillage image missing from split: {image_path}")
        samples.append((image_path, class_to_index[class_name]))
    if not samples:
        raise ValueError(f"PlantVillage split is empty: {split_file}")
    return samples


def limit_samples_per_class(
    samples: list[tuple[Path, int]],
    limit: int,
    seed: int,
) -> list[tuple[Path, int]]:
    if limit <= 0:
        return samples

    grouped: dict[int, list[tuple[Path, int]]] = {}
    for sample in samples:
        grouped.setdefault(sample[1], []).append(sample)

    rng = random.Random(seed)
    selected = []
    for label in sorted(grouped):
        class_samples = grouped[label]
        rng.shuffle(class_samples)
        selected.extend(class_samples[:limit])
    return selected


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset-dir", default="../data/plantvillage")
    parser.add_argument("--output", default="../models/disease_model.pt")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--image-size", type=int, default=160)
    parser.add_argument(
        "--samples-per-class",
        type=int,
        default=0,
        help="Limit each official split to this many samples per class; 0 uses all samples.",
    )
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--workers", type=int, default=0)
    args = parser.parse_args()

    if args.epochs < 1:
        parser.error("--epochs must be at least 1")
    if args.batch_size < 1:
        parser.error("--batch-size must be at least 1")
    if args.image_size < 32:
        parser.error("--image-size must be at least 32")
    if args.samples_per_class < 0:
        parser.error("--samples-per-class cannot be negative")
    if args.workers < 0:
        parser.error("--workers cannot be negative")

    dataset_root = Path(args.dataset_dir).resolve()
    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    image_root = dataset_root / "raw" / "color"
    split_dir = dataset_root / "splits"
    required_paths = [
        image_root,
        split_dir / "color_train.txt",
        split_dir / "color_test.txt",
    ]
    missing = [str(path) for path in required_paths if not path.exists()]
    if missing:
        raise FileNotFoundError(
            "PlantVillage dataset files are missing. Run "
            "backend/scripts/download_plantvillage.py first: " + ", ".join(missing)
        )

    label_names = sorted(path.name for path in image_root.iterdir() if path.is_dir())
    if not label_names:
        raise ValueError(f"No PlantVillage class folders found in {image_root}.")
    class_to_index = {name: index for index, name in enumerate(label_names)}
    train_samples = load_official_split(
        split_dir / "color_train.txt",
        image_root,
        class_to_index,
    )
    test_samples = load_official_split(
        split_dir / "color_test.txt",
        image_root,
        class_to_index,
    )
    train_samples = limit_samples_per_class(
        train_samples,
        args.samples_per_class,
        args.seed,
    )
    test_samples = limit_samples_per_class(
        test_samples,
        args.samples_per_class,
        args.seed + 1,
    )
    print(
        f"Training with {len(train_samples)} images; evaluating {len(test_samples)} "
        f"official-split images across {len(label_names)} classes.",
        flush=True,
    )

    mean = [0.485, 0.456, 0.406]
    std = [0.229, 0.224, 0.225]
    train_transform = transforms.Compose(
        [
            transforms.Resize((args.image_size, args.image_size)),
            transforms.RandomHorizontalFlip(),
            transforms.RandomRotation(10),
            transforms.ToTensor(),
            transforms.Normalize(mean, std),
        ]
    )
    test_transform = transforms.Compose(
        [
            transforms.Resize((args.image_size, args.image_size)),
            transforms.ToTensor(),
            transforms.Normalize(mean, std),
        ]
    )
    train_data = PlantVillageSplit(train_samples, train_transform)
    test_data = PlantVillageSplit(test_samples, test_transform)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    use_pin_memory = device.type == "cuda"
    train_loader = DataLoader(
        train_data,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=args.workers,
        pin_memory=use_pin_memory,
    )
    test_loader = DataLoader(
        test_data,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=args.workers,
        pin_memory=use_pin_memory,
    )

    weights = models.MobileNet_V3_Small_Weights.DEFAULT
    model = models.mobilenet_v3_small(weights=weights)
    model.classifier[3] = nn.Linear(model.classifier[3].in_features, len(label_names))
    for parameter in model.features.parameters():
        parameter.requires_grad = False
    model.to(device)

    optimizer = torch.optim.AdamW(model.classifier.parameters(), lr=1e-3)
    loss_function = nn.CrossEntropyLoss()
    for epoch in range(args.epochs):
        model.train()
        model.features.eval()
        total_loss = 0.0
        for images, labels in train_loader:
            images = images.to(device, non_blocking=use_pin_memory)
            labels = labels.to(device, non_blocking=use_pin_memory)
            optimizer.zero_grad(set_to_none=True)
            loss = loss_function(model(images), labels)
            loss.backward()
            optimizer.step()
            total_loss += float(loss.item())
        average_loss = total_loss / max(1, len(train_loader))
        print(f"Epoch {epoch + 1}/{args.epochs} - training loss: {average_loss:.4f}", flush=True)

    model.eval()
    expected: list[int] = []
    predicted: list[int] = []
    with torch.inference_mode():
        for images, labels in test_loader:
            logits = model(images.to(device, non_blocking=use_pin_memory))
            predicted.extend(logits.argmax(dim=1).cpu().tolist())
            expected.extend(labels.tolist())

    precision, recall, f1, _ = precision_recall_fscore_support(
        expected,
        predicted,
        average="weighted",
        zero_division=0,
    )
    metrics = {
        "dataset": DATASET_ID,
        "dataset_config": "color",
        "citation": DATASET_CITATION,
        "license": "CC-BY-SA-3.0",
        "split_method": "Official leaf-grouped train/test split from the dataset repository.",
        "sampling": (
            f"Deterministic stratified cap of {args.samples_per_class} samples per class."
            if args.samples_per_class
            else "Full official train/test splits."
        ),
        "samples": len(train_data) + len(test_data),
        "train_samples": len(train_data),
        "test_samples": len(test_data),
        "classes": label_names,
        "epochs": args.epochs,
        "batch_size": args.batch_size,
        "image_size": args.image_size,
        "device": str(device),
        "accuracy": float(accuracy_score(expected, predicted)),
        "weighted_precision": float(precision),
        "weighted_recall": float(recall),
        "weighted_f1": float(f1),
    }

    model = model.cpu().eval()
    scripted_model = torch.jit.script(model)
    temporary_model_path = output_path.with_suffix(output_path.suffix + ".tmp")
    scripted_model.save(str(temporary_model_path))
    temporary_model_path.replace(output_path)

    classes_path = output_path.with_name("disease_classes.json")
    classes_path.write_text(json.dumps(label_names, indent=2), encoding="utf-8")
    metrics_path = output_path.with_name("disease_model_metrics.json")
    metrics_path.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    manifest_path = output_path.with_name("disease_model_manifest.json")
    manifest_path.write_text(
        json.dumps(
            {
                "model_version": "mobilenetv3-plantvillage-1.0",
                "status": (
                    "TRAINED_ON_STRATIFIED_PLANTVILLAGE_SUBSET"
                    if args.samples_per_class
                    else "TRAINED_ON_PLANTVILLAGE_OFFICIAL_SPLIT"
                ),
                "classes_file": classes_path.name,
                "metrics_file": metrics_path.name,
                "dataset": DATASET_ID,
                "license": "CC-BY-SA-3.0",
                "image_size": args.image_size,
                "normalization_mean": mean,
                "normalization_std": std,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(json.dumps(metrics, indent=2), flush=True)


if __name__ == "__main__":
    main()
