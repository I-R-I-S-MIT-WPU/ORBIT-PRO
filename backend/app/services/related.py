"""
Find related sections across the full section set for each selected (top) section.
Fast CPU heuristic using token overlap; if embeddings are available, boost by cosine.
"""
from typing import Dict, List
import re
import os

try:
    from sentence_transformers import SentenceTransformer, util

    _HERE = os.path.dirname(__file__)
    _MODEL_DIR = os.path.join(_HERE, "models", "all-MiniLM-L6-v2")
    _EMBED_MODEL = SentenceTransformer(_MODEL_DIR)
    _HAS_EMB = True
except Exception:
    _HAS_EMB = False
    _EMBED_MODEL = None


def _tokens(s: str):
    return set(re.findall(r"\w+", (s or "").lower()))


def _bag_score(a: str, b: str) -> float:
    ta, tb = _tokens(a), _tokens(b)
    if not ta or not tb:
        return 0.0
    inter = len(ta & tb)
    denom = (len(ta) + len(tb)) / 2.0
    return inter / denom


def _emb_score(a: str, b: str) -> float:
    if not _HAS_EMB:
        return _bag_score(a, b)
    e1 = _EMBED_MODEL.encode(a, convert_to_tensor=True)
    e2 = _EMBED_MODEL.encode(b, convert_to_tensor=True)
    return float(util.pytorch_cos_sim(e1, e2).item())


def _section_text(sec: Dict) -> str:
    return f"{sec.get('section_title','')}. {sec.get('text','')}"


def find_related_sections(top_sections: List[Dict], all_sections: List[Dict], per_item: int = 3) -> Dict[str, List[Dict]]:
    """
    Returns a map: key is unique id of top section (doc|title|page), value is list of related sections (dicts).
    """
    related_map = {}
    for s in top_sections:
        key = f"{s.get('document','')}|{s.get('section_title','')}|{s.get('page_number',1)}"
        base_text = _section_text(s)
        scores = []
        for t in all_sections:
            if t is s:
                continue
            if t.get("document") == s.get("document") and t.get("page_number") == s.get("page_number"):
                continue
            score = 0.4 * _bag_score(base_text, _section_text(t)) + 0.6 * _emb_score(base_text, _section_text(t))
            scores.append((score, t))
        scores.sort(key=lambda x: x[0], reverse=True)
        picks = []
        for sc, t in scores[: per_item * 2]:  # over-sample then filter duplicates by page
            picks.append(
                {
                    "document": t.get("document", ""),
                    "section_title": t.get("section_title", ""),
                    "page_number": t.get("page_number", 1),
                    "relevance_score": float(sc),
                }
            )
        # keep unique by (doc,page), top N
        seen = set()
        uniq = []
        for p in picks:
            k = (p["document"], p["page_number"]) 
            if k in seen:
                continue
            seen.add(k)
            # Conform to SectionOut by adding importance_rank (1..N within related list)
            p_with_rank = dict(p)
            p_with_rank["importance_rank"] = len(uniq) + 1
            uniq.append(p_with_rank)
            if len(uniq) >= per_item:
                break
        related_map[key] = uniq
    return related_map
