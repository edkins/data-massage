from openai import OpenAI
import pandas as pd
import io
from utils import eval_tools as et

def call_gpt(prompt):
  client = OpenAI()
  completion = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
      {"role": "system", "content": "You are an evals generator."},
      {"role": "user", "content": prompt}
    ]
  )
  return completion.choices[0].message.content

def extend_evals(data): # data is a pandas dataframe or a csv string
  if type(data) != str:
    csv = df.to_csv(index=False, header=True)
  
  prompt = f'Generate some more evals in the likeness of this csv: {csv}. ONLY return a csv with the same columns.'
  response = call_gpt(prompt)
  validated = et.validate(response)
  
  return validated

if __name__ == '__main__':
  # splits = {'test': 'all/test-00000-of-00001.parquet', 'validation': 'all/validation-00000-of-00001.parquet', 'dev': 'all/dev-00000-of-00001.parquet', 'auxiliary_train': 'all/auxiliary_train-00000-of-00001.parquet'}
  # df = pd.read_parquet("hf://datasets/cais/mmlu/" + splits["dev"])

  splits = {'test': 'data/test-00000-of-00001.parquet', 'validation': 'data/validation-00000-of-00001.parquet'}
  df = pd.read_parquet("mmlu data.parquet")

  first_row = df.iloc[0:1]
  extend_evals(first_row)


