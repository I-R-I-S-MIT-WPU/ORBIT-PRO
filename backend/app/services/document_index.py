"""
Document indexing service: pre-computes and stores embeddings for fast semantic search.
Provides efficient vector storage and retrieval for large document collections.
"""

import hashlib
import json
import os
import pickle
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import fitz  # PyMuPDF
import numpy as np

from .models.allminilml6v2 import get_embedding_model


class DocumentChunk:
    """Represents a chunk of text from a document with its metadata."""

    def __init__(
        self,
        document: str,
        page_number: int,
        chunk_index: int,
        text: str,
        embedding: Optional[np.ndarray] = None,
    ):
        self.document = document
        self.page_number = page_number
        self.chunk_index = chunk_index
        self.text = text
        self.embedding = embedding
        self.text_hash = hashlib.md5(text.encode()).hexdigest()

    def to_dict(self):
        return {
            "document": self.document,
            "page_number": self.page_number,
            "chunk_index": self.chunk_index,
            "text": self.text,
            "text_hash": self.text_hash,
            "embedding": (
                self.embedding.tolist() if self.embedding is not None else None
            ),
        }

    @classmethod
    def from_dict(cls, data: dict):
        chunk = cls(
            document=data["document"],
            page_number=data["page_number"],
            chunk_index=data["chunk_index"],
            text=data["text"],
        )
        if data.get("embedding"):
            chunk.embedding = np.array(data["embedding"])
        chunk.text_hash = data.get("text_hash", chunk.text_hash)
        return chunk


class DocumentIndex:
    """Manages document embeddings and provides fast semantic search."""

    def __init__(self, index_dir: str = "document_index", max_workers: int = 4):
        self.index_dir = index_dir
        self.chunks: List[DocumentChunk] = []
        self.document_metadata: Dict[str, dict] = {}
        self.embedding_model = None
        self.max_workers = max_workers
        self._load_index()

    def _load_index(self):
        """Load existing index from disk."""
        os.makedirs(self.index_dir, exist_ok=True)

        # Load chunks
        chunks_file = os.path.join(self.index_dir, "chunks.pkl")
        if os.path.exists(chunks_file):
            try:
                with open(chunks_file, "rb") as f:
                    chunks_data = pickle.load(f)
                    self.chunks = [
                        DocumentChunk.from_dict(data) for data in chunks_data
                    ]
                print(f"Loaded {len(self.chunks)} document chunks from index")
            except Exception as e:
                print(f"Error loading chunks: {e}")
                self.chunks = []

        # Load metadata
        metadata_file = os.path.join(self.index_dir, "metadata.json")
        if os.path.exists(metadata_file):
            try:
                with open(metadata_file, "r") as f:
                    self.document_metadata = json.load(f)
                print(f"Loaded metadata for {len(self.document_metadata)} documents")
            except Exception as e:
                print(f"Error loading metadata: {e}")
                self.document_metadata = {}

    def _save_index(self):
        """Save index to disk."""
        # Save chunks
        chunks_file = os.path.join(self.index_dir, "chunks.pkl")
        try:
            chunks_data = [chunk.to_dict() for chunk in self.chunks]
            with open(chunks_file, "wb") as f:
                pickle.dump(chunks_data, f)
        except Exception as e:
            print(f"Error saving chunks: {e}")

        # Save metadata
        metadata_file = os.path.join(self.index_dir, "metadata.json")
        try:
            with open(metadata_file, "w") as f:
                json.dump(self.document_metadata, f, indent=2)
        except Exception as e:
            print(f"Error saving metadata: {e}")

    def _extract_document_chunks(
        self, document_path: str, document_name: str
    ) -> List[DocumentChunk]:
        """
        Extract text chunks from a PDF document.
        """
        try:
            doc = fitz.open(document_path)
            chunks = []
            chunk_index = 0

            for page_num in range(len(doc)):
                page = doc[page_num]
                text = page.get_text("text")

                if not text.strip():
                    continue

                # Split text into chunks
                text_chunks = self._split_text_into_chunks(text)

                for i, chunk_text in enumerate(text_chunks):
                    if chunk_text.strip():
                        chunk = DocumentChunk(
                            document=document_name,
                            page_number=page_num + 1,
                            chunk_index=chunk_index,
                            text=chunk_text.strip(),
                        )
                        chunks.append(chunk)
                        chunk_index += 1

            doc.close()
            return chunks

        except Exception as e:
            print(f"Error extracting chunks from {document_name}: {e}")
            return []

    def _split_text_into_chunks(
        self, text: str, chunk_size: int = 1000, overlap: int = 200
    ) -> List[str]:
        """
        Split text into overlapping chunks.
        """
        if len(text) <= chunk_size:
            return [text]

        chunks = []
        start = 0

        while start < len(text):
            end = start + chunk_size

            # Try to break at sentence boundaries
            if end < len(text):
                # Look for sentence endings
                for i in range(end, max(start + chunk_size - 100, start), -1):
                    if text[i] in ".!?":
                        end = i + 1
                        break

            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)

            start = end - overlap
            if start >= len(text):
                break

        return chunks

    def _get_file_hash(self, file_path: str) -> str:
        """
        Get MD5 hash of a file for change detection.
        """
        try:
            import hashlib

            hash_md5 = hashlib.md5()
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    hash_md5.update(chunk)
            return hash_md5.hexdigest()
        except Exception as e:
            print(f"Error computing file hash: {e}")
            return str(os.path.getmtime(file_path))

    def _compute_embedding(self, text: str) -> np.ndarray:
        """
        Compute embedding for text using the embedding model.
        """
        try:
            if self.embedding_model:
                return self.embedding_model.encode([text])[0]
            else:
                # Fallback: return a hash-based embedding
                import hashlib

                hash_obj = hashlib.md5(text.encode())
                hash_bytes = hash_obj.digest()
                # Convert to numpy array (384 dimensions to match all-MiniLM-L6-v2)
                embedding = np.zeros(384, dtype=np.float32)
                for i, byte in enumerate(hash_bytes):
                    if i < 384:
                        embedding[i] = float(byte) / 255.0
                return embedding
        except Exception as e:
            print(f"Error computing embedding: {e}")
            # Return zero vector as fallback
            return np.zeros(384, dtype=np.float32)

    def _index_document_worker(self, args: Tuple[str, str]) -> Tuple[str, bool, int]:
        """Worker function for parallel document indexing."""
        document_path, document_name = args
        try:
            # Check if document is already indexed and up-to-date
            file_hash = self._get_file_hash(document_path)
            if document_name in self.document_metadata:
                if self.document_metadata[document_name].get("file_hash") == file_hash:
                    print(f"Document {document_name} already indexed and up-to-date")
                    return document_name, True, 0

            print(f"Indexing document: {document_name}")

            # Extract text from PDF
            doc = fitz.open(document_path)
            total_chunks = 0
            new_chunks = []

            for page_num in range(len(doc)):
                page = doc[page_num]
                text = page.get_text("text")

                if not text.strip():
                    continue

                # Split into chunks
                chunks = self._split_text_into_chunks(
                    text, chunk_size=1000, overlap=200
                )

                # Create DocumentChunk objects and compute embeddings
                for chunk_idx, chunk_text in enumerate(chunks):
                    embedding = self._compute_embedding(chunk_text)

                    chunk = DocumentChunk(
                        document=document_name,
                        page_number=page_num + 1,
                        chunk_index=chunk_idx,
                        text=chunk_text,
                        embedding=embedding,
                    )

                    new_chunks.append(chunk)
                    total_chunks += 1

            doc.close()

            # Update metadata
            self.document_metadata[document_name] = {
                "file_hash": file_hash,
                "total_pages": len(doc),
                "total_chunks": total_chunks,
                "indexed_at": datetime.now().isoformat(),
                "file_size": os.path.getsize(document_path),
            }

            print(f"Successfully indexed {document_name}: {total_chunks} chunks")
            return document_name, True, total_chunks

        except Exception as e:
            print(f"Error indexing document {document_name}: {e}")
            return document_name, False, 0

    def index_document(self, document_path: str, document_name: str) -> bool:
        """Index a single document by extracting chunks and computing embeddings."""
        try:
            result, success, chunks = self._index_document_worker(
                (document_path, document_name)
            )
            if success:
                # Remove existing chunks for this document
                self.chunks = [
                    chunk for chunk in self.chunks if chunk.document != document_name
                ]

                # Get the actual chunks from the document
                doc = fitz.open(document_path)
                total_chunks = 0
                new_chunks = []

                for page_num in range(len(doc)):
                    page = doc[page_num]
                    text = page.get_text()
                    if text.strip():
                        chunks = self._split_text_into_chunks(text)
                        for chunk_idx, chunk_text in enumerate(chunks):
                            embedding = self._compute_embedding(chunk_text)

                            chunk = DocumentChunk(
                                document=document_name,
                                page_number=page_num + 1,
                                chunk_index=chunk_idx,
                                text=chunk_text,
                                embedding=embedding,
                            )

                            new_chunks.append(chunk)
                            total_chunks += 1

                doc.close()

                # Add new chunks to the index
                self.chunks.extend(new_chunks)

                # Save the updated index
                self._save_index()

                print(
                    f"✅ Successfully indexed {document_name}: {total_chunks} chunks added to index"
                )
                return True
            else:
                print(f"❌ Failed to index {document_name}")
                return False
        except Exception as e:
            print(f"Error in index_document: {e}")
            return False

    def remove_document(self, document_name: str) -> bool:
        """Remove a document from the index."""
        try:
            # Remove chunks
            original_count = len(self.chunks)
            self.chunks = [
                chunk for chunk in self.chunks if chunk.document != document_name
            ]

            # Remove metadata
            if document_name in self.document_metadata:
                del self.document_metadata[document_name]

            # Save index
            self._save_index()

            print(
                f"Removed {document_name} from index: {original_count - len(self.chunks)} chunks removed"
            )
            return True

        except Exception as e:
            print(f"Error removing document {document_name}: {e}")
            return False

    def search_semantic(
        self, query: str, top_k: int = 10, documents: Optional[List[str]] = None
    ) -> List[Dict]:
        """Perform semantic search across indexed documents."""
        if not self.chunks:
            return []

        # Filter chunks by documents if specified
        search_chunks = self.chunks
        if documents:
            search_chunks = [
                chunk for chunk in self.chunks if chunk.document in documents
            ]

        if not search_chunks:
            return []

        # Compute query embedding
        query_embedding = self._compute_embedding(query)

        # Compute similarities
        similarities = []
        for chunk in search_chunks:
            if chunk.embedding is not None:
                # Cosine similarity
                similarity = np.dot(query_embedding, chunk.embedding) / (
                    np.linalg.norm(query_embedding) * np.linalg.norm(chunk.embedding)
                )
                similarities.append((similarity, chunk))

        # Sort by similarity and return top results
        similarities.sort(key=lambda x: x[0], reverse=True)

        results = []
        for similarity, chunk in similarities[:top_k]:
            results.append(
                {
                    "document": chunk.document,
                    "page_number": chunk.page_number,
                    "text": chunk.text,
                    "similarity_score": float(similarity),
                    "chunk_index": chunk.chunk_index,
                }
            )

        return results

    def get_document_stats(self) -> Dict:
        """Get statistics about the indexed documents."""
        stats = {
            "total_documents": len(self.document_metadata),
            "total_chunks": len(self.chunks),
            "documents": {},
        }

        for doc_name, metadata in self.document_metadata.items():
            doc_chunks = [chunk for chunk in self.chunks if chunk.document == doc_name]
            stats["documents"][doc_name] = {
                **metadata,
                "actual_chunks": len(doc_chunks),
            }

        return stats

    def cluster_documents(self, n_clusters: int = 5) -> Dict:
        """Group similar documents automatically using clustering."""
        try:
            print(
                f"🔍 Clustering documents: {len(self.document_metadata)} documents available"
            )
            print(f"🔍 Document metadata keys: {list(self.document_metadata.keys())}")
            print(f"🔍 Total chunks: {len(self.chunks)}")
            print(
                f"🔍 Chunk documents: {list(set([chunk.document for chunk in self.chunks]))}"
            )

            if len(self.document_metadata) < 2:
                print(f"❌ Insufficient documents: {len(self.document_metadata)} < 2")
                return {
                    "clusters": [],
                    "message": "Need at least 2 documents for clustering",
                    "total_clusters": 0,
                    "clustering_method": "insufficient_documents",
                }

            # Check if we have embeddings
            if not self.chunks or len(self.chunks) == 0:
                print(f"❌ No chunks available: {len(self.chunks)}")
                return {
                    "clusters": [],
                    "message": "No document chunks available for clustering",
                    "total_clusters": 0,
                    "clustering_method": "no_chunks",
                }

            try:
                from sklearn.cluster import KMeans
                from sklearn.feature_extraction.text import TfidfVectorizer

                # Extract document texts for clustering
                doc_texts = []
                doc_names = []

                # Group chunks by document
                doc_chunks = {}
                for chunk in self.chunks:
                    if chunk.document not in doc_chunks:
                        doc_chunks[chunk.document] = []
                    doc_chunks[chunk.document].append(chunk.text)

                print(f"🔍 Grouped chunks by document: {list(doc_chunks.keys())}")

                # Create document-level text representations
                for doc_name, chunks in doc_chunks.items():
                    if doc_name in self.document_metadata:
                        # Combine all chunks for this document
                        full_text = " ".join(chunks)
                        if (
                            len(full_text.strip()) > 50
                        ):  # Only include documents with substantial text
                            doc_texts.append(full_text)
                            doc_names.append(doc_name)
                            print(
                                f"✅ Added document {doc_name} with {len(full_text)} chars"
                            )
                        else:
                            print(
                                f"⚠️ Document {doc_name} has insufficient text: {len(full_text)} chars"
                            )
                    else:
                        print(f"⚠️ Document {doc_name} not found in metadata")

                print(f"🔍 Final documents for clustering: {len(doc_texts)} documents")

                if len(doc_texts) < 2:
                    return {
                        "clusters": [],
                        "message": "Insufficient text content for clustering",
                        "total_clusters": 0,
                        "clustering_method": "insufficient_text",
                    }

                # Create TF-IDF vectors
                vectorizer = TfidfVectorizer(
                    max_features=1000, stop_words="english", min_df=1, max_df=0.95
                )
                tfidf_matrix = vectorizer.fit_transform(doc_texts)

                # Perform clustering
                n_clusters = min(n_clusters, len(doc_texts))
                print(
                    f"🔍 Creating {n_clusters} clusters from {len(doc_texts)} documents"
                )

                kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
                cluster_labels = kmeans.fit_predict(tfidf_matrix)

                # Group documents by cluster
                clusters = {}
                for i, label in enumerate(cluster_labels):
                    if label not in clusters:
                        clusters[label] = []
                    clusters[label].append(
                        {
                            "document": doc_names[i],
                            "text": (
                                doc_texts[i][:200] + "..."
                                if len(doc_texts[i]) > 200
                                else doc_texts[i]
                            ),
                        }
                    )

                # Convert to response format
                cluster_list = []
                for cluster_id, docs in clusters.items():
                    # Find cluster centroid and representative keywords
                    cluster_docs = [doc["document"] for doc in docs]
                    cluster_texts = [
                        doc_texts[doc_names.index(doc)] for doc in cluster_docs
                    ]

                    # Extract common keywords for cluster description
                    cluster_text = " ".join(cluster_texts)
                    words = cluster_text.lower().split()

                    # Filter out common words and count frequency
                    stop_words = {
                        "the",
                        "and",
                        "or",
                        "but",
                        "in",
                        "on",
                        "at",
                        "to",
                        "for",
                        "of",
                        "with",
                        "by",
                        "a",
                        "an",
                        "is",
                        "are",
                        "was",
                        "were",
                        "be",
                        "been",
                        "being",
                        "have",
                        "has",
                        "had",
                        "do",
                        "does",
                        "did",
                        "will",
                        "would",
                        "could",
                        "should",
                        "may",
                        "might",
                        "can",
                        "this",
                        "that",
                        "these",
                        "those",
                        "it",
                        "its",
                        "they",
                        "them",
                        "their",
                        "we",
                        "us",
                        "our",
                        "you",
                        "your",
                        "he",
                        "she",
                        "his",
                        "her",
                    }
                    word_freq = {}
                    for word in words:
                        if len(word) > 3 and word not in stop_words and word.isalpha():
                            word_freq[word] = word_freq.get(word, 0) + 1

                    # Get top keywords
                    top_keywords = sorted(
                        word_freq.items(), key=lambda x: x[1], reverse=True
                    )[:5]

                    # Generate more meaningful cluster description
                    if top_keywords:
                        keyword_list = [word for word, freq in top_keywords[:3]]
                        if len(keyword_list) == 1:
                            description = f"Documents focused on {keyword_list[0]}"
                        elif len(keyword_list) == 2:
                            description = f"Documents about {keyword_list[0]} and {keyword_list[1]}"
                        else:
                            description = f"Documents covering {', '.join(keyword_list[:-1])}, and {keyword_list[-1]}"
                    else:
                        description = f"Group of {len(docs)} related documents"

                    cluster_list.append(
                        {
                            "cluster_id": int(cluster_id),
                            "size": len(docs),
                            "documents": docs,
                            "keywords": [word for word, freq in top_keywords],
                            "description": description,
                        }
                    )

                print(f"✅ Successfully created {len(cluster_list)} clusters")
                return {
                    "clusters": cluster_list,
                    "total_clusters": len(cluster_list),
                    "clustering_method": "KMeans with TF-IDF",
                    "documents_processed": len(doc_texts),
                }

            except ImportError:
                # Fallback clustering without sklearn
                print("⚠️ sklearn not available, using fallback clustering")
                return self._fallback_clustering()

        except Exception as e:
            print(f"❌ Error in document clustering: {e}")
            return {"clusters": [], "error": str(e)}

    def _fallback_clustering(self) -> Dict:
        """Simple fallback clustering using document similarity."""
        if len(self.document_metadata) < 2:
            return {
                "clusters": [],
                "message": "Need at least 2 documents for clustering",
            }

        # Simple similarity-based clustering
        doc_names = list(self.document_metadata.keys())
        clusters = []
        used_docs = set()

        for doc_name in doc_names:
            if doc_name in used_docs:
                continue

            # Find similar documents
            similar_docs = [doc_name]
            used_docs.add(doc_name)

            doc_chunks = [chunk for chunk in self.chunks if chunk.document == doc_name]
            if not doc_chunks:
                continue

            # Get document embedding (average of chunk embeddings)
            doc_embedding = np.mean(
                [
                    chunk.embedding
                    for chunk in doc_chunks
                    if chunk.embedding is not None
                ],
                axis=0,
            )

            for other_doc in doc_names:
                if other_doc in used_docs:
                    continue

                other_chunks = [
                    chunk for chunk in self.chunks if chunk.document == other_doc
                ]
                if not other_chunks:
                    continue

                other_embedding = np.mean(
                    [
                        chunk.embedding
                        for chunk in other_chunks
                        if chunk.embedding is not None
                    ],
                    axis=0,
                )

                # Calculate similarity
                if doc_embedding is not None and other_embedding is not None:
                    similarity = np.dot(doc_embedding, other_embedding) / (
                        np.linalg.norm(doc_embedding) * np.linalg.norm(other_embedding)
                    )

                    if similarity > 0.7:  # High similarity threshold
                        similar_docs.append(other_doc)
                        used_docs.add(other_doc)

            if len(similar_docs) > 0:
                clusters.append(
                    {
                        "cluster_id": len(clusters),
                        "documents": [
                            {"document": doc, "metadata": self.document_metadata[doc]}
                            for doc in similar_docs
                        ],
                        "size": len(similar_docs),
                        "keywords": ["similarity-based"],
                        "description": f"Group of {len(similar_docs)} similar documents",
                    }
                )

        return {
            "clusters": clusters,
            "total_clusters": len(clusters),
            "clustering_method": "Similarity-based fallback",
        }

    def get_document_recommendations(self, document_name: str, top_k: int = 5) -> Dict:
        """Get document recommendations based on similarity to a given document."""
        try:
            if document_name not in self.document_metadata:
                return {
                    "current_document": document_name,
                    "recommendations": [],
                    "message": "Document not found in index",
                }

            # Get the document's chunks
            doc_chunks = [
                chunk for chunk in self.chunks if chunk.document == document_name
            ]
            if not doc_chunks:
                return {
                    "current_document": document_name,
                    "recommendations": [],
                    "message": "No chunks found for document",
                }

            # Calculate average embedding for the document
            doc_embeddings = [
                chunk.embedding for chunk in doc_chunks if chunk.embedding is not None
            ]
            if not doc_embeddings:
                return {
                    "current_document": document_name,
                    "recommendations": [],
                    "message": "No embeddings available for document",
                }

            # Use the first embedding as representative (or average if needed)
            doc_embedding = doc_embeddings[0]

            # Find similar documents
            similarities = []
            for chunk in self.chunks:
                if chunk.document != document_name and chunk.embedding is not None:
                    similarity = np.dot(doc_embedding, chunk.embedding) / (
                        np.linalg.norm(doc_embedding) * np.linalg.norm(chunk.embedding)
                    )
                    similarities.append((similarity, chunk))

            # Sort by similarity and group by document
            similarities.sort(key=lambda x: x[0], reverse=True)

            # Group by document and get best similarity per document
            doc_similarities = {}
            for similarity, chunk in similarities:
                if chunk.document not in doc_similarities:
                    doc_similarities[chunk.document] = {
                        "similarity_score": similarity,
                        "best_chunk": chunk,
                        "reason": f"High semantic similarity ({similarity:.3f}) with current document",
                    }

            # Convert to list and sort
            recommendations = []
            for doc_name, info in doc_similarities.items():
                if doc_name in self.document_metadata:
                    metadata = self.document_metadata[doc_name]
                    recommendations.append(
                        {
                            "document": doc_name,
                            "similarity_score": info["similarity_score"],
                            "reason": info["reason"],
                            "metadata": {
                                "total_pages": metadata.get("pages", 0) or 0,
                                "total_chunks": len(
                                    [c for c in self.chunks if c.document == doc_name]
                                ),
                                "file_size": metadata.get("size", 0) or 0,
                                "uploaded_at": metadata.get("uploaded_at", "Unknown"),
                            },
                        }
                    )

            # Sort by similarity and take top_k
            recommendations.sort(key=lambda x: x["similarity_score"], reverse=True)
            recommendations = recommendations[:top_k]

            return {
                "current_document": document_name,
                "recommendations": recommendations,
                "total_recommendations": len(recommendations),
            }

        except Exception as e:
            print(f"Error getting document recommendations: {e}")
            return {
                "current_document": document_name,
                "recommendations": [],
                "message": f"Error: {str(e)}",
            }

    def get_incremental_update_status(self) -> Dict:
        """Check which documents need re-indexing based on file changes."""
        status = {
            "documents_to_update": [],
            "documents_up_to_date": [],
            "total_files_checked": 0,
        }

        for doc_name in self.document_metadata.keys():
            file_path = os.path.join(
                os.path.dirname(self.index_dir), "..", "files", doc_name
            )
            status["total_files_checked"] += 1

            if os.path.exists(file_path):
                current_hash = self._get_file_hash(file_path)
                stored_hash = self.document_metadata[doc_name].get("file_hash", "")

                if current_hash == stored_hash:
                    status["documents_up_to_date"].append(doc_name)
                else:
                    status["documents_to_update"].append(
                        {
                            "document": doc_name,
                            "reason": "File hash changed",
                            "stored_hash": stored_hash[:8] + "...",
                            "current_hash": current_hash[:8] + "...",
                        }
                    )
            else:
                status["documents_to_update"].append(
                    {
                        "document": doc_name,
                        "reason": "File not found",
                        "stored_hash": self.document_metadata[doc_name].get(
                            "file_hash", ""
                        )[:8]
                        + "...",
                        "current_hash": "N/A",
                    }
                )

        return status

    def update_index_incremental(self, files_dir: str) -> Dict[str, bool]:
        """Only re-index documents that have changed."""
        status = self.get_incremental_update_status()
        documents_to_update = [
            item["document"] for item in status["documents_to_update"]
        ]

        if not documents_to_update:
            return {"message": "All documents are up to date", "updated": {}}

        print(
            f"Incremental update: re-indexing {len(documents_to_update)} changed documents"
        )
        results = self.update_index(files_dir, documents_to_update)

        return {
            "message": f"Updated {len(documents_to_update)} documents",
            "updated": results,
            "status": status,
        }

    def update_index(self, files_dir: str, document_names: List[str] = None) -> Dict:
        """
        Index documents by extracting text chunks and computing embeddings.
        If document_names is provided, only index those specific documents.
        """
        try:
            if document_names is None:
                # Index all PDF files in the directory
                document_names = [
                    f for f in os.listdir(files_dir) if f.lower().endswith(".pdf")
                ]

            if not document_names:
                print("No PDF documents found to index")
                return {"status": "no_documents", "message": "No PDF documents found"}

            print(f"🔍 Indexing {len(document_names)} documents...")

            # Get or initialize embedding model
            if self.embedding_model is None:
                self.embedding_model = get_embedding_model()

            total_chunks = 0
            indexed_docs = []

            for doc_name in document_names:
                doc_path = os.path.join(files_dir, doc_name)
                if not os.path.exists(doc_path):
                    print(f"⚠️ Document not found: {doc_path}")
                    continue

                try:
                    print(f"📄 Indexing {doc_name}...")

                    # Check if document is already indexed and up to date
                    doc_hash = self._get_file_hash(doc_path)
                    if doc_name in self.document_metadata:
                        existing_hash = self.document_metadata[doc_name].get(
                            "file_hash"
                        )
                        if existing_hash == doc_hash:
                            print(f"✅ {doc_name} already indexed and up to date")
                            indexed_docs.append(doc_name)
                            continue

                    # Extract text chunks from the document
                    doc_chunks = self._extract_document_chunks(doc_path, doc_name)

                    if not doc_chunks:
                        print(f"⚠️ No text content found in {doc_name}")
                        continue

                    # Compute embeddings for chunks
                    for chunk in doc_chunks:
                        if chunk.text.strip():
                            chunk.embedding = self._compute_embedding(chunk.text)

                    # Remove old chunks for this document
                    self.chunks = [c for c in self.chunks if c.document != doc_name]

                    # Add new chunks
                    self.chunks.extend(doc_chunks)

                    # Update metadata
                    self.document_metadata[doc_name] = {
                        "file_hash": doc_hash,
                        "chunk_count": len(doc_chunks),
                        "indexed_at": time.time(),
                        "file_size": os.path.getsize(doc_path),
                    }

                    total_chunks += len(doc_chunks)
                    indexed_docs.append(doc_name)
                    print(f"✅ Indexed {doc_name}: {len(doc_chunks)} chunks")

                except Exception as e:
                    print(f"❌ Error indexing {doc_name}: {e}")
                    continue

            if indexed_docs:
                # Save the updated index
                self._save_index()
                print(f"💾 Index saved with {len(self.chunks)} total chunks")

                return {
                    "status": "success",
                    "indexed_documents": indexed_docs,
                    "total_chunks": len(self.chunks),
                    "new_chunks": total_chunks,
                }
            else:
                return {
                    "status": "no_documents_indexed",
                    "message": "No documents were successfully indexed",
                }

        except Exception as e:
            print(f"❌ Error in document indexing: {e}")
            return {"status": "error", "message": str(e)}

    def _process_document_chunks(self, document_path: str, document_name: str):
        """Process document chunks and add to index."""
        try:
            doc = fitz.open(document_path)
            total_chunks = 0

            for page_num in range(len(doc)):
                page = doc[page_num]
                text = page.get_text("text")

                if not text.strip():
                    continue

                # Split into chunks
                chunks = self._split_text_into_chunks(
                    text, chunk_size=1000, overlap=200
                )

                # Create DocumentChunk objects and compute embeddings
                for chunk_idx, chunk_text in enumerate(chunks):
                    embedding = self._compute_embedding(chunk_text)

                    chunk = DocumentChunk(
                        document=document_name,
                        page_number=page_num + 1,
                        chunk_index=chunk_idx,
                        text=chunk_text,
                        embedding=embedding,
                    )

                    self.chunks.append(chunk)
                    total_chunks += 1

            doc.close()
            print(f"Processed {total_chunks} chunks for {document_name}")

        except Exception as e:
            print(f"Error processing chunks for {document_name}: {e}")


# Global index instance
_document_index = None


def get_document_index() -> DocumentIndex:
    """Get the global document index instance."""
    global _document_index
    if _document_index is None:
        _document_index = DocumentIndex()
    return _document_index


def index_documents(files_dir: str, document_names: List[str] = None) -> Dict:
    """
    Index documents by extracting text chunks and computing embeddings.
    If document_names is provided, only index those specific documents.
    """
    index = get_document_index()
    return index.update_index(files_dir, document_names)


def search_documents(
    query: str, top_k: int = 10, documents: Optional[List[str]] = None
) -> List[Dict]:
    """Search documents using the index."""
    index = get_document_index()
    return index.search_semantic(query, top_k, documents)


def get_index_stats() -> Dict:
    """Get index statistics."""
    index = get_document_index()
    return index.get_document_stats()


def remove_document_from_index(document_name: str) -> bool:
    """Remove a document from the index."""
    index = get_document_index()
    return index.remove_document(document_name)
