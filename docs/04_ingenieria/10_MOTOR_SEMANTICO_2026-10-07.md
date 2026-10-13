# Motor semántico de coincidencias — 7 de octubre de 2026

## Qué cambió

El worker puede comparar pérdidas y hallazgos con dos motores, elegidos con `MATCHING_ENGINE`:

| Motor | Cómo compara la descripción | Cuándo sugiere |
|---|---|---|
| `rules` (original) | Palabras exactas en común. | Misma categoría y fechas cercanas bastan, aunque la descripción no se parezca. |
| `semantic` (por defecto en Docker) | Promedio de **palabras normalizadas** (sin acentos, plurales, género ni diminutivos, con sinónimos regionales) y de un **modelo de lenguaje local**. | Solo si la descripción se parece (umbral `DESCRIPTION_GATE`); la fecha y la zona ordenan. |

La categoría, la ventana de 14 días, el tipo (pérdida/hallazgo) y la exclusión de la misma cuenta siguen igual. Las sugerencias siguen siendo eso: el equipo comprueba la propiedad antes de cualquier entrega.

**El modelo corre dentro del servidor.** Es `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` vía fastembed (ONNX, unos 220 MB, sin GPU). Las descripciones privadas no se envían a ninguna empresa y no hay costo por consulta. El vector de cada reporte se calcula una vez y se guarda en `ReportEmbedding`. Si el modelo no carga, el worker vuelve al motor `rules` y lo registra en el log, para no dejar de sugerir.

## Por qué así: lo que mostró la evaluación

`python manage.py evaluate_matching` compara los motores sobre casos ficticios en `backend/matching/evaluation/`:

- `casos_sierra.json`: 22 pérdidas y 30 hallazgos con acentos, plurales, sinónimos regionales y objetos parecidos que no son el mismo. **El diccionario regional se escribió conociendo estos casos**, así que sus resultados son optimistas.
- `casos_nuevos.json`: 13 pérdidas y 19 hallazgos de control, escritos después de fijar el diccionario y con sinónimos que no contiene. Es la prueba justa de si un motor generaliza.

| Motor | Casos de la Sierra: encuentra · 1.º · falsas alarmas | Casos nuevos: encuentra · 1.º · falsas alarmas · precisión |
|---|---|---|
| Actual (palabras exactas) | 20/20 · 16/20 · 109 | 12/12 · 9/12 · 54 · 18 % |
| Solo palabras normalizadas | 20/20 · 20/20 · 4 | 6/12 · 5/12 · 1 · 86 % |
| Solo IA | 15/20 · 13/20 · 8 | 9/12 · 9/12 · 4 · 69 % |
| **IA + palabras (motor `semantic`)** | **20/20 · 20/20 · 6** | **10/12 · 10/12 · 3 · 77 %** |

Lectura:

1. El motor original «encuentra todo» porque sugiere casi cualquier objeto de la misma categoría y fecha: por cada acierto produce varias alarmas falsas. Eso cansa a las personas y al equipo.
2. El diccionario solo reconoce lo que ya se le enseñó: con palabras nuevas baja a 6 de 12.
3. El modelo de lenguaje es lo que generaliza (cangurera ↔ riñonera, cobija ↔ frazada, recetario ↔ libreta de recetas). Solo, confunde prendas que comparten tela o color («chamarra de mezclilla» ↔ «pantalón de mezclilla»); combinado con las palabras se equilibra.
4. El motor `semantic` pierde 2 de 12 casos nuevos (chanclas ↔ sandalias, audífonos ↔ auriculares) que el original sí sugería entre mucho ruido. Esos avisos siguen visibles en Explorar.

**Límites:** son casos ficticios escritos por el equipo de desarrollo, pocos y en español escrito. No miden la precisión en campo ni el náhuatl o el español hablado de la Sierra. Los umbrales se fijaron antes de los casos nuevos y no se ajustaron con ellos; solo se corrigió un error de raíces («roja» ≠ «rojo») que afectaba a cualquier texto.

## Errores encontrados y corregidos al probar

- Raíces de cuatro letras conservaban el género: «agujetas rojas» no coincidía con «cordones rojos».
- «gorro» compartía raíz con «gorra» y la convertía en «capucha». Ahora `_build_lexicon` falla si dos grupos chocan, y «gorro» quedó fuera por ambiguo.

## Cómo operarlo

```powershell
# Comparar motores (agrega --details para ver cada caso)
docker compose exec worker python manage.py evaluate_matching
docker compose exec worker python manage.py evaluate_matching --cases matching/evaluation/casos_nuevos.json

# Volver a comparar los reportes activos tras cambiar de motor o de diccionario
docker compose exec worker python manage.py rematch_reports --drop-pending

# Volver al motor original: MATCHING_ENGINE=rules en .env y reiniciar el worker
```

El diccionario está en `REGIONAL_WORDS` de `backend/matching/scoring.py`. Cada grupo une palabras que nombran lo mismo; la primera es la forma común. Conviene ampliarlo con lo que digan las personas de la Sierra y volver a evaluar con ambos archivos de casos.

## Siguiente paso recomendado

Sustituir los casos ficticios por pares reales revisados y consentidos del piloto, medir con `evaluate_matching` y ajustar `DESCRIPTION_GATE`, `SEMANTIC_FLOOR` y `SEMANTIC_CEILING` solo con un conjunto distinto del que se usa para reportar resultados. Probar el modelo mayor (`paraphrase-multilingual-mpnet-base-v2`, unos 1.1 GB) con `--model` si el servidor lo permite.
