---
name: speca-map
description: Map extracted requirements to Solidity source code locations with confidence scoring
---

# /speca-map - Map Requirements to Source Code

You are mapping extracted requirements to their corresponding Solidity source code locations and producing a structured JSON file at `.speca/mapping.json`. This is Phase 1b of the SPECA (SPEcification-to-Checklist Auditing) pipeline. Mapping quality directly affects audit accuracy — wrong mappings cause the auditor to examine the wrong code, and unmapped requirements may indicate missing implementations.

---

## Phase 0: Prerequisites Check

1. Read `.speca/config.json` using the Read tool.
2. If the file does not exist, stop and tell the user: "No SPECA config found. Please run `/speca-init` first to initialize the project."
3. Parse the JSON and extract the `source_paths` array. You will need these to locate Solidity files.
4. Read `.speca/requirements.json` using the Read tool.
5. If the file does not exist, stop and tell the user: "No requirements found. Please run `/speca-extract` first to extract requirements from your specification files."
6. Parse the JSON and extract the `requirements` array. If the array is empty, stop and tell the user: "The requirements file contains no requirements. Please run `/speca-extract` to populate it."

---

## Phase 1: Solidity Source Analysis

Load and analyze every `.sol` file found under the directories and paths listed in `source_paths`. For directories, use the Glob tool with the pattern `<directory>/**/*.sol` to find all Solidity files recursively. For individual file paths ending in `.sol`, read them directly.

For each `.sol` file, read the entire file content and identify the following constructs. Record the line numbers (1-indexed, as reported by the Read tool) for each construct.

### 1a: Contract Definitions

For each `contract`, `abstract contract`, `interface`, or `library` declaration, record:
- **name**: The contract/interface/library name.
- **kind**: One of `contract`, `abstract contract`, `interface`, `library`.
- **inherits**: A list of parent contract names (from the `is` clause). Empty list if none.
- **line**: The line number of the declaration.

### 1b: Function Signatures

For each function (including `constructor`, `fallback`, and `receive`), record:
- **name**: The function name. For constructors use `constructor`, for fallback use `fallback`, for receive use `receive`.
- **visibility**: One of `public`, `external`, `internal`, `private`. Constructors default to `public` if not explicitly stated.
- **modifiers**: A list of modifier names applied to the function (e.g., `["onlyOwner", "nonReentrant"]`).
- **parameters**: A list of parameter types and names (e.g., `["uint256 amount", "address to"]`).
- **return_types**: A list of return types (e.g., `["bool", "uint256"]`). Empty list if none.
- **line_start**: The line number of the function declaration.
- **line_end**: The line number of the closing brace `}` of the function body. For functions without a body (interface declarations), use the line of the semicolon.
- **contract**: The name of the enclosing contract.

### 1c: Modifier Definitions

For each `modifier` definition, record:
- **name**: The modifier name.
- **line_start**: The line of the modifier declaration.
- **line_end**: The line of the closing brace.
- **contract**: The name of the enclosing contract.

### 1d: Event Definitions

For each `event` declaration, record:
- **name**: The event name.
- **parameters**: The full parameter list as a string (e.g., `"address indexed sender, uint256 amount"`).
- **line**: The line number.
- **contract**: The name of the enclosing contract.

### 1e: State Variables

For each state variable declaration, record:
- **name**: The variable name.
- **type**: The Solidity type (e.g., `mapping(address => uint256)`, `uint256`, `bool`).
- **visibility**: One of `public`, `internal`, `private`. Default is `internal` if not specified.
- **line**: The line number.
- **contract**: The name of the enclosing contract.

### 1f: Constructor Logic

For each constructor, also note:
- What state variables it initializes.
- What parameters it accepts.
- Any modifier or require/revert checks in the constructor body.

Store all this analysis in an internal data structure called `source_catalog`, organized by file path then by contract name.

---

## Phase 2: Keyword-Based Candidate Narrowing

For each requirement in the `requirements` array, perform keyword extraction and matching to produce a candidate list.

### Step 2a: Extract Keywords from Requirement Text

From the requirement's `text` field, extract potential Solidity identifiers:

1. **Function names**: Look for patterns like `functionName()`, `functionName(type)`, or words immediately before `()`. Also look for words that match function names found in `source_catalog`.
2. **Modifier names**: Look for words that match modifier names in `source_catalog` (e.g., `onlyOwner`, `whenNotPaused`).
3. **Event names**: Look for words that match event names in `source_catalog` (e.g., `Deposited`, `Transfer`).
4. **State variable names**: Look for words that match state variable names in `source_catalog`.
5. **General keywords**: Extract other significant nouns and verbs from the requirement text, excluding common English stop words. Convert camelCase and PascalCase identifiers into their component words for broader matching (e.g., `onlyOwner` also matches `owner`).

### Step 2b: Search Source Catalog

For each extracted keyword, search the `source_catalog` for matching identifiers:

1. **Exact match**: The keyword exactly matches a function name, modifier name, event name, or state variable name (case-sensitive).
2. **Substring match**: The keyword appears as a substring of an identifier (case-insensitive). For example, keyword `owner` matches function `transferOwnership`, modifier `onlyOwner`, and variable `_owner`.
3. **Component match**: A component word from a camelCase/PascalCase identifier matches a keyword. For example, requirement keyword `pause` matches function `emergencyPause`.

### Step 2c: Build Candidate List

For each requirement, produce a list of candidate locations. Each candidate is:

```
{
  "file": "<relative path to .sol file>",
  "contract": "<contract name>",
  "element_type": "<function|modifier|event|state_variable|constructor>",
  "element_name": "<name of the element>",
  "line_range": [<start_line>, <end_line>],
  "keyword_matches": ["<list of keywords that matched>"]
}
```

Rank candidates by the number of keyword matches (more matches = stronger candidate). Keep all candidates for now; filtering happens in Phase 3.

**Special handling by requirement type:**
- `access_control` requirements: Prioritize functions with relevant modifiers and modifier definitions.
- `event_emission` requirements: Prioritize functions that contain `emit` statements for the referenced event, and the event definition itself.
- `validation` requirements: Prioritize functions that contain `require` or `revert` statements.
- `state_transition` requirements: Prioritize functions that modify state variables.

---

## Phase 3: Semantic Refinement

For each candidate from Phase 2, perform a deeper semantic analysis to determine whether the code actually addresses the requirement.

### Step 3a: Read Candidate Code

For each candidate, read the actual source code at the candidate location (the lines within `line_range`). If you have not already read these lines during Phase 1, read them now.

### Step 3b: Assess Semantic Match

For each candidate, evaluate whether the code semantically addresses the requirement. Consider:

1. **Does the code implement the behavior described in the requirement?** For example, if the requirement says "withdraw() MUST revert if balance is zero", does the candidate function `withdraw` contain a check for zero balance?
2. **Are the relevant modifiers present?** If the requirement specifies access control (e.g., "only the owner"), does the function have the appropriate modifier (e.g., `onlyOwner`)?
3. **Are the relevant events emitted?** If the requirement specifies event emission, does the function body contain the corresponding `emit` statement?
4. **Does the code handle the specified edge case or validation?** If the requirement specifies input validation, does the code contain the appropriate `require` or `revert` check?

### Step 3c: Assign Confidence Score

Assign a confidence score between 0.0 and 1.0 to each candidate based on the semantic assessment:

- **0.9 - 1.0**: Direct, clear implementation of the requirement. The code obviously and completely addresses what the requirement specifies. Example: Requirement says "withdraw() MUST have onlyOwner modifier" and the function `withdraw` has `onlyOwner` modifier.
- **0.7 - 0.89**: Likely implements the requirement but with some ambiguity. The code appears to address the requirement but may be incomplete or use a different approach than expected. Example: Requirement says "only the owner MUST be able to call withdraw()" and the function has a `require(msg.sender == owner)` check instead of a named modifier.
- **0.5 - 0.69**: Partially addresses the requirement. Some elements match but the implementation may be incomplete or the connection is indirect. Example: Requirement is about balance validation and the function does some validation but not exactly what was specified.
- **Below 0.5**: Weak match, possibly unrelated. The keyword match was superficial and the code does not meaningfully address the requirement.

### Step 3d: Record Evidence

For each candidate with confidence >= 0.5, record a brief `evidence` string (one sentence) explaining why this code matches the requirement. Be specific — reference the actual code construct (modifier name, require condition, emit statement, etc.).

### Step 3e: Filter Candidates

Discard all candidates with confidence below 0.5. For the remaining candidates, sort by confidence score in descending order.

---

## Phase 4: Unmapped Detection

After processing all requirements through Phases 2-3:

1. Identify requirements that have **no candidates with confidence >= 0.5**. These are "unmapped" requirements.
2. For each unmapped requirement, set `status` to `"unmapped"` and add a `note` explaining why:
   - If no keyword matches were found at all: `"No matching Solidity identifiers found in source code — this requirement may reference unimplemented functionality"`
   - If keyword matches were found but all had confidence below 0.5: `"Keyword matches found but no code semantically addresses this requirement — implementation may be missing or incomplete"`
   - If the requirement references a function that does not exist in the source: `"Function <name>() not found in any source contract — possibly unimplemented"`
3. Unmapped requirements are **high-value audit findings**. They indicate that a specification requirement may not have a corresponding implementation. Emphasize these in the summary output.

---

## Phase 5: Write Output

### Step 5a: Build the Output JSON

Construct the output object with this exact schema:

```json
{
  "mapped_at": "<ISO 8601 timestamp>",
  "source_files": ["<list of all .sol files analyzed>"],
  "total_requirements": <integer>,
  "mapped": <integer>,
  "unmapped": <integer>,
  "mappings": [
    {
      "requirement_id": "<string>",
      "requirement_text": "<string>",
      "locations": [
        {
          "file": "<relative path to .sol file>",
          "contract": "<contract name>",
          "function": "<function signature, e.g., withdraw(uint256)>",
          "line_range": [<start_line>, <end_line>],
          "confidence": <float between 0.0 and 1.0>,
          "modifiers": ["<list of modifiers on the function>"],
          "evidence": "<one-sentence explanation of why this code matches>"
        }
      ],
      "status": "<mapped|unmapped>"
    }
  ]
}
```

Field details:

- `mapped_at`: Current date and time in ISO 8601 format (e.g., `"2026-02-17T12:00:00Z"`).
- `source_files`: A list of all `.sol` file paths that were analyzed, relative to the project root.
- `total_requirements`: The total number of requirements from `requirements.json`.
- `mapped`: The count of requirements with `status: "mapped"` (at least one location with confidence >= 0.5).
- `unmapped`: The count of requirements with `status: "unmapped"` (no locations with confidence >= 0.5).
- `mappings`: One entry per requirement, in the same order as the requirements array from `requirements.json`.

For each mapping entry:
- `requirement_id`: The `id` field from the requirement.
- `requirement_text`: The `text` field from the requirement (for human readability in the output).
- `locations`: The filtered and sorted candidate list (confidence >= 0.5 only). For unmapped requirements, this is an empty array `[]`.
- `status`: `"mapped"` if `locations` is non-empty, `"unmapped"` if `locations` is empty.

For unmapped entries, add an additional field:
- `note`: The explanation string from Phase 4.

For location entries:
- `file`: Relative path to the `.sol` file (matching the format in `source_paths`).
- `contract`: The contract name containing the matched code.
- `function`: The function signature in the format `functionName(paramType1,paramType2)`. For modifiers, use the format `modifier modifierName`. For events, use `event EventName(paramTypes)`. For state variables, use `var variableName`. For constructors, use `constructor(paramTypes)`.
- `line_range`: Array of two integers `[start_line, end_line]`.
- `confidence`: Float between 0.0 and 1.0, rounded to two decimal places.
- `modifiers`: List of modifier names applied to the function. Empty list `[]` for non-function elements.
- `evidence`: One-sentence explanation of the match.

### Step 5b: Write the File

Write the JSON to `.speca/mapping.json` using the Write tool. Use 2-space indentation for readability.

---

## Phase 6: Print Summary

After writing the file, print a summary to the user in this format:

```
Requirement-to-code mapping complete!

Source files analyzed:
  - <file1>
  - <file2>

Total requirements: <N>
  Mapped:   <count> (<percentage>%)
  Unmapped: <count> (<percentage>%)
```

If there are unmapped requirements, print a warnings section:

```
WARNINGS - Unmapped requirements (possible missing implementations):
  - <requirement_id>: <first 80 chars of requirement text>...
    Reason: <note>
  - <requirement_id>: <first 80 chars of requirement text>...
    Reason: <note>
```

Then print confidence distribution:

```
Confidence distribution of mapped locations:
  High   (0.9-1.0): <count> locations
  Medium (0.7-0.89): <count> locations
  Low    (0.5-0.69): <count> locations
```

Finally, print the next step:

```
Output written to: .speca/mapping.json

Next step: Run /speca-checklist to generate the audit checklist from the mappings.
```

---

## Error Handling

- If `.speca/config.json` does not exist, stop and tell the user to run `/speca-init`.
- If `.speca/requirements.json` does not exist, stop and tell the user to run `/speca-extract`.
- If `source_paths` contains a directory that does not exist, warn the user and skip that directory. If no valid source paths remain, stop with an error.
- If no `.sol` files are found in any of the `source_paths`, stop and tell the user: "No Solidity files found in the configured source paths. Please check `source_paths` in `.speca/config.json`."
- If `.speca/mapping.json` already exists, overwrite it without asking (mapping is idempotent and re-runnable).

---

## Notes

- This skill is **non-interactive**. Do not prompt the user for input during mapping. Read the config and requirements, process the source files, write the output, and print the summary.
- All file paths in the output must be **relative** to the project root, matching the format in `config.json`.
- When a single requirement maps to multiple code locations (e.g., a modifier definition and all functions that use it), include all relevant locations sorted by confidence.
- For inheritance hierarchies: if a function is defined in a parent contract but the requirement references a child contract, include the parent contract location as a candidate. Note in the evidence that the function is inherited.
- Be conservative with confidence scores. It is better to slightly under-score a match than to over-score it. False high-confidence mappings are worse than false low-confidence ones because they cause the auditor to skip detailed review.
- Unmapped requirements are the most valuable output of this skill. They highlight gaps between specification and implementation. Never suppress or downplay unmapped findings.
