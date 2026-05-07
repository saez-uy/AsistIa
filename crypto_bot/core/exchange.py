import time
import ccxt
import pandas as pd
from loguru import logger
from typing import Optional
import config


class ExchangeWrapper:
    """Thin wrapper around ccxt Binance with retry logic and paper-trading support.

    Two internal clients are maintained:
    - _exchange : testnet or live, used for orders and live price feeds
    - _public   : always real Binance (no auth), used for historical OHLCV data
                  because the testnet has <50 candles of history
    """

    MAX_RETRIES = 5
    RETRY_DELAY = 2  # seconds, doubles each retry

    def __init__(self):
        self._exchange = self._build_exchange()
        self._public = self._build_public_client()
        self.mode = config.TRADING_MODE

    # ─── Construction ────────────────────────────────────────────────────────

    def _build_exchange(self) -> ccxt.Exchange:
        params: dict = {
            "enableRateLimit": True,
            "options": {"defaultType": "spot"},
        }

        if config.USE_TESTNET:
            params["apiKey"] = config.BINANCE_TESTNET_API_KEY
            params["secret"] = config.BINANCE_TESTNET_API_SECRET
            exchange = ccxt.binance(params)
            exchange.set_sandbox_mode(True)
            logger.info("Exchange initialised in TESTNET (paper) mode")
        else:
            params["apiKey"] = config.BINANCE_API_KEY
            params["secret"] = config.BINANCE_API_SECRET
            exchange = ccxt.binance(params)
            logger.info("Exchange initialised in LIVE mode")

        return exchange

    def _build_public_client(self) -> ccxt.Exchange:
        """Unauthenticated real Binance client — only used for market data."""
        return ccxt.binance({"enableRateLimit": True, "options": {"defaultType": "spot"}})

    # ─── Data fetching ───────────────────────────────────────────────────────

    def _raw_to_df(self, raw: list) -> pd.DataFrame:
        df = pd.DataFrame(
            raw, columns=["timestamp", "open", "high", "low", "close", "volume"]
        )
        df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms", utc=True)
        df.set_index("timestamp", inplace=True)
        return df.astype(float)

    def fetch_ohlcv(
        self,
        symbol: str,
        timeframe: str,
        limit: int = 500,
        since: Optional[int] = None,
    ) -> pd.DataFrame:
        """Recent candles via the trading client (testnet or live)."""
        raw = self._retry(
            self._exchange.fetch_ohlcv,
            symbol,
            timeframe,
            since=since,
            limit=limit,
        )
        return self._raw_to_df(raw)

    def fetch_ohlcv_full_history(
        self, symbol: str, timeframe: str, months: int = 12
    ) -> pd.DataFrame:
        """Paginate through `months` of history using the PUBLIC real Binance client.

        The testnet only exposes a handful of candles, so historical data
        always comes from the real exchange (read-only, no auth required).
        """
        tf_ms = self._public.parse_timeframe(timeframe) * 1000
        since = self._public.milliseconds() - months * 30 * 24 * 3600 * 1000
        frames: list[pd.DataFrame] = []

        while True:
            raw = self._retry(
                self._public.fetch_ohlcv,
                symbol,
                timeframe,
                since=since,
                limit=1000,
            )
            if not raw:
                break
            chunk = self._raw_to_df(raw)
            frames.append(chunk)
            last_ts = int(chunk.index[-1].timestamp() * 1000)
            since = last_ts + tf_ms
            if since >= self._public.milliseconds():
                break
            time.sleep(self._public.rateLimit / 1000)

        if not frames:
            return pd.DataFrame()
        result = pd.concat(frames)
        result = result[~result.index.duplicated(keep="last")]
        result.sort_index(inplace=True)
        logger.info(
            f"Fetched {len(result)} candles for {symbol} [{timeframe}] "
            f"({months} months) via public endpoint"
        )
        return result

    def fetch_ticker(self, symbol: str) -> dict:
        # Use public client for ticker too — works without auth on testnet
        try:
            return self._retry(self._public.fetch_ticker, symbol)
        except Exception:
            return self._retry(self._exchange.fetch_ticker, symbol)

    def fetch_balance(self) -> dict:
        return self._retry(self._exchange.fetch_balance)

    # ─── Order management ────────────────────────────────────────────────────

    def create_market_buy(self, symbol: str, quantity: float) -> dict:
        logger.info(f"[{self.mode.upper()}] MARKET BUY {quantity} {symbol}")
        return self._retry(
            self._exchange.create_market_buy_order, symbol, quantity
        )

    def create_market_sell(self, symbol: str, quantity: float) -> dict:
        logger.info(f"[{self.mode.upper()}] MARKET SELL {quantity} {symbol}")
        return self._retry(
            self._exchange.create_market_sell_order, symbol, quantity
        )

    def fetch_open_orders(self, symbol: str) -> list:
        return self._retry(self._exchange.fetch_open_orders, symbol)

    def cancel_order(self, order_id: str, symbol: str) -> dict:
        return self._retry(self._exchange.cancel_order, order_id, symbol)

    # ─── Retry logic ─────────────────────────────────────────────────────────

    def _retry(self, fn, *args, **kwargs):
        delay = self.RETRY_DELAY
        for attempt in range(1, self.MAX_RETRIES + 1):
            try:
                return fn(*args, **kwargs)
            except ccxt.RateLimitExceeded:
                logger.warning(f"Rate limit hit, sleeping {delay}s (attempt {attempt})")
                time.sleep(delay)
                delay *= 2
            except (ccxt.NetworkError, ccxt.RequestTimeout) as exc:
                logger.warning(f"Network error: {exc}. Retrying in {delay}s")
                time.sleep(delay)
                delay *= 2
            except ccxt.AuthenticationError as exc:
                logger.error(f"Authentication failed: {exc}")
                raise
            except Exception as exc:
                logger.error(f"Unexpected exchange error: {exc}")
                raise
        raise ccxt.NetworkError(f"All {self.MAX_RETRIES} retries failed")
