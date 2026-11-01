from io import BytesIO

from fastapi import HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError


MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000
IMAGE_FORMATS = {
    ".jpg": ("image/jpeg", "JPEG"),
    ".jpeg": ("image/jpeg", "JPEG"),
    ".png": ("image/png", "PNG"),
    ".webp": ("image/webp", "WEBP"),
}
SIGNATURES = {
    "JPEG": lambda data: data.startswith(b"\xff\xd8\xff"),
    "PNG": lambda data: data.startswith(b"\x89PNG\r\n\x1a\n"),
    "WEBP": lambda data: len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP",
}


async def read_validated_image(upload: UploadFile) -> bytes:
    filename = upload.filename or ""
    extension = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    expected = IMAGE_FORMATS.get(extension)
    if expected is None:
        raise HTTPException(
            status_code=400,
            detail="Unsupported image type. Upload a JPG, JPEG, PNG, or WEBP image.",
        )

    content = await upload.read(MAX_IMAGE_BYTES + 1)
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Image too large. Maximum size is 10MB.")
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded image is empty.")

    expected_mime, expected_format = expected
    if upload.content_type not in (None, "", expected_mime, "application/octet-stream"):
        raise HTTPException(status_code=400, detail="Image content type does not match its file type.")
    if not SIGNATURES[expected_format](content):
        raise HTTPException(status_code=400, detail="Image file signature is invalid.")

    try:
        with Image.open(BytesIO(content)) as image:
            if image.format != expected_format:
                raise HTTPException(status_code=400, detail="Image format does not match its file type.")
            if image.width * image.height > MAX_IMAGE_PIXELS:
                raise HTTPException(status_code=400, detail="Image dimensions are too large to process safely.")
            image.verify()
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise HTTPException(status_code=400, detail="The uploaded image is invalid or could not be decoded.") from exc

    return content
