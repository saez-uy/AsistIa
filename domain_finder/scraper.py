"""
scraper.py — Obtiene dominios próximos a vencer.

Fuente primaria : expireddomains.net (scraping)
Fallback        : dominios_input.csv  (columnas: dominio, fecha_expiracion)
"""
import csv
import logging
import os
import re
from html.parser import HTMLParser
from datetime import datetime, timedelta

from http_utils import safe_get, polite_delay
from db import upsert_domain

logger = logging.getLogger(__name__)

CSV_FALLBACK = os.path.join(os.path.dirname(__file__), "dominios_input.csv")
EXPIREDDOMAINS_URL = "https://www.expireddomains.net/domain-lists/expiring-domains/"


# ── HTML parser for expireddomains.net table ─────────────────────────
class ExpiredDomainsParser(HTMLParser):
    """
    Extracts rows from the main domains table on expireddomains.net.
    Looks for <td class="field_domain"> and nearby date cells.
    """

    def __init__(self):
        super().__init__()
        self._in_domain_td = False
        self._in_date_td = False
        self._current_domain = None
        self._current_date = None
        self._td_class = ""
        self.results: list[tuple[str, str]] = []  # (domain, expiry_date)
        self._row_domains = []
        self._row_dates = []
        self._in_tr = False
        self._td_count = 0

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == "tr":
            self._in_tr = True
            self._row_domains = []
            self._row_dates = []
            self._td_count = 0

        if tag == "td":
            cls = attrs_dict.get("class", "")
            self._td_class = cls
            self._td_count += 1
            if "field_domain" in cls:
                self._in_domain_td = True

        if tag == "a" and self._in_domain_td:
            href = attrs_dict.get("href", "")
            # domain links look like /go/... or contain the domain name
            pass

    def handle_endtag(self, tag):
        if tag == "td":
            self._in_domain_td = False
            self._in_date_td = False
        if tag == "tr" and self._row_domains:
            domain = self._row_domains[0] if self._row_domains else None
            date = self._row_dates[0] if self._row_dates else ""
            if domain and re.match(r'^[a-z0-9][a-z0-9\-]{0,61}[a-z0-9]?\.(com)$', domain):
                self.results.append((domain, date))
            self._in_tr = False

    def handle_data(self, data):
        data = data.strip()
        if not data:
            return
        if self._in_domain_td:
            # Could be the domain text
            if re.match(r'^[a-z0-9][a-z0-9\-]{0,61}[a-z0-9]?\.(com)$', data.lower()):
                self._row_domains.append(data.lower())
        # Date pattern: YYYY-MM-DD or DD/MM/YYYY or similar
        if re.match(r'\d{4}-\d{2}-\d{2}', data) or re.match(r'\d{2}/\d{2}/\d{4}', data):
            self._row_dates.append(data)


def _parse_expireddomains_html(html: str) -> list[tuple[str, str]]:
    """
    Parse the HTML from expireddomains.net. Uses a more robust regex-based
    approach as fallback when the DOM parser misses rows.
    """
    results = []
    # Strategy: find all .com domains in the page and nearby dates
    domain_pattern = re.compile(
        r'class="[^"]*field_domain[^"]*"[^>]*>.*?'
        r'href="[^"]*">([a-z0-9][a-z0-9\-]*\.com)</a>',
        re.IGNORECASE | re.DOTALL,
    )
    # Broader fallback: any .com domain in a table link
    broad_pattern = re.compile(
        r'<a[^>]+href="[^"]*go[^"]*"[^>]*>([a-z0-9][a-z0-9\-]{2,61}\.com)</a>',
        re.IGNORECASE,
    )
    date_pattern = re.compile(r'(\d{4}-\d{2}-\d{2}|\d{2}/\d{2}/\d{4})')

    # Try specific field first
    matches = domain_pattern.findall(html)
    if not matches:
        matches = broad_pattern.findall(html)

    # Find all dates in the doc
    all_dates = date_pattern.findall(html)

    seen = set()
    for i, domain in enumerate(matches):
        d = domain.lower()
        if d in seen:
            continue
        seen.add(d)
        expiry = all_dates[i] if i < len(all_dates) else ""
        results.append((d, expiry))

    return results[:100]  # limit to 100 per page


def scrape_expireddomains(max_pages: int = 3) -> list[tuple[str, str]]:
    """
    Scrape expireddomains.net for .com domains expiring in ~30 days.
    Returns list of (domain, expiry_date_str).
    """
    logger.info("🌐 Intentando scraping de expireddomains.net...")
    all_domains = []

    params_base = {
        "ftlds[]": "com",
        "fwhois": "22",      # pending delete / expiring
        "falexa": "",
        "fmaxalexa": "",
        "o": "expires",
        "r": "asc",
    }

    for page in range(max_pages):
        params = {**params_base, "start": page * 25}
        logger.info("  → Página %d...", page + 1)
        resp = safe_get(EXPIREDDOMAINS_URL, params=params, timeout=20)

        if resp is None:
            logger.warning("  ✗ No se pudo obtener página %d", page + 1)
            break

        # Check if we got blocked (captcha / login wall)
        if resp.status_code in (403, 429, 503):
            logger.warning("  ✗ Bloqueado por expireddomains.net (HTTP %s)", resp.status_code)
            break
        if "login" in resp.url or "captcha" in resp.text.lower():
            logger.warning("  ✗ expireddomains.net requiere login o captcha")
            break

        domains = _parse_expireddomains_html(resp.text)
        if not domains:
            logger.warning("  ✗ No se encontraron dominios en página %d (posible bloqueo)", page + 1)
            break

        logger.info("  ✓ %d dominios encontrados en página %d", len(domains), page + 1)
        all_domains.extend(domains)
        polite_delay(2, 4)

    return all_domains


def load_csv_fallback() -> list[tuple[str, str]]:
    """Read domains from local CSV fallback file."""
    if not os.path.exists(CSV_FALLBACK):
        logger.warning("CSV de fallback no encontrado: %s", CSV_FALLBACK)
        # Generate a small demo CSV so the system can still run
        _generate_demo_csv()

    domains = []
    with open(CSV_FALLBACK, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            dom = row.get("dominio", "").strip().lower()
            exp = row.get("fecha_expiracion", "").strip()
            if dom.endswith(".com"):
                domains.append((dom, exp))
    logger.info("📄 CSV fallback: %d dominios leídos", len(domains))
    return domains


def _generate_demo_csv():
    """Creates a small demo CSV so the pipeline can be demonstrated end-to-end."""
    base = datetime.today()
    demo = [
        ("techgarden.com",      (base + timedelta(days=5)).strftime("%Y-%m-%d")),
        ("freshleafcare.com",   (base + timedelta(days=10)).strftime("%Y-%m-%d")),
        ("cloudsprout.com",     (base + timedelta(days=14)).strftime("%Y-%m-%d")),
        ("rapidsoil.com",       (base + timedelta(days=18)).strftime("%Y-%m-%d")),
        ("greenlogix.com",      (base + timedelta(days=22)).strftime("%Y-%m-%d")),
        ("dataplant.com",       (base + timedelta(days=7)).strftime("%Y-%m-%d")),
        ("swiftbloom.com",      (base + timedelta(days=28)).strftime("%Y-%m-%d")),
        ("nativeroot.com",      (base + timedelta(days=3)).strftime("%Y-%m-%d")),
        ("pixelherb.com",       (base + timedelta(days=12)).strftime("%Y-%m-%d")),
        ("smartirrigation.com", (base + timedelta(days=9)).strftime("%Y-%m-%d")),
    ]
    with open(CSV_FALLBACK, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["dominio", "fecha_expiracion"])
        writer.writerows(demo)
    logger.info("📄 CSV demo generado con %d dominios de ejemplo", len(demo))


def fetch_domains(use_csv_directly: bool = False) -> int:
    """
    Main entry: scrape → fallback CSV → save to DB.
    Returns count of domains stored.
    """
    domains: list[tuple[str, str]] = []

    if not use_csv_directly:
        domains = scrape_expireddomains()

    if not domains:
        logger.info("⬇️  Usando fallback CSV...")
        domains = load_csv_fallback()

    if not domains:
        logger.error("❌ No se obtuvieron dominios de ninguna fuente.")
        return 0

    for domain, expiry in domains:
        upsert_domain(domain, expiry)

    logger.info("💾 %d dominios guardados en la DB", len(domains))
    return len(domains)
