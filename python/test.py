from openai import OpenAI
import pandas as pd
import io
from utils.eval_tools import Validate 
from utils.RagCheck import RAGCheck

def call_gpt(prompt):
  client = OpenAI()
  completion = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
      {"role": "system", "content": "You are an evals generator."},
      {"role": "user", "content": prompt}
    ]
  )
  return completion.choices[0].message

def extend_evals(data): # data is a pandas dataframe or a csv string
  if type(data) != str:
    csv = df.to_csv(index=False, header=True)
  
  prompt = f'Generate some more evals in the likeness of this csv: {csv}. ONLY return a csv with the same columns.'
  response = call_gpt(prompt)
  return response.content

def create_evals(eval_prompt):
  prompt = f'Generate some evals based on this prompt: {eval_prompt}. ONLY return a csv with the columns question, choices, answer'
  response = call_gpt(prompt)
  return response

def edit_evals(data, eval_instructions): # data is a pandas dataframe or a csv string
  if type(data) != str:
    csv = df.to_csv(index=False, header=True)
  
  prompt = f'Edit these evals based off these instructions: {eval_instructions}: {csv}. ONLY return a csv with the same columns.'
  response = call_gpt(prompt)
  return response

if __name__ == '__main__':
  # splits = {'test': 'all/test-00000-of-00001.parquet', 'validation': 'all/validation-00000-of-00001.parquet', 'dev': 'all/dev-00000-of-00001.parquet', 'auxiliary_train': 'all/auxiliary_train-00000-of-00001.parquet'}
  # df = pd.read_parquet("hf://datasets/cais/mmlu/" + splits["dev"])

  splits = {'test': 'data/test-00000-of-00001.parquet', 'validation': 'data/validation-00000-of-00001.parquet'}
  df = pd.read_parquet("mmlu data.parquet")

  first_five = df.head()


