import pandas as pd
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
