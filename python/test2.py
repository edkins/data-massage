from openai import OpenAI
import pandas as pd
import io
from utils.eval_tools import Validate 
from utils.RagCheck import RAGCheck
import utils.utils as ut


def extend_evals(data): # data is a pandas dataframe or a csv string
  if type(data) != str:
    csv = data.to_csv(index=False, header=True)
  
  prompt = f'Generate some more evals in the likeness of this csv: {csv}. ONLY return a csv with the same columns.'
  response = ut.call_claude(prompt)
  validator = Validate()
  ragcheck = RAGCheck()
  
  print(response)

  validated = validator.validate(response)
  ragchecked = ragcheck.rag_check(validated)
  print(ragchecked)
  return validated

def human_insert(data: str, row:int, column:str, value:str) -> str:
  df = pd.read_csv(io.StringIO(data))
  df.loc[row - 2, column] = value
  return df.to_csv(index=False, header=True)

def human_eval(data: str, column:str) -> int:
  """
  Return the index of an arbitrary row where df[column] is ''
  We add two to the index because the first row (row 1) is the header row
  """
  df = pd.read_csv(io.StringIO(data))
  # Find a random row where df[column] is ''
  row = df[df[column] == ''].sample().index[0]
  return row + 2

if __name__ == '__main__':
  # splits = {'test': 'all/test-00000-of-00001.parquet', 'validation': 'all/validation-00000-of-00001.parquet', 'dev': 'all/dev-00000-of-00001.parquet', 'auxiliary_train': 'all/auxiliary_train-00000-of-00001.parquet'}
  # df = pd.read_parquet("hf://datasets/cais/mmlu/" + splits["dev"])

  splits = {'test': 'data/test-00000-of-00001.parquet', 'validation': 'data/validation-00000-of-00001.parquet'}
  df = pd.read_parquet("mmlu data.parquet")

  first_row = df.iloc[0:5]
  print(first_row.head())
  extend_evals(first_row)

