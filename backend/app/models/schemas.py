from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class DocumentItem(BaseModel):
    filename: str
    url: str
    pages: Optional[int] = None
    size: Optional[int] = None  # Size in bytes


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


# New schemas for text selection functionality
class TextSelectionRequest(BaseModel):
    selected_text: str
    document: str
    page_number: Optional[int] = None
    persona: Optional[str] = None
    job: Optional[str] = None


class CrossPDFInsight(BaseModel):
    document: str
    page_number: int
    section_title: Optional[str] = None
    relevant_text: str
    relevance_score: float
    insight_type: Optional[str] = (
        "relevant"  # "overlapping", "adjacent", "contradictory", "relevant"
    )
    jump_url: Optional[str] = None


class TextSelectionResponse(BaseModel):
    selected_text: str
    insights: List[CrossPDFInsight]
    summary: str
    contradictions: List[str]
    connections: List[str]


class EnhancedPodcastRequest(BaseModel):
    selected_text: str
    related_insights: List[CrossPDFInsight]
    document: str
    page_number: Optional[int] = None
    conversation_style: Optional[str] = "academic"  # academic, casual, technical
    persona: Optional[str] = None
    job: Optional[str] = None


class EnhancedPodcastResponse(BaseModel):
    url: str
    transcript: str
    duration: float


class DocumentSearchRequest(BaseModel):
    query: str
    documents: Optional[List[str]] = None
    top_k: Optional[int] = 10


class DocumentSearchResponse(BaseModel):
    results: List[Dict[str, Any]]
    total_found: int
    search_time: float
