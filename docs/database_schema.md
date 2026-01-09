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

