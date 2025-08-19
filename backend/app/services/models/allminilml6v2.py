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

        # Prefer local bundled model to avoid network downloads inside container
        here = os.path.dirname(__file__)
        local_model_dir = os.path.join(here, "all-MiniLM-L6-v2")
        if os.path.isdir(local_model_dir):
            try:
                print(f"Loading embedding model from local path: {local_model_dir}")
                _EMBEDDING_MODEL = SentenceTransformer(local_model_dir)
                _MODEL_LOADED = True
                print("✅ Embedding model loaded from local directory")
                return _EMBEDDING_MODEL
            except Exception as e:
                # Known issue: older sentence-transformers versions may not accept
                # certain Pooling kwargs stored in local config (e.g. weightedmean tokens)
                print(
                    f"⚠️ Failed to load local embedding model with SentenceTransformer: {e}"
                )
                # Try local Transformers-based loading as a fallback (offline-safe)
                try:
                    print("Attempting local Transformers load for embeddings...")
                    import torch
                    from transformers import AutoModel, AutoTokenizer

                    tokenizer = AutoTokenizer.from_pretrained(local_model_dir)
                    model = AutoModel.from_pretrained(local_model_dir)

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
                            inputs = self.tokenizer(
                                texts,
                                padding=True,
                                truncation=True,
                                return_tensors="pt",
                            )
                            inputs = {k: v.to(self.device) for k, v in inputs.items()}
                            with torch.no_grad():
                                outputs = self.model(**inputs)
                                # Mean pooling over tokens
                                embeddings = outputs.last_hidden_state.mean(dim=1)
                                return embeddings.cpu().numpy()

                    _EMBEDDING_MODEL = SimpleEmbeddingModel(model, tokenizer)
                    _MODEL_LOADED = True
                    print(
                        "✅ Embedding model loaded locally using Transformers (mean pooling)"
                    )
                    return _EMBEDDING_MODEL
                except Exception as local_tf_error:
                    print(f"⚠️ Local Transformers load also failed: {local_tf_error}")

        # Fallback to Hugging Face Hub
        print("Loading embedding model from Hugging Face Hub...")
        # Try both canonical and short names if needed
        try:
            _EMBEDDING_MODEL = SentenceTransformer(
                "sentence-transformers/all-MiniLM-L6-v2"
            )
        except Exception:
            _EMBEDDING_MODEL = SentenceTransformer("all-MiniLM-L6-v2")
        _MODEL_LOADED = True
        print("✅ Embedding model loaded successfully from hub")
        return _EMBEDDING_MODEL

    except ImportError as e:
        print(f"❌ SentenceTransformers not available: {e}")
        print("Please install: pip install sentence-transformers")
        return None
    except Exception as e:
        print(f"❌ Error loading embedding model: {e}")

        # Try alternative approach (hub) using Transformers directly
        try:
            print("Trying alternative model loading approach from hub...")
            import torch
            from transformers import AutoModel, AutoTokenizer

            model_name = "sentence-transformers/all-MiniLM-L6-v2"
            tokenizer = AutoTokenizer.from_pretrained(model_name)
            model = AutoModel.from_pretrained(model_name)

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
                    inputs = self.tokenizer(
                        texts, padding=True, truncation=True, return_tensors="pt"
                    )
                    inputs = {k: v.to(self.device) for k, v in inputs.items()}
                    with torch.no_grad():
                        outputs = self.model(**inputs)
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
