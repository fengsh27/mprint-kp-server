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


def create_table(cursor) -> None:
    create_sql = """
    CREATE TABLE IF NOT EXISTS cache_full_study (
      PMID VARCHAR(64) PRIMARY KEY,
      Year VARCHAR(64),
      Title TEXT,
      StudyType TEXT,
      Population TEXT,
      StudiedDrugs TEXT,
      StudiedDiseases TEXT,
      maternal_Score_PK FLOAT,
      maternal_Score_PE FLOAT,
      maternal_Score_CT FLOAT,
      pediatric_Score_PK FLOAT,
      pediatric_Score_PE FLOAT,
      pediatric_Score_CT FLOAT
    )
    """
    cursor.execute(create_sql)


def ensure_columns(cursor) -> None:
    column_defs = {
        "PMID": "VARCHAR(64)",
        "Year": "VARCHAR(64)",
        "Title": "TEXT",
        "StudyType": "TEXT",
        "Population": "TEXT",
        "StudiedDrugs": "TEXT",
        "StudiedDiseases": "TEXT",
        "maternal_Score_PK": "FLOAT",
        "maternal_Score_PE": "FLOAT",
        "maternal_Score_CT": "FLOAT",
        "pediatric_Score_PK": "FLOAT",
        "pediatric_Score_PE": "FLOAT",
        "pediatric_Score_CT": "FLOAT",
    }
    for column, definition in column_defs.items():
        cursor.execute(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'cache_full_study'
              AND column_name = %s
            LIMIT 1
            """,
            (column,),
        )
        exists = cursor.fetchone()
        if not exists:
            cursor.execute(f"ALTER TABLE cache_full_study ADD COLUMN {column} {definition}")

def ensure_indexes(cursor) -> None:
    index_specs = [
        ("new_pubmed_records", "idx_new_pubmed_records_pmid", "pmid"),
        ("new_study_type", "idx_new_study_type_pmid_type", "pmid, type"),
        ("new_pmid2drug", "idx_new_pmid2drug_pmid", "pmid"),
        ("new_pmid2disease", "idx_new_pmid2disease_pmid", "pmid"),
        ("new_population", "idx_new_population_pmid", "pmid"),
        ("maternal_database_with_scores", "idx_maternal_scores_pmid", "PMID"),
        ("pediatric_database_with_scores", "idx_pediatric_scores_pmid", "PMID"),
    ]

    for table, index_name, columns in index_specs:
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
        exists = cursor.fetchone()
        if not exists:
            cursor.execute(f"CREATE INDEX {index_name} ON {table} ({columns})")


def create_aggregate_tables(cursor) -> None:
    cursor.execute("DROP TEMPORARY TABLE IF EXISTS temp_study_type")
    cursor.execute("DROP TEMPORARY TABLE IF EXISTS temp_drug")
    cursor.execute("DROP TEMPORARY TABLE IF EXISTS temp_disease")
    cursor.execute("DROP TEMPORARY TABLE IF EXISTS temp_pmids")
    cursor.execute("DROP TEMPORARY TABLE IF EXISTS temp_population")

    cursor.execute(
        """
        CREATE TEMPORARY TABLE temp_study_type AS
        SELECT pmid, GROUP_CONCAT(DISTINCT type SEPARATOR ' / ') AS StudyType
        FROM new_study_type
        WHERE type IN ('PK', 'PE', 'CT')
        GROUP BY pmid
        """
    )
    cursor.execute("CREATE INDEX idx_temp_study_type_pmid ON temp_study_type (pmid)")

    cursor.execute(
        """
        CREATE TEMPORARY TABLE temp_population AS
        SELECT pmid, GROUP_CONCAT(DISTINCT type SEPARATOR ' / ') AS Population
        FROM new_population
        GROUP BY pmid
        """
    )
    cursor.execute("CREATE INDEX idx_temp_population_pmid ON temp_population (pmid)")

    cursor.execute(
        """
        CREATE TEMPORARY TABLE temp_drug AS
        SELECT pmid, GROUP_CONCAT(DISTINCT text SEPARATOR ' / ') AS StudiedDrugs
        FROM new_pmid2drug
        GROUP BY pmid
        """
    )
    cursor.execute("CREATE INDEX idx_temp_drug_pmid ON temp_drug (pmid)")

    cursor.execute(
        """
        CREATE TEMPORARY TABLE temp_disease AS
        SELECT pmid,
          GROUP_CONCAT(DISTINCT CASE
            WHEN text != 'NA' AND text IS NOT NULL THEN text
          END SEPARATOR ' / ') AS StudiedDiseases
        FROM new_pmid2disease
        GROUP BY pmid
        """
    )
    cursor.execute("CREATE INDEX idx_temp_disease_pmid ON temp_disease (pmid)")

    cursor.execute(
        """
        CREATE TEMPORARY TABLE temp_pmids AS
        SELECT pmid FROM temp_study_type
        """
    )
    cursor.execute("CREATE INDEX idx_temp_pmids_pmid ON temp_pmids (pmid)")


def populate_cache(cursor, batch_size: int) -> None:
    cursor.execute("SELECT COUNT(*) FROM temp_pmids")
    total_rows = cursor.fetchone()[0]
    offset = 0

    insert_sql = """
    INSERT INTO cache_full_study (
      PMID,
      Year,
      Title,
      StudyType,
      Population,
      StudiedDrugs,
      StudiedDiseases,
      maternal_Score_PK,
      maternal_Score_PE,
      maternal_Score_CT,
      pediatric_Score_PK,
      pediatric_Score_PE,
      pediatric_Score_CT
    )
    SELECT
      p.pmid AS PMID,
      p.pubdate AS Year,
      MAX(p.title) AS Title,
      st.StudyType AS StudyType,
      pop.Population AS Population,
      td.StudiedDrugs AS StudiedDrugs,
      tdi.StudiedDiseases AS StudiedDiseases,
      MAX(m.Score_PK) AS maternal_Score_PK,
      MAX(m.Score_PE) AS maternal_Score_PE,
      MAX(m.Score_CT) AS maternal_Score_CT,
      MAX(ped.Score_PK) AS pediatric_Score_PK,
      MAX(ped.Score_PE) AS pediatric_Score_PE,
      MAX(ped.Score_CT) AS pediatric_Score_CT
    FROM (
      SELECT pmid
      FROM temp_pmids
      ORDER BY pmid
      LIMIT %s OFFSET %s
    ) batch
    JOIN new_pubmed_records p ON p.pmid = batch.pmid
    JOIN temp_study_type st ON p.pmid = st.pmid
    LEFT JOIN temp_population pop ON p.pmid = pop.pmid
    LEFT JOIN temp_drug td ON p.pmid = td.pmid
    LEFT JOIN temp_disease tdi ON p.pmid = tdi.pmid
    LEFT JOIN maternal_database_with_scores m ON p.pmid = m.PMID
    LEFT JOIN pediatric_database_with_scores ped ON p.pmid = ped.PMID
    GROUP BY p.pmid, p.pubdate, st.StudyType, pop.Population, td.StudiedDrugs, tdi.StudiedDiseases
    """

    while offset < total_rows:
        cursor.execute(insert_sql, (batch_size, offset))
        offset += batch_size


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create and populate cache_full_study table."
    )
    parser.add_argument(
        "--env",
        default=".env.local",
        help="Path to the .env.local file with DB credentials.",
    )
    parser.add_argument(
        "--truncate",
        action="store_true",
        help="Truncate the cache table before inserting data.",
    )
    parser.add_argument(
        "--group-concat-max-len",
        type=int,
        default=100000,
        help="Session group_concat_max_len value.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=50000,
        help="Number of PMIDs per batch insert.",
    )
    args = parser.parse_args()

    load_env(args.env)
    config = get_db_config()

    conn = mysql.connector.connect(**config)
    try:
        cursor = conn.cursor()
        cursor.execute(f"SET SESSION group_concat_max_len = {args.group_concat_max_len}")
        ensure_indexes(cursor)
        create_table(cursor)
        ensure_columns(cursor)
        if args.truncate:
            cursor.execute("TRUNCATE TABLE cache_full_study")
        create_aggregate_tables(cursor)
        populate_cache(cursor, args.batch_size)
        conn.commit()
        print("cache_full_study table populated.")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
