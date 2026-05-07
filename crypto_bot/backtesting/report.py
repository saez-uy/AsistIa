import numpy as np
import pandas as pd
from loguru import logger
import config

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.dates as mdates
    MPL_AVAILABLE = True
except ImportError:
    MPL_AVAILABLE = False


def compute_metrics(
    trades: list[dict],
    equity_curve: list[float],
    initial_capital: float = config.INITIAL_CAPITAL,
    periods_per_year: int = 8760,  # hourly candles
) -> dict:
    if not trades:
        return {"error": "No trades executed"}

    df = pd.DataFrame(trades)
    pnl = df["pnl_usdt"].values
    pnl_pct = df["pnl_pct"].values / 100  # to decimal

    wins = pnl[pnl > 0]
    losses = pnl[pnl < 0]

    win_rate = len(wins) / len(pnl)
    avg_win = float(wins.mean()) if len(wins) else 0.0
    avg_loss = float(losses.mean()) if len(losses) else 0.0
    profit_factor = (
        float(wins.sum() / abs(losses.sum()))
        if losses.sum() != 0
        else float("inf")
    )

    # Equity drawdown
    eq = np.array(equity_curve)
    peak = np.maximum.accumulate(eq)
    drawdown = (eq - peak) / peak
    max_drawdown = float(drawdown.min())

    # Sharpe (annualised, assuming 0% risk-free rate)
    returns = np.diff(eq) / eq[:-1]
    sharpe = (
        float(returns.mean() / returns.std() * np.sqrt(periods_per_year))
        if returns.std() > 0
        else 0.0
    )

    total_return = (equity_curve[-1] - initial_capital) / initial_capital
    try:
        t_end = pd.to_datetime(df["exit_time"]).max()
        t_start = pd.to_datetime(df["entry_time"]).min()
        n_months = max((t_end - t_start).days / 30, 1)
    except Exception:
        n_months = 1
    monthly_return = (1 + total_return) ** (1 / n_months) - 1

    metrics = {
        "total_trades": len(trades),
        "win_rate": round(win_rate * 100, 2),
        "avg_win_usdt": round(avg_win, 2),
        "avg_loss_usdt": round(avg_loss, 2),
        "profit_factor": round(profit_factor, 2),
        "max_drawdown_pct": round(max_drawdown * 100, 2),
        "sharpe_ratio": round(sharpe, 2),
        "total_return_pct": round(total_return * 100, 2),
        "monthly_return_pct": round(monthly_return * 100, 2),
        "final_capital": round(equity_curve[-1], 2),
        "approved_for_live": monthly_return >= config.BACKTEST_MIN_MONTHLY_RETURN,
    }

    _print_report(metrics)
    return metrics


def _print_report(m: dict) -> None:
    approved = "✅ APPROVED" if m.get("approved_for_live") else "❌ NOT APPROVED"
    logger.info(
        f"\n{'='*50}\n"
        f"  BACKTEST REPORT\n"
        f"{'='*50}\n"
        f"  Total trades   : {m['total_trades']}\n"
        f"  Win rate       : {m['win_rate']}%\n"
        f"  Profit factor  : {m['profit_factor']}\n"
        f"  Avg win        : {m['avg_win_usdt']:+.2f} USDT\n"
        f"  Avg loss       : {m['avg_loss_usdt']:+.2f} USDT\n"
        f"  Max drawdown   : {m['max_drawdown_pct']:.2f}%\n"
        f"  Sharpe ratio   : {m['sharpe_ratio']}\n"
        f"  Total return   : {m['total_return_pct']:+.2f}%\n"
        f"  Monthly return : {m['monthly_return_pct']:+.2f}%\n"
        f"  Final capital  : {m['final_capital']:.2f} USDT\n"
        f"  Live trading   : {approved}\n"
        f"{'='*50}"
    )


def plot_equity_curve(
    equity_curve: list[float],
    symbol: str,
    output_path: str = "backtest_equity.png",
) -> None:
    if not MPL_AVAILABLE:
        logger.warning("matplotlib not available, skipping equity plot")
        return

    fig, ax = plt.subplots(figsize=(12, 5))
    ax.plot(equity_curve, linewidth=1.5, color="#2196F3", label="Portfolio Value")
    ax.axhline(
        y=equity_curve[0], color="gray", linestyle="--", linewidth=0.8, label="Initial Capital"
    )
    ax.fill_between(
        range(len(equity_curve)),
        equity_curve[0],
        equity_curve,
        where=[v >= equity_curve[0] for v in equity_curve],
        alpha=0.15,
        color="green",
        label="Profit",
    )
    ax.fill_between(
        range(len(equity_curve)),
        equity_curve[0],
        equity_curve,
        where=[v < equity_curve[0] for v in equity_curve],
        alpha=0.15,
        color="red",
        label="Loss",
    )
    ax.set_title(f"Equity Curve – {symbol}", fontsize=14)
    ax.set_xlabel("Candle (1h)")
    ax.set_ylabel("Portfolio Value (USDT)")
    ax.legend()
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(output_path, dpi=150)
    plt.close()
    logger.info(f"Equity curve saved to {output_path}")
