#!/usr/bin/env python3
"""
Crypto Trading Bot – Entry Point
Usage:
  python main.py backtest          # run backtesting on all configured symbols
  python main.py paper             # start paper trading loop
  python main.py live              # start live trading (requires backtest approval)
  python main.py report            # print DB trade statistics
"""

import sys
import os
import time
import argparse
from datetime import datetime

from loguru import logger

import config

# ─── Logging setup ───────────────────────────────────────────────────────────

os.makedirs(os.path.dirname(config.LOG_FILE), exist_ok=True)
logger.remove()
logger.add(sys.stderr, level=config.LOG_LEVEL, colorize=True)
logger.add(
    config.LOG_FILE,
    level="DEBUG",
    rotation=config.LOG_ROTATION,
    enqueue=True,
)


def run_backtest(symbols: list[str] = None) -> dict:
    """Download data and run backtest for all symbols. Returns metrics per symbol."""
    from core.exchange import ExchangeWrapper
    from backtesting.engine import BacktestEngine
    from backtesting.report import compute_metrics, plot_equity_curve
    from database.db_manager import DBManager

    symbols = symbols or config.SYMBOLS
    exchange = ExchangeWrapper()
    db = DBManager()
    results = {}

    for symbol in symbols:
        logger.info(f"── Backtesting {symbol} ──")
        df_1h = exchange.fetch_ohlcv_full_history(
            symbol, config.SIGNAL_TIMEFRAME, months=config.BACKTEST_MONTHS
        )
        df_4h = exchange.fetch_ohlcv_full_history(
            symbol, config.MACRO_TIMEFRAME, months=config.BACKTEST_MONTHS
        )

        if df_1h.empty or len(df_1h) < 500:
            logger.warning(f"Insufficient data for {symbol}, skipping")
            continue

        engine = BacktestEngine(symbol, df_1h, df_4h)
        trades = engine.run()
        metrics = compute_metrics(trades, engine.equity_curve)

        for trade in trades:
            db.insert_backtest_trade(trade)

        plot_equity_curve(
            engine.equity_curve,
            symbol,
            output_path=f"backtest_{symbol.replace('/', '_')}.png",
        )
        results[symbol] = metrics

    return results


def run_paper_trading() -> None:
    """Paper trading main loop – runs indefinitely every LOOP_INTERVAL_MINUTES."""
    from core.exchange import ExchangeWrapper
    from core.portfolio import Portfolio
    from core.risk_manager import RiskManager
    from core.order_manager import OrderManager
    from core.strategy import prepare_dataframe, evaluate_entry
    from database.db_manager import DBManager
    from notifications.telegram_notifier import TelegramNotifier

    logger.info("=" * 60)
    logger.info("  PAPER TRADING MODE STARTED")
    logger.info("=" * 60)

    exchange = ExchangeWrapper()
    portfolio = Portfolio()
    risk = RiskManager()
    db = DBManager()
    notifier = TelegramNotifier()
    order_mgr = OrderManager(exchange, portfolio, risk, db, notifier)

    notifier.send_alert(
        f"🤖 Paper trading bot started\n"
        f"Capital: {config.INITIAL_CAPITAL} USDT\n"
        f"Symbols: {', '.join(config.SYMBOLS)}"
    )

    last_daily_reset = datetime.utcnow().date()

    while True:
        loop_start = time.time()

        # Daily reset
        today = datetime.utcnow().date()
        if today != last_daily_reset:
            risk.reset_daily_stats()
            last_daily_reset = today
            notifier.send_daily_report(
                {**risk.summary(), "open_positions": len(portfolio.positions)}
            )

        current_prices: dict[str, float] = {}
        df_map: dict = {}

        for symbol in config.SYMBOLS:
            try:
                ticker = exchange.fetch_ticker(symbol)
                current_prices[symbol] = float(ticker["last"])

                df_1h = exchange.fetch_ohlcv(symbol, config.SIGNAL_TIMEFRAME, limit=600)
                df_4h = exchange.fetch_ohlcv(symbol, config.MACRO_TIMEFRAME, limit=300)
                df = prepare_dataframe(df_1h, df_4h)
                df_map[symbol] = df

            except Exception as exc:
                logger.error(f"Error fetching data for {symbol}: {exc}")
                continue

        # Manage exits on open positions
        order_mgr.manage_open_positions(current_prices, df_map)

        # Evaluate entries
        for symbol in config.SYMBOLS:
            if symbol in portfolio.positions:
                continue
            df = df_map.get(symbol)
            if df is None:
                continue

            try:
                signal = evaluate_entry(df)
                signal.symbol = symbol
                if signal.action == "buy":
                    price = current_prices.get(symbol, 0)
                    order_mgr.open_long(symbol, price)
            except Exception as exc:
                logger.error(f"Error evaluating entry for {symbol}: {exc}")

        # Log equity snapshot
        total_value = portfolio.total_value(current_prices)
        db.log_equity(total_value, mode="paper")
        logger.info(
            f"Loop complete | Capital: {risk.capital:.2f} USDT | "
            f"Portfolio: {total_value:.2f} USDT | "
            f"Open: {list(portfolio.positions.keys())}"
        )

        elapsed = time.time() - loop_start
        sleep_secs = max(0, config.LOOP_INTERVAL_MINUTES * 60 - elapsed)
        logger.debug(f"Sleeping {sleep_secs:.0f}s until next loop")
        time.sleep(sleep_secs)


def run_live_trading() -> None:
    """Live trading – only start after backtest and paper trading approval."""
    logger.critical(
        "Live trading mode requested. "
        "Ensure backtest AND paper trading show positive results first."
    )
    answer = input("Type 'CONFIRM LIVE' to proceed: ")
    if answer.strip() != "CONFIRM LIVE":
        logger.info("Live trading aborted by user")
        return

    # Reuse paper trading loop with live mode (config should have TRADING_MODE=live)
    if config.TRADING_MODE != "live":
        logger.error("Set TRADING_MODE=live in .env before starting live trading")
        return
    run_paper_trading()


def run_report() -> None:
    from database.db_manager import DBManager
    import pandas as pd

    db = DBManager()
    for mode in ("paper", "live", "backtest"):
        df = db.get_all_trades(mode=mode)
        if df.empty:
            continue
        closed = df[df["exit_price"].notna()]
        if closed.empty:
            continue
        total_pnl = closed["pnl_usdt"].sum()
        win_rate = (closed["pnl_usdt"] > 0).mean() * 100
        logger.info(
            f"\n[{mode.upper()}] {len(closed)} closed trades | "
            f"PnL: {total_pnl:+.2f} USDT | Win rate: {win_rate:.1f}%"
        )


# ─── CLI ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Crypto Trading Bot")
    parser.add_argument(
        "command",
        choices=["backtest", "paper", "live", "report"],
        help="Command to run",
    )
    parser.add_argument(
        "--symbols",
        nargs="+",
        default=None,
        help="Override symbols, e.g. --symbols BTC/USDT ETH/USDT",
    )
    args = parser.parse_args()

    if args.command == "backtest":
        results = run_backtest(args.symbols)
        approved = all(m.get("approved_for_live", False) for m in results.values())
        if approved:
            logger.info("All symbols APPROVED for paper/live trading")
        else:
            logger.warning("Some symbols did NOT meet the 10% monthly target")

    elif args.command == "paper":
        run_paper_trading()

    elif args.command == "live":
        run_live_trading()

    elif args.command == "report":
        run_report()


if __name__ == "__main__":
    main()
