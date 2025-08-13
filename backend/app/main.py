import argparse
import io
import os
import re
import threading
import time
import uuid
from typing import List, Optional

import fitz  # PyMuPDF
from dotenv import load_dotenv
from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .models.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    DocumentItem,
    InsightsRequest,
    InsightsResponse,
    PodcastRequest,
    PodcastResponse,
)
from .services import analyzer, extractor, llm, related, storage, summarizer, tts

# Directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
FILES_DIR = os.path.join(ROOT_DIR, "files")  # uploaded PDFs
STATIC_DIR = os.path.join(ROOT_DIR, "static")  # audio & other assets

# Load .env at import time so env vars are available in any run mode
load_dotenv(os.path.join(ROOT_DIR, ".env"))

os.makedirs(FILES_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)

app = FastAPI(title="Adobe Hackathon Finale API")

# CORS open for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static mounts
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/files", StaticFiles(directory=FILES_DIR), name="files")


@app.get("/", response_class=HTMLResponse)
def index_page():
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if not os.path.exists(index_path):
        return HTMLResponse("<h1>Adobe Hackathon Finale</h1><p>Frontend not found.</p>")
    with open(index_path, "r", encoding="utf-8") as f:
        return HTMLResponse(f.read())


@app.get("/favicon.ico")
def favicon():
    # Avoid 404 noise in console
    return Response(status_code=204)


@app.get("/api/config")
def get_config():
    # Surface Adobe Embed API key to frontend.
    adobe_key = os.getenv("ADOBE_EMBED_API_KEY", "")
    return {"adobe_embed_api_key": adobe_key}


@app.get("/.well-known/appspecific/com.chrome.devtools.json")
async def chrome_devtools():
    """Handle Chrome DevTools request to prevent 404 errors"""
    return {"status": "ok", "message": "Chrome DevTools endpoint"}


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "llm_provider": os.getenv("LLM_PROVIDER", "gemini"),
        "gemini_model": os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
        "ollama_model": os.getenv("OLLAMA_MODEL", "gemma3:1b"),
        "tts_provider": os.getenv("TTS_PROVIDER", "azure_speech"),
        "adobe_key": bool(os.getenv("ADOBE_EMBED_API_KEY")),
    }


@app.post("/api/upload", response_model=List[DocumentItem])
async def upload(files: List[UploadFile] = File(...)):
    saved: List[DocumentItem] = []
    for f in files:
        if not f.filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=400, detail=f"Only PDF allowed: {f.filename}"
            )
        content = await f.read()
        item = storage.save_pdf_bytes(FILES_DIR, f.filename, content)
        saved.append(item)
    return saved


@app.get("/api/documents", response_model=List[DocumentItem])
def list_documents():
    return storage.list_pdfs(FILES_DIR)


class AnalyzeQuery(BaseModel):
    persona: str
    job: str
    documents: List[str]  # filenames
    approach: Optional[str] = "nlp"  # nlp or llm
    method: Optional[str] = "auto"  # auto|keyword|embedding
    top_k: Optional[int] = 5


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze_documents(req: AnalyzeQuery):
    # Load and extract sections from selected PDFs
    sections = []
    for fname in req.documents:
        pdf_path = os.path.join(FILES_DIR, fname)
        if not os.path.exists(pdf_path):
            raise HTTPException(status_code=404, detail=f"File not found: {fname}")
        try:
            doc_sections = extractor.extract_sections_from_pdf(pdf_path)
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Failed to process {fname}: {e}"
            )
        for s in doc_sections:
            s["document"] = fname
        sections.extend(doc_sections)

    if not sections:
        return AnalyzeResponse(
            extracted_sections=[], snippets=[], related_map={}, method="none"
        )

    ranked, actual_method = analyzer.rank_sections_by_relevance(
        sections, req.persona, req.job, approach=req.approach, method=req.method
    )
    ranked = ranked[: max(1, req.top_k or 5)]

    # Generate short snippets (1-2 sentences)
    summaries = summarizer.summarize_sections(
        ranked, req.persona, req.job, approach="nlp"
    )

    # Build related sections map (per selected item find related across all)
    rel_map = related.find_related_sections(ranked, sections)

    # Response models
    return AnalyzeResponse(
        extracted_sections=[
            {
                "document": s["document"],
                "section_title": s.get("section_title", ""),
                "importance_rank": s.get("importance_rank", i + 1),
                "page_number": s.get("page_number", 1),
                "relevance_score": s.get("relevance_score", 0.0),
            }
            for i, s in enumerate(ranked)
        ],
        snippets=[
            {
                "document": ss["document"],
                "refined_text": ss["refined_text"],
                "page_number": ss["page_number"],
            }
            for ss in summaries
        ],
        related_map=rel_map,
        method=actual_method,
    )


@app.post("/api/insights", response_model=InsightsResponse)
def insights(req: InsightsRequest):
    # Compose a prompt based on persona, job, current snippet and related snippets
    system = {
        "role": "system",
        "content": (
            "You are a precise teaching assistant. Using the current section and related "
            "sections, produce a SHORT, ACTIONABLE brief for the user. Return plain text "
            "with EXACTLY these sections and formatting (no preface, no extra commentary):\n\n"
            "Key Insights:\n"
            "- <bullet 1, <= 20 words, include page numbers if obvious>\n"
            "- <bullet 2>\n"
            "- <bullet 3>\n\n"
            "Did You Know?:\n"
            "- <interesting fact or highlight, <= 20 words>\n"
            "- <another>\n\n"
            "Contradictions and Connections:\n"
            "- <note contradictions, counterpoints, or cross-doc links>\n"
            "- <another>\n\n"
            "Rules: Bullets must be concise, faithful to the text; no hallucinations; "
            "avoid repeating the prompt; do not include markdown fencing."
        ),
    }
    user = {
        "role": "user",
        "content": (
            f"Persona: {req.persona}\nJob: {req.job}\n"
            f"Current: {req.current_text}\n\nRelated:\n"
            + "\n".join([f"- {r}" for r in (req.related_texts or [])])
        ),
    }

    try:
        content = llm.get_llm_response([system, user])
    except Exception:
        # Fallback simple insights when LLM not available
        content = (
            "Key Insights:\n"
            "- Focus on definitions, equations, and mechanisms mentioned.\n\n"
            "Did You Know?:\n"
            "- Contrast with earlier sections to spot nuances.\n\n"
            "Contradictions and Connections:\n"
            "- Note any opposing claims; verify terminology.\n"
        )

    # Light post-processing to ensure section headers exist for consistent rendering
    text = (content or "").strip()
    low = text.lower()
    if (
        "key insights:" not in low
        and "did you know?" not in low
        and "contradictions" not in low
    ):
        bullets = [
            f"- {line.strip('- ').strip()}"
            for line in text.splitlines()
            if line.strip()
        ]
        text = "Key Insights:\n" + ("\n".join(bullets) or "- No insights available.")
    return InsightsResponse(content=text)


@app.post("/api/podcast", response_model=PodcastResponse)
def podcast(req: PodcastRequest):
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Empty text")

    # Generate mp3 in STATIC_DIR
    out_name = req.output_name or "podcast.mp3"
    out_path = os.path.join(STATIC_DIR, out_name)

    try:
        url = tts.generate_audio_to_file(text=text, output_file=out_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS failed: {e}")

    # Return URL for frontend to play
    rel = f"/static/{os.path.basename(out_path)}"
    return PodcastResponse(url=rel)


@app.get("/api/search_count")
def search_count(
    file: str = Query(..., description="PDF filename in /files"),
    q: str = Query(..., description="Search query"),
):
    pdf_path = os.path.join(FILES_DIR, file)
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail=f"File not found: {file}")

    # Build a case-insensitive pattern that counts overlapping matches
    # Example: for 'as', matches 'as' within words as requested
    try:
        pattern = re.compile(r"(?=" + re.escape(q) + r")", re.IGNORECASE)
    except re.error:
        raise HTTPException(status_code=400, detail="Invalid search pattern")

    doc = fitz.open(pdf_path)
    per_page = []
    total = 0
    for i, page in enumerate(doc, 1):
        text = page.get_text("text") or ""
        count = len(pattern.findall(text))
        per_page.append({"page": i, "count": count})
        total += count

    return {"file": file, "query": q, "total": total, "per_page": per_page}


# Serve frontend assets
@app.get("/app.js", response_class=HTMLResponse)
def js_bundle():
    path = os.path.join(FRONTEND_DIR, "app.js")
    if not os.path.exists(path):
        raise HTTPException(status_code=404)
    with open(path, "r", encoding="utf-8") as f:
        return HTMLResponse(f.read(), media_type="application/javascript")


@app.get("/styles.css", response_class=HTMLResponse)
def css_bundle():
    path = os.path.join(FRONTEND_DIR, "styles.css")
    if not os.path.exists(path):
        raise HTTPException(status_code=404)
    with open(path, "r", encoding="utf-8") as f:
        return HTMLResponse(f.read(), media_type="text/css")


JOBS: dict[str, dict] = {}


@app.post("/api/analyze_async")
def analyze_async(req: AnalyzeQuery):
    job_id = str(uuid.uuid4())
    JOBS[job_id] = {
        "status": "queued",
        "progress": 0,
        "current_file": None,
        "total_files": len(req.documents or []),
        "processed_files": 0,
        "result": None,
        "error": None,
    }

    def worker():
        try:
            JOBS[job_id]["status"] = "running"
            sections = []
            total = len(req.documents or [])
            for idx, fname in enumerate(req.documents or [], start=1):
                JOBS[job_id]["current_file"] = fname
                JOBS[job_id]["processed_files"] = idx - 1
                pdf_path = os.path.join(FILES_DIR, fname)
                if not os.path.exists(pdf_path):
                    raise HTTPException(
                        status_code=404, detail=f"File not found: {fname}"
                    )
                # Extract sections for this file
                doc_sections = extractor.extract_sections_from_pdf(pdf_path)
                for s in doc_sections:
                    s["document"] = fname
                sections.extend(doc_sections)
                # Rough progress by files first (80%), remainder after ranking
                JOBS[job_id]["progress"] = int((idx / max(1, total)) * 80)

            if not sections:
                JOBS[job_id]["result"] = AnalyzeResponse(
                    extracted_sections=[], snippets=[], related_map={}, method="none"
                ).dict()
                JOBS[job_id]["progress"] = 100
                JOBS[job_id]["status"] = "done"
                return

            # Ranking and summarization (split into two steps for progress)
            ranked, actual_method = analyzer.rank_sections_by_relevance(
                sections, req.persona, req.job, approach=req.approach, method=req.method
            )
            ranked = ranked[: max(1, req.top_k or 5)]
            JOBS[job_id]["progress"] = 90

            summaries = summarizer.summarize_sections(
                ranked, req.persona, req.job, approach="nlp"
            )
            JOBS[job_id]["progress"] = 95

            rel_map = related.find_related_sections(ranked, sections)

            result = AnalyzeResponse(
                extracted_sections=[
                    {
                        "document": s["document"],
                        "section_title": s.get("section_title", ""),
                        "importance_rank": s.get("importance_rank", i + 1),
                        "page_number": s.get("page_number", 1),
                        "relevance_score": s.get("relevance_score", 0.0),
                    }
                    for i, s in enumerate(ranked)
                ],
                snippets=[
                    {
                        "document": ss["document"],
                        "refined_text": ss["refined_text"],
                        "page_number": ss["page_number"],
                    }
                    for ss in summaries
                ],
                related_map=rel_map,
                method=actual_method,
            ).dict()

            JOBS[job_id]["result"] = result
            JOBS[job_id]["progress"] = 100
            JOBS[job_id]["status"] = "done"
        except Exception as e:
            JOBS[job_id]["status"] = "error"
            JOBS[job_id]["error"] = str(e)

    threading.Thread(target=worker, daemon=True).start()
    return {"job_id": job_id}


@app.get("/api/analyze_progress")
def analyze_progress(id: str = Query(...)):
    job = JOBS.get(id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    return {
        "status": job["status"],
        "progress": job["progress"],
        "current_file": job["current_file"],
        "processed_files": job["processed_files"],
        "total_files": job["total_files"],
        "error": job.get("error"),
    }


@app.get("/api/analyze_result")
def analyze_result(id: str = Query(...)):
    job = JOBS.get(id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    if job["status"] != "done":
        return JSONResponse({"status": job["status"]}, status_code=202)
    return job["result"]


if __name__ == "__main__":
    # Load .env before parsing
    load_dotenv(os.path.join(ROOT_DIR, ".env"))

    parser = argparse.ArgumentParser(
        description="Run Adobe Hackathon Finale API server"
    )
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--reload", action="store_true", help="Enable reload")
    parser.add_argument(
        "--llm",
        choices=["gemini", "ollama"],
        default=os.getenv("LLM_PROVIDER", "gemini"),
        help="LLM provider",
    )
    parser.add_argument(
        "--gemini-model", default=os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    )
    parser.add_argument(
        "--ollama-model", default=os.getenv("OLLAMA_MODEL", "gemma3:1b")
    )
    args = parser.parse_args()

    # Export provider choices to env so services pick them up
    os.environ["LLM_PROVIDER"] = args.llm
    if args.llm == "gemini":
        os.environ["GEMINI_MODEL"] = args.gemini_model
    elif args.llm == "ollama":
        os.environ["OLLAMA_MODEL"] = args.ollama_model

    import uvicorn

    uvicorn.run("app.main:app", host=args.host, port=args.port, reload=args.reload)
