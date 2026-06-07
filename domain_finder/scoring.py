"""
scoring.py — Calcula el score (0–10) para cada dominio candidato.

Criterios:
  +3  Nombre genérico o descriptivo (no inventado)
  +2  No aparece en los 3 primeros resultados de Google
  +2  No tiene redes sociales activas (Twitter/X e Instagram)
  +2  Tiene más de 50 backlinks (OpenLinkProfiler API)
  +1  Expira en menos de 15 días
"""
import logging
import re
from datetime import datetime

from http_utils import safe_get, polite_delay, random_headers
from db import get_all, update_score

logger = logging.getLogger(__name__)

# ── Word lists for generic/descriptive detection ─────────────────────
# Domains containing common English/Spanish words score as "generic"
GENERIC_WORDS = {
    # nature / garden (context-relevant)
    "garden", "plant", "leaf", "root", "bloom", "grass", "soil", "green",
    "tree", "flower", "herb", "forest", "nature", "eco", "organic",
    # tech
    "tech", "digital", "smart", "cloud", "data", "app", "net", "web",
    "soft", "code", "cyber", "info", "online", "media", "hub", "lab",
    # business
    "market", "shop", "store", "trade", "deal", "buy", "sale", "fast",
    "quick", "easy", "pro", "plus", "max", "prime", "global", "local",
    # descriptive
    "fresh", "clean", "new", "best", "top", "real", "true", "bright",
    "swift", "rapid", "secure", "safe", "open", "free", "direct",
    # Spanish
    "casa", "vida", "campo", "agua", "tierra", "sol", "luz", "bien",
    "fácil", "nuevo", "rápido", "seguro", "verde",
}


def _is_generic(domain_name: str) -> bool:
    """Return True if the domain name contains a common descriptive word."""
    name = re.sub(r'\.[a-z]{2,}$', '', domain_name.lower())
    # Split on digits and common separators
    parts = re.split(r'[\-_0-9]', name)
    for part in parts:
        if len(part) >= 3 and part in GENERIC_WORDS:
            return True
        # Sliding window: check substrings of length 4-8 inside compound words
        for length in range(4, min(len(part) + 1, 9)):
            for start in range(len(part) - length + 1):
                if part[start:start + length] in GENERIC_WORDS:
                    return True
    return False


def _days_until_expiry(expiry_str: str) -> int | None:
    """Parse expiry date and return days until expiry (negative = already expired)."""
    if not expiry_str:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"):
        try:
            exp = datetime.strptime(expiry_str.strip(), fmt)
            return (exp - datetime.today()).days
        except ValueError:
            continue
    return None


def _check_google_presence(domain_name: str) -> bool:
    """
    Returns True if domain does NOT appear in the first 3 Google results.
    Uses a simple scrape of DuckDuckGo HTML (more lenient than Google).
    """
    term = re.sub(r'\.[a-z]{2,}$', '', domain_name)
    search_url = "https://html.duckduckgo.com/html/"
    params = {"q": f'"{term}"', "kl": "us-en"}
    try:
        resp = safe_get(search_url, params=params, timeout=12)
        if resp is None:
            return True  # assume not found if search fails
        html = resp.text.lower()
        # DuckDuckGo result links appear as class="result__url"
        # Find first 3 result URLs
        urls = re.findall(r'class="result__url"[^>]*>(.*?)</a>', html, re.DOTALL)[:3]
        full_text = " ".join(urls)
        return domain_name.lower() not in full_text
    except Exception as exc:
        logger.debug("DuckDuckGo search error for %s: %s", domain_name, exc)
        return True  # benefit of the doubt


def _check_social_presence(domain_name: str) -> bool:
    """
    Returns True if domain does NOT have active social accounts.
    Checks Twitter/X profile URL and Instagram profile URL.
    """
    name = re.sub(r'\.[a-z]{2,}$', '', domain_name.lower())
    no_social = True

    # Twitter/X: a 200 on /name usually means active account
    for url in [
        f"https://twitter.com/{name}",
        f"https://x.com/{name}",
    ]:
        try:
            resp = safe_get(url, timeout=10)
            if resp and resp.status_code == 200 and "this account doesn't exist" not in resp.text.lower():
                logger.debug("  Twitter/X profile found for '%s'", name)
                no_social = False
                break
        except Exception:
            pass
        polite_delay(0.5, 1.0)

    if not no_social:
        return False

    # Instagram
    try:
        ig_url = f"https://www.instagram.com/{name}/"
        resp = safe_get(ig_url, timeout=10)
        if resp and resp.status_code == 200 and '"username":"' + name + '"' in resp.text:
            logger.debug("  Instagram profile found for '%s'", name)
            no_social = False
    except Exception:
        pass

    return no_social


def _check_backlinks(domain_name: str) -> int:
    """
    Returns estimated backlink count using OpenLinkProfiler free API.
    Returns 0 if unavailable.
    """
    url = "https://openlinkprofiler.org/api/getLinkCount"
    params = {"url": domain_name, "apikey": "free"}
    try:
        data = safe_get(url, params=params, json_resp=True, timeout=12)
        if data:
            count = int(data.get("total_links") or data.get("links") or 0)
            return count
    except Exception as exc:
        logger.debug("OpenLinkProfiler error for %s: %s", domain_name, exc)

    # Fallback: check Moz free toolbar (undocumented but public)
    try:
        moz_url = f"https://moz.com/domain-analysis?site={domain_name}"
        resp = safe_get(moz_url, timeout=12)
        if resp:
            m = re.search(r'"total_links"\s*:\s*(\d+)', resp.text)
            if m:
                return int(m.group(1))
    except Exception:
        pass

    return 0  # unable to determine


def compute_scores():
    """Score all candidate domains (tiene_marca=0) and save to DB."""
    rows = get_all()
    candidates = [r for r in rows if r["tiene_marca"] == 0 and r["score"] is None]

    if not candidates:
        logger.info("✓ Todos los candidatos ya tienen score o no hay candidatos.")
        return

    logger.info("📊 Calculando scores para %d candidatos...", len(candidates))

    for i, row in enumerate(candidates, 1):
        domain = row["dominio"]
        expiry = row["fecha_expiracion"]
        score = 0.0
        breakdown = []

        logger.info("  [%d/%d] Scoring: %s", i, len(candidates), domain)

        # +3 generic/descriptive name
        if _is_generic(domain):
            score += 3
            breakdown.append("+3 nombre genérico")
            logger.info("    +3 nombre genérico/descriptivo")
        else:
            breakdown.append("+0 nombre inventado")
            logger.info("    +0 nombre inventado (no genérico)")

        polite_delay(1, 2)

        # +2 not in top 3 search results
        not_in_search = _check_google_presence(domain)
        if not_in_search:
            score += 2
            breakdown.append("+2 sin presencia en búsqueda")
            logger.info("    +2 no aparece en búsqueda")
        else:
            breakdown.append("+0 aparece en búsqueda")
            logger.info("    +0 aparece en búsqueda")

        polite_delay(2, 4)

        # +2 no active social media
        no_social = _check_social_presence(domain)
        if no_social:
            score += 2
            breakdown.append("+2 sin redes sociales")
            logger.info("    +2 sin redes sociales detectadas")
        else:
            breakdown.append("+0 tiene redes sociales")
            logger.info("    +0 tiene redes sociales")

        polite_delay(1, 2)

        # +2 backlinks > 50
        backlinks = _check_backlinks(domain)
        if backlinks > 50:
            score += 2
            breakdown.append(f"+2 backlinks: {backlinks}")
            logger.info("    +2 backlinks: %d", backlinks)
        else:
            breakdown.append(f"+0 backlinks: {backlinks}")
            logger.info("    +0 backlinks: %d (≤50)", backlinks)

        polite_delay(1, 2)

        # +1 expires in < 15 days
        days_left = _days_until_expiry(expiry)
        if days_left is not None and 0 <= days_left < 15:
            score += 1
            breakdown.append(f"+1 expira en {days_left} días")
            logger.info("    +1 expira en %d días (<15)", days_left)
        else:
            left_str = f"{days_left} días" if days_left is not None else "fecha desconocida"
            breakdown.append(f"+0 expira en {left_str}")
            logger.info("    +0 expira en %s", left_str)

        score = min(10.0, score)
        fecha = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        update_score(domain, score, fecha)
        logger.info("  → Score final: %.1f/10  [%s]", score, " | ".join(breakdown))
        polite_delay(1, 2)
