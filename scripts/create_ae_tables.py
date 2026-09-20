#!/usr/bin/env python3
"""
Builds the adverse-event (AE) tables in the app database (APP_DB_NAME, default
kb_app) from the jiayi-server CSV folder, so the portal can serve the
"one drug, four evidence sources" view without the separate Python service.

    python scripts/create_ae_tables.py --jiayi-dir ~/projects/untrunked/jiayi-server
    python scripts/create_ae_tables.py --jiayi-dir ... --only cui_map      # recompute one table
    python scripts/create_ae_tables.py --jiayi-dir ... --drop              # start from scratch

Reads DB_* (source, for the `concept` table) and APP_DB_NAME (target) from
.env.local, like the other scripts here.

TABLES WRITTEN (all prefixed ae_)
---------------------------------
  ae_drug             one row per jiayi drug CUI: display name, rxcui, per-source counts
  ae_drug_term        every name known for a CUI (typeahead + highlighting)
  ae_cui_map          jiayi CUI -> portal-facing CUI (self, plus salt-form and
                      combination roll-ups resolved through `concept`)
  ae_term             adverse-event vocabulary (typeahead)
  ae_drug_similarity  Tanimoto structural-similarity edges
  ae_abstract         one row per (pmid, corpus) with title + abstract text
  ae_pubmed_finding   one row per extracted drug-AE finding (human + animal PubMed)
  ae_label_finding    one row per FDA-label drug-AE finding (human + animal)
  ae_label_text       FDA label section text, keyed by drug name + section

WHY CUI IS THE KEY
------------------
Every finding row in jiayi's four evidence files already carries a UMLS CUI
(`CUI` in the PubMed files, `drug_ID` in the label files), which is exactly the
identifier the portal's `concept` / `new_pmid2drug` tables use. RXCUI is only
filled on ~64% of human PubMed rows, so it is stored but not used for joins.

A CUI cell can hold several comma-separated CUIs (combination products); such
a row is stored once per CUI so each ingredient finds it.

ROLL-UP (ae_cui_map)
--------------------
The portal resolves a dropdown name to ingredient-level CUIs, while FDA label
rows are coded to salt forms ("DICLOFENAC SODIUM") and PubMed rows sometimes to
combinations ("sulfamethoxazole / trimethoprim"). For each jiayi CUI we take its
names from `concept`, strip salt suffixes, split combinations, and look the
pieces up again in `concept` (type = drug) to find the ingredient CUIs. Queries
go through this map, so the portal's diclofenac CUI reaches the diclofenac
sodium label findings. Measured on the 2026-09 data this lifts evidence
coverage from 57% to 73% of rows.
"""
import argparse
import collections
import csv
import os
import re
import sys
import time
from pathlib import Path

import mysql.connector
from dotenv import load_dotenv

csv.field_size_limit(sys.maxsize)

BATCH = 1000
SOURCES = ("pubmed_human", "pubmed_animal", "fda_human", "fda_animal")

# Salt / ester suffix words removed when rolling a salt-form name up to its ingredient.
SALT_WORDS = (
    "sodium|potassium|calcium|magnesium|hydrochloride|hcl|acetate|sulfate|sulphate|phosphate|"
    "citrate|tartrate|maleate|mesylate|besylate|succinate|fumarate|bromide|chloride|nitrate|"
    "disodium|dipotassium|trihydrate|monohydrate|dihydrate|hemihydrate|hydrobromide|lactate|"
    "gluconate|carbonate|bicarbonate|palmitate|propionate|valerate|decanoate|enanthate|pamoate|"
    "tosylate|benzoate|salicylate|stearate|oxalate|oxide|hydroxide|dimesylate|hemifumarate|"
    "malate|mofetil|proxetil|pivoxil|axetil|anhydrous"
)
SALT_RE = re.compile(rf"\b(?:{SALT_WORDS})\b", re.IGNORECASE)
COMBO_SPLIT_RE = re.compile(r"\s*/\s*|\s+and\s+|\s*\+\s*", re.IGNORECASE)
# Only a trailing RxNorm-style brand marker ("... injection [Luxturna]") is
# dropped; a bracket inside a systematic chemical name is part of the name
# (stripping it turned "[...]acetic acid" into acetic acid).
BRACKET_RE = re.compile(r"\s*\[[^\]]*\]\s*$")
# Normalized names that are too generic to be a roll-up target.
ROLLUP_STOP = {
    "nos", "acid", "acids", "salt", "salts", "ion", "ions", "extract", "extracts", "oil", "water", "venom",
    "complex", "vaccine", "supplement", "mineral supplement", "solution", "injection", "tablet", "capsule",
    "compound", "compounds", "agent", "agents", "product", "products", "drug", "drugs", "preparation",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def db_config(database_env: str) -> dict:
    cfg = {
        "host": os.getenv("DB_HOST"),
        "user": os.getenv("DB_USER"),
        "password": os.getenv("DB_PASSWORD"),
        "port": int(os.getenv("DB_PORT") or "3306"),
        "database": os.getenv(database_env) or ("kb_app" if database_env == "APP_DB_NAME" else None),
    }
    missing = [k for k, v in cfg.items() if v in (None, "")]
    if missing:
        raise SystemExit(f"Missing environment variables for {database_env}: {', '.join(missing)}")
    return cfg


def split_cuis(cell: str) -> list:
    return [c.strip() for c in (cell or "").split(",") if c.strip()]


def clip(value, n: int):
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    return s[:n]


def section_key(source_file: str) -> str:
    """'1_pregnancy_found_information.xlsx' -> 'pregnancy'."""
    stem = Path(source_file or "").stem
    stem = re.sub(r"^\d+_", "", stem)
    stem = re.sub(r"_found_information$", "", stem)
    return stem


def normalize_name(name: str) -> str:
    n = BRACKET_RE.sub("", name.lower())
    n = SALT_RE.sub("", n)
    n = re.sub(r"\s+", " ", n).strip(" ,-")
    return n


def combo_parts(name: str) -> list:
    return [p.strip() for p in COMBO_SPLIT_RE.split(name) if p.strip()]


def read_csv(path: Path):
    with open(path, newline="", encoding="utf-8") as f:
        yield from csv.DictReader(f)


def executemany(cursor, sql: str, rows: list, label: str, batch: int = BATCH) -> int:
    total = 0
    for i in range(0, len(rows), batch):
        cursor.executemany(sql, rows[i:i + batch])
        total += len(rows[i:i + batch])
    log(f"  {label}: {total} rows")
    return total


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------
DDL = {
    "drug": """
        CREATE TABLE IF NOT EXISTS ae_drug (
          cui VARCHAR(16) NOT NULL PRIMARY KEY,
          name VARCHAR(512) NOT NULL,
          rxcui VARCHAR(16) NULL,
          n_pubmed_human INT NOT NULL DEFAULT 0,
          n_pubmed_animal INT NOT NULL DEFAULT 0,
          n_fda_human INT NOT NULL DEFAULT 0,
          n_fda_animal INT NOT NULL DEFAULT 0
        ) DEFAULT CHARSET=utf8mb4
    """,
    "drug_term": """
        CREATE TABLE IF NOT EXISTS ae_drug_term (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          term VARCHAR(512) NOT NULL,
          cui VARCHAR(16) NOT NULL,
          source VARCHAR(32) NOT NULL,
          UNIQUE KEY uq_term_cui (term(191), cui),
          KEY idx_cui (cui),
          FULLTEXT KEY ft_term (term)
        ) DEFAULT CHARSET=utf8mb4
    """,
    "cui_map": """
        CREATE TABLE IF NOT EXISTS ae_cui_map (
          cui VARCHAR(16) NOT NULL,
          match_cui VARCHAR(16) NOT NULL,
          kind ENUM('self','rollup') NOT NULL,
          PRIMARY KEY (cui, match_cui),
          KEY idx_match (match_cui)
        ) DEFAULT CHARSET=utf8mb4
    """,
    "term": """
        CREATE TABLE IF NOT EXISTS ae_term (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          term VARCHAR(512) NOT NULL,
          canonical VARCHAR(512) NOT NULL,
          source VARCHAR(32) NOT NULL,
          KEY idx_canonical (canonical(191)),
          FULLTEXT KEY ft_term (term)
        ) DEFAULT CHARSET=utf8mb4
    """,
    "similarity": """
        CREATE TABLE IF NOT EXISTS ae_drug_similarity (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          drug_a VARCHAR(255) NOT NULL,
          drug_b VARCHAR(255) NOT NULL,
          cui_a VARCHAR(16) NULL,
          cui_b VARCHAR(16) NULL,
          tanimoto FLOAT NOT NULL,
          KEY idx_cui_a (cui_a),
          KEY idx_cui_b (cui_b),
          KEY idx_drug_a (drug_a(191)),
          KEY idx_drug_b (drug_b(191))
        ) DEFAULT CHARSET=utf8mb4
    """,
    "abstract": """
        CREATE TABLE IF NOT EXISTS ae_abstract (
          pmid VARCHAR(16) NOT NULL,
          corpus ENUM('human','animal') NOT NULL,
          title TEXT NULL,
          abstract MEDIUMTEXT NULL,
          PRIMARY KEY (pmid, corpus)
        ) DEFAULT CHARSET=utf8mb4
    """,
    "pubmed_finding": """
        CREATE TABLE IF NOT EXISTS ae_pubmed_finding (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          corpus ENUM('human','animal') NOT NULL,
          pmid VARCHAR(16) NOT NULL,
          cui VARCHAR(16) NOT NULL,
          rxcui VARCHAR(16) NULL,
          drug_name VARCHAR(512) NOT NULL,
          adverse_event VARCHAR(1000) NOT NULL,
          population VARCHAR(128) NULL,
          species VARCHAR(128) NULL,
          dosage_value VARCHAR(64) NULL,
          dosage_unit VARCHAR(64) NULL,
          finding_type VARCHAR(64) NULL,
          confidence VARCHAR(32) NULL,
          reasoning TEXT NULL,
          KEY idx_cui_ae (cui, adverse_event(191)),
          KEY idx_cui_corpus (cui, corpus),
          KEY idx_pmid (pmid)
        ) DEFAULT CHARSET=utf8mb4
    """,
    "label_finding": """
        CREATE TABLE IF NOT EXISTS ae_label_finding (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          corpus ENUM('human','animal') NOT NULL,
          cui VARCHAR(16) NOT NULL,
          drug_name VARCHAR(512) NOT NULL,
          adverse_event VARCHAR(1000) NOT NULL,
          normalized_ae VARCHAR(1000) NULL,
          population VARCHAR(128) NULL,
          species VARCHAR(128) NULL,
          age_range VARCHAR(128) NULL,
          dosage_value VARCHAR(64) NULL,
          dosage_unit VARCHAR(64) NULL,
          section VARCHAR(128) NOT NULL,
          from_column VARCHAR(64) NULL,
          meddra_pt_name VARCHAR(255) NULL,
          meddra_pt_code VARCHAR(32) NULL,
          meddra_soc_name VARCHAR(255) NULL,
          meddra_soc_code VARCHAR(32) NULL,
          KEY idx_cui_ae (cui, adverse_event(191)),
          KEY idx_cui_corpus (cui, corpus)
        ) DEFAULT CHARSET=utf8mb4
    """,
    "label_text": """
        CREATE TABLE IF NOT EXISTS ae_label_text (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          drug_key VARCHAR(255) NOT NULL,
          section VARCHAR(128) NOT NULL,
          seq INT NOT NULL,
          content MEDIUMTEXT NOT NULL,
          KEY idx_drug_section (drug_key(191), section)
        ) DEFAULT CHARSET=utf8mb4
    """,
}
TABLE_NAMES = {
    "drug": "ae_drug", "drug_term": "ae_drug_term", "cui_map": "ae_cui_map", "term": "ae_term",
    "similarity": "ae_drug_similarity", "abstract": "ae_abstract", "pubmed_finding": "ae_pubmed_finding",
    "label_finding": "ae_label_finding", "label_text": "ae_label_text",
}
LOAD_ORDER = ["abstract", "pubmed_finding", "label_finding", "drug", "drug_term", "cui_map",
              "term", "similarity", "label_text"]


# ---------------------------------------------------------------------------
# Loaders. `state` carries what later steps need from earlier ones.
# ---------------------------------------------------------------------------
def load_pubmed(cur, jiayi: Path, state: dict) -> None:
    """ae_abstract + ae_pubmed_finding from human_PubMed.csv and animal_PubMed.csv."""
    abstracts = {}
    findings = []
    cui_names = state.setdefault("cui_names", collections.defaultdict(collections.Counter))
    cui_counts = state.setdefault("cui_counts", collections.defaultdict(collections.Counter))
    cui_rxcui = state.setdefault("cui_rxcui", collections.defaultdict(collections.Counter))

    for row in read_csv(jiayi / "data_for_server" / "human_PubMed.csv"):
        pmid = (row.get("source_PMID") or "").strip()
        if not pmid:
            continue
        abstracts.setdefault((pmid, "human"), (row.get("title"), row.get("abstract")))
        cuis = split_cuis(row.get("CUI"))
        rxcui = clip(row.get("RXCUI"), 16)
        for cui in cuis:
            cui_names[cui][(row.get("drug_name") or "").strip()] += 1
            cui_counts[cui]["pubmed_human"] += 1
            if rxcui:
                cui_rxcui[cui][rxcui] += 1
            findings.append((
                "human", pmid, cui, rxcui, clip(row.get("drug_name"), 512) or "",
                clip(row.get("adverse_event"), 1000) or "", clip(row.get("population"), 128), None,
                clip(row.get("dosage_value"), 64), clip(row.get("dosage_unit"), 64),
                clip(row.get("finding_type"), 64), clip(row.get("confidence"), 32), row.get("reasoning") or None,
            ))

    for row in read_csv(jiayi / "data_for_server" / "animal_PubMed.csv"):
        pmid = (row.get("PMID") or "").strip()
        if not pmid:
            continue
        abstracts.setdefault((pmid, "animal"), (row.get("Title"), row.get("Abstract")))
        rxcui = clip(row.get("RXCUI"), 16)
        for cui in split_cuis(row.get("CUI")):
            cui_names[cui][(row.get("drug_name") or "").strip()] += 1
            cui_counts[cui]["pubmed_animal"] += 1
            if rxcui:
                cui_rxcui[cui][rxcui] += 1
            findings.append((
                "animal", pmid, cui, rxcui, clip(row.get("drug_name"), 512) or "",
                clip(row.get("adverse_event"), 1000) or "", clip(row.get("population"), 128),
                clip(row.get("species"), 128), clip(row.get("dosage_value"), 64), clip(row.get("dosage_unit"), 64),
                None, None, None,
            ))

    state["abstract_rows"] = [(pmid, corpus, t or None, a or None) for (pmid, corpus), (t, a) in abstracts.items()]
    state["pubmed_finding_rows"] = findings


def write_abstract(cur, jiayi: Path, state: dict) -> None:
    if "abstract_rows" not in state:
        load_pubmed(cur, jiayi, state)
    executemany(cur, "INSERT INTO ae_abstract (pmid, corpus, title, abstract) VALUES (%s,%s,%s,%s)",
                state["abstract_rows"], "ae_abstract", batch=200)


def write_pubmed_finding(cur, jiayi: Path, state: dict) -> None:
    if "pubmed_finding_rows" not in state:
        load_pubmed(cur, jiayi, state)
    executemany(cur, """
        INSERT INTO ae_pubmed_finding
          (corpus, pmid, cui, rxcui, drug_name, adverse_event, population, species,
           dosage_value, dosage_unit, finding_type, confidence, reasoning)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, state["pubmed_finding_rows"], "ae_pubmed_finding")


def load_labels(cur, jiayi: Path, state: dict) -> None:
    rows = []
    cui_names = state.setdefault("cui_names", collections.defaultdict(collections.Counter))
    cui_counts = state.setdefault("cui_counts", collections.defaultdict(collections.Counter))
    for corpus, fname, source in (("human", "human_druglabel.csv", "fda_human"),
                                  ("animal", "animal_druglabel.csv", "fda_animal")):
        for row in read_csv(jiayi / "data_for_server" / fname):
            for cui in split_cuis(row.get("drug_ID")):
                cui_names[cui][(row.get("drug_name") or "").strip()] += 1
                cui_counts[cui][source] += 1
                rows.append((
                    corpus, cui, clip(row.get("drug_name"), 512) or "",
                    clip(row.get("adverse_event"), 1000) or clip(row.get("normalized_ade"), 1000) or "",
                    clip(row.get("normalized_ade"), 1000), clip(row.get("population"), 128),
                    clip(row.get("species"), 128), clip(row.get("age_range"), 128),
                    clip(row.get("dosage_value"), 64), clip(row.get("dosage_unit"), 64),
                    section_key(row.get("source_file")), clip(row.get("from_column"), 64),
                    clip(row.get("pt_name") or row.get("meddra_pt_name"), 255),
                    clip(row.get("pt_code") or row.get("meddra_pt_code"), 32),
                    clip(row.get("soc_name") or row.get("meddra_soc_name"), 255),
                    clip(row.get("soc_code") or row.get("meddra_soc_code"), 32),
                ))
    state["label_finding_rows"] = rows


def write_label_finding(cur, jiayi: Path, state: dict) -> None:
    if "label_finding_rows" not in state:
        load_labels(cur, jiayi, state)
    executemany(cur, """
        INSERT INTO ae_label_finding
          (corpus, cui, drug_name, adverse_event, normalized_ae, population, species, age_range,
           dosage_value, dosage_unit, section, from_column, meddra_pt_name, meddra_pt_code,
           meddra_soc_name, meddra_soc_code)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, state["label_finding_rows"], "ae_label_finding")


def ensure_cui_index(cur, jiayi: Path, state: dict) -> None:
    if "cui_names" not in state or not state["cui_names"]:
        load_pubmed(cur, jiayi, state)
        load_labels(cur, jiayi, state)


def write_drug(cur, jiayi: Path, state: dict) -> None:
    ensure_cui_index(cur, jiayi, state)
    rows = []
    for cui, names in state["cui_names"].items():
        name = next((n for n, _ in names.most_common() if n), cui)
        rx = state.get("cui_rxcui", {}).get(cui)
        counts = state["cui_counts"][cui]
        rows.append((cui, clip(name, 512), rx.most_common(1)[0][0] if rx else None,
                     counts["pubmed_human"], counts["pubmed_animal"], counts["fda_human"], counts["fda_animal"]))
    executemany(cur, """
        INSERT INTO ae_drug (cui, name, rxcui, n_pubmed_human, n_pubmed_animal, n_fda_human, n_fda_animal)
        VALUES (%s,%s,%s,%s,%s,%s,%s)
    """, rows, "ae_drug")


def write_drug_term(cur, jiayi: Path, state: dict) -> None:
    """Names per CUI: raw evidence names, then RxNorm aliases via unified_drug_identity
    (rxcui -> cui rows and the crosswalk), then drug_vocabulary terms whose canonical
    resolves to a known name."""
    ensure_cui_index(cur, jiayi, state)
    terms = {}  # (term.lower, cui) -> (term, source)

    def add(term, cui, source):
        term = (term or "").strip()
        if not term or len(term) > 512:
            return
        terms.setdefault((term.lower(), cui), (term, source))

    for cui, names in state["cui_names"].items():
        for n in names:
            add(n, cui, "evidence")

    # rxcui -> set(cui): identity file's own cui rows plus the crosswalk
    rx_to_cui = collections.defaultdict(set)
    rx_names = collections.defaultdict(set)
    for row in read_csv(jiayi / "unified_drug_identity.csv"):
        if row["raw_value_type"] == "cui":
            rx_to_cui[row["rxcui"]].add(row["raw_value"].strip())
        else:
            rx_names[row["rxcui"]].add(row["raw_value"].strip())
        rx_names[row["rxcui"]].add(row["canonical_name"].strip())
    xw = jiayi / "cui_rxcui_crosswalk.csv"
    if xw.exists():
        for row in read_csv(xw):
            rx_to_cui[row["rxcui"]].add(row["cui"].strip())
    known = set(state["cui_names"])
    for rx, cuis in rx_to_cui.items():
        for cui in cuis & known:
            for n in rx_names.get(rx, ()):
                add(n, cui, "identity")

    # drug_vocabulary: term -> canonical; resolve canonical through names collected so far
    name_to_cui = collections.defaultdict(set)
    for (tl, cui), _ in terms.items():
        name_to_cui[tl].add(cui)
    voc = jiayi / "drug_vocabulary.csv"
    if voc.exists():
        for row in read_csv(voc):
            canon = (row.get("canonical_drug") or "").strip().lower()
            for cui in name_to_cui.get(canon, ()):
                add(row.get("term"), cui, row.get("source") or "vocabulary")

    state["term_index"] = {tl: cuis for tl, cuis in name_to_cui.items()}
    executemany(cur, "INSERT IGNORE INTO ae_drug_term (term, cui, source) VALUES (%s,%s,%s)",
                [(t, cui, src) for (tl, cui), (t, src) in terms.items()], "ae_drug_term")


def write_cui_map(cur, jiayi: Path, state: dict, src_cur) -> None:
    """Self rows for every jiayi CUI, plus roll-up rows found through the portal's
    `concept` table (see module docstring)."""
    ensure_cui_index(cur, jiayi, state)
    cuis = sorted(state["cui_names"])
    rows = [(c, c, "self") for c in cuis]

    # names for each jiayi CUI from concept (drug-typed), plus the raw evidence names
    concept_names = collections.defaultdict(set)
    for i in range(0, len(cuis), 500):
        batch = cuis[i:i + 500]
        src_cur.execute(
            f"SELECT cui, name FROM concept WHERE type='drug' AND cui IN ({','.join(['%s'] * len(batch))})", batch)
        for cui, name in src_cur.fetchall():
            concept_names[cui].add(name)
    for cui, names in state["cui_names"].items():
        concept_names[cui].update(n for n in names if n)

    # candidate ingredient names per CUI
    cand = collections.defaultdict(set)
    for cui, names in concept_names.items():
        for n in names:
            pieces = set()
            norm = normalize_name(n)
            if norm and norm != n.lower():
                pieces.add(norm)
            parts = combo_parts(n)
            if len(parts) > 1:
                for p in parts:
                    pieces.add(p.lower())
                    pn = normalize_name(p)
                    if pn:
                        pieces.add(pn)
            for p in pieces:
                generic = p in ROLLUP_STOP or p.rstrip("s") in ROLLUP_STOP or p.endswith("supplementation")
                if len(re.sub(r"[^a-z]", "", p)) >= 4 and not generic:
                    cand[cui].add(p)

    # resolve candidate names -> drug CUIs in concept
    all_names = sorted({p for ps in cand.values() for p in ps})
    name_cuis = collections.defaultdict(set)
    for i in range(0, len(all_names), 500):
        batch = all_names[i:i + 500]
        src_cur.execute(
            f"SELECT LOWER(name), cui FROM concept WHERE type='drug' AND name IN ({','.join(['%s'] * len(batch))})", batch)
        for name, cui in src_cur.fetchall():
            name_cuis[name].add(cui)

    n_rollup = 0
    for cui, ps in cand.items():
        targets = set()
        for p in ps:
            targets |= name_cuis.get(p, set())
        targets.discard(cui)
        for t in targets:
            rows.append((cui, t, "rollup"))
            n_rollup += 1
    log(f"  roll-up: {n_rollup} mappings for {sum(1 for c in cand if any(name_cuis.get(p) for p in cand[c]))} CUIs")
    executemany(cur, "INSERT IGNORE INTO ae_cui_map (cui, match_cui, kind) VALUES (%s,%s,%s)", rows, "ae_cui_map")


def write_term(cur, jiayi: Path, state: dict) -> None:
    rows = []
    seen = set()
    for row in read_csv(jiayi / "ae_vocabulary.csv"):
        term = (row.get("term") or "").strip()
        canon = (row.get("canonical_ae") or "").strip() or term
        if not term or len(term) > 512 or len(canon) > 512:
            continue
        key = (term.lower(), canon.lower())
        if key in seen:
            continue
        seen.add(key)
        rows.append((term, canon, clip(row.get("source"), 32) or "vocabulary"))
    executemany(cur, "INSERT INTO ae_term (term, canonical, source) VALUES (%s,%s,%s)", rows, "ae_term")


def write_similarity(cur, jiayi: Path, state: dict) -> None:
    path = jiayi / "drug_similarity_edges.csv"
    if not path.exists():
        log("  drug_similarity_edges.csv not found, skipping ae_drug_similarity")
        return
    if "term_index" not in state:
        # partial run: rebuild lower-name -> cuis from the evidence files
        ensure_cui_index(cur, jiayi, state)
        idx = collections.defaultdict(set)
        for cui, names in state["cui_names"].items():
            for n in names:
                if n:
                    idx[n.lower()].add(cui)
        state["term_index"] = idx
    idx = state["term_index"]

    def one_cui(name):
        cs = idx.get(name.lower())
        return sorted(cs)[0] if cs else None

    rows = []
    for row in read_csv(path):
        a, b = (row.get("drug_a") or "").strip(), (row.get("drug_b") or "").strip()
        try:
            sim = float(row.get("tanimoto_similarity") or 0)
        except ValueError:
            continue
        if a and b:
            rows.append((a[:255], b[:255], one_cui(a), one_cui(b), sim))
    executemany(cur, "INSERT INTO ae_drug_similarity (drug_a, drug_b, cui_a, cui_b, tanimoto) VALUES (%s,%s,%s,%s,%s)",
                rows, "ae_drug_similarity")


def write_label_text(cur, jiayi: Path, state: dict) -> None:
    """Unpivots drug_content_matrix.csv (one column per label section) to long form.
    Case-variant duplicate drug names are merged, and identical content blocks
    within a (drug, section) are dropped, matching drug_content_matrix_index.py."""
    path = jiayi / "drug_content_matrix.csv"
    if not path.exists():
        log("  drug_content_matrix.csv not found, skipping ae_label_text")
        return
    SEP = "\n\n---\n\n"
    merged = collections.defaultdict(lambda: collections.defaultdict(list))  # key -> section -> [blocks]
    for row in read_csv(path):
        key = (row.get("drug_name") or "").strip().upper()
        if not key:
            continue
        for col, val in row.items():
            if col == "drug_name" or not val or not val.strip():
                continue
            sec = section_key(col)
            bucket = merged[key][sec]
            for block in val.split(SEP):
                block = block.strip()
                if block and block not in bucket:
                    bucket.append(block)
    rows = []
    for key, sections in merged.items():
        for sec, blocks in sections.items():
            for i, block in enumerate(blocks):
                rows.append((key[:255], sec, i, block))
    log(f"  label text: {len(merged)} drugs, {len(rows)} content blocks")
    executemany(cur, "INSERT INTO ae_label_text (drug_key, section, seq, content) VALUES (%s,%s,%s,%s)",
                rows, "ae_label_text", batch=50)


WRITERS = {
    "abstract": write_abstract,
    "pubmed_finding": write_pubmed_finding,
    "label_finding": write_label_finding,
    "drug": write_drug,
    "drug_term": write_drug_term,
    "cui_map": write_cui_map,
    "term": write_term,
    "similarity": write_similarity,
    "label_text": write_label_text,
}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--jiayi-dir", required=True, help="Folder holding jiayi-server's CSV files")
    ap.add_argument("--env", default=str(Path(__file__).resolve().parent.parent / ".env.local"))
    ap.add_argument("--only", nargs="+", choices=LOAD_ORDER, help="Rebuild only these tables")
    ap.add_argument("--drop", action="store_true", help="DROP the selected tables before rebuilding (default: TRUNCATE)")
    args = ap.parse_args()

    load_dotenv(args.env)
    jiayi = Path(args.jiayi_dir).expanduser().resolve()
    if not (jiayi / "data_for_server").is_dir():
        raise SystemExit(f"{jiayi} does not look like the jiayi-server folder (no data_for_server/)")

    targets = args.only or LOAD_ORDER
    src = mysql.connector.connect(**db_config("DB_NAME"))
    dst = mysql.connector.connect(**db_config("APP_DB_NAME"))
    src_cur = src.cursor()
    cur = dst.cursor()
    log(f"source DB: {src.database}   target DB: {dst.database}   tables: {', '.join(targets)}")

    for key in LOAD_ORDER:
        if key not in targets:
            continue
        table = TABLE_NAMES[key]
        if args.drop:
            cur.execute(f"DROP TABLE IF EXISTS {table}")
        cur.execute(DDL[key])
        cur.execute(f"TRUNCATE TABLE {table}")
        dst.commit()

    state: dict = {}
    for key in LOAD_ORDER:
        if key not in targets:
            continue
        log(f"loading {TABLE_NAMES[key]} ...")
        if key == "cui_map":
            WRITERS[key](cur, jiayi, state, src_cur)
        else:
            WRITERS[key](cur, jiayi, state)
        dst.commit()

    cur.close(); src_cur.close(); dst.close(); src.close()
    log("done")


if __name__ == "__main__":
    main()
