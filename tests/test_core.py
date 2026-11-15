import json
import logging
import pytest
from pydantic import ValidationError

from src.core.config import Settings, get_settings
from src.core.logger import JSONFormatter, get_logger, setup_logging


class TestSettings:
    """Test suite for application configuration and environment parsing."""

    def test_default_settings(self):
        settings = Settings()
        assert settings.PROJECT_NAME == "ClauseGuard AI"
        assert settings.APP_ENV in ["development", "staging", "production", "test"]
        assert settings.API_V1_STR == "/api/v1"
        assert settings.MAX_UPLOAD_SIZE_MB == 25
        assert settings.QDRANT_MODE in ["local", "server", "memory"]
        assert settings.REDIS_MODE in ["mock", "server"]

    def test_settings_singleton_caching(self):
        s1 = get_settings()
        s2 = get_settings()
        assert s1 is s2

    def test_upload_size_validation(self):
        # Negative upload size should fail validation
        with pytest.raises(ValidationError):
            Settings(MAX_UPLOAD_SIZE_MB=-5)

        # Excessively large upload size should fail validation
        with pytest.raises(ValidationError):
            Settings(MAX_UPLOAD_SIZE_MB=500)

    def test_has_llm_key_helper(self):
        s_without = Settings(GEMINI_API_KEY=None, OPENROUTER_API_KEY=None)
        assert s_without.has_llm_key is False

        s_with_gemini = Settings(GEMINI_API_KEY="test_key_123")
        assert s_with_gemini.has_llm_key is True


class TestLogger:
    """Test suite for structured JSON logging."""

    def test_json_formatter_valid_json(self):
        formatter = JSONFormatter()
        record = logging.LogRecord(
            name="test_logger",
            level=logging.INFO,
            pathname=__file__,
            lineno=45,
            msg="Processing document clause",
            args=(),
            exc_info=None
        )

        formatted_output = formatter.format(record)
        data = json.loads(formatted_output)

        assert data["level"] == "INFO"
        assert data["logger"] == "test_logger"
        assert data["message"] == "Processing document clause"
        assert "timestamp" in data
        assert "module" in data

    def test_json_formatter_extra_context(self):
        formatter = JSONFormatter()
        record = logging.LogRecord(
            name="audit_engine",
            level=logging.WARNING,
            pathname=__file__,
            lineno=60,
            msg="Predatory term detected",
            args=(),
            exc_info=None
        )
        record.doc_id = "doc_xyz789"
        record.clause_type = "AUTO_RENEWAL_90D"

        formatted_output = formatter.format(record)
        data = json.loads(formatted_output)

        assert "context" in data
        assert data["context"]["doc_id"] == "doc_xyz789"
        assert data["context"]["clause_type"] == "AUTO_RENEWAL_90D"

    def test_setup_logging_initialization(self):
        setup_logging(level="DEBUG", json_format=True)
        logger = get_logger("test_module")
        assert logger.isEnabledFor(logging.DEBUG)
