"""Cabeceras de municipios de la Sierra usadas solo como referencias visuales.

Las coordenadas provienen del cuadro 1.2 de INEGI (Veracruz, 2018):
https://www.inegi.org.mx/app/cuadroentidad/Ver/2018/01/1_2
Una cabecera no representa el sitio preciso de ningún reporte.
"""

import re
import unicodedata


def decimal(degrees, minutes, seconds, west=False):
    value = degrees + minutes / 60 + seconds / 3600
    return -value if west else value


# Nombre, latitud norte DMS, longitud oeste DMS. Subconjunto inicial de 11
# municipios de la zona, ampliable tras validar el alcance del piloto.
MUNICIPALITIES = {
    "Astacinga": ((18, 34, 0), (97, 6, 7)),
    "Atlahuilco": ((18, 41, 50), (97, 5, 26)),
    "Los Reyes": ((18, 40, 21), (97, 2, 39)),
    "Magdalena": ((18, 45, 38), (97, 2, 43)),
    "Mixtla de Altamirano": ((18, 35, 44), (96, 59, 33)),
    "Tehuipango": ((18, 31, 3), (97, 3, 22)),
    "Tequila": ((18, 43, 47), (97, 4, 9)),
    "Texhuacán": ((18, 37, 14), (97, 2, 19)),
    "Tlaquilpa": ((18, 36, 44), (97, 7, 7)),
    "Xoxocotla": ((18, 38, 52), (97, 9, 6)),
    "Zongolica": ((18, 40, 0), (96, 59, 54)),
}


def normalize(value):
    plain = "".join(
        char for char in unicodedata.normalize("NFKD", value.casefold())
        if not unicodedata.combining(char)
    )
    return re.sub(r"\s+", " ", plain).strip()


def municipality_for_area(area):
    area = normalize(area)
    if not area or "sierra de zongolica" in area:
        return None
    for name in sorted(MUNICIPALITIES, key=len, reverse=True):
        if re.search(rf"(?<!\w){re.escape(normalize(name))}(?!\w)", area):
            return name
    return None


def marker_coordinates(name):
    north, west = MUNICIPALITIES[name]
    return [round(decimal(*west, west=True), 6), round(decimal(*north), 6)]
