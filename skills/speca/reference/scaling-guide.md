# SPECA Scaling Guide

Guidelines for running SPECA effectively, with emphasis on artifact quality and human review.

## Core Principle: Inspectable Artifacts with Human Review

SPECA decomposes auditing into **reproducible phases with inspectable intermediate artifacts** (Kamba & Sannai, 2026). Each artifact — requirements, mapping, checklist, findings, report — is a quality gate. Errors in upstream artifacts propagate downstream:

- Inaccurate requirements → wrong mappings → irrelevant checklist items → wasted audit effort
- Misaligned threat model → 56.8% of false positives (paper §4.4)
- Missing spec details → 57.1% of missed High/Medium issues (paper §4.5)

**Session splitting exists primarily to enable human review between phases, not to manage context windows.**

## When to Split Sessions

**Always split at phase boundaries.** Every phase transition is a human review point, regardless of codebase size.

| Transition | What the human reviews | Why it matters |
|------------|----------------------|----------------|
| init → extract | Threat model (actors, trust levels, boundaries) | 56.8% of FPs stem from threat model misalignment |
| extract → map | Extracted requirements completeness and accuracy | Requirements are the foundation for all downstream phases |
| map → checklist | Mapping coverage, unmapped requirements | Unmapped requirements = unaudited code |
| checklist → audit | Checklist items relevance, false check candidates | Irrelevant items waste audit effort and produce noise |
| audit → test | Findings validity, severity assignments | Human validation ~10 min/finding (paper §4.2) |
| test → report | Test results, PoC quality | PoC refinement ~30 min/finding (paper §4.2) |

### Human Review Protocol

**After each phase completes:**

1. Run `node $SPECA_DIR/scripts/speca-cli.mjs progress --phase <current> --action should-resume` to confirm checkpoint state.
2. Review the phase output using CLI summary commands:
   ```bash
   node $CLI query --file <artifact> --mode summary    # overview
   node $CLI query --file <artifact> --mode batch --index 0 --size 10  # spot-check
   ```
3. Present a summary to the user, highlighting:
   - Key statistics (count, coverage %)
   - Anomalies or concerns (e.g., low mapping rate, unexpected severity distribution)
   - Items that need human judgment (e.g., ambiguous requirements, borderline findings)
4. **Wait for user confirmation before proceeding to the next phase.**

### What to Review at Each Gate

**After init:** Does the threat model match the actual deployment? Are trust levels correct? (e.g., in the SPECA paper, misclassifying the execution layer trust level caused 21/37 invalid submissions)

**After extract:** Are all normative requirements captured? Are RFC 2119 modal verbs (MUST/SHOULD/MAY) correctly identified? Are there cross-references between requirements that need to be preserved?

**After map:** What is the mapping coverage rate? Are unmapped requirements truly unimplemented, or did the mapper miss code locations? Do mapped line ranges cover the right functions?

**After checklist:** Are checklist items concrete and testable? Do they align with the threat model's trust boundaries? Are vulnerability patterns from the pattern DB applied appropriately?

**After audit:** For each finding: Is the code evidence concrete? Does the finding respect trust boundaries? Is the severity justified? (~10 min per finding for human validation)

**After test:** Do generated tests capture the right boundary conditions? Are PoCs reproducible? (~30 min per finding for refinement)

## Scaling for Large Codebases

For projects exceeding **30 contracts** or **3000 LOC**, additional strategies help manage complexity within individual phases.

### Size Categories

| Category | Contracts | LOC | Additional Strategy |
|----------|-----------|-----|---------------------|
| Small | 1–10 | < 1000 | Phase splitting + human review sufficient |
| Medium | 11–30 | 1000–3000 | Same; consider batch-level spot-checks |
| Large | 31–60 | 3000–8000 | Within-phase batch splitting; subagent delegation for map/audit/test |
| XLarge | 60+ | 8000+ | Within-phase splitting + subagent delegation; stricter per-batch review |

### Within-Phase Splitting

When a single phase produces **6+ batches**, consider splitting at batch boundaries. The existing checkpoint/progress system (`progress.mjs`) handles resume:

- Run `progress --phase <p> --action should-resume` to determine state (`fresh`, `resume`, `restart`, `completed`).
- If `resume`: continue from the saved checkpoint. Pass `--resume` flag where supported (e.g., `/speca audit --resume`).
- If `restart`: the previous run's data is inconsistent — start the phase over.

### Subagent Delegation

Subagent delegation works when batches are **independent** — each batch can be processed without knowledge of other batches' results.

| Phase | Delegable? | Reason |
|-------|-----------|--------|
| extract | No | Requires holistic reading of spec for cross-references |
| map | **Yes** | Each requirement maps independently to code |
| checklist | No | Requires full requirements + mapping context for pattern matching |
| audit | **Yes** | Each checklist batch audits independently |
| test | **Yes** | Each finding/property generates tests independently |
| report | No | Aggregates all findings into a single document |

**Delegation template** for subagents:

```
You are executing a SPECA {phase} sub-task.

Project directory: {project_dir}
SPECA directory: {speca_dir}
Phase: {phase}
Batch range: items {start_index} to {end_index}

Instructions:
1. Read `{speca_dir}/reference/context-rules.md` and follow strictly.
2. Read `{speca_dir}/phases/{phase}.md` for the full phase protocol.
3. Process ONLY items in the assigned batch range.
4. Write results using speca-cli.mjs (do not write files directly).
5. Report completion status when done.

CLI path: node {speca_dir}/scripts/speca-cli.mjs
```

**Concurrency limits:**
- Maximum simultaneous subagents: **4** (file write contention risk above this).
- Each subagent processes a non-overlapping batch range.
- After all subagents complete, run `node $SPECA_DIR/scripts/speca-cli.mjs merge` if the phase produces batch files (audit phase).

**Claude Code usage:**

```
Agent(
  description: "SPECA audit batch 0-4",
  prompt: "<delegation template filled in>",
  subagent_type: "general-purpose"
)
```

Launch multiple Agent calls in a single message for parallel execution. Set `run_in_background: true` if continuing other work while subagents process.

**Important:** Subagent delegation parallelizes work *within* a phase. It does NOT eliminate the human review gate *between* phases. After all subagents complete and results are merged, the human must still review the aggregate output before the next phase begins.

## Workflow Example: Large Codebase (~50 contracts)

```
Session 1: /speca init
  → Human reviews threat model (actors, trust levels, boundaries)
  → User confirms: "threat model looks correct, proceed"

Session 2: /speca extract
  → Agent extracts requirements from spec
  → Human reviews: completeness, accuracy, modal verb identification
  → User confirms or requests corrections

Session 3: /speca map
  → Agent maps requirements to code (subagent delegation for 3-4 batches)
  → Human reviews: coverage rate, unmapped requirements, line range accuracy
  → User confirms

Session 4: /speca checklist
  → Agent generates checklist from requirements + mapping + pattern DB
  → Human reviews: relevance, testability, threat model alignment
  → User confirms

Session 5: /speca audit
  → Agent audits code against checklist (subagent delegation for 4 batches)
  → Human reviews each finding: ~10 min per finding
  → User validates findings, adjusts severities, removes FPs

Session 6: /speca test
  → Agent generates Foundry tests for validated findings
  → Human reviews: PoC quality, boundary conditions (~30 min per finding)

Session 7: /speca report
  → Agent generates Markdown + SARIF report
  → Human reviews final report for accuracy and completeness
```

Each session boundary is a **quality gate**, not a context window optimization.
