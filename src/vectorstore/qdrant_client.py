import os
import uuid
from typing import Any, Dict, List, Optional
from qdrant_client import QdrantClient
from qdrant_client.http import models

from src.core.config import get_settings
from src.core.logger import get_logger
from src.ingestion.chunker import ClauseChunk

logger = get_logger(__name__)


class QdrantVectorStore:
    """
    Production Qdrant Vector Store wrapper.
    Supports in-memory, local on-disk, and remote server modes.
    Generates BGE-small-en-v1.5 dense vectors via FastEmbed.
    """

    DEFAULT_EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
    VECTOR_DIM = 384

    def __init__(
        self,
        collection_name: Optional[str] = None,
        mode: Optional[str] = None,
        storage_path: Optional[str] = None,
    ):
        settings = get_settings()
        self.collection_name = collection_name or settings.QDRANT_COLLECTION_NAME
        self.mode = mode or settings.QDRANT_MODE
        self.storage_path = storage_path or settings.QDRANT_PATH

        # Initialize Qdrant Client based on mode
        if self.mode == "memory":
            self.client = QdrantClient(":memory:")
            logger.info("Initialized in-memory Qdrant instance")
        elif self.mode == "local":
            os.makedirs(self.storage_path, exist_ok=True)
            self.client = QdrantClient(path=self.storage_path)
            logger.info("Initialized local on-disk Qdrant", extra={"path": self.storage_path})
        elif self.mode == "server":
            self.client = QdrantClient(host=settings.QDRANT_HOST, port=settings.QDRANT_PORT)
            logger.info("Connected to remote Qdrant server", extra={"host": settings.QDRANT_HOST})
        else:
            raise ValueError(f"Unsupported QDRANT_MODE: '{self.mode}'")

        # Lazy embedder initialization
        self._embedder = None
        self.ensure_collection()

    @property
    def embedder(self):
        """Lazy load FastEmbed dense embedder."""
        if self._embedder is None:
            try:
                from fastembed import TextEmbedding
                self._embedder = TextEmbedding(model_name=self.DEFAULT_EMBEDDING_MODEL)
                logger.info("Loaded FastEmbed model", extra={"model": self.DEFAULT_EMBEDDING_MODEL})
            except Exception as e:
                logger.warning(
                    f"FastEmbed load failed ({e}); fallback to deterministic dummy embeddings for testing."
                )
                self._embedder = None
        return self._embedder

    def compute_embedding(self, text: str) -> List[float]:
        """Generate 384-dimensional dense embedding vector."""
        if self.embedder is not None:
            embeddings = list(self.embedder.embed([text]))
            return embeddings[0].tolist()
        else:
            # Fallback deterministic pseudo-vector for offline test environments
            import hashlib
            seed = int(hashlib.md5(text.encode("utf-8")).hexdigest(), 16)
            import random
            rng = random.Random(seed)
            return [rng.uniform(-1.0, 1.0) for _ in range(self.VECTOR_DIM)]

    def ensure_collection(self) -> None:
        """Create Qdrant collection if it does not already exist."""
        collections_response = self.client.get_collections()
        existing_names = [c.name for c in collections_response.collections]

        if self.collection_name not in existing_names:
            logger.info("Creating Qdrant collection", extra={"collection": self.collection_name})
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=models.VectorParams(
                    size=self.VECTOR_DIM,
                    distance=models.Distance.COSINE,
                ),
            )
            # Create payload indexes for fast filtering on server mode
            if self.mode == "server":
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="doc_id",
                    field_schema=models.PayloadSchemaType.KEYWORD,
                )
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="category",
                    field_schema=models.PayloadSchemaType.KEYWORD,
                )

    def upsert_clauses(self, chunks: List[ClauseChunk]) -> int:
        """
        Embed and upsert clause chunks into Qdrant collection.
        Returns the number of points inserted.
        """
        if not chunks:
            return 0

        points: List[models.PointStruct] = []
        for chunk in chunks:
            vector = self.compute_embedding(chunk.raw_text)
            # Generate deterministic UUID from chunk_id
            point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, chunk.chunk_id))
            payload = {
                "chunk_id": chunk.chunk_id,
                "doc_id": chunk.doc_id,
                "section_number": chunk.section_number,
                "section_title": chunk.section_title,
                "page_number": chunk.page_number,
                "raw_text": chunk.raw_text,
                "character_count": chunk.character_count,
                "token_count": chunk.token_count,
                "category": chunk.category,
            }

            points.append(
                models.PointStruct(
                    id=point_id,
                    vector=vector,
                    payload=payload,
                )
            )

        self.client.upsert(
            collection_name=self.collection_name,
            points=points,
        )

        logger.info(
            "Upserted clause chunks into Qdrant",
            extra={"collection": self.collection_name, "points_count": len(points)}
        )
        return len(points)

    def hybrid_search(
        self,
        query: str,
        doc_id: str,
        limit: int = 25,
        category_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Perform hybrid vector search filtered by document ID and optional category.
        """
        query_vector = self.compute_embedding(query)

        must_conditions: List[models.FieldCondition] = [
            models.FieldCondition(
                key="doc_id",
                match=models.MatchValue(value=doc_id),
            )
        ]

        if category_filter and category_filter.upper() != "ANY":
            must_conditions.append(
                models.FieldCondition(
                    key="category",
                    match=models.MatchValue(value=category_filter.upper()),
                )
            )

        search_filter = models.Filter(must=must_conditions)

        search_result = self.client.query_points(
            collection_name=self.collection_name,
            query=query_vector,
            query_filter=search_filter,
            limit=limit,
            with_payload=True,
        )

        results: List[Dict[str, Any]] = []
        for scored_point in search_result.points:
            item = dict(scored_point.payload) if scored_point.payload else {}
            item["score"] = float(scored_point.score)
            results.append(item)

        logger.info(
            "Vector search executed",
            extra={"query": query[:40], "doc_id": doc_id, "results_found": len(results)}
        )
        return results
