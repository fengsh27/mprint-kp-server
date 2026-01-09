import argparse
import os
import re
from typing import Iterable, List, Tuple

import pandas as pd
import mysql.connector
from dotenv import load_dotenv


COLUMN_DEFINITIONS = [
    ("Position", "VARCHAR(64)"),
    ("PMID", "VARCHAR(64)"),
    ("Title", "TEXT"),
    ("Year", "VARCHAR(64)"),
    ("Language", "VARCHAR(255)"),
    ("Abstract", "TEXT"),
    ("MeSH_terms_Descriptor", "TEXT"),
    ("MeSH_terms_Qualifier", "TEXT"),
    ("Publication_types", "TEXT"),
    ("Keywords", "TEXT"),
    ("drug_list", "TEXT"),
    ("id_list", "TEXT"),
    ("maternal_keyword", "TEXT"),
    ("maternal_mesh", "TEXT"),
    ("potential_kw", "TEXT"),
    ("Biomarker_pred", "FLOAT"),
    ("CT_pred", "FLOAT"),
    ("FBNSTP_pred", "FLOAT"),
    ("PE_pred", "FLOAT"),
    ("PK_pred", "FLOAT"),
    ("VC_pred", "FLOAT"),
    ("relevance_pred", "FLOAT"),
    ("precalc_vector", "TEXT"),
    ("Score_CT", "FLOAT"),
    ("Score_PK", "FLOAT"),
    ("Score_PE", "FLOAT"),
]

FLOAT_COLUMNS = {
    "Biomarker_pred",
    "CT_pred",
    "FBNSTP_pred",
    "PE_pred",
    "PK_pred",
    "VC_pred",
    "relevance_pred",
    "Score_CT",
    "Score_PK",
    "Score_PE",
}

REQUIRED_COLUMNS = {"PMID"}

CSV_TO_DB_COLUMN_MAP = {
    "position": "Position",
    "pmid": "PMID",
    "title": "Title",
    "year": "Year",
    "language": "Language",
    "abstract": "Abstract",
    "meshterms(descriptor)": "MeSH_terms_Descriptor",
    "meshterms(qualifier)": "MeSH_terms_Qualifier",
    "publicationtypes": "Publication_types",
    "keywords": "Keywords",
    "drug_list": "drug_list",
    "id_list": "id_list",
    "maternal_keyword": "maternal_keyword",
    "maternal_mesh": "maternal_mesh",
    "potential_kw": "potential_kw",
    "biomarker_pred": "Biomarker_pred",
    "ct_pred": "CT_pred",
    "fbnstp_pred": "FBNSTP_pred",
    "pe_pred": "PE_pred",
    "pk_pred": "PK_pred",
    "vc_pred": "VC_pred",
    "relevance_pred": "relevance_pred",
    "precalc_vector": "precalc_vector",
    "score_ct": "Score_CT",
    "score_pk": "Score_PK",
    "score_pe": "Score_PE",
}


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


def normalize_header(name: str) -> str:
    return re.sub(r"\s+", "", name).lower()


def prepare_chunk(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    rename_map = {}
    for col in df.columns:
        normalized = normalize_header(col)
        mapped = CSV_TO_DB_COLUMN_MAP.get(normalized)
        if mapped:
            rename_map[col] = mapped
    if rename_map:
        df = df.rename(columns=rename_map)

    df = df.replace(r"^\s*$", None, regex=True)
    for col in FLOAT_COLUMNS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
            df[col] = df[col].astype(object).where(pd.notna(df[col]), None)
    df = df.where(pd.notna(df), None)

    dropped = 0
    for col in REQUIRED_COLUMNS:
        if col in df.columns:
            before = len(df)
            df = df[df[col].notna()]
            dropped += before - len(df)
    return df, dropped


def read_csv_chunks(csv_path: str, chunksize: int) -> Iterable[pd.DataFrame]:
    return pd.read_csv(csv_path, dtype=str, chunksize=chunksize)


def create_table(cursor) -> None:
    columns_sql = ",\n  ".join(f"`{name}` {definition}" for name, definition in COLUMN_DEFINITIONS)
    create_sql = f"""
    CREATE TABLE IF NOT EXISTS maternal_database_with_scores (
      {columns_sql},
      UNIQUE KEY `uniq_pmid` (`PMID`)
    )
    """
    cursor.execute(create_sql)


def chunked_rows(rows: Iterable[Tuple], size: int) -> Iterable[List[Tuple]]:
    batch = []
    for row in rows:
        batch.append(row)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch


def insert_rows(cursor, df: pd.DataFrame, batch_size: int) -> int:
    columns = [name for name, _ in COLUMN_DEFINITIONS]
    missing_cols = [col for col in columns if col not in df.columns]
    if missing_cols:
        raise ValueError(f"CSV is missing columns: {', '.join(missing_cols)}")

    placeholders = ", ".join(["%s"] * len(columns))
    columns_sql = ", ".join(f"`{col}`" for col in columns)
    insert_sql = (
        f"INSERT IGNORE INTO maternal_database_with_scores ({columns_sql}) "
        f"VALUES ({placeholders})"
    )

    total_inserted = 0
    df = df.drop_duplicates(subset=["PMID"])
    rows = df[columns].itertuples(index=False, name=None)
    for batch in chunked_rows(rows, batch_size):
        cursor.executemany(insert_sql, batch)
        total_inserted += len(batch)
    return total_inserted


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Load maternal_database_with_scores data from csv file into MySQL."
    )
    parser.add_argument(
        "--csv",
        default="~/temp/maternal_database_with_scores.csv",
        help="Path to the CSV file.",
    )
    parser.add_argument(
        "--env",
        default=".env.local",
        help="Path to the .env.local file with DB credentials.",
    )
    parser.add_argument(
        "--truncate",
        action="store_true",
        help="Truncate the target table before inserting data.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=1000,
        help="Number of rows per batch insert.",
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=50000,
        help="Number of CSV rows per read chunk.",
    )
    args = parser.parse_args()

    load_env(args.env)
    config = get_db_config()
    conn = mysql.connector.connect(**config)
    try:
        cursor = conn.cursor()
        create_table(cursor)
        if args.truncate:
            cursor.execute("TRUNCATE TABLE maternal_database_with_scores")
        total_inserted = 0
        total_dropped = 0
        for chunk in read_csv_chunks(args.csv, args.chunk_size):
            prepared, dropped = prepare_chunk(chunk)
            total_dropped += dropped
            if prepared.empty:
                continue
            total_inserted += insert_rows(cursor, prepared, args.batch_size)
            conn.commit()
        print(f"Inserted {total_inserted} rows into maternal_database_with_scores.")
        if total_dropped:
            print(f"Dropped {total_dropped} rows with empty required columns.")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
