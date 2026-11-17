# ==========================================
# ClauseGuard AI — Multi-Stage Production Dockerfile
# ==========================================

# --- Stage 1: Builder ---
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies to wheels
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --prefix=/install -r requirements.txt

# --- Stage 2: Production Runner ---
FROM python:3.11-slim AS runner

WORKDIR /app

# Install runtime tools (curl for healthchecks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed dependencies from builder
COPY --from=builder /install /usr/local

# Create non-root user for security
RUN groupadd -g 1001 clauseguard && \
    useradd -u 1001 -g clauseguard -s /bin/bash -m clauseguard

# Copy application source code and evaluation data
COPY --chown=clauseguard:clauseguard src/ ./src/
COPY --chown=clauseguard:clauseguard data/ ./data/
COPY --chown=clauseguard:clauseguard evaluation/ ./evaluation/
COPY --chown=clauseguard:clauseguard tests/ ./tests/
COPY --chown=clauseguard:clauseguard .env.example .env

# Create storage directories with permissions
RUN mkdir -p /app/data/raw_uploads /app/qdrant_storage && \
    chown -R clauseguard:clauseguard /app

# Switch to unprivileged user
USER clauseguard

# Expose microservice port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start FastAPI Uvicorn ASGI server
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
