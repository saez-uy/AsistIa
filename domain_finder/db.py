"""
db.py — SQLite setup and helpers
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "dominios.db")


def get_conn():
    return sqlite3.connect(DB_PATH)


def init_db():
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS dominios (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                dominio          TEXT    UNIQUE NOT NULL,
                fecha_expiracion TEXT,
                tiene_marca      INTEGER,          -- 0=no, 1=si, NULL=no verificado
                score            REAL,
                razon_descarte   TEXT,
                fecha_analisis   TEXT
            )
        """)
        conn.commit()


def upsert_domain(dominio: str, fecha_expiracion: str):
    """Insert domain if not exists; ignore if already there."""
    with get_conn() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO dominios (dominio, fecha_expiracion) VALUES (?, ?)",
            (dominio.lower().strip(), fecha_expiracion),
        )
        conn.commit()


def update_trademark(dominio: str, tiene_marca: bool, razon: str = None):
    with get_conn() as conn:
        conn.execute(
            "UPDATE dominios SET tiene_marca=?, razon_descarte=? WHERE dominio=?",
            (int(tiene_marca), razon, dominio.lower().strip()),
        )
        conn.commit()


def update_score(dominio: str, score: float, fecha_analisis: str):
    with get_conn() as conn:
        conn.execute(
            "UPDATE dominios SET score=?, fecha_analisis=? WHERE dominio=?",
            (score, fecha_analisis, dominio.lower().strip()),
        )
        conn.commit()


def get_candidates():
    """Return domains NOT discarded (tiene_marca = 0 or NULL) with score, ordered desc."""
    with get_conn() as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.execute("""
            SELECT dominio, fecha_expiracion, tiene_marca, score, razon_descarte, fecha_analisis
            FROM dominios
            WHERE (tiene_marca IS NULL OR tiene_marca = 0)
            ORDER BY score DESC NULLS LAST
            LIMIT 20
        """)
        return [dict(r) for r in cur.fetchall()]


def get_all():
    with get_conn() as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.execute("SELECT * FROM dominios")
        return [dict(r) for r in cur.fetchall()]
