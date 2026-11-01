"""Download PlantVillage and extract its color images and official splits locally."""

import argparse
import re
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from zipfile import ZipFile, is_zipfile


DATASET_URL = "https://huggingface.co/datasets/mohanty/PlantVillage/resolve/main"


def download_file(url: str, destination: Path) -> None:
    """Stream a public dataset file to disk, resuming an interrupted transfer."""
    offset = destination.stat().st_size if destination.exists() else 0
    headers = {"Range": f"bytes={offset}-"} if offset else {}
    request = Request(url, headers=headers)

    try:
        response = urlopen(request, timeout=60)
    except HTTPError as error:
        content_range = error.headers.get("Content-Range", "")
        match = re.fullmatch(r"bytes \*/(\d+)", content_range)
        if error.code != 416 or not offset or not match:
            raise
        if int(match.group(1)) == offset and (
            destination.suffix != ".zip" or is_zipfile(destination)
        ):
            return
        destination.unlink()
        return download_file(url, destination)

    with response:
        if offset and response.status != 206:
            offset = 0
        content_range = response.headers.get("Content-Range", "")
        if response.status == 206 and not content_range.startswith(
            f"bytes {offset}-"
        ):
            raise ValueError(f"Unexpected partial response for {destination.name}.")

        mode = "ab" if offset else "wb"
        total_size = response.headers.get("Content-Length")
        expected_bytes = int(total_size) if total_size is not None else None
        downloaded = 0
        last_reported = 0
        with destination.open(mode) as output:
            while chunk := response.read(1024 * 1024):
                output.write(chunk)
                downloaded += len(chunk)
                if downloaded - last_reported >= 32 * 1024 * 1024:
                    print(
                        f"{destination.name}: "
                        f"{(offset + downloaded) / (1024 * 1024):,.0f} MiB",
                        flush=True,
                    )
                    last_reported = downloaded

    if expected_bytes is not None and downloaded != expected_bytes:
        raise ConnectionError(
            f"Incomplete download of {destination.name}: received "
            f"{downloaded:,} of {expected_bytes:,} bytes. Run the command again "
            "to resume."
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset-dir", default="../data/plantvillage")
    args = parser.parse_args()

    dataset_dir = Path(args.dataset_dir).resolve()
    dataset_dir.mkdir(parents=True, exist_ok=True)
    archive_path = dataset_dir / "data.zip"
    extracted_root = dataset_dir / "raw" / "color"
    if archive_path.exists() or not extracted_root.is_dir():
        download_file(f"{DATASET_URL}/data.zip?download=true", archive_path)

    for split_name in ("color_train.txt", "color_test.txt"):
        split_path = dataset_dir / "splits" / split_name
        split_path.parent.mkdir(parents=True, exist_ok=True)
        download_file(
            f"{DATASET_URL}/splits/{split_name}?download=true", split_path
        )

    if archive_path.exists():
        extracted_root.mkdir(parents=True, exist_ok=True)
        with ZipFile(archive_path) as archive:
            members = [
                member
                for member in archive.infolist()
                if member.filename.startswith("raw/color/")
            ]
            if not members:
                raise ValueError("PlantVillage archive contains no raw/color images.")
            for member in members:
                member_path = Path(member.filename)
                if member_path.is_absolute() or ".." in member_path.parts:
                    raise ValueError(
                        "PlantVillage archive contains an unsafe image path."
                    )
                archive.extract(member, dataset_dir)

    train_count = sum(
        1
        for line in (dataset_dir / "splits" / "color_train.txt").read_text(
            encoding="utf-8"
        ).splitlines()
        if line.strip()
    )
    test_count = sum(
        1
        for line in (dataset_dir / "splits" / "color_test.txt").read_text(
            encoding="utf-8"
        ).splitlines()
        if line.strip()
    )
    if train_count == 0 or test_count == 0:
        raise ValueError("PlantVillage official train/test split files are empty.")

    if archive_path.exists():
        archive_path.unlink()
    print(f"train: {train_count:,} images")
    print(f"test: {test_count:,} images")
    print(f"Dataset extracted under: {dataset_dir / 'raw' / 'color'}")
    print("License: CC BY-SA 3.0. Cite Mohanty, Hughes & Salathé (2016), doi:10.3389/fpls.2016.01419.")


if __name__ == "__main__":
    main()
