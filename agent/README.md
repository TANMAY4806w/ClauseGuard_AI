# ClauseGuard AI — Agent Workspace & Memory System

> **Local Agent System Hub:** Persistent Context, Memory, Subagents, Skills, and Living Execution Checklist.  
> *(Note: This folder is strictly local and excluded from GitHub via `.gitignore`)*

---

## 📁 Directory Structure

```text
agent/
├── memory/
│   ├── context.md          # Active project context, architecture facts, and runtime state
│   ├── checklist.md        # Living step-by-step progress checklist (updated on every milestone)
│   └── session_log.md      # Chronological log of decisions, milestones, and memory transitions
├── subagents/
│   ├── ingestion_agent.md  # Spec & instructions for PDF parsing, semantic chunking & Qdrant indexing
│   ├── audit_agent.md      # Spec & instructions for LangGraph state machine & MCP predatory rule audit
│   ├── reflection_agent.md # Spec & instructions for citation verification & anti-hallucination guardrail
│   └── eval_agent.md       # Spec & instructions for running Ragas benchmarking against the golden set
└── skills/
    └── README.md           # Guide for registering and invoking agent skills during implementation
```

---

## 🔄 Agent Memory Update Protocol

Whenever an update or milestone is delivered to the user:
1. **Check & Sync `memory/checklist.md`**: Mark newly completed tasks as `[x]`, verify the current active task, and note any blockers or deviations.
2. **Sync `memory/context.md`**: Update the current active phase, runtime environment state, and newly finalized technical decisions.
3. **Log in `memory/session_log.md`**: Record the timestamp, action taken, and key output delivered.
