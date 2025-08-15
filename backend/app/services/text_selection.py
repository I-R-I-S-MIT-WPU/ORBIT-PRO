"""
Text selection service: handles selected text analysis and cross-PDF insights.
Provides semantic search, contradiction detection, and related content discovery.
"""

import os
import re
import time
from typing import Dict, List, Optional, Tuple

import fitz  # PyMuPDF

from ..models.schemas import CrossPDFInsight, TextSelectionResponse
from . import document_index, extractor, related
from .llm import get_llm_service


def extract_text_around_selection(
    pdf_path: str, page_number: int, selected_text: str, context_chars: int = 500
) -> str:
    """
    Extract text around the selected text for better context.
    """
    try:
        doc = fitz.open(pdf_path)
        if page_number > len(doc):
            return selected_text

        page = doc[page_number - 1]
        full_text = page.get_text("text")

        # Find the selected text in the page
        start_pos = full_text.find(selected_text)
        if start_pos == -1:
            return selected_text

        # Extract context around the selection
        start_context = max(0, start_pos - context_chars)
        end_context = min(
            len(full_text), start_pos + len(selected_text) + context_chars
        )

        context_text = full_text[start_context:end_context]
        return context_text.strip()
    except Exception as e:
        print(f"Error extracting context: {e}")
        return selected_text


def find_semantic_matches(
    selected_text: str, all_documents: List[str], files_dir: str, top_k: int = 10
) -> List[Dict]:
    """
    Find semantically similar content across all uploaded documents using the document index.
    Optimized for fast retrieval and relevant results.
    """
    try:
        # Use the document index for fast semantic search
        matches = document_index.search_documents(
            query=selected_text,
            top_k=top_k * 2,
            documents=all_documents,  # Get more results for filtering
        )

        # Filter and enhance results for better relevance
        enhanced_matches = []
        for match in matches:
            # Calculate additional relevance factors
            relevance_score = match["similarity_score"]

            # Boost score for exact text matches
            if selected_text.lower() in match["text"].lower():
                relevance_score *= 1.2

            # Boost score for same document (if user is reading it)
            # Note: We don't have access to the current document here, so we'll skip this boost

            enhanced_matches.append(
                {
                    "document": match["document"],
                    "page_number": match["page_number"],
                    "text": match["text"],
                    "similarity_score": min(1.0, relevance_score),  # Cap at 1.0
                    "chunk_index": match["chunk_index"],
                    "relevance_score": min(1.0, relevance_score),  # Add for consistency
                }
            )

        # Sort by enhanced relevance score and return top_k
        enhanced_matches.sort(key=lambda x: x["relevance_score"], reverse=True)
        return enhanced_matches[:top_k]

    except Exception as e:
        print(f"Error in semantic search: {e}")
        # Fallback to old method if index fails
        return find_semantic_matches_fallback(
            selected_text, all_documents, files_dir, top_k
        )


def find_semantic_matches_fallback(
    selected_text: str, all_documents: List[str], files_dir: str, top_k: int = 10
) -> List[Dict]:
    """
    Fallback method for finding semantic matches when document index is not available.
    """
    matches = []

    for doc_name in all_documents:
        doc_path = os.path.join(files_dir, doc_name)
        if not os.path.exists(doc_path):
            continue

        try:
            doc = fitz.open(doc_path)

            for page_num in range(len(doc)):
                page = doc[page_num]
                text = page.get_text("text")

                # Split text into chunks for better matching
                chunks = split_text_into_chunks(text, chunk_size=1000, overlap=200)

                for chunk_idx, chunk in enumerate(chunks):
                    # Calculate semantic similarity
                    similarity = calculate_semantic_similarity(selected_text, chunk)

                    if similarity > 0.3:  # Threshold for relevance
                        matches.append(
                            {
                                "document": doc_name,
                                "page_number": page_num + 1,
                                "text": chunk,
                                "similarity_score": similarity,
                                "chunk_index": chunk_idx,
                            }
                        )

            doc.close()
        except Exception as e:
            print(f"Error processing {doc_name}: {e}")
            continue

    # Sort by similarity and return top matches
    matches.sort(key=lambda x: x["similarity_score"], reverse=True)
    return matches[:top_k]


def split_text_into_chunks(
    text: str, chunk_size: int = 1000, overlap: int = 200
) -> List[str]:
    """
    Split text into overlapping chunks for better semantic matching.
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


def calculate_semantic_similarity(text1: str, text2: str) -> float:
    """
    Calculate semantic similarity between two text chunks.
    Uses a combination of keyword overlap and embedding similarity.
    """
    # Simple keyword overlap as fallback
    words1 = set(re.findall(r"\w+", text1.lower()))
    words2 = set(re.findall(r"\w+", text2.lower()))

    if not words1 or not words2:
        return 0.0

    overlap = len(words1 & words2)
    union = len(words1 | words2)

    jaccard = overlap / union if union > 0 else 0.0

    # Try to use embedding similarity if available
    try:
        from sentence_transformers import SentenceTransformer, util

        from .models.allminilml6v2 import get_embedding_model

        model = get_embedding_model()
        if model:
            emb1 = model.encode(text1, convert_to_tensor=True)
            emb2 = model.encode(text2, convert_to_tensor=True)
            cosine_sim = float(util.pytorch_cos_sim(emb1, emb2).item())

            # Combine Jaccard and cosine similarity
            return 0.3 * jaccard + 0.7 * cosine_sim
    except Exception:
        pass

    return jaccard


def detect_contradictions(selected_text: str, related_texts: List[str]) -> List[str]:
    """
    Detect contradictions between selected text and related content.
    """
    contradictions = []

    if not related_texts:
        return contradictions

    # Use LLM to detect contradictions
    try:
        prompt = f"""
        Analyze the following selected text and related texts for contradictions or opposing claims.
        
        Selected Text: {selected_text}
        
        Related Texts:
        {chr(10).join([f"{i+1}. {text}" for i, text in enumerate(related_texts)])}
        
        Identify any contradictions, opposing claims, or conflicting information. Return each contradiction as a separate line starting with "- ".
        If no contradictions are found, return "No contradictions detected."
        """

        response = get_llm_service().get_llm_response(
            [{"role": "user", "content": prompt}]
        )

        if response and "No contradictions detected" not in response:
            lines = response.strip().split("\n")
            for line in lines:
                if line.strip().startswith("- "):
                    contradictions.append(line.strip()[2:])

    except Exception as e:
        print(f"Error detecting contradictions: {e}")

    return contradictions


def find_connections(selected_text: str, related_texts: List[str]) -> List[str]:
    """
    Find connections and relationships between selected text and related content.
    """
    connections = []

    if not related_texts:
        return connections

    try:
        prompt = f"""
        Analyze the following selected text and related texts for connections, relationships, and patterns.
        
        Selected Text: {selected_text}
        
        Related Texts:
        {chr(10).join([f"{i+1}. {text}" for i, text in enumerate(related_texts)])}
        
        Identify connections, relationships, patterns, or themes that link these texts. Return each connection as a separate line starting with "- ".
        Focus on:
        - Similar methodologies or approaches
        - Related concepts or theories
        - Complementary findings
        - Shared references or citations
        """

        response = get_llm_service().get_llm_response(
            [{"role": "user", "content": prompt}]
        )

        if response:
            lines = response.strip().split("\n")
            for line in lines:
                if line.strip().startswith("- "):
                    connections.append(line.strip()[2:])

    except Exception as e:
        print(f"Error finding connections: {e}")

    return connections


def categorize_insight_type(selected_text: str, related_text: str) -> str:
    """
    Categorize the type of insight based on the relationship between texts.
    """
    # Simple heuristics for categorization
    selected_lower = selected_text.lower()
    related_lower = related_text.lower()

    # Check for overlapping content
    selected_words = set(re.findall(r"\w+", selected_lower))
    related_words = set(re.findall(r"\w+", related_lower))
    overlap = len(selected_words & related_words)

    if overlap > len(selected_words) * 0.3:
        return "overlapping"

    # Check for contradictory indicators
    contradiction_indicators = [
        "however",
        "but",
        "although",
        "despite",
        "contrary",
        "opposite",
        "different",
        "disagree",
    ]
    if any(indicator in related_lower for indicator in contradiction_indicators):
        return "contradictory"

    # Check for adjacent/related content
    related_indicators = [
        "similar",
        "related",
        "complementary",
        "further",
        "additionally",
        "moreover",
    ]
    if any(indicator in related_lower for indicator in related_indicators):
        return "adjacent"

    return "relevant"


def generate_insight_summary(
    selected_text: str, insights: List[CrossPDFInsight]
) -> str:
    """
    Generate a concise summary of the key insights from selected text and related content.
    """
    try:
        if not insights:
            return f"Selected text: '{selected_text[:100]}{'...' if len(selected_text) > 100 else ''}'. No related content found across documents."

        insight_texts = [
            f"{insight.document} (p.{insight.page_number}): {insight.relevant_text[:200]}..."
            for insight in insights[:5]
        ]

        prompt = f"""
        Generate a concise summary of the key insights from the selected text and related content.
        
        Selected Text: {selected_text}
        
        Related Insights:
        {chr(10).join(insight_texts)}
        
        Provide a 2-3 sentence summary highlighting the main points and connections.
        Focus on the most relevant findings and how they relate to the selected text.
        """

        try:
            response = get_llm_service().get_llm_response(
                [{"role": "user", "content": prompt}]
            )
            if response and response.strip():
                return response.strip()
            else:
                print("LLM returned empty response for summary")
                raise Exception("Empty LLM response")
        except Exception as llm_error:
            print(f"LLM summary generation failed: {llm_error}")
            # Generate fallback summary based on available data
            return generate_fallback_summary(selected_text, insights)

    except Exception as e:
        print(f"Error generating summary: {e}")
        return generate_fallback_summary(selected_text, insights)


def generate_fallback_summary(
    selected_text: str, insights: List[CrossPDFInsight]
) -> str:
    """
    Generate a fallback summary when LLM is not available.
    """
    try:
        if not insights:
            return f"Selected text: '{selected_text[:100]}{'...' if len(selected_text) > 100 else ''}'. No related content found across documents."

        # Count insights by document
        doc_counts = {}
        for insight in insights:
            doc_counts[insight.document] = doc_counts.get(insight.document, 0) + 1

        # Find most relevant insights
        top_insights = sorted(insights, key=lambda x: x.relevance_score, reverse=True)[
            :3
        ]

        # Build summary
        summary_parts = []
        summary_parts.append(
            f"Found {len(insights)} relevant sections across {len(doc_counts)} documents."
        )

        if top_insights:
            top_doc = top_insights[0].document
            top_score = top_insights[0].relevance_score
            summary_parts.append(
                f"Most relevant content in '{top_doc}' with {top_score:.1%} similarity."
            )

        if len(insights) > 3:
            summary_parts.append(
                f"Additional {len(insights) - 3} relevant sections available for exploration."
            )

        return " ".join(summary_parts)

    except Exception as e:
        print(f"Error generating fallback summary: {e}")
        return f"Selected text: '{selected_text[:100]}{'...' if len(selected_text) > 100 else ''}'. {len(insights)} related sections found across documents."


def process_text_selection(
    selected_text: str,
    document: str,
    page_number: Optional[int],
    all_documents: List[str],
    files_dir: str,
    persona: Optional[str] = None,
    job: Optional[str] = None,
) -> TextSelectionResponse:
    """
    Main function to process text selection and generate cross-PDF insights.
    """
    start_time = time.time()

    # Extract context around selection
    doc_path = os.path.join(files_dir, document)
    context_text = extract_text_around_selection(
        doc_path, page_number or 1, selected_text
    )

    # Find semantic matches across all documents using the index
    matches = find_semantic_matches(selected_text, all_documents, files_dir, top_k=15)

    # Convert matches to CrossPDFInsight objects
    insights = []
    for match in matches:
        insight_type = categorize_insight_type(selected_text, match["text"])

        # Create jump URL
        jump_url = f"/files/{match['document']}#page={match['page_number']}"

        insight = CrossPDFInsight(
            document=match["document"],
            page_number=match["page_number"],
            section_title=f"Page {match['page_number']}",
            relevant_text=(
                match["text"][:300] + "..."
                if len(match["text"]) > 300
                else match["text"]
            ),
            relevance_score=match["similarity_score"],
            insight_type=insight_type,
            jump_url=jump_url,
        )
        insights.append(insight)

    # Sort insights by relevance score
    insights.sort(key=lambda x: x.relevance_score, reverse=True)

    # Detect contradictions and connections
    related_texts = [insight.relevant_text for insight in insights[:10]]
    contradictions = detect_contradictions(selected_text, related_texts)
    connections = find_connections(selected_text, related_texts)

    # Generate summary
    summary = generate_insight_summary(selected_text, insights[:5])

    return TextSelectionResponse(
        selected_text=selected_text,
        insights=insights[:10],  # Return top 10 insights
        summary=summary,
        contradictions=contradictions,
        connections=connections,
    )
