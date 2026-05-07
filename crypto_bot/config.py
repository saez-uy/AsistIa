import os
from dotenv import load_dotenv

load_dotenv()

# ─── Exchange ────────────────────────────────────────────────────────────────
EXCHANGE_ID = "binance"
TRADING_MODE = os.getenv("TRADING_MODE", "paper")  # "paper" | "live"
USE_TESTNET = TRADING_MODE == "paper"

BINANCE_API_KEY = os.getenv("BINANCE_API_KEY", "")
BINANCE_API_SECRET = os.getenv("BINANCE_API_SECRET", "")
BINANCE_TESTNET_API_KEY = os.getenv("BINANCE_TESTNET_API_KEY", "")
BINANCE_TESTNET_API_SECRET = os.getenv("BINANCE_TESTNET_API_SECRET", "")

# ─── Futures / leverage ───────────────────────────────────────────────────────
USE_FUTURES = os.getenv("USE_FUTURES", "false").lower() == "true"
FUTURES_LEVERAGE = int(os.getenv("FUTURES_LEVERAGE", "2"))   # 1 = spot equivalent
MARGIN_MODE = "isolated"   # "isolated" keeps risk per-position; never use "cross"

# ─── Trading pairs ───────────────────────────────────────────────────────────
SYMBOLS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT"]
QUOTE_CURRENCY = "USDT"
INITIAL_CAPITAL = 500.0

# ─── Timeframes ──────────────────────────────────────────────────────────────
SIGNAL_TIMEFRAME = "1h"
MACRO_TIMEFRAME = "4h"
LOOP_INTERVAL_MINUTES = 15

# ─── Indicator parameters ────────────────────────────────────────────────────
RSI_PERIOD = 14
RSI_OVERSOLD = 35
RSI_OVERBOUGHT = 70

EMA_FAST = 9
EMA_SLOW = 21
EMA_MACRO = 200

MACD_FAST = 12
MACD_SLOW = 26
MACD_SIGNAL = 9

ATR_PERIOD = 14
ATR_MULTIPLIER = 3.0          # volatility filter: block if ATR > 3x 30d avg
ATR_LOOKBACK_DAYS = 30

BB_PERIOD = 20
BB_STD = 2.0

STOCH_K = 14
STOCH_D = 3
STOCH_SMOOTH = 3

# ─── Risk management ─────────────────────────────────────────────────────────
MAX_RISK_PER_TRADE = 0.02     # 2% capital per trade
MAX_PORTFOLIO_RISK = 0.06     # 6% total simultaneous risk
MAX_DAILY_LOSS = 0.03         # circuit breaker: stop if -3% on the day
MAX_OPEN_TRADES = 2

TAKE_PROFIT_PCT = 0.03        # +3%
STOP_LOSS_PCT = 0.015         # -1.5%  → R:R = 1:2
TRAILING_ACTIVATION_PCT = 0.015  # activate trailing at +1.5%
TRAILING_STOP_PCT = 0.01      # 1% trailing distance
KELLY_FRACTION = 0.25         # fractional Kelly (25%)

# ─── Signals: minimum conditions to enter ────────────────────────────────────
MIN_SIGNALS_REQUIRED = 2      # out of 4 conditions (3 was too restrictive: ~1 trade/month)

# ─── Backtesting ─────────────────────────────────────────────────────────────
BACKTEST_MONTHS = 12
BACKTEST_MIN_MONTHLY_RETURN = 0.01   # 1% monthly minimum (~12% annual) to approve

# ─── Paper trading ───────────────────────────────────────────────────────────
PAPER_TRADING_MIN_DAYS = 7

# ─── Database ────────────────────────────────────────────────────────────────
DB_PATH = os.getenv("DB_PATH", "./trades.db")

# ─── Telegram ────────────────────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

# ─── Logging ─────────────────────────────────────────────────────────────────
LOG_LEVEL = "INFO"
LOG_FILE = "./logs/bot.log"
LOG_ROTATION = "10 MB"
