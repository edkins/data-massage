import pandas as pd
import sys
import io
from typing import Optional

def human_insert(data: str, row:Optional[int], column:str, value:str) -> str:
  df = pd.read_csv(io.StringIO(data))
  if column not in df.columns:
    df[column] = ''    # add the column and fill with blank values
  if row is not None:
    df.loc[row - 2, column] = value
  return df.to_csv(index=False, header=True)

def human_eval(data: str, column:str) -> tuple[int, dict[str,str]]:
  """
  Return the index of an arbitrary row where df[column] is ''
  We add two to the index because the first row (row 1) is the header row
  """
  df = pd.read_csv(io.StringIO(data))
  # Find a random row where df[column] is ''
  opportunities = (df[column] == '') | df[column].isna()
  if opportunities.sum() == 0:
    raise ValueError(f"No opportunities found in column {column}")
  row = df[opportunities].sample(1).index[0]
  qa = df.loc[row].to_dict()
  return (int(row) + 2, qa)

def human_eval_fix(data, row: int, column: str, hint: str) -> str:
  import utils.utils as ut
  from utils.csv_manipulation import read_llm_csv_output, remove_human_columns
  df = pd.read_csv(io.StringIO(data))
  mini_csv, translator = remove_human_columns(df.loc[row - 2:row - 1])
  prompt = f"""Please correct the following single-row CSV data according to the hint provided.

Hint: {hint}

---begin csv---
{mini_csv}
---end csv---

ONLY return a csv WITH THE SAME COLUMNS and a single data row (plus header). DO NOT SURROUND WITH BACKTICKS
"""
  response = ut.call_gpt(prompt)
  corrected = read_llm_csv_output(response, translator.kept_columns, index=df.index[row - 2:row-1])
  print(corrected, file=sys.stderr)
  reconstituted = translator.reconstitute(corrected)
  print(reconstituted, file=sys.stderr)
  print(len(reconstituted), file=sys.stderr)
  df.loc[row - 2:row - 2] = reconstituted.loc[row - 2:row - 2]
  return df.to_csv(index=False, header=True)
