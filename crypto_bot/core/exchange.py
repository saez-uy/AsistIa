import time
import ccxt
import pandas as pd
from loguru import logger
from typing import Optional
import config


class ExchangeWrapper:
    """Binance wrapper supporting spot, futures USDM, testnet, and live modes.

    Clients:
    - _exchange : authenticated client for orders (testnet/live, spot or futures)
    - _public   : unauthenticated real Binance spot client for historical OHLCV
                  (testnet has <50 candles; futures public data is the same prices)
    """

    MAX_RETRIES = 5
    RETRY_DELAY = 2

    def __init__(self):
        self._exchange = self._build_exchange()
        self._public = self._build_public_client()
        self.mode = config.TRADING_MODE
        self.use_futures = config.USE_FUTURES
        if self.use_futures:
            self._init_leverage()

    # ─── Construction ────────────────────────────────────────────────────────

    def _build_exchange(self) -> ccxt.Exchange:
        market_type = "future" if config.USE_FUTURES else "spot"
        params: dict = {
            "enableRateLimit": True,
            "options": {"defaultType": market_type},
        }

        if config.USE_TESTNET:
            params["apiKey"] = config.BINANCE_TESTNET_API_KEY
            params["secret"] = config.BINANCE_TESTNET_API_SECRET
            exchange = ccxt.binance(params)
            exchange.set_sandbox_mode(True)
            mode_label = f"FUTURES {config.FUTURES_LEVERAGE}x" if config.USE_FUTURES else "SPOT"
            logger.info(f"Exchange initialised in TESTNET ({mode_label}) paper mode")
        else:
            params["apiKey"] = config.BINANCE_API_KEY
            params["secret"] = config.BINANCE_API_SECRET
            exchange = ccxt.binance(params)
            mode_label = f"FUTURES {config.FUTURES_LEVERAGE}x" if config.USE_FUTURES else "SPOT"
            logger.info(f"Exchange initialised in LIVE ({mode_label}) mode")

        return exchange

    def _build_public_client(self) -> ccxt.Exchange:
        """Unauthenticated real Binance spot client — used only for OHLCV history."""
        return ccxt.binance({"enableRateLimit": True, "options": {"defaultType": "spot"}})

    def _init_leverage(self) -> None:
        """Set leverage and margin mode for all configured symbols."""
        for symbol in config.SYMBOLS:
            try:
                self._retry(
                    self._exchange.set_leverage,
                    config.FUTURES_LEVERAGE,
                    symbol,
                )
                self._retry(
                    self._exchange.set_margin_mode,
                    config.MARGIN_MODE,
                    symbol,
                )
                logger.info(
                    f"Futures: {symbol} leverage={config.FUTURES_LEVERAGE}x "
                    f"margin={config.MARGIN_MODE}"
                )
            except Exception as exc:
                logger.warning(f"Could not set leverage for {symbol}: {exc}")

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
        """Paginate full history from real public Binance (testnet has no history)."""
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
            f"({months} months)"
        )
        return result

    def fetch_ticker(self, symbol: str) -> dict:
        try:
            return self._retry(self._public.fetch_ticker, symbol)
        except Exception:
            return self._retry(self._exchange.fetch_ticker, symbol)

    def fetch_balance(self) -> dict:
        return self._retry(self._exchange.fetch_balance)

    # ─── Order management ────────────────────────────────────────────────────

    def create_market_buy(self, symbol: str, quantity: float) -> dict:
        label = f"FUTURES {config.FUTURES_LEVERAGE}x" if self.use_futures else "SPOT"
        logger.info(f"[{self.mode.upper()}][{label}] MARKET BUY {quantity} {symbol}")
        if self.use_futures:
            # Open a LONG position in futures
            return self._retry(
                self._exchange.create_market_order,
                symbol, "buy", quantity, params={"positionSide": "LONG"}
            )
        return self._retry(self._exchange.create_market_buy_order, symbol, quantity)

    def create_market_sell(self, symbol: str, quantity: float) -> dict:
        label = f"FUTURES {config.FUTURES_LEVERAGE}x" if self.use_futures else "SPOT"
        logger.info(f"[{self.mode.upper()}][{label}] MARKET SELL {quantity} {symbol}")
        if self.use_futures:
            # Close a LONG position in futures
            return self._retry(
                self._exchange.create_market_order,
                symbol, "sell", quantity,
                params={"positionSide": "LONG", "reduceOnly": True}
            )
        return self._retry(self._exchange.create_market_sell_order, symbol, quantity)

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
