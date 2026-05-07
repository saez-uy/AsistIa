import asyncio
from loguru import logger

try:
    from telegram import Bot
    from telegram.error import TelegramError
    TELEGRAM_AVAILABLE = True
except ImportError:
    TELEGRAM_AVAILABLE = False

import config


class TelegramNotifier:
    """Send trade and portfolio alerts via Telegram."""

    def __init__(
        self,
        token: str = config.TELEGRAM_BOT_TOKEN,
        chat_id: str = config.TELEGRAM_CHAT_ID,
    ):
        self.token = token
        self.chat_id = chat_id
        self.enabled = bool(token and chat_id and TELEGRAM_AVAILABLE)
        if not self.enabled:
            logger.warning(
                "Telegram notifications disabled "
                "(missing token/chat_id or library not installed)"
            )

    def _send(self, text: str) -> None:
        if not self.enabled:
            logger.debug(f"[Telegram disabled] {text}")
            return

        async def _do_send():
            try:
                bot = Bot(token=self.token)
                await bot.send_message(
                    chat_id=self.chat_id,
                    text=text,
                    parse_mode="HTML",
                )
            except TelegramError as exc:
                logger.warning(f"Telegram send failed: {exc}")

        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(_do_send())
            else:
                loop.run_until_complete(_do_send())
        except Exception as exc:
            logger.warning(f"Telegram event loop error: {exc}")

    # ─── Message templates ───────────────────────────────────────────────────

    def send_trade_open(
        self,
        symbol: str,
        entry_price: float,
        stop_loss: float,
        take_profit: float,
        quantity: float,
    ) -> None:
        mode_tag = f"[{config.TRADING_MODE.upper()}]"
        msg = (
            f"<b>{mode_tag} 🟢 OPEN LONG</b>\n"
            f"Pair: <b>{symbol}</b>\n"
            f"Entry: <code>{entry_price:.4f}</code>\n"
            f"Quantity: <code>{quantity:.6f}</code>\n"
            f"Stop Loss: <code>{stop_loss:.4f}</code> "
            f"(-{config.STOP_LOSS_PCT*100:.1f}%)\n"
            f"Take Profit: <code>{take_profit:.4f}</code> "
            f"(+{config.TAKE_PROFIT_PCT*100:.1f}%)"
        )
        self._send(msg)

    def send_trade_close(
        self,
        symbol: str,
        entry_price: float,
        exit_price: float,
        pnl_usdt: float,
        pnl_pct: float,
        reason: str,
        portfolio_summary: dict,
    ) -> None:
        mode_tag = f"[{config.TRADING_MODE.upper()}]"
        emoji = "🟢" if pnl_usdt >= 0 else "🔴"
        reason_labels = {
            "tp": "Take Profit",
            "sl": "Stop Loss",
            "trailing": "Trailing Stop",
            "signal": "Inverse Signal",
        }
        reason_label = reason_labels.get(reason, reason)
        msg = (
            f"<b>{mode_tag} {emoji} CLOSE LONG</b>\n"
            f"Pair: <b>{symbol}</b>\n"
            f"Entry: <code>{entry_price:.4f}</code>\n"
            f"Exit: <code>{exit_price:.4f}</code>\n"
            f"PnL: <b>{pnl_usdt:+.2f} USDT ({pnl_pct:+.2f}%)</b>\n"
            f"Reason: {reason_label}\n"
            f"─────────────────\n"
            f"Portfolio:\n"
            f"  Capital: <code>{portfolio_summary['capital']:.2f} USDT</code>\n"
            f"  Total Return: <code>{portfolio_summary['total_return_pct']:+.2f}%</code>"
        )
        self._send(msg)

    def send_alert(self, message: str) -> None:
        self._send(f"⚠️ <b>ALERT</b>\n{message}")

    def send_daily_report(self, summary: dict) -> None:
        msg = (
            f"<b>📊 Daily Report</b>\n"
            f"Capital: <code>{summary['capital']:.2f} USDT</code>\n"
            f"Total Return: <code>{summary['total_return_pct']:+.2f}%</code>\n"
            f"Open Positions: {summary['open_positions']}\n"
            f"Daily Loss: <code>{summary.get('daily_loss_pct', 0):.2f}%</code>"
        )
        self._send(msg)
