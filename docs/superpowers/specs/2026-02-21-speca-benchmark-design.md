# SPECA Benchmark System Design

**Date:** 2026-02-21
**Status:** Approved

## Overview

Build a benchmark system to quantitatively evaluate SPECA's detection accuracy (Recall/Precision/F1) and overall pipeline quality using real-world smart contract hack cases from Code4rena contests.

## Goals

1. **Detection accuracy measurement** — Recall, Precision, F1 against known vulnerabilities
2. **Pipeline quality evaluation** — Per-phase metrics (extract coverage, mapping rate, pattern coverage, test generation rate)
3. **Automated execution** — Ground truth comparison and scoring fully automated
4. **Prototype scope** — 3-5 benchmark cases covering major vulnerability categories

## Approach: Code4rena Contest-Based

Use Code4rena/Sherlock public contest repositories as the primary source:
- Contracts + audit reports + confirmed findings are all publicly available on GitHub
- Findings validated by multiple auditors provide high-confidence ground truth
- Severity classifications enable severity-stratified accuracy evaluation

Specifications are extracted/structured from audit reports in RFC 2119 format (MUST/SHOULD/MAY).

## Directory Structure

```
benchmarks/
├── benchmark.json              # Benchmark set metadata
├── cases/
│   ├── case-001-<category>-<name>/
│   │   ├── metadata.json       # Case metadata (source, date, damages, etc.)
│   │   ├── contracts/          # Solidity source files
│   │   │   └── *.sol
│   │   ├── docs/
│   │   │   └── spec.md         # Structured spec from audit report
│   │   ├── ground-truth.json   # Known vulnerabilities (answer key)
│   │   └── .speca/             # SPECA execution results (gitignored)
│   ├── case-002-...
│   └── ...
└── results/
    └── YYYY-MM-DD-evaluation.json  # Automated evaluation results
```

## Ground Truth Schema

```json
{
  "case_id": "case-001-reentrancy-example",
  "known_vulnerabilities": [
    {
      "id": "VUL-001",
      "title": "Reentrancy in withdraw()",
      "severity": "critical",
      "category": "REENT",
      "swc_id": "SWC-107",
      "affected_files": ["contracts/Vault.sol"],
      "affected_functions": ["withdraw(uint256)"],
      "affected_lines": [31, 38],
      "description": "State update after external call allows reentrancy",
      "source": "code4rena-contest-xxx-finding-H01"
    }
  ],
  "false_positive_notes": []
}
```

## Evaluation Metrics

### Detection Accuracy (Primary)

**Matching logic:** A SPECA finding matches a ground-truth vulnerability when:
1. Category match: finding's `pattern_refs` matches ground-truth `category`
2. Location overlap: `affected_files` match AND `affected_lines` overlap (±5 line tolerance)
3. Both conditions satisfied = True Positive

| Metric | Definition | Meaning |
|--------|-----------|---------|
| Recall | TP / (TP + FN) | % of known vulnerabilities detected |
| Precision | TP / (TP + FP) | % of reported findings that are real |
| F1 Score | 2 × P × R / (P + R) | Harmonic mean of P and R |

Computed per-severity (critical/high/medium) and aggregate.

### Pipeline Quality (Secondary)

| Phase | Metric | Computation |
|-------|--------|-------------|
| extract | Requirement extraction rate | spec requirements vs extracted count |
| map | Mapping accuracy | mapped / total requirements |
| checklist | Pattern coverage | ground-truth categories covered by checklist |
| audit | Detection accuracy | Recall/Precision/F1 above |
| test | Test generation rate | PoC generated / findings, test pass rate |

### Evaluation Result Schema

```json
{
  "evaluation_date": "2026-02-21",
  "speca_version": "1.0",
  "cases_evaluated": 3,
  "aggregate": {
    "detection": {
      "recall": 0.75,
      "precision": 0.60,
      "f1": 0.667,
      "by_severity": {
        "critical": { "recall": 1.0, "precision": 0.5, "f1": 0.667 },
        "high": { "recall": 0.5, "precision": 0.75, "f1": 0.6 }
      }
    },
    "pipeline": {
      "extract_coverage": 0.93,
      "mapping_rate": 0.87,
      "pattern_coverage": 0.80,
      "test_generation_rate": 0.67
    }
  },
  "per_case": []
}
```

## Benchmark Case Selection Criteria

### Prototype candidates (3-5 cases)

| # | Category | Selection criteria | Source |
|---|---------|-------------------|--------|
| 1 | REENT (Reentrancy) | Classic reentrancy exploit | Code4rena High findings |
| 2 | ACCESS (Access Control) | Missing owner/role check | Code4rena High findings |
| 3 | LOGIC (Logic Error) | Business logic flaw | Code4rena Medium/High |
| 4 | EXTCALL (External Call) | External call issue | Code4rena High findings |
| 5 | INT (Integer) | Overflow/rounding issue | Code4rena Medium |

### Contract selection criteria
- **Size:** 1-3 files, ≤500 lines (not overly complex)
- **Vulnerability clarity:** 1-3 confirmed High/Critical findings
- **Spec reconstructability:** Audit report has sufficient description
- **Solidity version:** ^0.8.x (SPECA target range)

## Specification Generation Process

```
[Code4rena Contest Repo]
        |
        v
[Get audit report] ── findings (H-01, M-01, etc.)
        |
        v
[Get contract code] ── *.sol files
        |
        v
[Structure specification]
  - Extract function/event/modifier list from code
  - Extract spec descriptions from report "Background"/"Overview" sections
  - Structure in RFC 2119 format (MUST/SHOULD/MAY)
  - Human review for quality
        |
        v
[Create ground truth JSON]
  - Convert confirmed findings to ground-truth.json
  - Map category, severity, affected locations
```

## Execution Pipeline

### Benchmark run flow

```
[benchmarks/run.sh]
    |
    ├── for each case in cases/
    │   ├── 1. /speca init    (auto-configure from config.json)
    │   ├── 2. /speca extract
    │   ├── 3. /speca map
    │   ├── 4. /speca checklist
    │   ├── 5. /speca audit
    │   ├── 6. /speca test    (if Foundry available)
    │   └── 7. /speca report
    │
    └── [benchmarks/evaluate.mjs]
        ├── Compare findings.json vs ground-truth.json per case
        ├── Determine TP/FP/FN via matching logic
        ├── Compute Recall/Precision/F1
        ├── Compute pipeline quality metrics
        └── Output results/YYYY-MM-DD-evaluation.json
```

### Scripts

| Script | Role |
|--------|------|
| `benchmarks/run.sh` | Execute SPECA pipeline on all cases sequentially |
| `benchmarks/evaluate.mjs` | Automated findings vs ground-truth comparison and scoring |
| `benchmarks/collect.mjs` | Helper to fetch contracts + reports from Code4rena GitHub repos |

## Constraints and Notes

- **LLM variance:** SPECA is LLM-based, so results vary between runs. Use median of 3 runs.
- **Foundry dependency:** Test phase requires Foundry. Evaluate other phases if unavailable.
- **Manual steps:** Spec review and ground-truth.json creation require human verification.
- **Scope:** Prototype only — 3-5 cases. Expandable to 30+ for statistical significance later.
