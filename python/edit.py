import sys
from utils import csv_manipulation
import utils.utils as ut

def remove_dodgy(data) -> tuple[str,int]:
    """
    Remove dodgy data from the input data.

    Args:
        data: A CSV string or pandas dataframe.

    Returns:
        str: A CSV string with the dodgy data removed.
        int: number of rows considered
    """
    df_all = csv_manipulation.to_df(data)
    dodgy = csv_manipulation.find_dodgy_rows(df_all)
    num_dodgy = dodgy.sum()
    
    # Remove the dodgy rows
    df_clean = df_all[~dodgy]
    
    return df_clean.to_csv(index=False), int(num_dodgy)

def edit_dodgy(data, hint:str) -> tuple[str,int,int]:
    """
    Edit the dodgy data in the input data.

    Args:
        data: A CSV string or pandas dataframe.
        hint (str): A hint to help the user correct the data.

    Returns:
        str: A CSV string with the dodgy data corrected.
        int: number of rows considered
        int: number of rows corrected
    """
    df_all = csv_manipulation.to_df(data)
    dodgy = csv_manipulation.find_dodgy_rows(df_all)
    num_dodgy = dodgy.sum()
    df_all_nohuman, translator = csv_manipulation.remove_human_columns_df(df_all)
    df_dodgy_nohuman, _ = csv_manipulation.remove_human_columns_df(df_all[dodgy])
    csv = df_dodgy_nohuman.to_csv(index=False, header=True)

    if hint == '':
        hint = 'try to fix any inaccuracies'

    prompt = f"""Please correct the following data according to the hint provided.

Hint: {hint}

---begin csv---
{csv}
---end csv---

ONLY return a csv WITH THE SAME COLUMNS and the same number of rows in the same order. DO NOT SURROUND WITH BACKTICKS
    """
    response = ut.call_gpt(prompt)
    df_dodgy_corrected_nohuman = csv_manipulation.read_llm_csv_output(response, translator.kept_columns, index=df_dodgy_nohuman.index)
    #print(df_dodgy_corrected_nohuman, file=sys.stderr)
    if len(df_dodgy_corrected_nohuman) != num_dodgy:
        raise ValueError(f"The number of rows in the corrected data does not match the original data. {len(df_dodgy_corrected_nohuman)} != {num_dodgy}")
    
    df_all_corrected_nohuman = df_all_nohuman.copy()
    df_all_corrected_nohuman.loc[dodgy] = df_dodgy_corrected_nohuman
    was_corrected = (df_all_corrected_nohuman != df_all_nohuman).any(axis=1)
    num_corrected = was_corrected.sum()

    df_all.loc[was_corrected] = translator.reconstitute(df_all_corrected_nohuman[was_corrected])
    return df_all.to_csv(index=False), int(num_dodgy), int(num_corrected)