---
name: speca-init
description: Initialize SPECA auditing project - creates .speca/ directory and config.json with threat model
---

# /speca-init - SPECA Project Initialization

You are initializing a SPECA (SPEcification-to-Checklist Auditing) project for Solidity smart contract security auditing. This command interactively collects configuration from the user and generates the `.speca/config.json` file that all subsequent SPECA commands depend on.

## Overview

This command performs 5 phases:
1. Collect specification file paths
2. Collect Solidity source paths
3. Define threat model (actors, boundaries, assumptions)
4. Generate `.speca/config.json`
5. Print summary and next steps

**IMPORTANT:** Use the project root (current working directory) as the base for all relative paths. All paths stored in config.json should be relative to the project root.

---

## Phase 1: Collect Specification Paths

Ask the user for their specification file paths. Specifications can be Markdown (`.md`) or YAML (`.yaml`/`.yml`) files.

**Prompt the user:**
> What are the paths to your specification files? These can be Markdown (.md) or YAML (.yaml/.yml) files.
>
> Examples: `./docs/spec.md`, `./docs/interface.yaml`
>
> You can provide multiple paths separated by commas, or one at a time.

**After receiving paths:**
1. Normalize each path (trim whitespace, ensure relative path format starting with `./`).
2. Validate each file exists using the Glob tool or Read tool. If a file does not exist, inform the user and ask them to correct the path.
3. Verify each file has a supported extension: `.md`, `.yaml`, or `.yml`. Reject files with other extensions and ask for correction.
4. Continue asking until the user confirms all spec paths are provided (ask: "Are there any additional spec files? (yes/no)").

Store the validated paths in a list called `spec_paths`.

---

## Phase 2: Collect Source Paths

Ask the user for their Solidity source directories or files.

**Prompt the user:**
> What are the paths to your Solidity source files or directories?
>
> Common locations: `./contracts/`, `./src/`
>
> You can provide directories (all `.sol` files will be included) or specific file paths.

**After receiving paths:**
1. Normalize each path (trim whitespace, ensure relative path format starting with `./`).
2. Validate each path exists:
   - For directories: use Glob to check that the directory exists and contains at least one `.sol` file. Use the pattern `<directory>/**/*.sol` to verify.
   - For files: use Read to verify the file exists and has a `.sol` extension.
3. If a path does not exist or contains no Solidity files, inform the user and ask for correction.
4. Continue asking until the user confirms all source paths are provided (ask: "Are there any additional source paths? (yes/no)").

Store the validated paths in a list called `source_paths`.

---

## Phase 3: Define Threat Model

The threat model is critical for reducing false positives during auditing. The SPECA paper found that **56.8% of false positives came from threat model misalignment**. This phase MUST be completed thoroughly.

### Step 3a: Define Actors

**Prompt the user:**
> Let's define the threat model. First, who are the actors that interact with your contracts?
>
> For each actor, specify their trust level:
> - **TRUSTED**: Fully trusted entities (e.g., contract owner, deployer, admin multisig)
> - **SEMI_TRUSTED**: Partially trusted entities (e.g., oracles, bridge relayers, keepers)
> - **UNTRUSTED**: Untrusted entities (e.g., external callers, end users, potential attackers)
>
> Format: `actor_name: TRUST_LEVEL`
>
> Example:
> ```
> contract_owner: TRUSTED
> oracle: SEMI_TRUSTED
> external_caller: UNTRUSTED
> ```

**After receiving actors:**
1. Parse each line into an actor name (snake_case) and trust level.
2. Validate that each trust level is one of: `TRUSTED`, `SEMI_TRUSTED`, `UNTRUSTED`.
3. If any trust level is invalid, ask the user to correct it.
4. Ensure at least one actor is defined. If none are provided, suggest common defaults:
   - `contract_owner: TRUSTED`
   - `external_caller: UNTRUSTED`
5. Ask: "Are there any additional actors? (yes/no)"

Store as a dictionary mapping actor names to trust levels in `actors`.

### Step 3b: Define Trust Boundaries

**Prompt the user:**
> Now define the trust boundaries. These describe which actors can access which functions or contract interfaces.
>
> Format: `actor -> scope`
>
> Examples:
> ```
> external_caller -> public/external functions
> oracle -> callback functions only
> contract_owner -> all functions including admin
> ```

**After receiving boundaries:**
1. Parse each boundary as a string in `actor -> scope` format.
2. Verify that each actor referenced in a boundary was defined in Step 3a. If not, warn the user and ask them to either add the actor or correct the boundary.
3. Ask: "Are there any additional trust boundaries? (yes/no)"

Store as a list of strings in `boundaries`.

### Step 3c: Define Security Assumptions

**Prompt the user:**
> Finally, define your security assumptions. These are properties of the environment or system that you assume to be true during the audit.
>
> Examples:
> ```
> EVM execution is deterministic
> Block timestamp can be manipulated within ~15 seconds
> External contracts called via interfaces may be malicious
> Solidity compiler version is ^0.8.x (built-in overflow protection)
> ```
>
> Enter your assumptions (one per line), or press enter with no input to use the defaults above.

**After receiving assumptions:**
1. If the user provides no input (empty), use these defaults:
   - "EVM execution is deterministic"
   - "Block timestamp can be manipulated within ~15 seconds"
   - "Solidity compiler version is ^0.8.x (built-in overflow protection)"
2. Otherwise, parse each line as a separate assumption string.
3. Ask: "Are there any additional assumptions? (yes/no)"

Store as a list of strings in `assumptions`.

---

## Phase 4: Generate Config

### Step 4a: Create Directory

Create the `.speca/` directory in the project root if it does not already exist:

```bash
mkdir -p .speca
```

Also create the reports subdirectory:

```bash
mkdir -p .speca/reports
```

### Step 4b: Write config.json

Write `.speca/config.json` with the following schema:

```json
{
  "version": "1.0",
  "spec_paths": ["./docs/spec.md"],
  "source_paths": ["./contracts/"],
  "threat_model": {
    "actors": {
      "contract_owner": "TRUSTED",
      "external_caller": "UNTRUSTED"
    },
    "boundaries": [
      "external_caller -> public/external functions"
    ],
    "assumptions": [
      "EVM execution is deterministic"
    ]
  }
}
```

Replace the example values with the actual collected values from Phases 1-3. Use the Write tool to create the file. Ensure the JSON is properly formatted with 2-space indentation.

---

## Phase 5: Confirmation

After writing the config, print a summary to the user:

```
SPECA project initialized successfully!

Configuration Summary:
  Spec files:    <list of spec_paths>
  Source paths:  <list of source_paths>

  Threat Model:
    Actors:
      - <actor>: <trust_level>  (for each actor)
    Boundaries:
      - <boundary>  (for each boundary)
    Assumptions:
      - <assumption>  (for each assumption)

Config written to: .speca/config.json

Next step: Run /speca-extract to extract requirements from your specification files.
```

---

## Error Handling

- If `.speca/config.json` already exists, ask the user: "A SPECA config already exists. Do you want to overwrite it? (yes/no)". Only proceed if they confirm.
- If any file validation fails, clearly state which file was not found and ask for a corrected path.
- If the user provides empty input for required fields (spec_paths, source_paths, actors), explain that the field is required and ask again.

## Notes

- All paths in config.json MUST be relative to the project root (start with `./`).
- The threat model section is the most important part of initialization. Do not allow the user to skip it. At minimum, require one TRUSTED actor and one UNTRUSTED actor.
- This config is consumed by all downstream SPECA commands: `/speca-extract`, `/speca-map`, `/speca-checklist`, `/speca-audit`, `/speca-test`, and `/speca-report`.
