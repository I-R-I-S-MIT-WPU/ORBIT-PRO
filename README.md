# Adobe Hackathon Finale (Adobe Hackathon 2025)

An interactive, intelligent PDF reading web app that brings Round 1A/1B brains to life.

- CPU-first, fast recommendations (<10s)
- Persona + Job-to-be-done driven relevance
- Multi-PDF upload and library
- Adobe PDF Embed API viewer with jump-to-section
- Highlights via text search + snippets
- LLM-powered insights (Gemini/Azure/OpenAI/Ollama)
- 2–5 min Podcast mode via TTS providers (Azure/GCP/local)

## Quick Start (Docker)

Build:

```bash
docker build --platform linux/amd64 -t adobe-hackathon-finale .
```

Run (Gemini + Azure Speech):

```bash
docker run \
  -e LLM_PROVIDER=gemini \
  -e GOOGLE_API_KEY=$GOOGLE_API_KEY \  # or: -e GOOGLE_APPLICATION_CREDENTIALS=/creds/sa.json
  -e GEMINI_MODEL=gemini-2.0-flash \
  -e TTS_PROVIDER=azure_speech \
  -e AZURE_SPEECH_KEY=$AZURE_SPEECH_KEY \
  -e AZURE_SPEECH_REGION=centralindia \  # or set AZURE_SPEECH_ENDPOINT=https://centralindia.api.cognitive.microsoft.com/
  -e ADOBE_EMBED_API_KEY=$ADOBE_EMBED_API_KEY \
  -p 8080:8080 adobe-hackathon-finale
```

Run (Ollama local free-tier):

```bash
docker run \
  -e LLM_PROVIDER=ollama \
  -e OLLAMA_BASE_URL=http://host.docker.internal:11434 \
  -e OLLAMA_MODEL=gemma3:1b \
  -e TTS_PROVIDER=azure_speech \
  -e AZURE_SPEECH_KEY=$AZURE_SPEECH_KEY \
  -e AZURE_SPEECH_REGION=centralindia \
  -e ADOBE_EMBED_API_KEY=$ADOBE_EMBED_API_KEY \
  -p 8080:8080 adobe-hackathon-finale
```

Open http://localhost:8080/

Notes:
- Base features (upload, extract headings, rank, snippets, navigate) run without internet and without LLM/TTS.
- Insights bulb and Podcast require the relevant provider env vars.

## Project Structure

```
Adobe-Hackathon-Finale/
  backend/
    app/
      main.py
      models/schemas.py
      services/
        extractor.py
        analyzer.py
        summarizer.py
        related.py
        llm.py
        tts.py
        storage.py
      static/        # audio output, served as /static
    requirements.txt
  frontend/
    index.html
    app.js
    styles.css
  Dockerfile
  README.md
```

## API Endpoints (summary)
- POST /api/upload (multipart) → stores PDFs
- GET /api/documents → list PDFs + URLs
- POST /api/analyze → persona/job + selected docs → relevant sections + snippets + related
- POST /api/insights → LLM insights given context
- POST /api/podcast → TTS to mp3, returns URL
- GET /files/{filename} → serve original PDFs
- GET /api/config → surface Adobe Embed API key
- GET /api/health → simple status and provider info

## Offline mode
- Set no LLM/TTS env → the app switches to keyword/embedding heuristic and extractive summaries; podcast disabled unless local provider enabled.

## Dev (local Python)
```
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt
python backend/app/main.py --reload --llm gemini --gemini-model gemini-2.0-flash
# or
python backend/app/main.py --reload --llm ollama --ollama-model gemma3:1b
```

## Environment variables
- Copy `.env.example` to `.env` and fill required values. The backend loads `.env` automatically.
- LLM providers: set `LLM_PROVIDER` to `gemini` (default), `ollama`, `openai`, or `azure`.
- Azure Speech TTS: use `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` (e.g., `centralindia`).
  - Alternatively, set `AZURE_SPEECH_ENDPOINT` (aliases supported: `AZURE_ENDPOINT`, `AZURE_ENPOINT`), region is derived.
  - Optional `AZURE_SPEECH_VOICE` (default: `en-US-AriaNeural`).
- Adobe PDF Embed: set `ADOBE_EMBED_API_KEY`.

## Credits
- Round 1A: heading/outline extraction inspiration
- Round 1B: relevance ranking + extractive summaries
- Adobe PDF Embed API for high-fidelity viewer
