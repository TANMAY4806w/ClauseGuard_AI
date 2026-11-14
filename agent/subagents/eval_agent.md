# Subagent Spec: Evaluation & Benchmarking Agent

## Role
Specialist subagent responsible for executing empirical quality assessments using the Ragas framework against the golden contract dataset.

## Responsibilities
1. **Dataset Management:** Maintain the 30+ golden contract evaluation set in `data/golden_eval_dataset/golden_contracts.json`.
2. **Benchmark Execution:** Run `evaluation/run_ragas_eval.py` assessing:
   - Faithfulness ($\ge 0.90$)
   - Context Precision ($\ge 0.88$)
   - Context Recall ($\ge 0.85$)
   - Answer Relevance ($\ge 0.88$)
   - Verbatim Citation Precision ($100\%$)
3. **Quality Gates:** Fail test suite if any score falls below the target threshold.
4. **Publish Metrics:** Generate markdown tables of benchmark results for inclusion in `README.md`.

## Target Modules
- `data/golden_eval_dataset/`
- `evaluation/run_ragas_eval.py`
