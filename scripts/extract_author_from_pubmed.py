import argparse
import json
import logging
import os
import time
from typing import Dict, Iterable, List, Sequence, Tuple
from http.client import IncompleteRead
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen
import xml.etree.ElementTree as ET

import mysql.connector
from dotenv import load_dotenv


PUBMED_ESUMMARY_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
PUBMED_EFETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"

AUTHOR_TABLE_NAME = "pubmed_author_affiliation"


def load_env(env_path: str) -> None:
    load_dotenv(dotenv_path=env_path)


def get_db_config() -> dict:
    config = {
        "host": os.getenv("DB_HOST"),
        "user": os.getenv("DB_USER"),
        "password": os.getenv("DB_PASSWORD"),
        "port": int(os.getenv("DB_PORT", "3306")),
        "database": os.getenv("DB_NAME") or "kb",
    }
    missing = [key for key, value in config.items() if value in (None, "")]
    if missing:
        raise ValueError(f"Missing database environment variables: {', '.join(missing)}")
    return config


def connect_db(db_config: dict):
    return mysql.connector.connect(**db_config)


def iter_table_pmids(db_config: dict, table: str, batch_size: int) -> Iterable[List[str]]:
    last_pmid: str | None = None
    while True:
        connection = connect_db(db_config)
        try:
            cursor = connection.cursor(buffered=False)
            where_clause = "PMID IS NOT NULL AND PMID != ''"
            params: list[str] = []
            if last_pmid is not None:
                where_clause += " AND PMID > %s"
                params.append(last_pmid)
            query = f"""
                SELECT DISTINCT PMID
                FROM {table}
                WHERE {where_clause}
                ORDER BY PMID
                LIMIT %s
            """
            params.append(batch_size)
            cursor.execute(query, params)
            rows = cursor.fetchall()
            if not rows:
                return
            pmids = []
            for (pmid,) in rows:
                if pmid is None:
                    continue
                value = str(pmid).strip()
                if value:
                    pmids.append(value)
            if pmids:
                last_pmid = pmids[-1]
                logging.info("Fetched %d PMIDs from %s starting at %s", len(pmids), table, last_pmid)
                yield pmids
        except mysql.connector.Error as exc:
            logging.exception("MySQL error while reading %s", table)
            if getattr(exc, "errno", None) != 2013:
                raise
            time.sleep(2)
        finally:
            connection.close()


def iter_pmids(db_config: dict, batch_size: int, dedupe: bool) -> Iterable[List[str]]:
    tables = [
        "cache_full_study",
    ]
    seen_pmids: set[str] | None = set() if dedupe else None
    for table in tables:
        for pmid_batch in iter_table_pmids(db_config, table, batch_size):
            if seen_pmids is None:
                yield pmid_batch
                continue
            unique = []
            for pmid in pmid_batch:
                if pmid in seen_pmids:
                    continue
                seen_pmids.add(pmid)
                unique.append(pmid)
            if unique:
                yield unique


def chunked(values: Sequence[str], size: int) -> Iterable[List[str]]:
    batch: List[str] = []
    for value in values:
        batch.append(value)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch


def build_esummary_url(pmids: Sequence[str], api_key: str | None, email: str | None) -> str:
    params = {
        "db": "pubmed",
        "id": ",".join(pmids),
        "retmode": "json",
    }
    if api_key:
        params["api_key"] = api_key
    if email:
        params["email"] = email
    return f"{PUBMED_ESUMMARY_URL}?{urlencode(params)}"


def build_efetch_url(pmids: Sequence[str], api_key: str | None, email: str | None) -> str:
    params = {
        "db": "pubmed",
        "id": ",".join(pmids),
        "retmode": "xml",
    }
    if api_key:
        params["api_key"] = api_key
    if email:
        params["email"] = email
    return f"{PUBMED_EFETCH_URL}?{urlencode(params)}"


def request_esummary(pmids: Sequence[str], api_key: str | None, email: str | None) -> dict:
    url = build_esummary_url(pmids, api_key, email)
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            with urlopen(url, timeout=30) as response:
                payload = response.read().decode("utf-8")
            return json.loads(payload)
        except (HTTPError, URLError, json.JSONDecodeError, IncompleteRead, ConnectionResetError) as exc:
            last_error = exc
            logging.warning("ESummary request failed (attempt %d/%d): %s", attempt + 1, 3, exc)
            time.sleep(2 ** attempt)
    raise RuntimeError(f"Failed to fetch PubMed data: {last_error}")


def request_efetch(pmids: Sequence[str], api_key: str | None, email: str | None) -> str:
    url = build_efetch_url(pmids, api_key, email)
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            with urlopen(url, timeout=30) as response:
                return response.read().decode("utf-8")
        except (HTTPError, URLError, IncompleteRead, ConnectionResetError) as exc:
            last_error = exc
            logging.warning("EFetch request failed (attempt %d/%d): %s", attempt + 1, 3, exc)
            time.sleep(2 ** attempt)
    raise RuntimeError(f"Failed to fetch PubMed data: {last_error}")


def parse_full_author_rows(xml_payload: str) -> List[Tuple[str, str, str]]:
    rows: List[Tuple[str, str, str]] = []
    root = ET.fromstring(xml_payload)
    for article in root.findall(".//PubmedArticle"):
        pmid_node = article.find(".//MedlineCitation/PMID")
        if pmid_node is None or not pmid_node.text:
            continue
        pmid = pmid_node.text.strip()
        for author in article.findall(".//Article/AuthorList/Author"):
            collective = author.findtext("CollectiveName")
            if collective:
                author_name = collective.strip()
            else:
                last_name = author.findtext("LastName")
                fore_name = author.findtext("ForeName")
                if fore_name and last_name:
                    author_name = f"{fore_name.strip()} {last_name.strip()}"
                elif last_name:
                    author_name = last_name.strip()
                else:
                    continue
            affiliations = [
                info.text.strip()
                for info in author.findall(".//AffiliationInfo/Affiliation")
                if info.text and info.text.strip()
            ]
            affiliation_text = "; ".join(affiliations)
            rows.append((pmid, author_name, affiliation_text))
    return rows


def parse_short_author_rows(esummary: dict) -> List[Tuple[str, str, str]]:
    rows: List[Tuple[str, str, str]] = []
    result = esummary.get("result", {})
    uids = result.get("uids", [])
    for uid in uids:
        item = result.get(str(uid), {})
        authors = item.get("authors", [])
        for author in authors:
            name = author.get("name")
            if name:
                rows.append((str(uid), name.strip(), ""))
    return rows


def fetch_full_authors_batch(
    pmids: Sequence[str],
    api_key: str | None,
    email: str | None,
    depth: int = 0,
) -> List[Tuple[str, str, str]]:
    try:
        xml_payload = request_efetch(pmids, api_key, email)
        return parse_full_author_rows(xml_payload)
    except ET.ParseError:
        logging.warning(
            "XML parse error for batch size %d at depth %d; splitting batch",
            len(pmids),
            depth,
        )
        if len(pmids) <= 1 or depth >= 4:
            logging.error("Skipping PMID batch due to repeated XML parse errors: %s", pmids)
            return []
        mid = len(pmids) // 2
        left = fetch_full_authors_batch(pmids[:mid], api_key, email, depth + 1)
        right = fetch_full_authors_batch(pmids[mid:], api_key, email, depth + 1)
        return left + right


def fetch_pubmed_author_rows(
    pmids: Sequence[str],
    batch_size: int,
    api_key: str | None,
    email: str | None,
    full_names: bool,
) -> List[Tuple[str, str, str]]:
    rows: List[Tuple[str, str, str]] = []
    delay = 0.1 if api_key else 0.34
    for batch in chunked(pmids, batch_size):
        if full_names:
            rows.extend(fetch_full_authors_batch(batch, api_key, email))
        else:
            esummary = request_esummary(batch, api_key, email)
            rows.extend(parse_short_author_rows(esummary))
        time.sleep(delay)
    return rows


def create_pubmed_author_table(cursor) -> None:
    cursor.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {AUTHOR_TABLE_NAME} (
          PMID VARCHAR(64) NOT NULL,
          author TEXT,
          affiliation TEXT,
          KEY idx_pmid (PMID),
          UNIQUE KEY uniq_pmid_author_affiliation (PMID, author(255), affiliation(255))
        )
        """
    )


def insert_author_rows(cursor, rows: Sequence[Tuple[str, str, str]]) -> None:
    if not rows:
        return
    cursor.executemany(
        f"""
        INSERT IGNORE INTO {AUTHOR_TABLE_NAME} (PMID, author, affiliation)
        VALUES (%s, %s, %s)
        """,
        rows,
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract PubMed authors for PMIDs in maternal/pediatric tables.",
    )
    parser.add_argument(
        "--env",
        default=".env.local",
        help="Path to .env file with database credentials.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=200,
        help="Number of PMIDs per PubMed request.",
    )
    parser.add_argument(
        "--db-batch-size",
        type=int,
        default=200,
        help="Number of PMIDs to fetch per DB page.",
    )
    parser.add_argument(
        "--log-file",
        default="pubmed_author.log",
        help="Path to log file.",
    )
    parser.add_argument(
        "--short-names",
        action="store_true",
        help="Use ESummary to request abbreviated author names.",
    )
    parser.add_argument(
        "--no-dedupe",
        action="store_true",
        help="Do not de-duplicate PMIDs across tables.",
    )
    args = parser.parse_args()
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=[
            logging.FileHandler(args.log_file),
            logging.StreamHandler(),
        ],
    )

    load_env(args.env)
    api_key = os.getenv("NCBI_API_KEY")
    email = os.getenv("NCBI_EMAIL")
    if args.short_names:
        logging.warning("Short-name mode does not include affiliations; affiliation column will be empty.")

    db_config = get_db_config()
    dedupe = not args.no_dedupe
    connection = connect_db(db_config)
    try:
        cursor = connection.cursor()
        create_pubmed_author_table(cursor)
        connection.commit()
        for pmid_batch in iter_pmids(db_config, args.db_batch_size, dedupe):
            logging.info("Requesting authors for %d PMIDs", len(pmid_batch))
            rows = fetch_pubmed_author_rows(
                pmid_batch,
                args.batch_size,
                api_key,
                email,
                not args.short_names,
            )
            insert_author_rows(cursor, rows)
            connection.commit()
            logging.info(f"Inserted %d rows into {AUTHOR_TABLE_NAME}", len(rows))
    finally:
        connection.close()


if __name__ == "__main__":
    main()
