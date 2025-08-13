# syntax=docker/dockerfile:1
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy project
COPY backend /app/backend
COPY frontend /app/frontend
COPY README.md /app/README.md

# Install Python deps
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Download sentence-transformers model into services/models
RUN python /app/backend/app/services/download_allminilml6v2.py || true

EXPOSE 8080

# Run the API server
WORKDIR /app/backend
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
