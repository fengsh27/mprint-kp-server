# MPRINT Silver Database — Table Schemas

Generated from `information_schema` on 2026-11-11.

- **Host:** `mprint-silver-db.mysql.database.azure.com` (Azure Database for MySQL, **TLS required**)
- **Server version:** 8.0.46-azure
- **Schemas documented:** `kb`, `kb_app`
- **Credentials:** read from `.env` (not reproduced here)

Access level of the `reader` account used to generate this document:

```
GRANT USAGE ON *.* TO `reader`@`%`
GRANT SELECT ON `kb`.* TO `reader`@`%`
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE ON `kb_app`.* TO `reader`@`%`
```

> **Row counts are InnoDB estimates** from `information_schema.tables`, not exact counts.
> They can be off by a wide margin; use `COUNT(*)` when precision matters.

---

## Contents

### `kb`

- [`atc`](#kbatc) — 4,257 rows, 1.5 MB
- [`cache_full_study`](#kbcache_full_study) — 388,177 rows, 269.9 MB
- [`cache_word_cloud`](#kbcache_word_cloud) — 85 rows, 2.5 MB
- [`concept`](#kbconcept) — 3,200,740 rows, 385.9 MB
- [`epc`](#kbepc) — 2,427 rows, 0.3 MB
- [`label_stats`](#kblabel_stats) — 44,822 rows, 8.5 MB
- [`maternal_database_with_scores`](#kbmaternal_database_with_scores) — 313,085 rows, 1033.0 MB
- [`moa`](#kbmoa) — 1,424 rows, 0.2 MB
- [`model2drug`](#kbmodel2drug) — 2,223 rows, 0.1 MB
- [`model2pop`](#kbmodel2pop) — 2,327 rows, 0.1 MB
- [`model_detail`](#kbmodel_detail) — 1,782 rows, 2.5 MB
- [`new_pmid2disease`](#kbnew_pmid2disease) — 2,832,468 rows, 241.8 MB
- [`new_pmid2drug`](#kbnew_pmid2drug) — 22,459,871 rows, 1644.0 MB
- [`new_population`](#kbnew_population) — 3,592,802 rows, 200.7 MB
- [`new_pubmed_records`](#kbnew_pubmed_records) — 964,953 rows, 1928.0 MB
- [`new_study_type`](#kbnew_study_type) — 1,306,946 rows, 57.6 MB
- [`pe`](#kbpe) — 2,227 rows, 0.2 MB
- [`pediatric_database_with_scores`](#kbpediatric_database_with_scores) — 729,945 rows, 2252.0 MB
- [`pk`](#kbpk) — 25,252 rows, 3.5 MB
- [`pmid2disease`](#kbpmid2disease) — 319,744 rows, 25.5 MB
- [`pmid2drug`](#kbpmid2drug) — 6,590,510 rows, 279.8 MB
- [`population`](#kbpopulation) — 309,309 rows, 15.5 MB
- [`pubmed_author_affiliation`](#kbpubmed_author_affiliation) — 2,565,009 rows, 359.9 MB
- [`pubmed_records`](#kbpubmed_records) — 299,724 rows, 577.0 MB
- [`pubmed_view`](#kbpubmed_view) *(view)* — - rows, - MB
- [`rel`](#kbrel) — 7,568,636 rows, 803.0 MB
- [`spl`](#kbspl) — 101,748 rows, 158.7 MB
- [`study_type`](#kbstudy_type) — 100,826 rows, 4.5 MB

### `kb_app`

- [`cache_label_section`](#kb_appcache_label_section) — 12 rows, 0.0 MB
- [`cache_word_cloud`](#kb_appcache_word_cloud) — 396 rows, 12.5 MB
- [`feedback`](#kb_appfeedback) — 0 rows, 0.0 MB

---

## Overview

| Schema | Table | Type | Engine | Est. rows | Data MB | Index MB |
|---|---|---|---|---:|---:|---:|
| `kb` | `atc` | table | InnoDB | 4,257 | 1.5 | 0.0 |
| `kb` | `cache_full_study` | table | InnoDB | 388,177 | 269.9 | 0.0 |
| `kb` | `cache_word_cloud` | table | InnoDB | 85 | 2.5 | 0.0 |
| `kb` | `concept` | table | InnoDB | 3,200,740 | 385.9 | 82.7 |
| `kb` | `epc` | table | InnoDB | 2,427 | 0.3 | 0.0 |
| `kb` | `label_stats` | table | InnoDB | 44,822 | 8.5 | 0.0 |
| `kb` | `maternal_database_with_scores` | table | InnoDB | 313,085 | 1033.0 | 16.5 |
| `kb` | `moa` | table | InnoDB | 1,424 | 0.2 | 0.0 |
| `kb` | `model2drug` | table | InnoDB | 2,223 | 0.1 | 0.0 |
| `kb` | `model2pop` | table | InnoDB | 2,327 | 0.1 | 0.0 |
| `kb` | `model_detail` | table | InnoDB | 1,782 | 2.5 | 0.0 |
| `kb` | `new_pmid2disease` | table | InnoDB | 2,832,468 | 241.8 | 202.4 |
| `kb` | `new_pmid2drug` | table | InnoDB | 22,459,871 | 1644.0 | 939.0 |
| `kb` | `new_population` | table | InnoDB | 3,592,802 | 200.7 | 154.2 |
| `kb` | `new_pubmed_records` | table | InnoDB | 964,953 | 1928.0 | 0.0 |
| `kb` | `new_study_type` | table | InnoDB | 1,306,946 | 57.6 | 57.1 |
| `kb` | `pe` | table | InnoDB | 2,227 | 0.2 | 0.0 |
| `kb` | `pediatric_database_with_scores` | table | InnoDB | 729,945 | 2252.0 | 39.6 |
| `kb` | `pk` | table | InnoDB | 25,252 | 3.5 | 0.0 |
| `kb` | `pmid2disease` | table | InnoDB | 319,744 | 25.5 | 0.0 |
| `kb` | `pmid2drug` | table | InnoDB | 6,590,510 | 279.8 | 438.8 |
| `kb` | `population` | table | InnoDB | 309,309 | 15.5 | 0.0 |
| `kb` | `pubmed_author_affiliation` | table | InnoDB | 2,565,009 | 359.9 | 565.6 |
| `kb` | `pubmed_records` | table | InnoDB | 299,724 | 577.0 | 15.5 |
| `kb` | `pubmed_view` | VIEW | - | - | - | - |
| `kb` | `rel` | table | InnoDB | 7,568,636 | 803.0 | 0.0 |
| `kb` | `spl` | table | InnoDB | 101,748 | 158.7 | 0.0 |
| `kb` | `study_type` | table | InnoDB | 100,826 | 4.5 | 0.0 |
| `kb_app` | `cache_label_section` | table | InnoDB | 12 | 0.0 | 0.0 |
| `kb_app` | `cache_word_cloud` | table | InnoDB | 396 | 12.5 | 0.0 |
| `kb_app` | `feedback` | table | InnoDB | 0 | 0.0 | 0.0 |

---

## Schema `kb`

### `kb.atc`

**Type:** table · **Engine:** InnoDB · **Est. rows:** 4,257 · **Data:** 1.5 MB

| # | Column | Type | Null | Key | Default | Extra |
|---:|---|---|---|---|---|---|
| 1 | `atcid` | `int` | no | PRI |  | auto_increment |
| 2 | `L1` | `varchar(128)` | YES |  |  |  |
| 3 | `L2` | `varchar(512)` | YES |  |  |  |
| 4 | `L3` | `varchar(512)` | YES |  |  |  |
| 5 | `L4` | `varchar(512)` | YES |  |  |  |
| 6 | `atc_code` | `varchar(50)` | YES |  |  |  |
| 7 | `CUI` | `varchar(50)` | YES |  |  |  |

**Indexes**

| Index | Columns | Unique | Type |
|---|---|---|---|
| `PRIMARY` | `atcid` | yes | BTREE |

### `kb.cache_full_study`

**Type:** table · **Engine:** InnoDB · **Est. rows:** 388,177 · **Data:** 269.9 MB

| # | Column | Type | Null | Key | Default | Extra |
|---:|---|---|---|---|---|---|
| 1 | `PMID` | `varchar(64)` | no | PRI |  |  |
| 2 | `Year` | `varchar(64)` | YES |  |  |  |
| 3 | `Title` | `text` | YES |  |  |  |
| 4 | `StudyType` | `text` | YES |  |  |  |
| 5 | `Population` | `text` | YES |  |  |  |
| 6 | `StudiedDrugs` | `text` | YES |  |  |  |
| 7 | `StudiedDiseases` | `text` | YES |  |  |  |
| 8 | `maternal_Score_PK` | `float` | YES |  |  |  |
| 9 | `maternal_Score_PE` | `float` | YES |  |  |  |
| 10 | `maternal_Score_CT` | `float` | YES |  |  |  |
| 11 | `pediatric_Score_PK` | `float` | YES |  |  |  |
| 12 | `pediatric_Score_PE` | `float` | YES |  |  |  |
| 13 | `pediatric_Score_CT` | `float` | YES |  |  |  |

**Indexes**

| Index | Columns | Unique | Type |
|---|---|---|---|
| `PRIMARY` | `PMID` | yes | BTREE |

### `kb.cache_word_cloud`

**Type:** table · **Engine:** InnoDB · **Est. rows:** 85 · **Data:** 2.5 MB

| # | Column | Type | Null | Key | Default | Extra |
|---:|---|---|---|---|---|---|
| 1 | `cache_key` | `varchar(255)` | no | PRI |  |  |
| 2 | `svg` | `longtext` | YES |  |  |  |
| 3 | `created_at` | `timestamp` | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |

**Indexes**

| Index | Columns | Unique | Type |
|---|---|---|---|
| `PRIMARY` | `cache_key` | yes | BTREE |

### `kb.concept`

**Type:** table · **Engine:** InnoDB · **Est. rows:** 3,200,740 · **Data:** 385.9 MB · **Indexes:** 82.7 MB

| # | Column | Type | Null | Key | Default | Extra |
|---:|---|---|---|---|---|---|
| 1 | `conceptid` | `int` | no | PRI |  | auto_increment |
| 2 | `cui` | `varchar(25)` | no | MUL |  |  |
| 3 | `name` | `varchar(4096)` | YES | MUL |  |  |
| 4 | `type` | `varchar(10)` | YES |  |  |  |
| 5 | `low_name` | `varchar(4096)` | YES | MUL |  |  |

**Indexes**

| Index | Columns | Unique | Type |
|---|---|---|---|
| `PRIMARY` | `conceptid` | yes | BTREE |
| `cui_index` | `cui` | no | BTREE |
| `low_name_index` | `low_name` | no | BTREE |
| `name_index` | `name` | no | BTREE |

### `kb.epc`

**Type:** table · **Engine:** InnoDB · **Est. rows:** 2,427 · **Data:** 0.3 MB

| # | Column | Type | Null | Key | Default | Extra |
|---:|---|---|---|---|---|---|
| 1 | `epcid` | `int` | no | PRI |  | auto_increment |
| 2 | `CUI` | `varchar(50)` | YES |  |  |  |
| 3 | `EPC` | `varchar(512)` | YES |  |  |  |
| 4 | `type` | `varchar(50)` | YES |  |  |  |

**Indexes**

| Index | Columns | Unique | Type |
|---|---|---|---|
| `PRIMARY` | `epcid` | yes | BTREE |

### `kb.label_stats`

**Type:** table · **Engine:** InnoDB · **Est. rows:** 44,822 · **Data:** 8.5 MB

| # | Column | Type | Null | Key | Default | Extra |
|---:|---|---|---|---|---|---|
| 1 | `my_row_id` | `bigint unsigned` | no | PRI |  | auto_increment INVISIBLE |
| 2 | `set_id` | `varchar(100)` | no |  |  |  |
| 3 | `cui` | `varchar(50)` | YES |  |  |  |
| 4 | `nursing_mothers` | `int` | YES |  |  |  |
| 5 | `carcinogenesis_and_mutagenesis_and_impairment_of_fertility` | `int` | YES |  |  |  |
| 6 | `pregnancy` | `int` | YES |  |  |  |
| 7 | `pediatric_use` | `int` | YES |  |  |  |
| 8 | `teratogenic_effects` | `int` | YES |  |  |  |
| 9 | `pregnancy_or_breast_feeding` | `int` | YES |  |  |  |
| 10 | `labor_and_delivery` | `int` | YES |  |  |  |
| 11 | `nonteratogenic_effects` | `int` | YES |  |  |  |
| 12 | `TITLE` | `varchar(5120)` | YES |  |  |  |

**Indexes**

| Index | Columns | Unique | Type |
|---|---|---|---|
| `PRIMARY` | `my_row_id` | yes | BTREE |

### `kb.maternal_database_with_scores`

**Type:** table · **Engine:** InnoDB · **Est. rows:** 313,085 · **Data:** 1033.0 MB · **Indexes:** 16.5 MB

| # | Column | Type | Null | Key | Default | Extra |
|---:|---|---|---|---|---|---|
| 1 | `my_row_id` | `bigint unsigned` | no | PRI |  | auto_increment INVISIBLE |
| 2 | `Position` | `varchar(64)` | YES |  |  |  |
| 3 | `PMID` | `varchar(64)` | YES | UNI |  |  |
| 4 | `Title` | `text` | YES |  |  |  |
| 5 | `Year` | `varchar(64)` | YES |  |  |  |
| 6 | `Language` | `varchar(255)` | YES |  |  |  |
| 7 | `Abstract` | `text` | YES |  |  |  |
| 8 | `MeSH_terms_Descriptor` | `text` | YES |  |  |  |
| 9 | `MeSH_terms_Qualifier` | `text` | YES |  |  |  |
| 10 | `Publication_types` | `text` | YES |  |  |  |
| 11 | `Keywords` | `text` | YES |  |  |  |
| 12 | `drug_list` | `text` | YES |  |  |  |
| 13 | `id_list` | `text` | YES |  |  |  |
| 14 | `maternal_keyword` | `text` | YES |  |  |  |
| 15 | `maternal_mesh` | `text` | YES |  |  |  |
| 16 | `potential_kw` | `text` | YES |  |  |  |
| 17 | `Biomarker_pred` | `float` | YES |  |  |  |
| 18 | `CT_pred` | `float` | YES |  |  |  |
| 19 | `FBNSTP_pred` | `float` | YES |  |  |  |
| 20 | `PE_pred` | `float` | YES |  |  |  |
| 21 | `PK_pred` | `float` | YES |  |  |  |
| 22 | `VC_pred` | `float` | YES |  |  |  |
| 23 | `relevance_pred` | `float` | YES |  |  |  |
| 24 | `precalc_vector` | `text` | YES |  |  |  |
| 25 | `Score_CT` | `float` | YES |  |  |  |
| 26 | `Score_PK` | `float` | YES |  |  |  |
| 27 | `Score_PE` | `float` | YES |  |  |  |

**Indexes**

| Index | Columns | Unique | Type |
|---|---|---|---|
| `PRIMARY` | `my_row_id` | yes | BTREE |
| `idx_maternal_database_with_scores_pmid` | `PMID` | no | BTREE |
| `idx_maternal_scores_pmid` | `PMID` | no | BTREE |
| `uniq_pmid` | `PMID` | yes | BTREE |

### `kb.moa`

**Type:** table · **Engine:** InnoDB · **Est. rows:** 1,424 · **Data:** 0.2 MB

| # | Column | Type | Null | Key | Default | Extra |
|---:|---|---|---|---|---|---|
| 1 | `moaid` | `int` | no | PRI |  | auto_increment |
| 2 | `CUI` | `varchar(50)` | YES |  |  |  |
| 3 | `MOA` | `varchar(1024)` | YES |  |  |  |
| 4 | `type` | `varchar(50)` | YES |  |  |  |

**Indexes**

| Index | Columns | Unique | Type |
|---|---|---|---|
| `PRIMARY` | `moaid` | yes | BTREE |

### `kb.model2drug`

**Type:** table · **Engine:** InnoDB · **Est. rows:** 2,223 · **Data:** 0.1 MB

| # | Column | Type | Null | Key | Default | Extra |
|---:|---|---|---|---|---|---|
| 1 | `m2did` | `int` | no | PRI |  | auto_increment |
| 2 | `mid` | `varchar(25)` | no |  |  |  |
| 3 | `cui` | `varchar(25)` | YES |  |  |  |

**Indexes**

| Index | Columns | Unique | Type |
|---|---|---|---|
| `PRIMARY` | `m2did` | yes | BTREE |

### `kb.model2pop`

**Type:** table · **Engine:** InnoDB · **Est. rows:** 2,327 · **Data:** 0.1 MB

| # | Column | Type | Null | Key | Default | Extra |
|---:|---|---|---|---|---|---|
| 1 | `m2pid` | `int` | no | PRI |  | auto_increment |
| 2 | `mid` | `varchar(25)` | no |  |  |  |
| 3 | `type` | `varchar(25)` | YES |  |  |  |

**Indexes**

| Index | Columns | Unique | Type |
|---|---|---|---|
| `PRIMARY` | `m2pid` | yes | BTREE |

### `kb.model_detail`

**Type:** table · **Engine:** InnoDB · **Est. rows:** 1,782 · **Data:** 2.5 MB

| # | Column | Type | Null | Key | Default | Extra |
|---:|---|---|---|---|---|---|
| 1 | `mid` | `varchar(25)` | no | PRI |  |  |
| 2 | `Model type` | `varchar(50)` | YES |  |  |  |
| 3 | `Publication` | `blob` | YES |  |  |  |
| 4 | `Population` | `varchar(512)` | YES |  |  |  |
| 5 | `Drug` | `varchar(512)` | YES |  |  |  |
| 6 | `Disease` | `varchar(1024)` | YES |  |  |  |
| 7 | `PMID` | `varchar(50)` | YES |  |  |  |
| 8 | `Training data Reference` | `blob` | YES |  |  |  |
| 9 | `Training data` | `blob` | YES |  |  |  |
| 10 | `Program/code` | `blob` | YES |  |  |  |

**Indexes**

| Index | Columns | Unique | Type |
|---|---|---|---|
| `PRIMARY` | `mid` | yes | BTREE |

### `kb.new_pmid2disease`

**Type:** table · **Engine:** InnoDB · **Est. rows:** 2,832,468 · **Data:** 241.8 MB · **Indexes:** 202.4 MB

| # | Column | Type | Null | Key | Default | Extra |
|---:|---|---|---|---|---|---|
| 1 | `p2did` | `int` | no | PRI |  | auto_increment |
| 2 | `pmid` | `varchar(50)` | YES | MUL |  |  |
| 3 | `code` | `varchar(25)` | no |  |  |  |
| 4 | `cui` | `varchar(25)` | no | MUL |  |  |
| 5 | `text` | `varchar(1024)` | YES |  |  |  |
| 6 | `source` | `varchar(50)` | YES |  |  |  |

**Indexes**

| Index | Columns | Unique | Type |
|---|---|---|---|
| `PRIMARY` | `p2did` | yes | BTREE |
| `disease_cui_index` | `cui` | no | BTREE |
| `idx_new_pmid2disease_pmid` | `pmid` | no | BTREE |
| `pmid_index` | `pmid` | no | BTREE |

### `kb.new_pmid2drug`

**Type:** table · **Engine:** InnoDB · **Est. rows:** 22,459,871 · **Data:** 1644.0 MB · **Indexes:** 939.0 MB

| # | Column | Type | Null | Key | Default | Extra |
|---:|---|---|---|---|---|---|
| 1 | `p2cid` | `int` | no | PRI |  | auto_increment |
| 2 | `pmid` | `varchar(50)` | no | MUL |  |  |
| 3 | `souce` | `varchar(50)` | YES |  |  |  |
| 4 | `text` | `varchar(5000)` | YES |  |  |  |
| 5 | `code` | `varchar(25)` | YES |  |  |  |
| 6 | `cui` | `varchar(25)` | YES | MUL |  |  |

**Indexes**

| Index | Columns | Unique | Type |
|---|---|---|---|
| `PRIMARY` | `p2cid` | yes | BTREE |
| `idx_cui_pmid` | `cui`, `pmid` | no | BTREE |
| `idx_new_pmid2drug_pmid` | `pmid` | no | BTREE |
| `new_pmid2drug_cui_IDX` | `cui` | no | BTREE |
| `new_pmid2drug_pmid_IDX` | `pmid` | no | BTREE |

### `kb.new_population`

**Type:** table · **Engine:** InnoDB · **Est. rows:** 3,592,802 · **Data:** 200.7 MB · **Indexes:** 154.2 MB

| # | Column | Type | Null | Key | Default | Extra |
|---:|---|---|---|---|---|---|
| 1 | `poid` | `int` | no | PRI |  | auto_increment |
| 2 | `pmid` | `varchar(50)` | YES | MUL |  |  |
| 3 | `type` | `varchar(25)` | YES | MUL |  |  |
| 4 | `cate` | `varchar(25)` | YES |  |  |  |

**Indexes**

| Index | Columns | Unique | Type |
|---|---|---|---|
| `PRIMARY` | `poid` | yes | BTREE |
| `idx_new_population_pmid` | `pmid` | no | BTREE |
| `new_population_pmid_IDX` | `pmid` | no | BTREE |
| `new_population_type_IDX` | `type` | no | BTREE |

### `kb.new_pubmed_records`

**Type:** table · **Engine:** InnoDB · **Est. rows:** 964,953 · **Data:** 1928.0 MB

| # | Column | Type | Null | Key | Default | Extra |
|---:|---|---|---|---|---|---|
| 1 | `pmid` | `varchar(50)` | no | PRI |  |  |
| 2 | `title` | `varchar(5000)` | YES |  |  |  |
| 3 | `abstract` | `blob` | YES |  |  |  |
| 4 | `pubdate` | `varchar(10)` | YES |  |  |  |

**Indexes**

| Index | Columns | Unique | Type |
|---|---|---|---|
| `PRIMARY` | `pmid` | yes | BTREE |
| `idx_new_pubmed_records_pmid` | `pmid` | no | BTREE |

### `kb.new_study_type`

**Type:** table · **Engine:** InnoDB · **Est. rows:** 1,306,946 · **Data:** 57.6 MB · **Indexes:** 57.1 MB

| # | Column | Type | Null | Key | Default | Extra |
|---:|---|---|---|---|---|---|
| 1 | `stid` | `int` | no | PRI |  | auto_increment |
| 2 | `pmid` | `varchar(50)` | no | MUL |  |  |
| 3 | `type` | `varchar(200)` | no | MUL |  |  |

**Indexes**

| Index | Columns | Unique | Type |
|---|---|---|---|
| `PRIMARY` | `stid` | yes | BTREE |
| `idx_new_study_type_pmid_type` | `pmid`, `type` | no | BTREE |
| `new_study_type_pmid_IDX` | `pmid` | no | BTREE |
| `new_study_type_type_IDX` | `type` | no | BTREE |

### `kb.pe`

**Type:** table · **Engine:** InnoDB · **Est. rows:** 2,227 · **Data:** 0.2 MB

| # | Column | Type | Null | Key | Default | Extra |
|---:|---|---|---|---|---|---|
| 1 | `peid` | `int` | no | PRI |  | auto_increment |
| 2 | `CUI` | `varchar(50)` | YES |  |  |  |
| 3 | `PE` | `varchar(128)` | YES |  |  |  |
| 4 | `type` | `varchar(50)` | YES |  |  |  |

**Indexes**

| Index | Columns | Unique | Type |
|---|---|---|---|
| `PRIMARY` | `peid` | yes | BTREE |

### `kb.pediatric_database_with_scores`

**Type:** table · **Engine:** InnoDB · **Est. rows:** 729,945 · **Data:** 2252.0 MB · **Indexes:** 39.6 MB

| # | Column | Type | Null | Key | Default | Extra |
|---:|---|---|---|---|---|---|
| 1 | `my_row_id` | `bigint unsigned` | no | PRI |  | auto_increment INVISIBLE |
| 2 | `Position` | `varchar(64)` | YES |  |  |  |
| 3 | `PMID` | `varchar(64)` | YES | UNI |  |  |
| 4 | `Title` | `text` | YES |  |  |  |
| 5 | `Year` | `varchar(64)` | YES |  |  |  |
| 6 | `Language` | `varchar(255)` | YES |  |  |  |
| 7 | `Abstract` | `text` | YES |  |  |  |
| 8 | `MeSH_terms_Descriptor` | `text` | YES |  |  |  |
| 9 | `MeSH_terms_Qualifier` | `text` | YES |  |  |  |
| 10 | `Publication_types` | `text` | YES |  |  |  |
| 11 | `Keywords` | `text` | YES |  |  |  |
| 12 | `drug_list` | `text` | YES |  |  |  |
| 13 | `id_list` | `text` | YES |  |  |  |
| 14 | `pediatric_keyword` | `text` | YES |  |  |  |
| 15 | `pediatric_mesh` | `text` | YES |  |  |  |
| 16 | `potential_kw` | `text` | YES |  |  |  |
| 17 | `Biomarker_pred` | `float` | YES |  |  |  |
| 18 | `CT_pred` | `float` | YES |  |  |  |
| 19 | `FBNSTP_pred` | `float` | YES |  |  |  |
| 20 | `PE_pred` | `float` | YES |  |  |  |
| 21 | `PK_pred` | `float` | YES |  |  |  |
| 22 | `VC_pred` | `float` | YES |  |  |  |
| 23 | `relevance_pred` | `float` | YES |  |  |  |
| 24 | `precalc_vector` | `text` | YES |  |  |  |
| 25 | `Score_CT` | `float` | YES |  |  |  |
| 26 | `Score_PK` | `float` | YES |  |  |  |
| 27 | `Score_PE` | `float` | YES |  |  |  |

**Indexes**

| Index | Columns | Unique | Type |
|---|---|---|---|
| `PRIMARY` | `my_row_id` | yes | BTREE |
| `idx_pediatric_database_with_scores_pmid` | `PMID` | no | BTREE |
| `idx_pediatric_scores_pmid` | `PMID` | no | BTREE |
| `uniq_pmid` | `PMID` | yes | BTREE |

### `kb.pk`

**Type:** table · **Engine:** InnoDB · **Est. rows:** 25,252 · **Data:** 3.5 MB

| # | Column | Type | Null | Key | Default | Extra |
|---:|---|---|---|---|---|---|
| 1 | `pkid` | `int` | no | PRI |  | auto_increment |
| 2 | `property` | `varchar(50)` | YES |  |  |  |
| 3 | `value` | `varchar(10240)` | YES |  |  |  |
| 4 | `CUI` | `varchar(50)` | YES |  |  |  |

**Indexes**

| Index | Columns | Unique | Type |
|---|---|---|---|
| `PRIMARY` | `pkid` | yes | BTREE |

### `kb.pmid2disease`

**Type:** table · **Engine:** InnoDB · **Est. rows:** 319,744 · **Data:** 25.5 MB

| # | Column | Type | Null | Key | Default | Extra |
|---:|---|---|---|---|---|---|
| 1 | `p2did` | `int` | no | PRI |  | auto_increment |
| 2 | `pmid` | `varchar(50)` | no | MUL |  |  |
| 3 | `code` | `varchar(25)` | YES |  |  |  |
| 4 | `cui` | `varchar(25)` | YES | MUL |  |  |
| 5 | `text` | `varchar(100)` | YES |  |  |  |
| 6 | `source` | `varchar(50)` | YES |  |  |  |

**Indexes**

| Index | Columns | Unique | Type |
|---|---|---|---|
| `PRIMARY` | `p2did` | yes | BTREE |
| `disease_cui_index` | `cui` | no | BTREE |
| `pmid_index` | `pmid` | no | BTREE |

### `kb.pmid2drug`

**Type:** table · **Engine:** InnoDB · **Est. rows:** 6,590,510 · **Data:** 279.8 MB · **Indexes:** 438.8 MB

| # | Column | Type | Null | Key | Default | Extra |
|---:|---|---|---|---|---|---|
| 1 | `p2cid` | `int` | no | PRI |  | auto_increment |
| 2 | `pmid` | `varchar(50)` | no | MUL |  |  |
| 3 | `source` | `varchar(50)` | YES |  |  |  |
| 4 | `code` | `varchar(25)` | YES |  |  |  |
| 5 | `cui` | `varchar(25)` | YES | MUL |  |  |
| 6 | `text` | `varchar(100)` | YES |  |  |  |

**Indexes**

| Index | Columns | Unique | Type |
|---|---|---|---|
| `PRIMARY` | `p2cid` | yes | BTREE |
| `drug_cui_index` | `cui` | no | BTREE |
| `pmid_index` | `pmid` | no | BTREE |

### `kb.population`

**Type:** table · **Engine:** InnoDB · **Est. rows:** 309,309 · **Data:** 15.5 MB

| # | Column | Type | Null | Key | Default | Extra |
|---:|---|---|---|---|---|---|
| 1 | `my_row_id` | `bigint unsigned` | no | PRI |  | auto_increment INVISIBLE |
| 2 | `poid` | `int` | no |  |  |  |
| 3 | `pmid` | `varchar(50)` | YES | MUL |  |  |
| 4 | `type` | `varchar(25)` | YES | MUL |  |  |

**Indexes**

| Index | Columns | Unique | Type |
|---|---|---|---|
| `PRIMARY` | `my_row_id` | yes | BTREE |
| `pmid_index` | `pmid` | no | BTREE |
| `pop_type` | `type` | no | BTREE |

### `kb.pubmed_author_affiliation`

**Type:** table · **Engine:** InnoDB · **Est. rows:** 2,565,009 · **Data:** 359.9 MB · **Indexes:** 565.6 MB

| # | Column | Type | Null | Key | Default | Extra |
|---:|---|---|---|---|---|---|
| 1 | `my_row_id` | `bigint unsigned` | no | PRI |  | auto_increment INVISIBLE |
| 2 | `PMID` | `varchar(64)` | no | MUL |  |  |
| 3 | `author` | `text` | YES |  |  |  |
| 4 | `affiliation` | `text` | YES |  |  |  |

**Indexes**

| Index | Columns | Unique | Type |
|---|---|---|---|
| `PRIMARY` | `my_row_id` | yes | BTREE |
| `idx_pmid` | `PMID` | no | BTREE |
| `uniq_pmid_author_affiliation` | `PMID`, `author`, `affiliation` | yes | BTREE |

### `kb.pubmed_records`

**Type:** table · **Engine:** InnoDB · **Est. rows:** 299,724 · **Data:** 577.0 MB · **Indexes:** 15.5 MB

| # | Column | Type | Null | Key | Default | Extra |
|---:|---|---|---|---|---|---|
| 1 | `my_row_id` | `bigint unsigned` | no | PRI |  | auto_increment INVISIBLE |
| 2 | `pmid` | `varchar(50)` | YES | MUL |  |  |
| 3 | `title` | `varchar(500)` | YES |  |  |  |
| 4 | `abstract` | `blob` | YES |  |  |  |
| 5 | `pubdate` | `varchar(10)` | YES |  |  |  |

**Indexes**

| Index | Columns | Unique | Type |
|---|---|---|---|
| `PRIMARY` | `my_row_id` | yes | BTREE |
| `pmid_index` | `pmid` | no | BTREE |

### `kb.pubmed_view`

**Type:** view · **Est. rows:** -

| # | Column | Type | Null | Key | Default | Extra |
|---:|---|---|---|---|---|---|
| 1 | `pmid` | `varchar(50)` | YES |  |  |  |
| 2 | `pubdate` | `varchar(10)` | YES |  |  |  |
| 3 | `title` | `varchar(500)` | YES |  |  |  |
| 4 | `drug_cui` | `varchar(25)` | YES |  |  |  |
| 5 | `drug_name` | `varchar(100)` | YES |  |  |  |
| 6 | `disease_cui` | `varchar(25)` | YES |  |  |  |
| 7 | `disease_name` | `varchar(100)` | YES |  |  |  |
| 8 | `study_type` | `varchar(10)` | YES |  |  |  |
| 9 | `population` | `varchar(25)` | YES |  |  |  |

**View definition**

```sql
(not available to this account)
```

### `kb.rel`

**Type:** table · **Engine:** InnoDB · **Est. rows:** 7,568,636 · **Data:** 803.0 MB

| # | Column | Type | Null | Key | Default | Extra |
|---:|---|---|---|---|---|---|
| 1 | `rui` | `varchar(25)` | no | PRI |  |  |
| 2 | `cui1` | `varchar(25)` | YES | MUL |  |  |
| 3 | `rel` | `varchar(10)` | YES |  |  |  |
| 4 | `cui2` | `varchar(25)` | YES |  |  |  |
| 5 | `sab` | `varchar(50)` | YES |  |  |  |

**Indexes**

| Index | Columns | Unique | Type |
|---|---|---|---|
| `PRIMARY` | `rui` | yes | BTREE |
| `cui_index` | `cui1` | no | BTREE |

### `kb.spl`

**Type:** table · **Engine:** InnoDB · **Est. rows:** 101,748 · **Data:** 158.7 MB

| # | Column | Type | Null | Key | Default | Extra |
|---:|---|---|---|---|---|---|
| 1 | `splid` | `int` | no | PRI |  | auto_increment |
| 2 | `set_id` | `varchar(100)` | no |  |  |  |
| 3 | `cui` | `varchar(25)` | no |  |  |  |
| 4 | `Section` | `varchar(100)` | YES |  |  |  |
| 5 | `Contents` | `blob` | YES |  |  |  |
| 6 | `drugname` | `varchar(512)` | YES |  |  |  |

**Indexes**

| Index | Columns | Unique | Type |
|---|---|---|---|
| `PRIMARY` | `splid` | yes | BTREE |

### `kb.study_type`

**Type:** table · **Engine:** InnoDB · **Est. rows:** 100,826 · **Data:** 4.5 MB

| # | Column | Type | Null | Key | Default | Extra |
|---:|---|---|---|---|---|---|
| 1 | `stid` | `int` | no | PRI |  | auto_increment |
| 2 | `pmid` | `varchar(50)` | no | MUL |  |  |
| 3 | `type` | `varchar(10)` | YES | MUL |  |  |

**Indexes**

| Index | Columns | Unique | Type |
|---|---|---|---|
| `PRIMARY` | `stid` | yes | BTREE |
| `pmid_index` | `pmid` | no | BTREE |
| `st_index` | `type` | no | BTREE |

---

## Schema `kb_app`

### `kb_app.cache_label_section`

**Type:** table · **Engine:** InnoDB · **Est. rows:** 12 · **Data:** 0.0 MB

| # | Column | Type | Null | Key | Default | Extra |
|---:|---|---|---|---|---|---|
| 1 | `cache_key` | `varchar(80)` | no | PRI |  |  |
| 2 | `status` | `varchar(32)` | no |  |  |  |
| 3 | `title` | `varchar(512)` | YES |  |  |  |
| 4 | `html` | `longtext` | YES |  |  |  |
| 5 | `created_at` | `timestamp` | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |

**Indexes**

| Index | Columns | Unique | Type |
|---|---|---|---|
| `PRIMARY` | `cache_key` | yes | BTREE |

### `kb_app.cache_word_cloud`

**Type:** table · **Engine:** InnoDB · **Est. rows:** 396 · **Data:** 12.5 MB

| # | Column | Type | Null | Key | Default | Extra |
|---:|---|---|---|---|---|---|
| 1 | `cache_key` | `varchar(255)` | no | PRI |  |  |
| 2 | `svg` | `longtext` | YES |  |  |  |
| 3 | `created_at` | `timestamp` | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |

**Indexes**

| Index | Columns | Unique | Type |
|---|---|---|---|
| `PRIMARY` | `cache_key` | yes | BTREE |

### `kb_app.feedback`

**Type:** table · **Engine:** InnoDB · **Est. rows:** 0 · **Data:** 0.0 MB

| # | Column | Type | Null | Key | Default | Extra |
|---:|---|---|---|---|---|---|
| 1 | `id` | `int unsigned` | no | PRI |  | auto_increment |
| 2 | `additional_data` | `text` | YES |  |  |  |
| 3 | `exclude_data` | `text` | YES |  |  |  |
| 4 | `recommended_publications` | `text` | YES |  |  |  |
| 5 | `additional_comments` | `text` | YES |  |  |  |
| 6 | `submitted_at` | `timestamp` | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| 7 | `ip_address` | `varchar(45)` | YES |  |  |  |

**Indexes**

| Index | Columns | Unique | Type |
|---|---|---|---|
| `PRIMARY` | `id` | yes | BTREE |

---

## Notes

- **No foreign-key constraints are declared** anywhere in `kb` or `kb_app`.
  Joins are by convention (`pmid` / `PMID`, `cui`) and referential integrity is not enforced
  by the database.

