# SPECA Large Codebase Verification

Step-by-step guide for verifying SPECA on the Compound V2 cToken test case (~3500 LOC, 16 contracts).

Each session boundary is a **human review gate**. The user must confirm artifact quality before the next phase begins. This follows the SPECA paper's design: reproducible phases with inspectable intermediate artifacts (Kamba & Sannai, 2026).

## Prerequisites

```bash
# Fetch contracts (one-time)
bash skills/speca/tests/cases/compound-v2-ctoken/fetch-contracts.sh

# Setup test environment
node skills/speca/tests/setup-test.mjs --case compound-v2-ctoken --output /tmp/speca-verify-large --clean
```

## Phase Execution (Session-per-Phase with Human Review)

### Session 1: Init

```
cd /tmp/speca-verify-large
/speca init          # Config already present; verify threat model
```

**Human review gate:**
- Are the 5 actors (admin, oracle, supplier, borrower, liquidator) correctly classified?
- Are trust levels right? (admin=TRUSTED, oracle=SEMI_TRUSTED, others=UNTRUSTED)
- Do boundary definitions match Compound V2's actual access control?
- Are assumptions accurate? (Solidity 0.5.x, oracle staleness, etc.)

> In the SPECA paper, 56.8% of false positives stemmed from threat model misalignment. Getting this right is critical.

**User confirms before proceeding.**

### Session 2: Extract

```
cd /tmp/speca-verify-large
/speca extract       # Extract requirements from docs/spec.md
```

**Human review gate:**
```bash
node skills/speca/scripts/speca-cli.mjs query --file requirements --mode summary
# Expected: 40+ requirements
node skills/speca/scripts/speca-cli.mjs query --file requirements --mode batch --index 0 --size 10
# Spot-check first 10 requirements
```
- Are RFC 2119 modal verbs (MUST/SHOULD/MAY) correctly identified?
- Are all spec sections covered (supply, borrow, liquidation, admin, interest)?
- Are cross-references between requirements preserved?

**User confirms before proceeding.**

### Session 3: Map

```
cd /tmp/speca-verify-large
/speca map
```

**Human review gate:**
```bash
node skills/speca/scripts/speca-cli.mjs query --file mapping --mode summary
```
- What is the mapping coverage rate? (target: > 80%)
- For unmapped requirements: are they truly unimplemented, or did the mapper miss?
- Spot-check a few mappings: do line ranges point to the right functions?

**User confirms before proceeding.**

### Session 4: Checklist

```
cd /tmp/speca-verify-large
/speca checklist
```

**Human review gate:**
```bash
node skills/speca/scripts/speca-cli.mjs query --file checklist --mode summary
# Expected: 80+ checklist items (varied severities)
```
- Are checklist items concrete and testable?
- Do items align with the threat model's trust boundaries?
- Are vulnerability patterns from the pattern DB applied appropriately for Solidity 0.5.x?

**User confirms before proceeding.**

### Session 5: Audit

```
cd /tmp/speca-verify-large
/speca audit
```

**Human review gate:**
```bash
node skills/speca/scripts/speca-cli.mjs query --file findings --mode summary
```
- Review each finding (~10 min per finding):
  - Is the code evidence concrete and accurate?
  - Does the finding respect trust boundaries defined in init?
  - Is the severity justified?
- Remove false positives before proceeding

**User validates findings before proceeding.**

### Session 6: Test

```
cd /tmp/speca-verify-large
/speca test
```

**Human review gate:**
- Do generated tests capture the right boundary conditions?
- Are PoCs reproducible? (~30 min per finding for refinement)
- Do tests align with validated findings from the previous gate?

**User confirms before proceeding.**

### Session 7: Report

```
cd /tmp/speca-verify-large
/speca report
```

**Human review gate:**
- Is the report accurate and complete?
- Do finding descriptions match validated findings?
- Are SARIF entries well-formed?

## Final Verification

```bash
node skills/speca/tests/verify-output.mjs --dir /tmp/speca-verify-large
```

## Comparison with Known Audits

After report generation, compare findings against known audit results:

### Trail of Bits (2019) — Key Findings to Check

- Integer overflow/underflow risks in math operations (Solidity 0.5.x)
- Reentrancy vectors in token interactions
- Oracle manipulation risks
- Access control on admin functions

### OpenZeppelin (2019) — Key Findings to Check

- ERC-20 non-standard return value handling
- Interest calculation precision
- Liquidation incentive edge cases

A successful SPECA run should identify a subset of these known issues, demonstrating pattern coverage across the vulnerability database.
