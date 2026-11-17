import os
import pytest

from evaluation.run_ragas_eval import load_golden_dataset, run_benchmark
from evaluation.run_llm_eval import run_llm_benchmark


class TestEvaluationSuite:
    """Test suite verifying golden evaluation dataset and benchmark metrics."""

    def test_golden_dataset_integrity(self):
        dataset_path = "data/golden_eval_dataset/golden_contracts.json"
        assert os.path.exists(dataset_path), "Golden contracts dataset file is missing."

        golden_data = load_golden_dataset(dataset_path)
        assert len(golden_data) >= 30, f"Expected at least 30 golden test cases, found {len(golden_data)}"

        # Validate required schema keys across every test case
        required_keys = {
            "id",
            "contract_type",
            "category",
            "query",
            "ground_truth_context",
            "expected_risk_level",
            "expected_headline",
        }
        for item in golden_data:
            assert required_keys.issubset(item.keys()), f"Missing keys in golden case {item.get('id')}"
            assert len(item["ground_truth_context"]) >= 30, "Ground truth context too short"

    def test_ragas_quality_gates(self):
        # Run benchmark across the full 35-case dataset
        report = run_benchmark()

        assert report["all_gates_passed"] is True, "One or more Ragas quality gates failed."
        metrics = report["metrics"]

        # Assert mathematical thresholds
        assert metrics["faithfulness"] >= 0.90, f"Faithfulness {metrics['faithfulness']} < 0.90"
        assert metrics["context_precision"] >= 0.88, f"Context Precision {metrics['context_precision']} < 0.88"
        assert metrics["context_recall"] >= 0.85, f"Context Recall {metrics['context_recall']} < 0.85"
        assert metrics["verbatim_citation_precision"] == 1.0, "Citation precision must be 100%"

    def test_llm_quality_gates(self):
        """Verify statutory alignment, schema conformance, and fallback resilience for LLM."""
        report = run_llm_benchmark()
        assert report["all_gates_passed"] is True, f"LLM quality gates failed: {report['quality_gates']}"
        assert report["metrics"]["statutory_alignment_score"] >= 0.75
        assert report["metrics"]["schema_conformance_rate"] == 1.0
        assert report["metrics"]["circuit_breaker_groq_to_gemini"] is True
        assert report["metrics"]["blackout_deterministic_fallback"] is True
