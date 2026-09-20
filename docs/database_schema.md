# Database Schema

## Tables
- `concept`
- `pubmed_records`


## concept
| Field | Type | Null | Key | Default | Extra |
| --- | --- | --- | --- | --- | --- |
| concept_id | int(11) | NO | PRI | NULL | auto_increment |
| cui | varchar(25) | NO | MUL | NULL | |
| name | varchar(4096) | YES | MUL | NULL | |
| type | varchar(10) | YES | | NULL | |
| low_name | varchar(4096) | YES | MUL | NULL | |

## pubmed_records
| Field     | Type            | Null | Key | Default | Extra                    |
|-----------|-----------------|------|-----|---------|--------------------------|
| my_row_id | bigint unsigned | NO   | PRI | NULL    | auto_increment INVISIBLE |
| pmid      | varchar(50)     | YES  | MUL | NULL    |                          |
| title     | varchar(500)    | YES  |     | NULL    |                          |
| abstract  | blob            | YES  |     | NULL    |                          |
| pubdate   | varchar(10)     | YES  |     | NULL    |                          |


## atc (Anatomical Therapeutic Chemical)
| Field    | Type         | Null | Key | Default | Extra          |
|----------|--------------|------+-----|---------|----------------|
| atcid    | int          | NO   | PRI | NULL    | auto_increment |
| L1       | varchar(128) | YES  |     | NULL    |                |
| L2       | varchar(512) | YES  |     | NULL    |                |
| L3       | varchar(512) | YES  |     | NULL    |                |
| L4       | varchar(512) | YES  |     | NULL    |                |
| atc_code | varchar(50)  | YES  |     | NULL    |                |
| CUI      | varchar(50)  | YES  |     | NULL    |                |


## epc (Established Pharmacology Class)
| Field | Type         | Null | Key | Default | Extra          |
|-------|--------------|------|-----|---------|----------------|
| epcid | int          | NO   | PRI | NULL    | auto_increment |
| CUI   | varchar(50)  | YES  |     | NULL    |                |
| EPC   | varchar(512) | YES  |     | NULL    |                |
| type  | varchar(50)  | YES  |     | NULL    |                |


## moa (Mechanism of Action)
| Field | Type          | Null | Key | Default | Extra          |
|-------|---------------|------+-----|---------|----------------|
| moaid | int           | NO   | PRI | NULL    | auto_increment |
| CUI   | varchar(50)   | YES  |     | NULL    |                |
| MOA   | varchar(1024) | YES  |     | NULL    |                |
| type  | varchar(50)   | YES  |     | NULL    |                |

## new_study_type
| Field | Type        | Null | Key | Default | Extra          |
|-------|-------------|------+-----|---------|----------------|
| stid  | int         | NO   | PRI | NULL    | auto_increment |
| pmid  | varchar(50) | NO   | MUL | NULL    |                |
| type  | varchar(10) | YES  | MUL | NULL    |                |

## new_population
| Field | Type        | Null | Key | Default | Extra          |
|-------|-------------|------|-----|---------|----------------|
| poid  | int         | NO   | PRI | NULL    | auto_increment |
| pmid  | varchar(50) | YES  | MUL | NULL    |                |
| type  | varchar(25) | YES  | MUL | NULL    |                |
| cate  | varchar(25) | YES  |     | NULL    |                |



# Adverse-event tables (app database `kb_app`)

Built by `scripts/create_ae_tables.py` from the jiayi-server CSV folder. All
are keyed by UMLS CUI, the same identifier as `concept` / `new_pmid2drug`, and
queried through `app/libs/database/query_ae.ts`.

| Table | Rows (2026-09) | Purpose |
| --- | --- | --- |
| `ae_drug` | ~8.5k | One row per jiayi drug CUI: display `name`, `rxcui`, per-source record counts (`n_pubmed_human`, `n_pubmed_animal`, `n_fda_human`, `n_fda_animal`). |
| `ae_drug_term` | ~21k | Every name known for a CUI (`term`, `cui`, `source` = evidence / identity / rxnorm_brand / rxnorm_ingredient / clinical_data). FULLTEXT on `term`. Used for typeahead and highlighting. |
| `ae_cui_map` | ~9.9k | `cui` (jiayi) → `match_cui` (portal-facing); `kind` = self or rollup. Roll-ups map salt forms and combination products to their ingredient CUIs via `concept`. Every query joins through this table. |
| `ae_term` | ~52k | Adverse-event vocabulary (`term`, `canonical`, `source`). FULLTEXT on `term`. |
| `ae_drug_similarity` | ~13k | Tanimoto edges (`drug_a`, `drug_b`, `cui_a`, `cui_b`, `tanimoto`); undirected, stored once. |
| `ae_abstract` | ~59k | `(pmid, corpus)` → `title`, `abstract`; corpus = human or animal. |
| `ae_pubmed_finding` | ~156k | One extracted drug–event finding: `corpus`, `pmid`, `cui`, `rxcui`, `drug_name`, `adverse_event`, `population`, `species`, `dosage_value/unit`, `finding_type`, `confidence`, `reasoning`. Index on `(cui, adverse_event)`. |
| `ae_label_finding` | ~101k | One FDA-label drug–event finding: `corpus`, `cui`, `drug_name`, `adverse_event`, `normalized_ae`, `population`, `species`, `age_range`, dosage, `section` (label section key, e.g. `pregnancy`), MedDRA PT / SOC. Index on `(cui, adverse_event)`. |
| `ae_label_text` | ~34k | Label section text: `drug_key` (upper-cased label drug name), `section`, `seq`, `content`. Joined to `ae_label_finding` by name + section (the source matrix has no CUI column). |

A comma-separated CUI cell in the source (combination product) is stored once
per CUI, so each ingredient finds the row.
