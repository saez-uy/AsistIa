"""
trademark.py — Verifica marcas registradas usando USPTO (primario) o EUIPO (fallback).

USPTO Open Data API: https://developer.uspto.gov/api-catalog
  Endpoint de búsqueda: GET https://tsdrapi.uspto.gov/ts/cd/casestatus/sn{serial}/info.json
  Alternativa bulk:     POST https://developer.uspto.gov/ds-api/oa_tm/v1/records
                        o   https://uspto.report/api/tm/search

EUIPO API (fallback):   https://euipo.europa.eu/eSearch/#advanced/trademarks
  REST:                 https://euipo.europa.eu/copla/trademark/data/
"""
import logging
import re

from http_utils import safe_get, polite_delay
from db import update_trademark, get_all

logger = logging.getLogger(__name__)

# USPTO full-text search (no API key required)
USPTO_SEARCH_URL = "https://uspto.report/api/tm/search"
# EUIPO fallback
EUIPO_URL = "https://euipo.europa.eu/copla/trademark/data/trademarks"


def _strip_tld(domain: str) -> str:
    """'techgarden.com' → 'techgarden'"""
    return re.sub(r'\.[a-z]{2,}$', '', domain.lower().strip())


def check_uspto(term: str) -> tuple[bool, str]:
    """
    Query USPTO trademark database for 'term'.
    Returns (has_trademark: bool, detail: str).
    """
    try:
        # uspto.report wraps USPTO's open data — no key needed
        params = {"q": term, "rows": 5, "start": 0}
        data = safe_get(USPTO_SEARCH_URL, params=params, json_resp=True, timeout=15)
        if data is None:
            return None, "USPTO no respondió"

        hits = data.get("response", {}).get("numFound", 0)
        if hits == 0:
            return False, "Sin resultados en USPTO"

        # Check for LIVE marks matching the term closely
        docs = data.get("response", {}).get("docs", [])
        for doc in docs:
            mark_text = (doc.get("wordMark") or doc.get("markDrawingCode") or "").lower()
            status = (doc.get("statusCode") or doc.get("caseStatusCode") or "").upper()
            if term.lower() in mark_text and status in ("A", "LIVE", "REGISTERED", "700", "730"):
                return True, f"Marca activa en USPTO: '{doc.get('wordMark', '')}' [{status}]"

        return False, f"USPTO: {hits} resultado(s) pero sin marca activa exacta"

    except Exception as exc:
        logger.warning("Error USPTO para '%s': %s", term, exc)
        return None, f"Error USPTO: {exc}"


def check_euipo(term: str) -> tuple[bool, str]:
    """
    Fallback: query EUIPO trademark search REST API.
    Returns (has_trademark: bool, detail: str).
    """
    try:
        params = {
            "trademarkName": term,
            "trademarkStatus": "Registered",
            "pageSize": 5,
            "pageNumber": 1,
        }
        data = safe_get(EUIPO_URL, params=params, json_resp=True, timeout=15)
        if data is None:
            return None, "EUIPO no respondió"

        total = data.get("total", 0) or (len(data.get("trademarks", [])))
        if total == 0:
            return False, "Sin resultados en EUIPO"

        trademarks = data.get("trademarks", [])
        for tm in trademarks:
            name = (tm.get("trademarkName") or "").lower()
            status = (tm.get("trademarkStatus") or "").lower()
            if term.lower() in name and "registered" in status:
                return True, f"Marca en EUIPO: '{tm.get('trademarkName', '')}'"

        return False, f"EUIPO: {total} resultado(s) sin coincidencia exacta activa"

    except Exception as exc:
        logger.warning("Error EUIPO para '%s': %s", term, exc)
        return None, f"Error EUIPO: {exc}"


def verify_trademarks():
    """
    Verify all domains in DB that haven't been checked yet.
    Tries USPTO first; falls back to EUIPO if USPTO is unavailable.
    """
    rows = get_all()
    pending = [r for r in rows if r["tiene_marca"] is None]

    if not pending:
        logger.info("✓ Todos los dominios ya tienen verificación de marca.")
        return

    logger.info("🔎 Verificando marcas para %d dominios...", len(pending))

    uspto_available = True  # will flip if consecutive failures
    consecutive_failures = 0

    for i, row in enumerate(pending, 1):
        domain = row["dominio"]
        term = _strip_tld(domain)
        logger.info("  [%d/%d] Verificando: %s (término: '%s')", i, len(pending), domain, term)

        has_mark = None
        detail = ""

        if uspto_available:
            has_mark, detail = check_uspto(term)
            if has_mark is None:
                consecutive_failures += 1
                if consecutive_failures >= 3:
                    logger.warning("  ⚠️  USPTO falló 3 veces seguidas — cambiando a EUIPO")
                    uspto_available = False
            else:
                consecutive_failures = 0

        if has_mark is None:
            logger.info("  → Usando EUIPO como fallback para '%s'", term)
            has_mark, detail = check_euipo(term)

        if has_mark is None:
            logger.warning("  ✗ Ambas APIs fallaron para '%s' — marcando como candidato por defecto", term)
            has_mark = False
            detail = "APIs no disponibles — sin verificación"

        status_icon = "🚫" if has_mark else "✅"
        logger.info("  %s %s — %s", status_icon, domain, detail)

        update_trademark(domain, has_mark, detail if has_mark else None)
        polite_delay(1.5, 3.0)
