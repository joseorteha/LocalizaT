"""Modelo de lenguaje local para comparar descripciones.

Corre dentro del servidor (sin enviar descripciones privadas a otra empresa y
sin costo por consulta). Usa un modelo multilingüe pequeño de fastembed
(ONNX, sin GPU). Si la librería o el modelo no están disponibles, devuelve
``None`` y el motor semántico compara solo con palabras normalizadas.
"""

import logging
import math
from functools import lru_cache

from django.conf import settings


logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _model():
    try:
        from fastembed import TextEmbedding
    except ImportError:
        logger.warning("fastembed no está instalado; se usarán solo palabras normalizadas.")
        return None
    try:
        return TextEmbedding(settings.MATCHING_MODEL, cache_dir=settings.MATCHING_MODEL_CACHE)
    except Exception:
        logger.exception("No se pudo cargar el modelo %s.", settings.MATCHING_MODEL)
        return None


def embed(texts):
    """Vectores normalizados para cada texto, o ``None`` si no hay modelo."""
    model = _model()
    if model is None:
        return None
    vectors = []
    for vector in model.embed(list(texts)):
        values = [float(value) for value in vector]
        norm = math.sqrt(sum(value * value for value in values)) or 1.0
        vectors.append([value / norm for value in values])
    return vectors


def cosine(a, b):
    """Similitud entre dos vectores ya normalizados (de -1 a 1)."""
    return sum(x * y for x, y in zip(a, b))
