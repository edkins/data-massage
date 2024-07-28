import numpy as np
import pandas as pd
import csv
from io import StringIO
from sentence_transformers import SentenceTransformer
import spacy
import wikipediaapi

class Validate():
    def __init__(self):
      self.model = SentenceTransformer('paraphrase-MiniLM-L6-v2')
      self.nlp = spacy.load("en_core_web_sm")
      self.wiki = wikipediaapi.Wikipedia('Bias/0.0 (xxxx@gmail.com)','en')

    def get_embedding(self, sentences):
      embeddings = self.model.encode(sentences)
      return embeddings

    def filter_similar_items(self, csv_string, threshold=0.5):
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

        try:
          questions = df['question'].tolist()
        except:
          questions = df[df.columns[0]].tolist()

        embeddings = self.get_embedding(questions)
        
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

    def extract_keywords(self, text):
        """
        Extract keywords from a given text using spaCy.
        
        Args:
            text (str): The input text (question) from which to extract keywords.
        
        Returns:
            list: A list of extracted keywords.
        """
        doc = self.nlp(text)
        keywords = []
        
        # Extracting nouns, proper nouns, and named entities
        for token in doc:
            if token.pos_ in ["NOUN", "PROPN"]:
                keywords.append(token.text)
        
        for ent in doc.ents:
            keywords.append(ent.text)
        
        # Removing duplicates
        keywords = list(set(keywords))
        
        return keywords

    def validate(self, csv):
        df = self.filter_similar_items(csv)
        return df.to_csv(index=False, header=True)