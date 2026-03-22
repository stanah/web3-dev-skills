# Compound V2 cToken — SPECA Test Case

Large-scale SPECA test case using Compound Protocol V2's cToken contracts.

## Overview

| Property | Value |
|----------|-------|
| Protocol | Compound V2 |
| Focus | cToken (supply, borrow, liquidation, interest) |
| Contracts | ~12 files |
| LOC | ~3500 |
| Solidity | 0.5.x (no built-in overflow protection) |
| License | BSD-3-Clause |
| Source | [compound-finance/compound-protocol](https://github.com/compound-finance/compound-protocol) |

## Purpose

This test case validates SPECA's scaling capabilities:
- Multiple interacting contracts with shared state
- Solidity 0.5.x overflow patterns (INT-001 from vulnerability DB)
- Complex financial logic (exchange rates, interest accrual, liquidation)
- Well-documented protocol with public audit reports for comparison

## Setup

Contracts are not included in this repository. Fetch them first:

```bash
bash skills/speca/tests/cases/compound-v2-ctoken/fetch-contracts.sh
```

Then run the standard setup:

```bash
node skills/speca/tests/setup-test.mjs --case compound-v2-ctoken --output /tmp/speca-verify-large --clean
```

## License

The Compound V2 source code is licensed under BSD-3-Clause. See the [LICENSE](https://github.com/compound-finance/compound-protocol/blob/master/LICENSE) in the original repository.

Contracts are fetched from a pinned commit and used solely for testing SPECA's audit pipeline.

## Reference Audits

- Trail of Bits (2019): [compound-protocol audit](https://github.com/trailofbits/publications/blob/master/reviews/compound-2.pdf)
- OpenZeppelin (2019): Compound V2 audit report
