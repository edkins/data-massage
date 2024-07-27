from openai import OpenAI
import pandas as pd
import io

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

def extend_evals(df):
  csv = df.to_csv(index=False, header=True)
  prompt = f'Generate some more evals in the likeness of this csv: {csv}. ONLY return a csv with the same columns.'
  response = call_gpt(prompt)
  output_data = pd.read_csv(io.StringIO(response))

  print(response)
  print(output_data)

  return response



splits = {'test': 'all/test-00000-of-00001.parquet', 'validation': 'all/validation-00000-of-00001.parquet', 'dev': 'all/dev-00000-of-00001.parquet', 'auxiliary_train': 'all/auxiliary_train-00000-of-00001.parquet'}
df = pd.read_parquet("hf://datasets/cais/mmlu/" + splits["dev"])

first_row = df.iloc[0:1]
extend_evals(first_row)


