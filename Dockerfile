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

# Create non-root user for Hugging Face Spaces compatibility (UID 1000)
RUN useradd -m -u 1000 user

# Copy backend source & assets
COPY --chown=user:user src/ ./src/
COPY --chown=user:user data/ ./data/
COPY --chown=user:user evaluation/ ./evaluation/
COPY --chown=user:user tests/ ./tests/
COPY --chown=user:user migrations/ ./migrations/
COPY --chown=user:user .env.example .env

# Copy built frontend distribution
COPY --from=frontend-builder --chown=user:user /app/frontend/dist ./frontend/dist

# Create storage directories with permissions
RUN mkdir -p /app/data/raw_uploads /app/qdrant_storage && \
    chown -R user:user /app

USER user

EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:7860/health || exit 1

CMD ["sh", "-c", "uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
