from openai import OpenAI
import pandas as pd
import io
from utils.eval_tools import Validate 
from utils.RagCheck import RAGCheck
import utils.utils as ut


def extend_evals(data): # data is a pandas dataframe or a csv string

  if isinstance(data, pd.DataFrame):
    csv = data.to_csv(index=False, header=True)
  else:
    csv_data = io.StringIO(data)
    df = pd.read_csv(csv_data)
    csv = df.to_csv(index=False, header=True)

  prompt = f'Generate some more evals in the likeness of this csv: {csv}. ONLY return a csv WITH THE SAME COLUMNS. DO NOT SURROUND WITH BACKTICKS'
  response = ut.call_gpt(prompt)
  validator = Validate()
  ragcheck = RAGCheck()
  
  validated = validator.validate(response)
  ragchecked = ragcheck.rag_check(validated)

  return ragchecked

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

  # splits = {'test': 'data/test-00000-of-00001.parquet', 'validation': 'data/validation-00000-of-00001.parquet'}
  # df = pd.read_parquet("mmlu data.parquet")
  string = '''question,answer,choices
AN,1,[1 2 3]
AO,2,[1 2 3]
AP,3,[1 2 3]
AQ,1,[1 2 3]
AR,2,[1 2 3]
AS,3,[1 2 3]
AT,1,[1 2 3]
AU,2,[1 2 3]
AV,3,[1 2 3]'''
  print(extend_evals(string))  
