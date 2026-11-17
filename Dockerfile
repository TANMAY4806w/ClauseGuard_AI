# ==========================================
# ClauseGuard AI — Multi-Stage Production Dockerfile
# ==========================================

# --- Stage 1: Frontend Builder ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# --- Stage 2: Python Dependency Builder ---
FROM python:3.11-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --prefix=/install -r requirements.txt

# --- Stage 3: Production Runner ---
FROM python:3.11-slim AS runner

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy python dependencies
COPY --from=builder /install /usr/local

# Create non-root user
RUN groupadd -g 1001 clauseguard && \
    useradd -u 1001 -g clauseguard -s /bin/bash -m clauseguard

# Copy backend source & assets
COPY --chown=clauseguard:clauseguard src/ ./src/
COPY --chown=clauseguard:clauseguard data/ ./data/
COPY --chown=clauseguard:clauseguard evaluation/ ./evaluation/
COPY --chown=clauseguard:clauseguard tests/ ./tests/
COPY --chown=clauseguard:clauseguard migrations/ ./migrations/
COPY --chown=clauseguard:clauseguard .env.example .env

# Copy built frontend distribution
COPY --from=frontend-builder --chown=clauseguard:clauseguard /app/frontend/dist ./frontend/dist

# Create storage directories
RUN mkdir -p /app/data/raw_uploads /app/qdrant_storage && \
    chown -R clauseguard:clauseguard /app

USER clauseguard

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
