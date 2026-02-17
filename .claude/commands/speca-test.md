---
name: speca-test
description: Generate Foundry test contracts for checklist boundary conditions and finding reproduction (Strategy C)
---

# /speca-test - Generate Foundry Tests

You are generating executable Foundry test contracts for boundary condition verification and Proof-of-Concept (PoC) reproduction of audit findings. This is Phase 4 of the SPECA (SPEcification-to-Checklist Auditing) pipeline and implements Strategy C from the SPECA paper. The primary value is turning static checklist items and audit findings into executable evidence that human reviewers can verify independently.

---

## Phase 0: Prerequisites Check

1. Read `.speca/checklist.json` using the Read tool.
2. If the file does not exist, stop and tell the user: "No checklist found. Please run `/speca-checklist` first to generate the security checklist."
3. Parse the JSON and extract the `checklist` array.
4. Read `.speca/findings.json` using the Read tool.
5. If the file does not exist, print a warning: "No findings file found (`.speca/findings.json`). Continuing with checklist-only test generation. Run `/speca-audit` first if you want PoC tests for findings." Set an internal flag `has_findings = false` and continue.
6. If the file exists, parse the JSON and extract the `findings` array. Set `has_findings = true`.
7. Read `.speca/mapping.json` using the Read tool.
8. If the file does not exist, stop and tell the user: "No requirement-to-code mapping found. Please run `/speca-map` first to map requirements to source code."
9. Parse the JSON and extract the `mappings` array and the `source_files` list.
10. Read `.speca/config.json` using the Read tool.
11. If the file does not exist, stop and tell the user: "No SPECA config found. Please run `/speca-init` first to initialize the project."
12. Parse the JSON and extract the `source_paths` array.
13. Load all Solidity source files listed in `source_files` from `mapping.json`. Read each file fully using the Read tool. Store the contents indexed by file path for reference during test generation.
14. Check if Foundry is available by running `forge --version` using the Bash tool. If the command succeeds, set `foundry_available = true`. If it fails (command not found or error), set `foundry_available = false` and print: "Foundry not detected. Test files will be generated but not executed."

---

## Phase 1: Identify Testable Items

Collect two categories of testable items: checklist-derived tests and finding-derived PoC tests.

### Step 1a: Checklist-Derived Test Items

From the `checklist` array, select items where:

1. **`check_type` is `"dynamic"`** — These are properties that cannot be verified by static inspection alone and require test execution.
2. **Any item that has a corresponding finding in `findings.json`** (if `has_findings` is true) — These get PoC tests regardless of `check_type`.

For each selected checklist item, record:
- `checklist_id`: The check's `id` field (e.g., `CHK-AUTH-001-a`).
- `requirement_id`: The check's `requirement_id` field.
- `property`: The check's `property` field (the testable statement).
- `priority`: The check's `priority` field.
- `pattern_refs`: The check's `pattern_refs` array.

### Step 1b: Finding-Derived PoC Items

If `has_findings` is true, process findings by severity to determine which get PoC tests:

1. **Critical severity findings** — MUST have a PoC test. These are the highest value tests.
2. **High severity findings** — SHOULD have a PoC test. Generate unless the finding is purely informational or structural (e.g., missing implementation with no code to test).
3. **Medium severity findings** — MAY have a PoC test. Generate if the vulnerability can be demonstrated through a transaction sequence.
4. **Low/Informational severity findings** — Optional. Skip unless the finding describes a concrete behavioral issue that can be demonstrated in a test.

For each selected finding, record:
- `finding_id`: The finding's `id` field (e.g., `FIND-001`).
- `checklist_id`: The finding's `checklist_id` field.
- `severity`: The finding's `severity` field.
- `title`: The finding's `title` field.
- `description`: The finding's `description` field.
- `code_refs`: The finding's `proof_trace.code_refs` array.
- `recommendation`: The finding's `recommendation` field.

### Step 1c: Deduplicate

If a checklist item already has a corresponding finding, combine them into a single test file that includes both property tests and the PoC. Do not generate two separate files for the same checklist item.

---

## Phase 2: Test Generation

For each testable item (or combined checklist+finding pair), generate a Foundry test contract.

### Step 2a: Create Test Directory

Create the test directory structure if it does not exist:

```bash
mkdir -p test/speca
```

### Step 2b: Determine Import Paths

For each testable item, use the `mappings` array to find the source code location:

1. Look up the `requirement_id` in the `mappings` array.
2. From the mapping's `locations` array, get the `file` and `contract` name.
3. Construct the import path relative to the test file location. Since test files are at `test/speca/Test_<id>.t.sol`, the import path to a source file at `contracts/Foo.sol` would be `../../contracts/Foo.sol`. Adjust the number of `../` segments based on the actual source file path depth.

If the mapping has multiple locations across different contracts, import all relevant contracts.

### Step 2c: Generate Test Contracts

For each testable item, generate a Foundry test file following this structure.

**File naming convention:** `test/speca/Test_<checklist_id>.t.sol`

- Replace hyphens in the checklist ID with underscores for the filename and contract name (Solidity identifiers cannot contain hyphens).
- Example: checklist ID `CHK-AUTH-001-a` produces file `test/speca/Test_CHK_AUTH_001_a.t.sol` and contract name `Test_CHK_AUTH_001_a`.

**Template for checklist-derived (property) tests:**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
// Import the target contract(s) — adjust path based on mapping
import "<relative_import_path>";

/// @title SPECA Test: <checklist_id>
/// @notice Property: <property statement from checklist>
/// @dev Generated by /speca-test from .speca/checklist.json
contract Test_<sanitized_checklist_id> is Test {
    // --- Target contract instance(s) ---
    <TargetContract> target;

    // --- Labeled addresses for readability ---
    address owner = makeAddr("owner");
    address attacker = makeAddr("attacker");
    address user1 = makeAddr("user1");
    address user2 = makeAddr("user2");

    function setUp() public {
        // Deploy the target contract as the owner
        vm.startPrank(owner);
        target = new <TargetContract>(<constructor_args_if_any>);
        // Additional setup: fund accounts, set initial state, etc.
        vm.stopPrank();
    }

    /// @notice Positive case: <property> is satisfied under normal conditions
    function test_<sanitized_checklist_id>_positive() public {
        // Arrange: set up preconditions that satisfy the requirement
        // Act: call the function under test
        // Assert: verify the expected outcome
    }

    /// @notice Negative case: <property> violation is correctly prevented
    function test_<sanitized_checklist_id>_negative() public {
        // Arrange: set up conditions that violate the requirement
        // Act + Assert: verify the function reverts or rejects
        // Use vm.expectRevert() for revert cases
    }
}
```

**Template for finding-derived (PoC) tests:**

When a finding exists for the checklist item, add PoC test functions to the same contract:

```solidity
    /// @notice PoC for <finding_id>: <finding_title>
    /// @dev Severity: <severity>
    /// @dev If this test PASSES, the vulnerability is CONFIRMED.
    function test_<sanitized_finding_id>_poc() public {
        // Step 1: <description of setup>
        // Set up the attack preconditions

        // Step 2: <description of attack action>
        // Execute the attack sequence

        // Step 3: <description of verification>
        // Verify that the attack succeeded (e.g., attacker gained funds, state is corrupted)
        // A PASSING test means the vulnerability EXISTS
    }
```

### Step 2d: Fill In Test Logic

For each test function, generate concrete test logic based on the checklist property, the finding description (if any), and the actual source code. Follow these guidelines:

**For positive case tests (`test_*_positive`):**
1. Set up valid preconditions that satisfy all requirements.
2. Call the function under test with valid arguments.
3. Assert that the expected state changes occurred (use `assertEq`, `assertTrue`, `assertGt`, etc.).
4. Assert that expected events were emitted (use `vm.expectEmit`).

**For negative case tests (`test_*_negative`):**
1. Set up conditions that violate the requirement being tested.
2. Use `vm.expectRevert()` before calling the function if it should revert.
3. Alternatively, call the function and assert that no state change occurred.
4. Test with unauthorized callers using `vm.prank(attacker)`.

**For PoC tests (`test_*_poc`):**
1. Reconstruct the attack scenario step by step from the finding's `proof_trace.reasoning`.
2. Use Foundry cheat codes as needed:
   - `vm.prank(address)` / `vm.startPrank(address)` — impersonate an address for the next call.
   - `vm.deal(address, amount)` — set ETH balance.
   - `vm.warp(timestamp)` — set block timestamp.
   - `vm.roll(blockNumber)` — set block number.
   - `vm.expectRevert()` — expect the next call to revert.
   - `vm.expectEmit(true, true, true, true)` — expect an event emission.
   - `deal(address token, address to, uint256 amount)` — set ERC-20 balance (if using forge-std StdCheats).
3. Include descriptive comments for each step explaining what happens and why.
4. The test PASSING means the vulnerability is confirmed. The test FAILING means the vulnerability is not exploitable (or has been fixed).

**For pattern-specific tests:**

Use the `pattern_refs` field to tailor the test logic:

- **REENT-***: Deploy a malicious reentering contract as part of the test. Have it call back into the target during a callback.
- **ACCESS-***: Call the protected function from an unauthorized address using `vm.prank(attacker)`. Expect revert for positive case; for PoC, demonstrate that the call succeeds when it should not.
- **INT-***: Use boundary values (`type(uint256).max`, `0`, `1`) as inputs and verify correct handling.
- **LOGIC-***: Test exact boundary conditions (e.g., `amount == limit` vs `amount == limit + 1`).
- **EXTCALL-***: Mock external calls or deploy minimal contracts that simulate external call behavior.
- **GAS-***: Use large arrays or repeated operations to demonstrate gas exhaustion.
- **ORACLE-***: Mock oracle responses with stale or manipulated data.
- **ERC-***: Test with non-standard token implementations (mock contracts that return no value, etc.).
- **UPGRADE-***: Test initialization sequences and storage layout assumptions.
- **CRYPTO-***: Test signature replay or weak randomness exploitation.

### Step 2e: Write Test Files

For each generated test contract, write the file to `test/speca/Test_<sanitized_id>.t.sol` using the Write tool. If a file already exists at that path, overwrite it (test generation is idempotent).

---

## Phase 3: Execution (Optional)

### Step 3a: Run Tests (If Foundry Is Available)

If `foundry_available` is true:

1. Run the tests using the Bash tool:
   ```bash
   forge test --match-path "test/speca/*" -vvv 2>&1
   ```
2. Capture the full output including pass/fail status for each test function.
3. Set a reasonable timeout (up to 120 seconds). If the tests take too long, note which tests timed out.

### Step 3b: Interpret Results

For each test function, classify the result:

**For property tests (positive/negative):**
- **Test PASSES**: The property holds. The code behaves as specified.
- **Test FAILS**: The property is violated. This indicates a potential bug or specification deviation.

**For PoC tests:**
- **Test PASSES**: The vulnerability is **CONFIRMED**. The exploit scenario is reproducible.
- **Test FAILS**: The vulnerability is **NOT REPRODUCIBLE** under the tested conditions. This could mean the finding is a false positive, or the PoC needs adjustment.

Record results for each test function:
- `test_name`: The function name.
- `result`: `"pass"` or `"fail"`.
- `interpretation`: One-sentence explanation of what the result means.

### Step 3c: Handle Compilation Errors

If `forge test` fails due to compilation errors:
1. Capture the error output.
2. Identify the failing test file(s) and the error messages.
3. Print a warning for each compilation error with the file path and error message.
4. Do NOT attempt to auto-fix compilation errors. The generated tests are a starting point; compilation errors often indicate that import paths, constructor arguments, or interface details need manual adjustment.
5. Note the compilation errors in the summary output.

### Step 3d: Skip Execution (If Foundry Not Available)

If `foundry_available` is false:
- Print: "Foundry not found. Test files generated but not executed. Install Foundry (https://getfoundry.sh) and run: `forge test --match-path test/speca/ -vvv`"
- Skip all execution steps.

---

## Phase 4: Write Summary Output

### Step 4a: Build the Output JSON

Construct a summary file at `.speca/test-results.json` with this schema:

```json
{
  "generated_at": "<ISO 8601 timestamp>",
  "foundry_available": true,
  "tests_executed": true,
  "total_test_files": 5,
  "total_test_functions": 12,
  "test_files": [
    {
      "file": "test/speca/Test_CHK_AUTH_001_a.t.sol",
      "checklist_id": "CHK-AUTH-001-a",
      "finding_id": "FIND-001",
      "test_functions": [
        {
          "name": "test_CHK_AUTH_001_a_positive",
          "type": "property_positive",
          "result": "pass",
          "interpretation": "Access control correctly restricts unauthorized callers"
        },
        {
          "name": "test_CHK_AUTH_001_a_negative",
          "type": "property_negative",
          "result": "pass",
          "interpretation": "Function correctly reverts for unauthorized callers"
        },
        {
          "name": "test_FIND_001_poc",
          "type": "poc",
          "result": "pass",
          "interpretation": "VULNERABILITY CONFIRMED: unauthorized caller can bypass access control"
        }
      ]
    }
  ],
  "summary": {
    "property_tests": {
      "total": 8,
      "passed": 7,
      "failed": 1
    },
    "poc_tests": {
      "total": 4,
      "passed": 3,
      "failed": 1
    },
    "compilation_errors": 0
  }
}
```

If tests were not executed (Foundry not available or skipped), set:
- `tests_executed` to `false`.
- All `result` fields to `"not_executed"`.
- All `interpretation` fields to `"Test not executed — Foundry not available"`.
- Summary counts to 0 for passed/failed.

Write the JSON to `.speca/test-results.json` using the Write tool with 2-space indentation.

### Step 4b: Print Summary

Print a summary to the user in this format:

```
SPECA test generation complete!

Test files generated: <N>
Test functions generated: <N>
  Property tests (positive): <N>
  Property tests (negative): <N>
  PoC tests:                 <N>

Test directory: test/speca/
```

If tests were executed, also print:

```
Execution Results:
  Property tests: <passed>/<total> passed
  PoC tests:      <passed>/<total> passed

  Confirmed vulnerabilities (PoC passed): <N>
  Properties violated (test failed):     <N>
```

If there were compilation errors, print:

```
Compilation Errors: <N> test file(s) failed to compile
  - <file>: <error summary>
```

If tests were NOT executed, print:

```
Tests NOT executed — Foundry not found.
Install Foundry: https://getfoundry.sh
Run manually: forge test --match-path test/speca/ -vvv
```

Finally, always print:

```
Output written to: .speca/test-results.json

Next step: Run /speca-report to generate the full audit report.
```

---

## Error Handling

- If `.speca/checklist.json` does not exist, stop and tell the user to run `/speca-checklist`.
- If `.speca/mapping.json` does not exist, stop and tell the user to run `/speca-map`.
- If `.speca/config.json` does not exist, stop and tell the user to run `/speca-init`.
- If `.speca/findings.json` does not exist, warn but continue (test generation works without findings).
- If a Solidity source file referenced in `mapping.json` cannot be read, warn the user and skip tests that depend on that file.
- If the checklist array is empty, stop and tell the user: "The checklist is empty. Please run `/speca-checklist` to generate check items."
- If no testable items are found (no dynamic checks and no findings), print: "No testable items found. All checklist items are static-only and no findings exist. Run `/speca-audit` to generate findings, or ensure your checklist includes dynamic check types."
- If `.speca/test-results.json` already exists, overwrite it without asking (test generation is idempotent and re-runnable).
- If existing test files in `test/speca/` exist, overwrite them without asking.

---

## Test Quality Guidelines

1. **Use Foundry's standard library** (`forge-std/Test.sol`). Do not use third-party test frameworks.
2. **Use labeled addresses** (`makeAddr("owner")`, `makeAddr("attacker")`) for readability. Never use raw hex addresses in tests.
3. **Include descriptive comments** in every test function explaining what is being tested and why. Each step in a PoC should have a comment.
4. **Import paths must be relative** to the test file location. Since test files are in `test/speca/`, use `../../` prefix to reach the project root for source file imports.
5. **Each test file must be self-contained** with its own `setUp()` function. Do not share state between test files.
6. **Solidity pragma should match the project**. Default to `pragma solidity ^0.8.20;` unless the project's source files use a different version.
7. **Constructor arguments**: Examine the target contract's constructor in the source code and provide appropriate arguments in `setUp()`. If the constructor requires parameters, use reasonable test values.
8. **Handle dependencies**: If the target contract depends on other contracts (e.g., a token contract, an oracle), deploy mock or minimal versions in `setUp()`.
9. **For reentrancy PoCs**: Create a minimal attacker contract inline in the test file (as a separate contract in the same file) that implements the reentrancy callback.
10. **Test naming convention**: All test functions must start with `test_` (Foundry convention). Use the checklist or finding ID in the function name for traceability.

---

## Notes

- This command is **non-interactive**. Do not prompt the user for input during test generation. Read all prerequisites, generate tests, optionally execute them, write the output, and print the summary.
- All file paths in the output must be **relative** to the project root, matching the format in `config.json`.
- Strategy C (test-based verification) was the least effective standalone strategy in the SPECA paper (5.9% of findings). However, PoC generation for confirmed findings is highly valuable for human reviewers because it provides executable proof that a vulnerability exists. The primary goal is to turn static findings into executable evidence, not to discover new findings through testing alone.
- When generating PoC tests for findings, faithfully reproduce the attack scenario described in the finding's `proof_trace.reasoning`. The test should be a mechanical translation of the reasoning into Solidity test code.
- Generated tests are a **starting point**. They may require manual adjustment for compilation (import paths, constructor arguments, interface mismatches). This is expected and acceptable. The goal is to produce tests that are 80-90% correct and need minimal human editing.
- If the same vulnerability can be demonstrated through multiple attack paths, generate the simplest one. Simpler PoCs are more convincing and easier to review.
