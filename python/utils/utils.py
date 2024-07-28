from openai import OpenAI
import anthropic

def call_gpt(prompt):
  client = OpenAI()
  completion = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
      {"role": "system", "content": "You are an evals generator. If you get a CSV, return a CSV with the same columns."},
      {"role": "user", "content": prompt}
    ]
  )
  return completion.choices[0].message.content

def call_claude(prompt):
  client = anthropic.Anthropic()

  message = client.messages.create(
      model="claude-3-5-sonnet-20240620",
      max_tokens=1000,
      temperature=0,
      system="You are an evals generator.",
      messages=[
          {
              "role": "user",
              "content": [
                  {
                      "type": "text",
                      "text": prompt
                  }
              ]
          }
      ]
  )

  return message.content[0].text