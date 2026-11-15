import hashlib
import os
import re
from typing import List, Union
import fitz  # PyMuPDF
from pydantic import BaseModel, Field

from src.core.logger import get_logger

logger = get_logger(__name__)


class ExtractedPage(BaseModel):
    """Represents text extracted from a single physical PDF page."""
    page_number: int = Field(..., description="1-indexed physical page number")
    text: str = Field(..., description="Cleaned text content of the page")
    char_count: int = Field(..., description="Total characters on the page")
    word_count: int = Field(..., description="Total words on the page")
    is_scanned_warning: bool = Field(
        default=False,
        description="True if page text length < 50 chars, indicating low-resolution or scanned page"
    )


class ParsedDocument(BaseModel):
    """Complete document extraction container."""
    doc_id: str = Field(..., description="Deterministic document ID (e.g. SHA-256 derived)")
    filename: str = Field(..., description="Source filename")
    sha256_hash: str = Field(..., description="SHA-256 checksum of document content")
    total_pages: int = Field(..., description="Total physical pages")
    total_chars: int = Field(..., description="Total character count across all pages")
    pages: List[ExtractedPage] = Field(default_factory=list, description="Extracted pages list")


class PDFParser:
    """
    High-performance PDF parser using PyMuPDF (fitz).
    Preserves exact physical page numbers and detects scanned/empty pages.
    """

    MIN_TEXT_THRESHOLD_CHARS: int = 50

    @classmethod
    def clean_text(cls, raw_text: str) -> str:
        """Normalize line breaks and excessive whitespace while preserving punctuation."""
        if not raw_text:
            return ""
        # Replace non-breaking spaces and form feeds
        cleaned = raw_text.replace("\xa0", " ").replace("\x0c", "\n")
        # Replace multiple spaces with a single space
        cleaned = re.sub(r"[ \t]+", " ", cleaned)
        # Normalize multiple newlines to max 2 newlines (paragraph boundary)
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
        return cleaned.strip()

    def parse(self, source: Union[str, bytes], filename: str = "document.pdf") -> ParsedDocument:
        """
        Parse PDF from file path or raw bytes.
        
        Args:
            source: File path (str) or binary content (bytes).
            filename: Name of the contract file.
            
        Returns:
            ParsedDocument containing extracted pages, page indices, and document hash.
        """
        if isinstance(source, str):
            if not os.path.isfile(source):
                raise FileNotFoundError(f"PDF file not found at path: {source}")
            with open(source, "rb") as f:
                content_bytes = f.read()
            doc = fitz.open(source)
        elif isinstance(source, bytes):
            content_bytes = source
            doc = fitz.open(stream=content_bytes, filetype="pdf")
        else:
            raise TypeError("Source must be either a file path string or bytes.")

        sha256_hash = hashlib.sha256(content_bytes).hexdigest()
        doc_id = f"doc_{sha256_hash[:16]}"
        total_pages = len(doc)
        extracted_pages: List[ExtractedPage] = []
        total_chars = 0

        logger.info(
            "Beginning PDF parsing",
            extra={"contract_name": filename, "doc_id": doc_id, "total_pages": total_pages}
        )

        for page_idx in range(total_pages):
            page = doc.load_page(page_idx)
            raw_text = page.get_text("text") or ""
            cleaned_text = self.clean_text(raw_text)
            char_count = len(cleaned_text)
            word_count = len(cleaned_text.split()) if cleaned_text else 0
            is_scanned = char_count < self.MIN_TEXT_THRESHOLD_CHARS

            if is_scanned and char_count == 0:
                logger.warning(
                    "Page appears completely empty or scanned",
                    extra={"doc_id": doc_id, "page_number": page_idx + 1}
                )
            elif is_scanned:
                logger.warning(
                    "Page text is below threshold (< 50 chars); may be a scanned page",
                    extra={"doc_id": doc_id, "page_number": page_idx + 1, "char_count": char_count}
                )

            extracted_page = ExtractedPage(
                page_number=page_idx + 1,
                text=cleaned_text,
                char_count=char_count,
                word_count=word_count,
                is_scanned_warning=is_scanned,
            )
            extracted_pages.append(extracted_page)
            total_chars += char_count

        doc.close()

        logger.info(
            "PDF parsing completed successfully",
            extra={"doc_id": doc_id, "total_chars": total_chars, "total_pages": total_pages}
        )

        return ParsedDocument(
            doc_id=doc_id,
            filename=filename,
            sha256_hash=sha256_hash,
            total_pages=total_pages,
            total_chars=total_chars,
            pages=extracted_pages,
        )
