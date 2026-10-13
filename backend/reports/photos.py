"""Limpieza de fotos subidas: se valida que sea una imagen, se reduce y se vuelve a
guardar como JPEG. Al recodificarla se pierden los metadatos EXIF, entre ellos la
ubicación GPS que muchos celulares guardan en cada foto.
"""
from io import BytesIO

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError

# Evita imágenes trampa que pesan poco y ocupan gigas al abrirse.
MAX_PIXELS = 40_000_000
ACCEPTED = {"JPEG", "PNG", "WEBP", "GIF", "MPO"}


def clean_photo(upload):
    """Devuelve (ContentFile JPEG, ancho, alto) o lanza ValidationError con un mensaje claro."""
    if upload.size > settings.PHOTO_MAX_BYTES:
        raise ValidationError("La foto pesa más de 8 MB. Toma otra o envíala más pequeña.")
    try:
        probe = Image.open(upload)
        if probe.format not in ACCEPTED:
            raise ValidationError("Usa una foto en formato JPG, PNG o WEBP.")
        if probe.width * probe.height > MAX_PIXELS:
            raise ValidationError("La foto es demasiado grande.")
        probe.verify()
        upload.seek(0)
        image = Image.open(upload)
        image.load()
    except ValidationError:
        raise
    except (UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError):
        raise ValidationError("No pudimos leer la imagen. Intenta con otra foto.")
    image = ImageOps.exif_transpose(image)  # respeta cómo se tomó la foto antes de borrar el EXIF
    if image.mode not in ("RGB", "L"):
        background = Image.new("RGB", image.size, (255, 255, 255))
        background.paste(image.convert("RGBA"), mask=image.convert("RGBA").split()[-1])
        image = background
    image = image.convert("RGB")
    side = settings.PHOTO_MAX_SIDE
    image.thumbnail((side, side))
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=82, optimize=True, progressive=True)
    return ContentFile(buffer.getvalue()), image.width, image.height
