# SPECA Init Phase

You are initializing a SPECA (SPEcification-to-Checklist Auditing) project for Solidity smart contract security auditing. This phase interactively collects configuration from the user and generates the `.speca/config.json` file that all subsequent phases depend on.

## Overview

This phase performs 6 steps:
1. Collect specification file paths
2. Collect Solidity source paths
3. Define threat model (actors, boundaries, assumptions)
4. Select output language
5. Generate `.speca/config.json`
6. Print summary and next steps

**IMPORTANT:** Use the project root (current working directory) as the base for all relative paths. All paths stored in config.json should be relative to the project root.

---

## Step 1: Collect Specification Paths

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

## Step 2: Collect Source Paths

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
   - For directories: use Glob to check that the directory exists and contains at least one `.sol` file.
   - For files: use Read to verify the file exists and has a `.sol` extension.
3. If a path does not exist or contains no Solidity files, inform the user and ask for correction.
4. Continue asking until the user confirms all source paths are provided.

Store the validated paths in a list called `source_paths`.

---

## Step 3: Define Threat Model

The threat model is critical for reducing false positives during auditing. The SPECA paper found that **56.8% of false positives came from threat model misalignment**.

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

**After receiving actors:**
1. Parse each line into an actor name (snake_case) and trust level.
2. Validate that each trust level is one of: `TRUSTED`, `SEMI_TRUSTED`, `UNTRUSTED`.
3. Ensure at least one actor is defined.
4. Ask: "Are there any additional actors? (yes/no)"

### Step 3b: Define Trust Boundaries

**Prompt the user:**
> Now define the trust boundaries. These describe which actors can access which functions.
>
> Format: `actor -> scope`

**After receiving boundaries:**
1. Verify that each actor referenced was defined in Step 3a.
2. Ask: "Are there any additional trust boundaries? (yes/no)"

### Step 3c: Define Security Assumptions

**Prompt the user:**
> Finally, define your security assumptions.
>
> Enter your assumptions (one per line), or press enter to use these defaults:
> - EVM execution is deterministic
> - Block timestamp can be manipulated within ~15 seconds
> - Solidity compiler version is ^0.8.x (built-in overflow protection)

---

## Step 4: Select Output Language

**Prompt the user:**
> What language should the SPECA output be written in?
>
> Examples: `en` (English), `ja` (Japanese), `zh` (Chinese), `ko` (Korean)
>
> Default: `en` (English). Press enter to use the default.

If empty input, use `"en"`.

---

## Step 5: Generate Config

### Step 5a: Create Directory

```bash
mkdir -p .speca/reports
```

### Step 5b: Write config.json

Write `.speca/config.json` with this schema:

```json
{
  "version": "1.0",
  "language": "<language>",
  "spec_paths": ["./docs/spec.md"],
  "source_paths": ["./contracts/"],
  "threat_model": {
    "actors": { "actor_name": "TRUST_LEVEL" },
    "boundaries": ["actor -> scope"],
    "assumptions": ["assumption text"]
  }
}
```

Use 2-space indentation.

---

## Step 6: Confirmation

Print a summary:

```
SPECA project initialized successfully!

Configuration Summary:
  Spec files:      <list>
  Source paths:    <list>
  Output Language: <language>

  Threat Model:
    Actors:       <list>
    Boundaries:   <list>
    Assumptions:  <list>

Config written to: .speca/config.json

Next step: Run /speca extract to extract requirements from your specification files.
```

---

## Error Handling

- If `.speca/config.json` already exists, ask: "A SPECA config already exists. Overwrite? (yes/no)"
- All paths in config.json MUST be relative to the project root (start with `./`).
- At minimum, require one TRUSTED actor and one UNTRUSTED actor.
