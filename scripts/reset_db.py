#!/usr/bin/env python3
"""
Reset / Purge tool for Sothema ATS database.
Allows quickly clearing low-quality or test CV data while preserving admin accounts.
"""
import argparse
import os
import sqlite3
import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from ats_store import DB_PATH, init_ats_db


def reset_candidates(db_path=DB_PATH, keep_admin=True):
    """Purge all candidate records, skills, and analyses from the database."""
    if not os.path.exists(db_path):
        print(f"Database file not found at: {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        cand_count = cursor.execute("SELECT COUNT(*) FROM ats_candidates").fetchone()[0]
        print(f"Current candidate count: {cand_count}")

        with conn:
            cursor.execute("DELETE FROM ats_candidates")
            cursor.execute("DELETE FROM resume_data")
            cursor.execute("DELETE FROM resume_skills")
            cursor.execute("DELETE FROM resume_analysis")
            cursor.execute("DELETE FROM ats_audit_log WHERE action = 'candidate_ingested'")

            if not keep_admin:
                cursor.execute("DELETE FROM admin")
                cursor.execute("DELETE FROM admin_logs")
                cursor.execute("DELETE FROM ats_audit_log")
                print("Purged admin accounts and full audit log.")

        # Reclaim SQLite disk space (VACUUM must be run outside a transaction)
        conn.execute("VACUUM")

        print("Purge completed successfully.")
        print("Candidate count now: 0")
        if keep_admin:
            admin_rows = cursor.execute("SELECT email FROM admin").fetchall()
            admins = [r[0] for r in admin_rows]
            print(f"Admin accounts preserved: {', '.join(admins) if admins else 'None'}")
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="Purge / Reset Sothema ATS Candidate Database")
    parser.add_argument("--all", action="store_true", help="Delete everything including admin accounts")
    parser.add_argument("--db", type=str, default=str(DB_PATH), help="Path to database file")
    args = parser.parse_args()

    keep_admin = not args.all
    reset_candidates(db_path=args.db, keep_admin=keep_admin)


if __name__ == "__main__":
    main()

