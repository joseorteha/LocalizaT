"""Puntuación de coincidencias entre una pérdida y un hallazgo.

Hay dos motores:

- ``rules``: el original. Compara palabras tal como se escribieron.
- ``semantic``: normaliza el texto (acentos, plurales, diminutivos y palabras
  de la región), mide cuánto se parecen las descripciones con palabras y con
  un modelo de lenguaje local, y exige que la descripción se parezca antes de
  sugerir nada. La categoría, la fecha y la zona siguen funcionando igual.

Las funciones son puras: reciben objetos con los atributos de ``Report`` y no
consultan la base de datos, para poder evaluarlas con casos de prueba.
"""

import re
import unicodedata

from reports.models import Report


STOPWORDS = {"de", "del", "la", "el", "los", "las", "con", "una", "uno", "por", "para", "que", "en", "un"}

# Palabras distintas que en la Sierra nombran lo mismo. La primera de cada grupo
# es la forma que se usa al comparar. Ampliar con lo que diga la comunidad.
REGIONAL_WORDS = [
    ["bolsa", "bolso", "morral", "morralito", "bolsita"],
    ["maleta", "maletin", "valija"],
    ["chamarra", "chaqueta", "chamarrita", "campera"],
    ["mezclilla", "jean", "jeans", "denim"],
    ["sueter", "sweater", "jersey"],
    ["tejido", "tejida", "estambre", "bordado", "bordada"],
    # «gorro» queda fuera: puede ser gorra o capucha, y su raíz choca con «gorra».
    ["gorra", "cachucha", "gorrita"],
    ["capucha"],
    ["rebozo", "reboso", "chal"],
    ["lentes", "anteojos", "gafas", "lente"],
    ["paraguas", "sombrilla"],
    ["cuaderno", "libreta"],
    ["cuadro", "cuadricula", "cuadriculado", "cuadriculada"],
    ["matematicas", "mate"],
    ["termo", "termica", "termico"],
    ["balon", "pelota"],
    ["funda", "enfundado", "enfundada"],
    ["cuero", "piel"],
    ["plata", "plateado", "plateada"],
    ["oro", "dorado", "dorada"],
    ["chico", "chica", "pequeno", "pequena", "chiquito", "chiquita"],
    ["rueda", "ruedita"],
    ["lana", "borrega"],
    ["forro", "forrado", "forrada"],
    ["mercado", "mandado", "plaza"],
    ["cafe", "marron"],
    ["raya", "rayado", "rayada"],
    ["escuela", "escolar"],
    ["virgen", "virgencita", "guadalupe", "guadalupana"],
    ["metal", "metalico", "metalica"],
    ["oscuro", "marino"],
]

# Puntuación del motor semántico. La descripción decide; la fecha y la zona
# ayudan a ordenar, pero por sí solas ya no bastan para sugerir.
SUGGESTION_THRESHOLD = 55
DESCRIPTION_GATE = 0.35
# Similitud del modelo que se considera "nada parecido" (0) y "muy parecido" (1).
SEMANTIC_FLOOR = 0.50
SEMANTIC_CEILING = 0.85


def fold(value):
    """Minúsculas y sin acentos: «Suéter» y «sueter» se vuelven iguales."""
    return "".join(
        char for char in unicodedata.normalize("NFKD", value.casefold())
        if not unicodedata.combining(char)
    )


def stem(word):
    """Raíz aproximada: quita plural, género y diminutivo (mochilas → mochil)."""
    if len(word) > 3 and word.endswith("s"):
        word = word[:-1]
    # ≥ 4 para que «roja» y «rojo» (y «rojas», «rojos») queden iguales.
    if len(word) >= 4 and word[-1] in "aeo":
        word = word[:-1]
    for suffix in ("cit", "it"):
        if len(word) > 5 and word.endswith(suffix):
            word = word[: -len(suffix)]
            break
    return word


def _build_lexicon():
    stems, words = {}, {}
    for group in REGIONAL_WORDS:
        canonical = group[0]
        for item in group:
            root = stem(item)
            # Dos grupos con la misma raíz se mezclarían sin avisar (p. ej. gorra y gorro).
            if stems.get(root, stem(canonical)) != stem(canonical):
                raise ValueError(f"«{item}» comparte raíz con otro grupo de REGIONAL_WORDS.")
            stems[root] = stem(canonical)
            words[item] = canonical
    return stems, words


_STEM_LEXICON, _WORD_LEXICON = _build_lexicon()


def words(value):
    """Palabras tal como se escribieron (motor original)."""
    return {part for part in re.findall(r"[\wáéíóúñ]+", value.casefold()) if len(part) > 2 and part not in STOPWORDS}


def tokens(value):
    """Palabras normalizadas: sin acentos, en raíz y con sinónimos regionales unidos."""
    found = set()
    for part in re.findall(r"[a-z0-9ñ]+", fold(value)):
        if len(part) <= 2 or part in STOPWORDS:
            continue
        root = stem(part)
        found.add(_STEM_LEXICON.get(root, root))
    return found


def canonical_text(value):
    """El texto con las palabras regionales sustituidas por su forma común.

    Es lo que recibe el modelo de lenguaje: así «chaqueta de jean» y «chamarra
    de mezclilla» llegan con las mismas palabras.
    """
    parts = re.findall(r"[a-z0-9ñ]+", fold(value))
    return " ".join(_WORD_LEXICON.get(part, _WORD_LEXICON.get(part.rstrip("s"), part)) for part in parts)


def lexical_similarity(lost_text, found_text):
    """Parte de las palabras de la descripción más corta que aparecen en la otra."""
    a, b = tokens(lost_text), tokens(found_text)
    if not a or not b:
        return 0.0
    return len(a & b) / min(len(a), len(b))


def semantic_similarity(cosine):
    """Convierte la similitud del modelo (≈0.5 a 0.85) a una escala de 0 a 1."""
    if cosine is None:
        return 0.0
    value = (cosine - SEMANTIC_FLOOR) / (SEMANTIC_CEILING - SEMANTIC_FLOOR)
    return max(0.0, min(1.0, value))


def _compatible(lost, found):
    if lost.kind != Report.Kind.LOST or found.kind != Report.Kind.FOUND:
        return None
    if lost.category != found.category or lost.owner_id == found.owner_id:
        return None
    days = abs((lost.occurred_on - found.occurred_on).days)
    return days if days <= 14 else None


def score_pair(lost, found):
    """Motor original: categoría, fecha, zona y palabras exactas en común."""
    days = _compatible(lost, found)
    if days is None:
        return 0, []
    score = 40 + max(0, 20 - days * 2)
    reasons = ["misma categoría", "fechas próximas"]
    if words(lost.approximate_area) & words(found.approximate_area):
        score += 20
        reasons.append("zona relacionada")
    common = words(lost.description) & words(found.description)
    if common:
        score += min(20, len(common) * 5)
        reasons.append("rasgos similares")
    return min(score, 100), reasons


def description_similarity(lost, found, cosine=None, use_model=True):
    """Qué tanto se parecen las descripciones, de 0 a 1.

    Promedia las palabras normalizadas con el modelo de lenguaje: las palabras
    evitan confundir prendas que solo comparten tela o color, y el modelo
    reconoce descripciones dichas de otra forma.
    """
    lexical = lexical_similarity(lost.description, found.description)
    if not use_model or cosine is None:
        return lexical
    return (lexical + semantic_similarity(cosine)) / 2


def score_pair_semantic(lost, found, cosine=None, use_model=True):
    """Motor semántico. ``cosine`` es la similitud del modelo entre descripciones."""
    return score_with_similarity(lost, found, description_similarity(lost, found, cosine, use_model))


def score_with_similarity(lost, found, similarity):
    """Puntuación del motor semántico a partir de una similitud ya calculada."""
    days = _compatible(lost, found)
    if days is None:
        return 0, []
    if similarity < DESCRIPTION_GATE:
        return 0, []
    score = 30 + max(0, 15 - days * 1.5) + round(similarity * 40)
    reasons = ["misma categoría", "descripción parecida"]
    if tokens(lost.approximate_area) & tokens(found.approximate_area):
        score += 15
        reasons.append("zona relacionada")
    if days <= 3:
        reasons.append("fechas próximas")
    return min(round(score), 100), reasons
