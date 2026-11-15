import re
from typing import List, Optional
from pydantic import BaseModel, Field

from src.ingestion.pdf_parser import ExtractedPage, ParsedDocument
from src.core.logger import get_logger

logger = get_logger(__name__)


class ClauseChunk(BaseModel):
    """Represents a discrete semantic legal clause chunk ready for vector indexing."""
    chunk_id: str = Field(..., description="Unique chunk identifier, e.g. doc_123_clause_001")
    doc_id: str = Field(..., description="Parent document identifier")
    section_number: str = Field(default="N/A", description="Detected section or clause number, e.g. '8.2' or 'Article IV'")
    section_title: str = Field(default="General Provisions", description="Section headline or title")
    page_number: int = Field(..., description="Physical page number (1-indexed)")
    raw_text: str = Field(..., description="Verbatim text content of the clause")
    character_count: int = Field(..., description="Character count")
    token_count: int = Field(..., description="Estimated token count (~chars / 4)")
    category: str = Field(default="GENERAL", description="Predicted legal category: TERMINATION, INDEMNITY, LIABILITY, JURISDICTION, IP, GENERAL")


class SemanticClauseChunker:
    """
    Regex-anchored semantic hierarchy splitter.
    Detects legal section boundaries (Articles, Sections, numbered clauses, bold caps)
    to ensure complete clauses are preserved without slicing sentences.
    """

    # Section header detection regex patterns
    SECTION_PATTERNS = [
        # E.g., "Article I: Definitions", "ARTICLE 4 - TERMINATION"
        re.compile(r"^(?:ARTICLE|Article)\s+([IVXLCDM\d]+)[:\.\-\s]+([^\n\.\;]+)?", re.MULTILINE),
        # E.g., "Section 14.2(b) Renewal Term", "SECTION 3. FEES"
        re.compile(r"^(?:SECTION|Section|Clause)\s+(\d+(?:\.\d+)*(?:\([a-zA-Z\d]+\))*)[:\.\-\s]+([^\n\.\;]+)?", re.MULTILINE),
        # E.g., "14.2 Automatic Renewal", "1.1 Definitions"
        re.compile(r"^(\d+\.\d+(?:\.\d+)?)\s+([A-Z][a-zA-Z0-9\s,\-\(\)]+)(?:\n|$)", re.MULTILINE),
        # E.g., All-caps headers: "TERMINATION AND CANCELLATION", "INDEMNIFICATION"
        re.compile(r"^([A-Z][A-Z\s\/\&]{3,40})(?:\n|$)", re.MULTILINE),
    ]

    # Category classification keywords
    CATEGORY_KEYWORDS = {
        "TERMINATION": ["terminat", "renewal", "renew", "cancel", "expiration", "lock-in", "notice of non-renewal"],
        "INDEMNITY": ["indemnif", "hold harmless", "defend", "third-party claim", "indemnitee"],
        "LIABILITY": ["limitation of liability", "liability cap", "consequential damage", "liquidated damage", "sole remedy"],
        "JURISDICTION": ["governing law", "jurisdiction", "venue", "arbitration", "dispute resolution", "courts of"],
        "IP": ["intellectual property", "ownership of work", "work made for hire", "patent", "copyright", "assignment"],
        "CONFIDENTIALITY": ["confidential", "non-disclosure", "proprietary information", "trade secret"],
    }

    def __init__(self, min_chunk_chars: int = 60, max_chunk_chars: int = 2500):
        self.min_chunk_chars = min_chunk_chars
        self.max_chunk_chars = max_chunk_chars

    def classify_category(self, text: str, title: str = "") -> str:
        """Infer legal category based on section title and clause content."""
        search_blob = f"{title} {text}".lower()
        for category, keywords in self.CATEGORY_KEYWORDS.items():
            for kw in keywords:
                if kw in search_blob:
                    return category
        return "GENERAL"

    def split_page_into_clauses(self, page: ExtractedPage, doc_id: str, start_index: int = 1) -> List[ClauseChunk]:
        """Split a single page's text into semantic clause chunks."""
        text = page.text
        if not text or len(text.strip()) < self.min_chunk_chars:
            return []

        # Find all section header match positions
        matches = []
        for pattern in self.SECTION_PATTERNS:
            for match in pattern.finditer(text):
                matches.append((match.start(), match.end(), match.groups()))

        # Sort matches by character position in page
        matches.sort(key=lambda x: x[0])

        # Filter overlapping matches
        filtered_matches = []
        last_end = -1
        for start, end, groups in matches:
            if start >= last_end:
                filtered_matches.append((start, end, groups))
                last_end = end

        chunks: List[ClauseChunk] = []
        current_idx = start_index

        if not filtered_matches:
            # Fallback: Split by double newline (paragraphs) if no formal section headers found
            paragraphs = [p.strip() for p in text.split("\n\n") if len(p.strip()) >= self.min_chunk_chars]
            if not paragraphs:
                paragraphs = [text.strip()]

            for para in paragraphs:
                category = self.classify_category(para)
                chunk = ClauseChunk(
                    chunk_id=f"{doc_id}_p{page.page_number}_c{current_idx:03d}",
                    doc_id=doc_id,
                    section_number="General",
                    section_title="General Clause",
                    page_number=page.page_number,
                    raw_text=para,
                    character_count=len(para),
                    token_count=max(1, len(para) // 4),
                    category=category,
                )
                chunks.append(chunk)
                current_idx += 1
            return chunks

        # Process text preceding the first detected section (if any)
        first_start = filtered_matches[0][0]
        if first_start >= self.min_chunk_chars:
            pre_text = text[:first_start].strip()
            chunks.append(
                ClauseChunk(
                    chunk_id=f"{doc_id}_p{page.page_number}_c{current_idx:03d}",
                    doc_id=doc_id,
                    section_number="Preamble / Recitals",
                    section_title="Introductory Provisions",
                    page_number=page.page_number,
                    raw_text=pre_text,
                    character_count=len(pre_text),
                    token_count=max(1, len(pre_text) // 4),
                    category=self.classify_category(pre_text, "Introductory"),
                )
            )
            current_idx += 1

        # Process each detected section
        for i, (start, end, groups) in enumerate(filtered_matches):
            next_start = filtered_matches[i + 1][0] if i + 1 < len(filtered_matches) else len(text)
            clause_content = text[start:next_start].strip()

            if len(clause_content) < self.min_chunk_chars:
                continue

            # Extract number & title from regex groups
            if len(groups) >= 2:
                sec_num = (groups[0] or "").strip()
                sec_title = (groups[1] or "").strip() or sec_num
            elif len(groups) == 1:
                sec_num = "Section"
                sec_title = (groups[0] or "").strip()
            else:
                sec_num = "Section"
                sec_title = "Clause"

            category = self.classify_category(clause_content, sec_title)

            chunk = ClauseChunk(
                chunk_id=f"{doc_id}_p{page.page_number}_c{current_idx:03d}",
                doc_id=doc_id,
                section_number=sec_num,
                section_title=sec_title,
                page_number=page.page_number,
                raw_text=clause_content,
                character_count=len(clause_content),
                token_count=max(1, len(clause_content) // 4),
                category=category,
            )
            chunks.append(chunk)
            current_idx += 1

        return chunks

    def chunk_document(self, document: ParsedDocument) -> List[ClauseChunk]:
        """Chunk an entire parsed document across all physical pages."""
        all_chunks: List[ClauseChunk] = []
        clause_counter = 1

        for page in document.pages:
            page_chunks = self.split_page_into_clauses(page, document.doc_id, start_index=clause_counter)
            all_chunks.extend(page_chunks)
            clause_counter += len(page_chunks)

        logger.info(
            "Semantic chunking completed",
            extra={
                "doc_id": document.doc_id,
                "total_chunks": len(all_chunks),
                "total_pages": document.total_pages,
            }
        )
        return all_chunks
