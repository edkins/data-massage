import openai
import numpy as np
import pandas as pd
import csv
from io import StringIO
from sentence_transformers import SentenceTransformer

def init_model():
  model = SentenceTransformer('paraphrase-MiniLM-L6-v2')
  return model

def get_embedding(sentences, model):
  embeddings = model.encode(sentences)
  return embeddings


def filter_similar_items(csv_string, model, threshold=0.5):
    """
    Filter out similar items from a CSV string containing 'question' and 'answer' columns.
    
    Args:
        csv_string (str): CSV string with 'question' and 'answer' columns.
        threshold (float): Similarity threshold to filter out items. Default is 0.5.
    
    Returns:
        DataFrame: A DataFrame of filtered data items ensuring diversity.
    """
    # Parse the CSV string
    f = StringIO(csv_string)
    reader = csv.DictReader(f)
    
    # Read the data into a DataFrame
    df = pd.DataFrame(reader)
    # Concatenate 'question' and 'answer' columns
    
    # Compute embeddings for all combined items
    embeddings = get_embedding(df['question'], model=model)
    
    # Convert embeddings to numpy array
    embeddings = np.array(embeddings)
    # Calculate the similarity matrix (Euclidean distance)
    similarity_matrix = np.sqrt(np.sum((embeddings[:, np.newaxis] - embeddings[np.newaxis, :]) ** 2, axis=-1))
    
    # Identify pairs with similarity below the threshold and remove duplicates
    to_remove = set()
    for i in range(len(df)):
        for j in range(i + 1, len(df)):
            if similarity_matrix[i, j] < threshold:
                to_remove.add(j if np.random.rand() > 0.5 else i)
    
    # Filter out the items
    final_df = df.drop(list(to_remove)).reset_index(drop=True)
    
    return final_df

def validate(csv):
    model = init_model()
    df = filter_similar_items(csv, model)
    return df.to_csv(index=False, header=True)

