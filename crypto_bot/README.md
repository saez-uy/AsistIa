# Crypto Trading Bot

Automated BTC/USDT & ETH/USDT trading bot with multi-signal trend-following strategy, backtesting engine, paper trading, and Telegram alerts.

## Strategy Summary

**Entry (LONG):** ≥3 of 4 conditions must be true:
1. RSI(14) crosses above 35 (exits oversold)
2. EMA(9) crosses above EMA(21) on 1h
3. MACD histogram flips from negative to positive
4. Price is above EMA(200) on 4h (macro bull filter)

**Exit:**
- Take Profit: +3%
- Stop Loss: -1.5% (R:R = 1:2)
- Trailing Stop: activates at +1.5%, trails 1% below peak
- Signal exit: RSI > 70 AND MACD declining

**Risk:**
- 2% capital at risk per trade
- Max 2 simultaneous positions
- Circuit breaker at -3% daily loss

## Installation

```bash
# 1. Clone and enter directory
cd crypto_bot

# 2. Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure credentials
cp .env.example .env
# Edit .env with your Binance testnet API keys and Telegram bot token
```

## Configuration

Edit `.env`:
```
BINANCE_TESTNET_API_KEY=xxx
BINANCE_TESTNET_API_SECRET=xxx
TELEGRAM_BOT_TOKEN=xxx       # optional
TELEGRAM_CHAT_ID=xxx         # optional
TRADING_MODE=paper
```

All strategy parameters are in `config.py` – no code changes needed.

## Usage

### 1. Backtest (start here)
```bash
python main.py backtest
```
Downloads 12 months of OHLCV data, runs the strategy, prints metrics and saves an equity curve PNG. **Live trading is only recommended if monthly return ≥ 10%.**

### 2. Paper Trading
```bash
python main.py paper
```
Runs the live loop every 15 minutes using real Binance prices but without real orders. All trades are logged to SQLite. Run for at least 7 days before going live.

### 3. Trade Report
```bash
python main.py report
```
Prints a summary of all closed trades from the database.

### 4. Live Trading
```bash
# Set TRADING_MODE=live in .env first
python main.py live
```
Requires manual confirmation. Only enable after successful backtest AND paper trading.

## Running Tests

```bash
pip install pytest
pytest tests/ -v
```

## Project Structure

```
crypto_bot/
├── config.py               # All parameters
├── main.py                 # CLI entry point
├── core/
│   ├── exchange.py         # ccxt Binance wrapper with retries
│   ├── strategy.py         # Signal generation
│   ├── risk_manager.py     # Position sizing, circuit breaker
│   ├── order_manager.py    # Open/close orchestration
│   └── portfolio.py        # Position tracking
├── indicators/
│   ├── trend.py            # EMA, MACD
│   ├── momentum.py         # RSI, Stochastic
│   └── volatility.py       # ATR, Bollinger Bands
├── backtesting/
│   ├── engine.py           # Walk-forward backtester
│   └── report.py           # Sharpe, Drawdown, Win Rate, equity plot
├── notifications/
│   └── telegram_notifier.py
├── database/
│   └── db_manager.py       # SQLite CRUD
└── tests/
    └── test_strategy.py    # Unit tests
```

## Safety Notes

- Never commit your `.env` file (it's in `.gitignore`)
- Always run paper trading ≥7 days before live
- The circuit breaker halts trading if daily loss exceeds 3%
- Max 2 open positions enforced at all times
- ATR filter blocks trades during abnormally high volatility

## Obtaining API Keys

1. **Binance Testnet:** [testnet.binance.vision](https://testnet.binance.vision) – free, no real money
2. **Telegram Bot:** Message `@BotFather` on Telegram, create a bot, get the token
3. **Chat ID:** Send a message to your bot, then call `https://api.telegram.org/bot<TOKEN>/getUpdates`
