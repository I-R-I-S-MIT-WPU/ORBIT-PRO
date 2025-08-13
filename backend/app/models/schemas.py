from typing import List, Dict, Optional
from pydantic import BaseModel


class DocumentItem(BaseModel):
    filename: str
    url: str


class SectionOut(BaseModel):
    document: str
    section_title: str
    importance_rank: int
    page_number: int
    relevance_score: float


class SnippetOut(BaseModel):
    document: str
    refined_text: str
    page_number: int


class AnalyzeResponse(BaseModel):
    extracted_sections: List[SectionOut]
    snippets: List[SnippetOut]
    related_map: Dict[str, List[SectionOut]]
    method: str


class AnalyzeRequest(BaseModel):
    persona: str
    job: str
    documents: List[str]
    approach: Optional[str] = "nlp"
    method: Optional[str] = "auto"
    top_k: Optional[int] = 5


class InsightsRequest(BaseModel):
    persona: str
    job: str
    current_text: str
    related_texts: Optional[List[str]] = []


class InsightsResponse(BaseModel):
    content: str


class PodcastRequest(BaseModel):
    text: str
    output_name: Optional[str] = None


class PodcastResponse(BaseModel):
    url: str
