"""
Summarizer: extractive or LLM-based summaries.
Ported from Round 1B `summarizer.py` (extractive default for speed).
"""
from typing import Dict, List
import re
import subprocess


def _extractive_summary(section):
    text = section.get("text", "")
    sentences = re.split(r"(?<=[.!?]) +", text)
    summary = " ".join(sentences[:2]).strip()
    return summary if summary else text[:200]


def _ollama_summary(section, persona, job):
    prompt = f"""
You are an expert assistant. Given the following section from a document, a persona, and a job-to-be-done, write a concise summary (2-3 sentences) of the section, focusing on what is most relevant for the persona's job.

Section: {section.get('section_title', '')}
Text: {section.get('text', '')}
Persona: {persona}
Job: {job}

Summary:"""
    try:
        result = subprocess.run(
            ["ollama", "run", "gemma3:1b", "--format", "json"],
            input=prompt.encode("utf-8"),
            capture_output=True,
            timeout=20,
        )
        output = result.stdout.decode("utf-8").strip()
        summary = " ".join(re.split(r"(?<=[.!?]) +", output)[:3])
        return summary[:400]
    except Exception:
        return section.get("text", "")[:200]


def summarize_sections(sections: List[Dict], persona: str, job: str, approach: str = "nlp") -> List[Dict]:
    results = []
    for section in sections:
        refined = _ollama_summary(section, persona, job) if approach == "llm" else _extractive_summary(section)
        results.append(
            {
                "document": section["document"],
                "refined_text": refined,
                "page_number": section.get("page_number", 1),
            }
        )
    return results
