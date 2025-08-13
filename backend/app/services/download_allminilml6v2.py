import os

from sentence_transformers import SentenceTransformer

HERE = os.path.dirname(__file__)
MODEL_DIR = os.path.join(HERE, "models", "all-MiniLM-L6-v2")
os.makedirs(MODEL_DIR, exist_ok=True)

print(f"downloading 'all-MiniLM-L6-v2' to {MODEL_DIR} ...")
model = SentenceTransformer("all-MiniLM-L6-v2")
model.save(MODEL_DIR)
print("download complete")
