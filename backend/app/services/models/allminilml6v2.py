"""
Helper module for managing the all-MiniLM-L6-v2 embedding model instance.
Provides singleton pattern for model reuse and better performance.
"""

import os
from typing import Optional

_EMBEDDING_MODEL = None
_MODEL_LOADED = False


def get_embedding_model():
    """
    Get or create the embedding model instance.
    Uses singleton pattern for better performance.
    """
    global _EMBEDDING_MODEL, _MODEL_LOADED

    if _MODEL_LOADED and _EMBEDDING_MODEL is not None:
        return _EMBEDDING_MODEL

    try:
        from sentence_transformers import SentenceTransformer

        # Try to load the model from Hugging Face Hub
        print("Loading embedding model from Hugging Face Hub...")
        _EMBEDDING_MODEL = SentenceTransformer("all-MiniLM-L6-v2")
        _MODEL_LOADED = True
        print("✅ Embedding model loaded successfully")
        return _EMBEDDING_MODEL

    except ImportError as e:
        print(f"❌ SentenceTransformers not available: {e}")
        print("Please install: pip install sentence-transformers")
        return None
    except Exception as e:
        print(f"❌ Error loading embedding model: {e}")

        # Try alternative approach
        try:
            print("Trying alternative model loading approach...")
            import torch
            from transformers import AutoModel, AutoTokenizer

            model_name = "sentence-transformers/all-MiniLM-L6-v2"
            tokenizer = AutoTokenizer.from_pretrained(model_name)
            model = AutoModel.from_pretrained(model_name)

            # Create a simple wrapper
            class SimpleEmbeddingModel:
                def __init__(self, model, tokenizer):
                    self.model = model
                    self.tokenizer = tokenizer
                    self.device = torch.device(
                        "cuda" if torch.cuda.is_available() else "cpu"
                    )
                    self.model.to(self.device)

                def encode(self, texts, **kwargs):
                    if isinstance(texts, str):
                        texts = [texts]

                    # Tokenize and get embeddings
                    inputs = self.tokenizer(
                        texts, padding=True, truncation=True, return_tensors="pt"
                    )
                    inputs = {k: v.to(self.device) for k, v in inputs.items()}

                    with torch.no_grad():
                        outputs = self.model(**inputs)
                        # Use mean pooling
                        embeddings = outputs.last_hidden_state.mean(dim=1)
                        return embeddings.cpu().numpy()

            _EMBEDDING_MODEL = SimpleEmbeddingModel(model, tokenizer)
            _MODEL_LOADED = True
            print("✅ Embedding model loaded using alternative approach")
            return _EMBEDDING_MODEL

        except Exception as alt_e:
            print(f"❌ Alternative approach also failed: {alt_e}")
            return None


def is_embedding_available() -> bool:
    """
    Check if embedding model is available.
    """
    return get_embedding_model() is not None
