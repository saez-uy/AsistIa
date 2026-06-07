"""
http_utils.py — Shared HTTP helpers: user-agent rotation, retries, delays.
"""
import random
import time
import logging
import requests

logger = logging.getLogger(__name__)

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/124.0.0.0 Safari/537.36",
]

SESSION = requests.Session()


def random_headers(referer: str = None) -> dict:
    headers = {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Connection": "keep-alive",
    }
    if referer:
        headers["Referer"] = referer
    return headers


def polite_delay(min_s: float = 2.0, max_s: float = 4.0):
    t = random.uniform(min_s, max_s)
    logger.debug("Waiting %.1fs...", t)
    time.sleep(t)


def safe_get(url: str, *, timeout: int = 15, retries: int = 2,
             params: dict = None, headers: dict = None, json_resp: bool = False):
    """
    GET with rotating UA, retries, and polite delays.
    Returns (response_object | dict | None).
    """
    hdrs = headers or random_headers()
    for attempt in range(1, retries + 2):
        try:
            resp = SESSION.get(url, headers=hdrs, params=params, timeout=timeout)
            if resp.status_code == 200:
                return resp.json() if json_resp else resp
            logger.warning("HTTP %s for %s (attempt %d)", resp.status_code, url, attempt)
        except Exception as exc:
            logger.warning("Request error for %s (attempt %d): %s", url, attempt, exc)
        if attempt <= retries:
            polite_delay(1, 2)
    return None
