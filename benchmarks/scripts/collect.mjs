import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Parse a Code4rena GitHub contest URL.
 * Returns { org, repo }.
 */
export function parseContestUrl(url) {
  const match = url.match(/github\.com\/([^/]+)\/([^/\s]+)/);
  if (!match) {
    throw new Error(`Invalid GitHub URL: ${url}`);
  }
  return { org: match[1], repo: match[2] };
}

/**
 * Build a case directory name.
 * Format: case-{num}-{category}-{name}
 */
export function buildCaseDir(num, category, name) {
  const padded = String(num).padStart(3, '0');
  return `case-${padded}-${category.toLowerCase()}-${name.toLowerCase()}`;
}

/**
 * Generate a ground-truth.json template.
 */
export function generateGroundTruthTemplate(caseId) {
  return {
    case_id: caseId,
    known_vulnerabilities: [],
    false_positive_notes: []
  };
}

/**
 * Scaffold a benchmark case directory with starter files.
 */
export function scaffoldCase(benchmarkRoot, contestUrl, caseNum, category, shortName) {
  const { org, repo } = parseContestUrl(contestUrl);
  const dirName = buildCaseDir(caseNum, category, shortName);
  const caseDir = join(benchmarkRoot, 'cases', dirName);

  if (existsSync(caseDir)) {
    throw new Error(`Case directory already exists: ${caseDir}`);
  }

  // Create directories
  mkdirSync(join(caseDir, 'contracts'), { recursive: true });
  mkdirSync(join(caseDir, 'docs'), { recursive: true });

  // Write metadata.json
  const metadata = {
    case_id: dirName,
    source: {
      org,
      repo,
      url: contestUrl
    },
    category: category.toUpperCase(),
    created_at: new Date().toISOString().slice(0, 10),
    notes: ''
  };
  writeFileSync(join(caseDir, 'metadata.json'), JSON.stringify(metadata, null, 2));

  // Write ground-truth.json
  const groundTruth = generateGroundTruthTemplate(dirName);
  writeFileSync(join(caseDir, 'ground-truth.json'), JSON.stringify(groundTruth, null, 2));

  // Write docs/spec.md template
  const specMd = `# ${dirName} Specification

## Overview

<!-- Brief description of the protocol / contest scope -->

## Key Terms (RFC 2119)

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT",
"SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this
document are to be interpreted as described in RFC 2119.

## Invariants

<!-- List protocol invariants here -->

## External Dependencies

<!-- List external contracts / oracles / libraries -->
`;
  writeFileSync(join(caseDir, 'docs', 'spec.md'), specMd);

  console.log(`Scaffolded: ${caseDir}`);
  console.log('Next steps:');
  console.log(`  1. Clone ${contestUrl} and copy relevant contracts into ${join(caseDir, 'contracts/')}`);
  console.log(`  2. Fill in ${join(caseDir, 'docs', 'spec.md')} with protocol specification`);
  console.log(`  3. Populate ${join(caseDir, 'ground-truth.json')} with known vulnerabilities`);
}

// CLI entrypoint
if (process.argv[1] === import.meta.filename) {
  const [contestUrl, caseNum, category, shortName] = process.argv.slice(2);

  if (!contestUrl || !caseNum || !category || !shortName) {
    console.error('Usage: node collect.mjs <contest-repo-url> <case-number> <category> <short-name>');
    process.exit(1);
  }

  scaffoldCase(process.cwd(), contestUrl, Number(caseNum), category, shortName);
}
