import pandas as pd
import numpy as np
import wikipediaapi
from sentence_transformers import SentenceTransformer, util
import spacy
from io import StringIO
from openai import OpenAI
from .utils import call_gpt, call_claude

def init_model():
    model = SentenceTransformer('paraphrase-MiniLM-L6-v2')
    return model

class RAGCheck:
    def __init__(self):
        self.nlp = spacy.load("en_core_web_sm")
        self.model = init_model()
        self.wiki_wiki = wikipediaapi.Wikipedia('Bias/0.0 (xxxx@gmail.com)','en')


    def extract_keywords(self, text):
        """
        Extract keywords from a given text using spaCy.
        """
        doc = self.nlp(text)
        keywords = [token.text for token in doc if token.pos_ in ["NOUN", "PROPN"]]
        keywords += [ent.text for ent in doc.ents]
        return list(set(keywords))

    def get_wikipedia_pages(self, keywords):
        """
        Retrieve Wikipedia pages based on the provided keywords.
        """
        pages = []
        for keyword in keywords:
            page = self.wiki_wiki.page(keyword)
            if page.exists():
                pages.append(page.text)
        return pages

    def chunk_text(self, text, chunk_size=200):
        """
        Split the text into chunks of specified size.
        """
        words = text.split()
        return [' '.join(words[i:i + chunk_size]) for i in range(0, len(words), chunk_size)]

    def get_top_chunks(self, question, chunks, top_k=3):
        """
        Get the top K most similar chunks to the question.
        """
        question_embedding = self.model.encode(question, convert_to_tensor=True)
        chunk_embeddings = self.model.encode(chunks, convert_to_tensor=True)
        similarities = util.pytorch_cos_sim(question_embedding, chunk_embeddings)[0]
        top_k = min(top_k, len(chunks))
        top_k_indices = similarities.topk(k=top_k)[1]
        return [chunks[i] for i in top_k_indices]

    def rag_check(self, csv_string, top_k=5):
        df = pd.read_csv(StringIO(csv_string))
        results = []

        for index, row in df.iterrows():
            question = row[df.columns[0]]
            keywords = self.extract_keywords(question)
            wikipedia_texts = self.get_wikipedia_pages(keywords)

            all_chunks = []
            for text in wikipedia_texts:
                chunks = self.chunk_text(text)
                all_chunks.extend(chunks)

            if all_chunks:
                top_chunks = self.get_top_chunks(question, all_chunks, top_k=top_k)
                prompt = f"Check this question and answer to see if it is true. Here is the question: {question} Here are the answer choices and the selected answer: {row['choices']} Answer: {row['answer']} Here is some context: {' '.join(top_chunks)} Return 0 if the answer is incorrect and 1 if the answer is correct. ONLY RETURN 0 or 1.  DO NOT RETURN ANYTHING ELSE"
                rag_result = call_gpt(prompt)

                prompt = f"Check this question and answer to see if it is true. Here is the question: {question} Here are the answer choices and the selected answer: {row['choices']} Answer: {row['answer']} (0 indexed) Return 0 if the answer is incorrect and 1 if the answer is correct. ONLY RETURN 0 or 1."
                model_result = call_gpt(prompt)

                results.append({
                    'question': question,
                    'choices': row['choices'],
                    'answer': row['answer'],
                    'model_result': model_result + rag_result
                })

        return pd.DataFrame(results).to_csv(index=False, header=False)
