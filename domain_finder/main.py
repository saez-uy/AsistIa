#!/usr/bin/env python3
"""
main.py — Punto de entrada del Domain Finder.

Uso:
  python main.py              # flujo completo (scraping + CSV fallback)
  python main.py --csv        # forzar lectura desde dominios_input.csv
  python main.py --skip-fetch # saltar la obtención de dominios (usar DB existente)
  python main.py --skip-tm    # saltar verificación de marcas
  python main.py --skip-score # saltar scoring
"""
import argparse
import logging
import sys
import os

# Add current dir to path so relative imports work when run directly
sys.path.insert(0, os.path.dirname(__file__))

import db
import scraper
import trademark
import scoring
import report


def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-7s  %(message)s",
        datefmt="%H:%M:%S",
        handlers=[logging.StreamHandler(sys.stdout)],
    )


def banner():
    print("""
╔══════════════════════════════════════════════════════╗
║   🌿  Domain Finder — Dominios sin marca registrada  ║
║       con scoring inteligente (0–10)                 ║
╚══════════════════════════════════════════════════════╝
""")


def main():
    setup_logging()
    banner()

    parser = argparse.ArgumentParser(description="Domain Finder")
    parser.add_argument("--csv",        action="store_true", help="Forzar uso de CSV local")
    parser.add_argument("--skip-fetch", action="store_true", help="No obtener dominios nuevos")
    parser.add_argument("--skip-tm",    action="store_true", help="No verificar marcas")
    parser.add_argument("--skip-score", action="store_true", help="No calcular scores")
    args = parser.parse_args()

    # ── 1. Inicializar DB ──────────────────────────────────────────────
    logging.info("📦 Inicializando base de datos...")
    db.init_db()

    # ── 2. Obtener dominios ───────────────────────────────────────────
    if not args.skip_fetch:
        logging.info("\n── PASO 1: Obtener dominios por vencer ──────────────────")
        count = scraper.fetch_domains(use_csv_directly=args.csv)
        if count == 0:
            logging.error("No se obtuvieron dominios. Abortando.")
            sys.exit(1)
    else:
        logging.info("⏭️  Saltando obtención de dominios (--skip-fetch)")

    # ── 3. Verificar marcas ───────────────────────────────────────────
    if not args.skip_tm:
        logging.info("\n── PASO 2: Verificar marcas registradas ─────────────────")
        trademark.verify_trademarks()
    else:
        logging.info("⏭️  Saltando verificación de marcas (--skip-tm)")

    # ── 4. Scoring ────────────────────────────────────────────────────
    if not args.skip_score:
        logging.info("\n── PASO 3: Calcular scores ──────────────────────────────")
        scoring.compute_scores()
    else:
        logging.info("⏭️  Saltando scoring (--skip-score)")

    # ── 5. Reporte ────────────────────────────────────────────────────
    logging.info("\n── PASO 4: Generar reporte ──────────────────────────────")
    report.print_report()
    report.export_csv()

    logging.info("✅ Proceso completado.")


if __name__ == "__main__":
    main()
