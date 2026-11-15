
"""
Field Sync Server + Vanish Class Network

Field Sync endpoints:
  GET  /health
  POST /sync/push
  GET  /sync/pull?since=<cursor>
  GET  /records/{record_id}

Vanish Class Network:
  WS   /ws

Important:
  Field Sync data is stored in SQLite.
  Vanish chat messages are handled separately in memory
  by vanish_relay.py. They are not stored in the Field Sync database.
"""

import json
import sqlite3
from contextlib import contextmanager
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# Import the Vanish WebSocket router
from vanish_relay import router as vanish_router


# ---------- configuration ----------

DB_PATH = "server.db"
PULL_PAGE_SIZE = 100


# ---------- FastAPI application ----------

app = FastAPI(title="Field Sync Server + Vanish Class Network")

# Register the Vanish WebSocket endpoint: /ws
app.include_router(vanish_router)


# ---------- database helpers ----------

@contextmanager
def db_conn():
    """One connection per request block. Commits on success, rolls back on error."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    try:
        yield conn
        conn.commit()

    except Exception:
        conn.rollback()
        raise

    finally:
        conn.close()


def init_db() -> None:
    with db_conn() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS records (
                id      TEXT PRIMARY KEY,
                data    TEXT NOT NULL,
                version INTEGER NOT NULL,
                seq     INTEGER NOT NULL
            )
        """)

        db.execute("""
            CREATE INDEX IF NOT EXISTS idx_records_seq
            ON records(seq)
        """)

        db.execute("""
            CREATE TABLE IF NOT EXISTS counters (
                name  TEXT PRIMARY KEY,
                value INTEGER NOT NULL
            )
        """)

        db.execute("""
            INSERT OR IGNORE INTO counters(name, value)
            VALUES ('seq', 0)
        """)


def next_seq(db: sqlite3.Connection) -> int:
    db.execute(
        "UPDATE counters SET value = value + 1 WHERE name = 'seq'"
    )

    return db.execute(
        "SELECT value FROM counters WHERE name = 'seq'"
    ).fetchone()[0]


def row_to_record(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "data": json.loads(row["data"]),
        "version": row["version"],
        "seq": row["seq"],
    }


# Initialize the original Field Sync database
init_db()


# ---------- request models ----------

class Change(BaseModel):
    id: str
    base_version: int
    data: dict[str, Any]
    push_id: Optional[str] = None


class PushRequest(BaseModel):
    device_id: str
    changes: list[Change]


# ---------- original Field Sync endpoints ----------

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/records/{record_id}")
def get_record(record_id: str):
    with db_conn() as db:
        row = db.execute(
            "SELECT * FROM records WHERE id = ?",
            (record_id,)
        ).fetchone()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="record not found"
        )

    return row_to_record(row)


@app.post("/sync/push")
def push(req: PushRequest):
    accepted: list[dict[str, Any]] = []
    conflicts: list[dict[str, Any]] = []

    with db_conn() as db:
        for change in req.changes:

            row = db.execute(
                "SELECT * FROM records WHERE id = ?",
                (change.id,)
            ).fetchone()

            server_version = row["version"] if row else 0

            if change.base_version == server_version:

                new_version = server_version + 1
                seq = next_seq(db)

                db.execute(
                    """
                    INSERT OR REPLACE INTO records
                    (id, data, version, seq)
                    VALUES (?, ?, ?, ?)
                    """,
                    (
                        change.id,
                        json.dumps(change.data),
                        new_version,
                        seq
                    )
                )

                accepted.append({
                    "id": change.id,
                    "version": new_version
                })

            else:
                conflicts.append({
                    "id": change.id,
                    "client_base_version": change.base_version,
                    "server": row_to_record(row) if row else None,
                })

    return {
        "accepted": accepted,
        "conflicts": conflicts
    }


@app.get("/sync/pull")
def pull(since: int = 0):
    with db_conn() as db:
        rows = db.execute(
            """
            SELECT * FROM records
            WHERE seq > ?
            ORDER BY seq
            LIMIT ?
            """,
            (since, PULL_PAGE_SIZE)
        ).fetchall()

    records = [row_to_record(row) for row in rows]

    cursor = records[-1]["seq"] if records else since

    return {
        "records": records,
        "cursor": cursor,
        "has_more": len(records) == PULL_PAGE_SIZE,
    }


# ---------- Vanish Class Network ----------

# WebSocket endpoint is registered through vanish_router.
# Its route is:
# ws://<server-address>/ws
#
# Chat messages are managed by vanish_relay.py in memory.
# They are separate from the SQLite Field Sync records.
