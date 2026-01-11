import argparse
import os

import mysql.connector
from dotenv import load_dotenv


def load_env(env_path: str) -> None:
    load_dotenv(dotenv_path=env_path)


def get_db_config() -> dict:
    config = {
        "host": os.getenv("DB_HOST"),
        "user": os.getenv("DB_USER"),
        "password": os.getenv("DB_PASSWORD"),
        "port": int(os.getenv("DB_PORT", "3306")),
        "database": os.getenv("DB_NAME"),
    }
    missing = [key for key, value in config.items() if value in (None, "")]
    if missing:
        raise ValueError(f"Missing database environment variables: {', '.join(missing)}")
    return config


def ensure_index(cursor, table: str, index_name: str, column: str) -> None:
    cursor.execute(
        """
        SELECT 1
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = %s
          AND index_name = %s
        LIMIT 1
        """,
        (table, index_name),
    )
    if cursor.fetchone():
        return
    cursor.execute(f"CREATE INDEX {index_name} ON {table} ({column})")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create PMID indexes for MeSH term tables."
    )
    parser.add_argument(
        "--env",
        default=".env.local",
        help="Path to the .env.local file with DB credentials.",
    )
    args = parser.parse_args()

    load_env(args.env)
    config = get_db_config()

    conn = mysql.connector.connect(**config)
    try:
        cursor = conn.cursor()
        ensure_index(
            cursor,
            "maternal_database_with_scores",
            "idx_maternal_database_with_scores_pmid",
            "PMID",
        )
        ensure_index(
            cursor,
            "pediatric_database_with_scores",
            "idx_pediatric_database_with_scores_pmid",
            "PMID",
        )
        conn.commit()
        print("PMID indexes ensured for maternal/pediatric MeSH tables.")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
