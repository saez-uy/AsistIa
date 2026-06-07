"""
report.py — Genera tabla en consola y exporta candidatos.csv
"""
import csv
import logging
import os

from db import get_candidates

logger = logging.getLogger(__name__)

CSV_OUTPUT = os.path.join(os.path.dirname(__file__), "candidatos.csv")

COLUMNS = ["dominio", "fecha_expiracion", "score", "tiene_marca", "fecha_analisis"]
HEADERS = ["Dominio", "Expira", "Score", "¿Marca?", "Analizado"]
WIDTHS  = [30, 14, 7, 8, 20]


def _fmt_row(row: dict) -> list[str]:
    marca = "No" if row["tiene_marca"] == 0 else ("Sí" if row["tiene_marca"] == 1 else "—")
    score = f"{row['score']:.1f}/10" if row["score"] is not None else "—"
    return [
        row["dominio"] or "—",
        row["fecha_expiracion"] or "—",
        score,
        marca,
        (row["fecha_analisis"] or "—")[:19],
    ]


def _divider(widths: list[int]) -> str:
    return "+" + "+".join("-" * (w + 2) for w in widths) + "+"


def _row_line(values: list[str], widths: list[int]) -> str:
    cells = []
    for v, w in zip(values, widths):
        v = str(v)
        if len(v) > w:
            v = v[: w - 1] + "…"
        cells.append(f" {v:<{w}} ")
    return "|" + "|".join(cells) + "|"


def print_report():
    candidates = get_candidates()

    print("\n" + "═" * 90)
    print("  🌿  TOP 20 DOMINIOS CANDIDATOS  —  ¿Riego hoy? Domain Finder")
    print("═" * 90)

    if not candidates:
        print("  No hay candidatos disponibles todavía.")
        print("═" * 90 + "\n")
        return

    div = _divider(WIDTHS)
    print(div)
    print(_row_line(HEADERS, WIDTHS))
    print(div.replace("-", "="))

    for row in candidates:
        print(_row_line(_fmt_row(row), WIDTHS))
    print(div)
    print(f"\n  Total candidatos: {len(candidates)}")
    print("═" * 90 + "\n")


def export_csv():
    candidates = get_candidates()
    if not candidates:
        logger.warning("No hay candidatos para exportar.")
        return

    with open(CSV_OUTPUT, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(candidates)

    logger.info("📁 Exportado: %s  (%d filas)", CSV_OUTPUT, len(candidates))
    print(f"  CSV guardado en: {CSV_OUTPUT}")
