"""
PDF section extractor: identifies headings and page numbers using layout/semantic cues.
Ported from Round 1B `extractor.py`.
"""
from typing import Dict, List
import re
import fitz  # PyMuPDF


def extract_sections_from_pdf(pdf_path: str) -> List[Dict]:
    """
    Extract section headings (H1/H2/H3) with page numbers from a PDF.
    Returns a list of dicts: {section_title, level, page_number, text}
    """
    doc = fitz.open(pdf_path)
    headings = []
    font_sizes = []

    # Collect font sizes
    for page in doc:
        blocks = page.get_text("dict").get("blocks", [])
        for b in blocks:
            for l in b.get("lines", []):
                for s in l.get("spans", []):
                    font_sizes.append(s.get("size", 0))

    if not font_sizes:
        return []

    # Heuristic: top-3 sizes map to H1/H2/H3
    unique_sizes = sorted(list(set(font_sizes)), reverse=True)
    size_to_level = {}
    if len(unique_sizes) > 0:
        size_to_level[unique_sizes[0]] = "H1"
    if len(unique_sizes) > 1:
        size_to_level[unique_sizes[1]] = "H2"
    if len(unique_sizes) > 2:
        size_to_level[unique_sizes[2]] = "H3"

    # Extract headings
    for page_num, page in enumerate(doc, 1):
        blocks = page.get_text("dict").get("blocks", [])
        for b in blocks:
            for l in b.get("lines", []):
                for s in l.get("spans", []):
                    text = (s.get("text", "") or "").strip()
                    if not text or len(text) < 3:
                        continue
                    size = s.get("size", 0)
                    level = size_to_level.get(size)

                    # semantic cues: all-caps short, numbered
                    is_heading = False
                    if level:
                        is_heading = True
                    elif re.match(r"^[A-Z][A-Z\s\d\-\.]+$", text) and len(text.split()) < 10:
                        is_heading = True
                        level = "H2"
                    elif re.match(r"^(\d+\.|[IVX]+\.)", text):
                        is_heading = True
                        level = "H3"

                    if is_heading:
                        headings.append(
                            {
                                "section_title": text,
                                "level": level or "H3",
                                "page_number": page_num,
                                "text": text,
                            }
                        )
    return headings
