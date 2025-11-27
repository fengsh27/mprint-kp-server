import pandas as pd
import ast
import sqlite3
import json
import re
from typing import Optional


def process_drug_class(file_path: str) -> pd.DataFrame:
    """
    Read a TSV file (CSV with tab delimiter) and extract important columns.
    
    Args:
        file_path: Path to the TSV file to read
        
    Returns:
        DataFrame containing the important columns:
        - GENNME_manual
        - level1
        - level2
        - level3
        - count_all
        - count_pkpect
        - count_pect
        - count_pk
        - count_pe
        - count_ct
        - count_vc
        - count_fbnstp
        - count_biomarker
    """
    # Read the TSV file with tab delimiter
    df = pd.read_csv(file_path, sep='\t', dtype=str)
    
    # Define the important columns to extract
    important_columns = [
        'GENNME_manual',
        'level1',
        'level2',
        'level3',
        'count_all',
        'count_pkpect',
        'count_pect',
        'count_pk',
        'count_pe',
        'count_ct',
        'count_vc',
        'count_fbnstp',
        'count_biomarker'
    ]
    
    # Check which columns exist in the file
    available_columns = [col for col in important_columns if col in df.columns]
    
    # Extract only the available important columns
    result_df = df # [available_columns].copy()
    
    # Parse list columns (level1, level2, level3) from string representations to actual lists
    # list_columns = ['level1', 'level2', 'level3', 'ATCs']
    # for col in list_columns:
    #    if col in result_df.columns:
    #        result_df[col] = result_df[col].apply(
    #            lambda x: ast.literal_eval(x) if pd.notna(x) and isinstance(x, str) else x
    #        )
    
    return result_df


def save_to_sqlite3(db_path: str, table_name: str, result: pd.DataFrame) -> None:
    """
    Save a pandas DataFrame to a SQLite3 database table.
    
    Args:
        db_path: Path to the SQLite database file
        table_name: Name of the table to create/overwrite
        result: DataFrame to save with columns:
            - GENNME_manual (VARCHAR(255))
            - Subpopulation (int) - column name may be "peds: 0~1", "peds: 13~17", "postpartum", etc.
            - parsed_dict (text)
            - CUIs (text)
            - ATCs (json)
            - level1 (json)
            - level2 (json)
            - level3 (json)
            - count_all (int)
            - count_pkpect (int)
            - count_pect (int)
            - count_pk (int)
            - count_pe (int)
            - count_ct (int)
            - count_vc (int)
            - count_fbnstp (int)
            - count_biomarker (int)
    """
    # Create a copy to avoid modifying the original DataFrame
    df = result.copy()
    
    # Find and rename the Subpopulation column
    # Look for columns matching patterns like "peds: *" or "postpartum"
    subpopulation_col = None
    for col in df.columns:
        if re.match(r'^peds:\s*\d+~\d+$', col) or \
            col.lower() == 'postpartum' or \
            col.lower() == 'pregnancy':
            subpopulation_col = col
            break
    
    if subpopulation_col:
        df = df.rename(columns={subpopulation_col: 'Subpopulation'})
        # Convert Subpopulation to integer
        df['Subpopulation'] = pd.to_numeric(df['Subpopulation'], errors='coerce').astype('Int64')
    elif 'Subpopulation' not in df.columns:
        raise ValueError("Could not find Subpopulation column (expected pattern: 'peds: *' or 'postpartum')")
    
    # Prepare the DataFrame for SQLite insertion
    # Convert JSON columns (ATCs, level1, level2, level3) to JSON strings
    json_columns = ['ATCs', 'level1', 'level2', 'level3']
    for col in json_columns:
        if col in df.columns:
            def convert_to_json(x):
                if pd.isna(x):
                    return None
                if isinstance(x, str):
                    # If it's already a string, try to parse it first, then convert back to JSON
                    try:
                        parsed = ast.literal_eval(x)
                        return json.dumps(parsed)
                    except:
                        return x
                # If it's already a list or dict, convert to JSON string
                return json.dumps(x)
            
            df[col] = df[col].apply(convert_to_json)
    
    # Convert count columns to integers
    count_columns = [
        'count_all', 'count_pkpect', 'count_pect', 'count_pk', 
        'count_pe', 'count_ct', 'count_vc', 'count_fbnstp', 'count_biomarker'
    ]
    for col in count_columns:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').astype('Int64')
    
    # Ensure GENNME_manual is string and truncate if necessary
    if 'GENNME_manual' in df.columns:
        df['GENNME_manual'] = df['GENNME_manual'].astype(str).str[:255]
    
    # Convert parsed_dict and CUIs to strings (text)
    if 'parsed_dict' in df.columns:
        df['parsed_dict'] = df['parsed_dict'].astype(str)
    if 'CUIs' in df.columns:
        df['CUIs'] = df['CUIs'].astype(str)
    
    # Connect to SQLite database
    conn = sqlite3.connect(db_path)
    
    try:
        # Create table with the specified schema
        create_table_sql = f"""
        CREATE TABLE IF NOT EXISTS {table_name} (
            GENNME_manual VARCHAR(255),
            Subpopulation INTEGER,
            parsed_dict TEXT,
            CUIs TEXT,
            ATCs JSON,
            level1 JSON,
            level2 JSON,
            level3 JSON,
            count_all INTEGER,
            count_pkpect INTEGER,
            count_pect INTEGER,
            count_pk INTEGER,
            count_pe INTEGER,
            count_ct INTEGER,
            count_vc INTEGER,
            count_fbnstp INTEGER,
            count_biomarker INTEGER
        )
        """
        conn.execute(create_table_sql)
        
        # Clear existing data (safe even if table is empty)
        conn.execute(f"DELETE FROM {table_name}")
        
        # Prepare columns for insertion (only include columns that exist in DataFrame)
        required_columns = [
            'GENNME_manual', 'Subpopulation', 'parsed_dict', 'CUIs', 'ATCs',
            'level1', 'level2', 'level3', 'count_all', 'count_pkpect', 
            'count_pect', 'count_pk', 'count_pe', 'count_ct', 'count_vc', 
            'count_fbnstp', 'count_biomarker'
        ]
        
        available_columns = [col for col in required_columns if col in df.columns]
        
        # Insert data
        df[available_columns].to_sql(
            table_name, 
            conn, 
            if_exists='append', 
            index=False,
            method='multi'
        )
        
        # Commit the transaction
        conn.commit()
        
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


if __name__ == "__main__":
    result = process_drug_class("data/2_ped1218_drug_with_count.txt")
    save_to_sqlite3("data/drug_class.db", "ped1218", result)

    result = process_drug_class("data/2_ped112_drug_with_count.txt")
    save_to_sqlite3("data/drug_class.db", "ped112", result)

    result = process_drug_class("data/2_ped01_drug_with_count.txt")
    save_to_sqlite3("data/drug_class.db", "ped01", result)

    result = process_drug_class("data/2_postpartum_drug_with_count.txt")
    save_to_sqlite3("data/drug_class.db", "postpartum", result)

    result = process_drug_class("data/2_pregnancy_drug_with_count.txt")
    save_to_sqlite3("data/drug_class.db", "pregnancy", result)