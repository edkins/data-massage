from openai import OpenAI
import pandas as pd
import io
from utils.eval_tools import Validate 
from utils.RagCheck import RAGCheck
import utils.utils as ut
from utils import csv_manipulation

def remove_duplicates(data, threshold=0.7): # data is a pandas dataframe or a csv string
  if isinstance(data, pd.DataFrame):
    csv = data.to_csv(index=False, header=True)
  else:
    csv_data = io.StringIO(data)
    df = pd.read_csv(csv_data)
    csv = df.to_csv(index=False, header=True)

  val = Validate()
  return val.filter_similar_items(csv, threshold)

def extend_evals(data, hint, amount=201): # data is a pandas dataframe or a csv string
  csv, translator = csv_manipulation.remove_human_columns(data)

  if hint == '':
    prompt = f'Generate {amount} evals in the likeness of this csv: {csv}.  ONLY return a csv WITH THE SAME COLUMNS. DO NOT SURROUND WITH BACKTICKS'
  else:
    prompt = f'Generate {amount} evals in the likeness of this csv. Follow these instructions: {hint}. Here is the csv: {csv}.  ONLY return a csv WITH THE SAME COLUMNS. DO NOT SURROUND WITH BACKTICKS'
  
  response = ut.call_gpt(prompt)
  df = csv_manipulation.read_llm_csv_output(response, translator.kept_columns)
  reconstructed = translator.reconstitute(df)

  return reconstructed.to_csv(index=False, header=False)

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
