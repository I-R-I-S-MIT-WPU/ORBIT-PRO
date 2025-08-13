"""
Ranks sections by relevance to persona/job.
Ported from Round 1B `analyzer.py` with light adjustments for packaging.
"""
from typing import Dict, List, Tuple
import re
import subprocess
import os

try:
    from sentence_transformers import SentenceTransformer, util

    _HERE = os.path.dirname(__file__)
    _MODEL_DIR = os.path.join(_HERE, "models", "all-MiniLM-L6-v2")
    _EMBEDDING_MODEL = SentenceTransformer(_MODEL_DIR)
    _HAS_EMBEDDINGS = True
except Exception:
    _HAS_EMBEDDINGS = False
    _EMBEDDING_MODEL = None


def _nlp_score(section, persona, job):
    text = (section.get("section_title", "") + " " + section.get("text", "")).lower()
    persona_job = (persona + " " + job).lower()
    text_words = set(re.findall(r"\w+", text))
    pj_words = set(re.findall(r"\w+", persona_job))
    overlap = len(text_words & pj_words)
    return overlap


def _embedding_score(section, persona, job):
    if not _HAS_EMBEDDINGS:
        return _nlp_score(section, persona, job)
    text = section.get("section_title", "") + ". " + section.get("text", "")
    persona_job = persona + ". " + job
    emb1 = _EMBEDDING_MODEL.encode(persona_job, convert_to_tensor=True)
    emb2 = _EMBEDDING_MODEL.encode(text, convert_to_tensor=True)
    score = float(util.pytorch_cos_sim(emb1, emb2).item())
    return score


def _ollama_score(section, persona, job):
    prompt = f"""
You are an expert assistant. Given the following section from a document, a persona, and a job-to-be-done, rate the relevance of the section to the persona's job on a scale of 1 (not relevant) to 10 (highly relevant).

Section: {section.get('section_title', '')}
Text: {section.get('text', '')}
Persona: {persona}
Job: {job}

Respond with only the number (1-10)."""
    try:
        result = subprocess.run(
            ["ollama", "run", "gemma3:1b", "--format", "json"],
            input=prompt.encode("utf-8"),
            capture_output=True,
            timeout=10,
        )
        output = result.stdout.decode("utf-8").strip()
        m = re.search(r"([1-9]|10)", output)
        return int(m.group(1)) if m else 1
    except Exception:
        return 1


def rank_sections_by_relevance(
    sections: List[Dict],
    persona: str,
    job: str,
    approach: str = "nlp",
    method: str = "auto",
) -> Tuple[List[Dict], str]:
    if approach == "llm":
        for section in sections:
            section["relevance_score"] = _ollama_score(section, persona, job)
        actual_method = "llm"
    else:
        use_embedding = (method == "embedding") or (method == "auto" and _HAS_EMBEDDINGS)
        for section in sections:
            section["relevance_score"] = (
                _embedding_score(section, persona, job) if use_embedding else _nlp_score(section, persona, job)
            )
        actual_method = "embedding" if use_embedding else "keyword"

    ranked = sorted(sections, key=lambda x: x.get("relevance_score", 0), reverse=True)
    for i, s in enumerate(ranked):
        s["importance_rank"] = i + 1
    return ranked, actual_method
