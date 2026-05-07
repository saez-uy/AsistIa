import sqlite3
import pandas as pd
from datetime import datetime
from loguru import logger
import config


CREATE_TRADES_TABLE = """
CREATE TABLE IF NOT EXISTS trades (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp   DATETIME DEFAULT (datetime('now')),
    symbol      TEXT     NOT NULL,
    side        TEXT     NOT NULL,
    entry_price REAL,
    exit_price  REAL,
    quantity    REAL,
    pnl_usdt    REAL,
    pnl_pct     REAL,
    exit_reason TEXT,
    mode        TEXT     NOT NULL,
    open_trade_id INTEGER
);
"""

CREATE_EQUITY_TABLE = """
CREATE TABLE IF NOT EXISTS equity_curve (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT (datetime('now')),
    capital   REAL     NOT NULL,
    mode      TEXT     NOT NULL
);
"""


class DBManager:
    def __init__(self, db_path: str = config.DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(CREATE_TRADES_TABLE)
            conn.execute(CREATE_EQUITY_TABLE)
        logger.debug(f"Database ready at {self.db_path}")

    # ─── Trades ──────────────────────────────────────────────────────────────

    def insert_trade_open(
        self,
        symbol: str,
        side: str,
        entry_price: float,
        quantity: float,
        mode: str,
    ) -> int:
        with self._connect() as conn:
            cur = conn.execute(
                """INSERT INTO trades (symbol, side, entry_price, quantity, mode)
                   VALUES (?, ?, ?, ?, ?)""",
                (symbol, side, entry_price, quantity, mode),
            )
            trade_id = cur.lastrowid
        logger.debug(f"DB: opened trade #{trade_id} for {symbol}")
        return trade_id

    def update_trade_close(
        self,
        symbol: str,
        exit_price: float,
        pnl_usdt: float,
        pnl_pct: float,
        exit_reason: str,
    ) -> None:
        with self._connect() as conn:
            conn.execute(
                """UPDATE trades
                   SET exit_price = ?, pnl_usdt = ?, pnl_pct = ?,
                       exit_reason = ?, timestamp = datetime('now')
                   WHERE symbol = ? AND exit_price IS NULL
                   ORDER BY id DESC LIMIT 1""",
                (exit_price, pnl_usdt, pnl_pct, exit_reason, symbol),
            )
        logger.debug(f"DB: closed trade for {symbol} | PnL={pnl_usdt:+.2f}")

    def insert_backtest_trade(self, trade: dict) -> None:
        with self._connect() as conn:
            conn.execute(
                """INSERT INTO trades
                   (timestamp, symbol, side, entry_price, exit_price,
                    quantity, pnl_usdt, pnl_pct, exit_reason, mode)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    str(trade.get("exit_time", "")),
                    trade["symbol"],
                    "buy",
                    trade["entry_price"],
                    trade["exit_price"],
                    trade["quantity"],
                    trade["pnl_usdt"],
                    trade["pnl_pct"],
                    trade["exit_reason"],
                    "backtest",
                ),
            )

    def get_all_trades(self, mode: str = None) -> pd.DataFrame:
        query = "SELECT * FROM trades"
        params: tuple = ()
        if mode:
            query += " WHERE mode = ?"
            params = (mode,)
        with self._connect() as conn:
            return pd.read_sql_query(query, conn, params=params)

    def get_open_trades(self) -> list[dict]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM trades WHERE exit_price IS NULL ORDER BY id"
            ).fetchall()
        return [dict(r) for r in rows]

    # ─── Equity curve ────────────────────────────────────────────────────────

    def log_equity(self, capital: float, mode: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO equity_curve (capital, mode) VALUES (?, ?)",
                (capital, mode),
            )

    def get_equity_curve(self, mode: str = None) -> pd.DataFrame:
        query = "SELECT * FROM equity_curve"
        params: tuple = ()
        if mode:
            query += " WHERE mode = ?"
            params = (mode,)
        with self._connect() as conn:
            return pd.read_sql_query(query, conn, params=params)
