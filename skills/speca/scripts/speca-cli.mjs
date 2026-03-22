#!/usr/bin/env node
/**
 * speca-cli.mjs — Unified CLI entry point and subcommand router for speca.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { exitWithError, ERROR_CODES } from './lib/errors.mjs';
import { querySummary, queryBatch, queryGet } from './lib/query.mjs';
import { filterChecklist } from './filter-checklist.mjs';
import { computeStats } from './compute-stats.mjs';
import { initFindings, appendFinding } from './append-finding.mjs';
import { mergeFindings } from './merge-findings.mjs';
import { generateSarif } from './generate-sarif.mjs';
import { generateReportSkeleton } from './generate-report-skeleton.mjs';
import { readConfig, getConfigHash } from './lib/config.mjs';
import { loadProgress, saveProgress, shouldResume } from './lib/progress.mjs';

// File name to path mapping for the query subcommand
const FILE_PATH_MAP = {
  config: '.speca/config.json',
  requirements: '.speca/requirements.json',
  mapping: '.speca/mapping.json',
  checklist: '.speca/checklist.json',
  findings: '.speca/findings.json',
  'test-results': '.speca/test-results.json',
};

/**
 * Read stdin fully via async iteration.
 */
async function readStdin() {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
  }
  return input;
}

// ---------------------------------------------------------------------------
// Subcommand handlers
// ---------------------------------------------------------------------------

async function handleQuery(args, projectRoot) {
  const { values } = parseArgs({
    args,
    options: {
      file: { type: 'string' },
      mode: { type: 'string' },
      index: { type: 'string' },
      size: { type: 'string' },
      id: { type: 'string' },
    },
    strict: false,
  });

  const { file, mode } = values;
  if (!file) exitWithError('--file is required', ERROR_CODES.INVALID_ARGS);
  if (!mode) exitWithError('--mode is required', ERROR_CODES.INVALID_ARGS);
  if (!FILE_PATH_MAP[file]) exitWithError(`Unknown file: ${file}`, ERROR_CODES.INVALID_ARGS);

  // config only supports summary
  if (file === 'config' && mode !== 'summary') {
    exitWithError(`Mode "${mode}" is not supported for file "config"; only "summary" is allowed`, ERROR_CODES.UNSUPPORTED_MODE);
  }

  const filePath = join(projectRoot, FILE_PATH_MAP[file]);
  let data;
  try {
    data = JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (e) {
    if (e.code === 'ENOENT') exitWithError(`File not found: ${filePath}`, ERROR_CODES.FILE_NOT_FOUND);
    exitWithError(`Failed to parse ${filePath}: ${e.message}`, ERROR_CODES.PARSE_ERROR);
  }

  let result;
  if (mode === 'summary') {
    result = querySummary(file, data);
  } else if (mode === 'batch') {
    const index = values.index !== undefined ? parseInt(values.index, 10) : 0;
    const size = values.size !== undefined ? parseInt(values.size, 10) : 20;
    result = queryBatch(file, data, index, size);
  } else if (mode === 'get') {
    if (!values.id) exitWithError('--id is required for mode "get"', ERROR_CODES.INVALID_ARGS);
    result = queryGet(file, data, values.id);
  } else {
    exitWithError(`Unknown mode: ${mode}`, ERROR_CODES.INVALID_ARGS);
  }

  console.log(JSON.stringify(result, null, 2));
}

async function handleFilter(args, projectRoot) {
  const { values } = parseArgs({
    args,
    options: {
      input: { type: 'string' },
      type: { type: 'string' },
      priority: { type: 'string' },
      'batch-index': { type: 'string' },
      'batch-size': { type: 'string' },
      mapping: { type: 'string' },
    },
    strict: false,
  });

  if (!values.input) exitWithError('--input is required', ERROR_CODES.INVALID_ARGS);

  let checklistData;
  try {
    checklistData = JSON.parse(readFileSync(values.input, 'utf-8'));
  } catch (e) {
    if (e.code === 'ENOENT') exitWithError(`File not found: ${values.input}`, ERROR_CODES.FILE_NOT_FOUND);
    exitWithError(`Failed to parse ${values.input}: ${e.message}`, ERROR_CODES.PARSE_ERROR);
  }

  const opts = {
    priority: values.priority ? values.priority.split(',') : undefined,
    type: values.type ? values.type.split(',') : undefined,
    batchIndex: values['batch-index'] !== undefined ? parseInt(values['batch-index'], 10) : undefined,
    batchSize: values['batch-size'] !== undefined ? parseInt(values['batch-size'], 10) : undefined,
    includeMeta: true,
  };

  if (values.mapping) {
    try {
      opts.mappingData = JSON.parse(readFileSync(values.mapping, 'utf-8'));
    } catch (e) {
      if (e.code === 'ENOENT') exitWithError(`Mapping file not found: ${values.mapping}`, ERROR_CODES.FILE_NOT_FOUND);
      exitWithError(`Failed to parse mapping file: ${e.message}`, ERROR_CODES.PARSE_ERROR);
    }
  }

  const result = filterChecklist(checklistData, opts);
  console.log(JSON.stringify(result, null, 2));
}

async function handleStats(args, projectRoot) {
  const { values } = parseArgs({
    args,
    options: {
      findings: { type: 'string' },
      checklist: { type: 'string' },
      format: { type: 'string', default: 'json' },
    },
    strict: false,
  });

  if (!values.findings) exitWithError('--findings is required', ERROR_CODES.INVALID_ARGS);
  if (!values.checklist) exitWithError('--checklist is required', ERROR_CODES.INVALID_ARGS);

  let findingsData, checklistData;
  try {
    findingsData = JSON.parse(readFileSync(values.findings, 'utf-8'));
  } catch (e) {
    if (e.code === 'ENOENT') exitWithError(`File not found: ${values.findings}`, ERROR_CODES.FILE_NOT_FOUND);
    exitWithError(`Failed to parse ${values.findings}: ${e.message}`, ERROR_CODES.PARSE_ERROR);
  }
  try {
    checklistData = JSON.parse(readFileSync(values.checklist, 'utf-8'));
  } catch (e) {
    if (e.code === 'ENOENT') exitWithError(`File not found: ${values.checklist}`, ERROR_CODES.FILE_NOT_FOUND);
    exitWithError(`Failed to parse ${values.checklist}: ${e.message}`, ERROR_CODES.PARSE_ERROR);
  }

  const stats = computeStats(findingsData, checklistData);

  if (values.format === 'text') {
    console.log(`Findings: ${stats.total_findings}`);
    console.log(`  Critical: ${stats.severity?.critical ?? 0}`);
    console.log(`  High: ${stats.severity?.high ?? 0}`);
    console.log(`  Medium: ${stats.severity?.medium ?? 0}`);
    console.log(`  Low: ${stats.severity?.low ?? 0}`);
    console.log(`  Informational: ${stats.severity?.informational ?? 0}`);
    console.log(`Checklist: ${stats.checklist.audited}/${stats.checklist.total} (${stats.checklist.coverage_pct}%)`);
  } else {
    console.log(JSON.stringify(stats, null, 2));
  }
}

async function handleConfig(args, projectRoot) {
  const { values } = parseArgs({
    args,
    options: {
      action: { type: 'string' },
    },
    strict: false,
  });

  if (!values.action) exitWithError('--action is required', ERROR_CODES.INVALID_ARGS);

  const action = values.action;

  if (action === 'summary') {
    let config;
    try {
      config = readConfig(projectRoot);
    } catch (e) {
      if (e.code === 'ENOENT') exitWithError(`Config file not found in ${projectRoot}/.speca/config.json`, ERROR_CODES.FILE_NOT_FOUND);
      exitWithError(`Failed to read config: ${e.message}`, ERROR_CODES.PARSE_ERROR);
    }
    const summary = querySummary('config', config);
    console.log(JSON.stringify(summary, null, 2));

  } else if (action === 'hash') {
    let hash;
    try {
      hash = getConfigHash(projectRoot);
    } catch (e) {
      if (e.code === 'ENOENT') exitWithError(`Config file not found in ${projectRoot}/.speca/config.json`, ERROR_CODES.FILE_NOT_FOUND);
      exitWithError(`Failed to read config: ${e.message}`, ERROR_CODES.PARSE_ERROR);
    }
    console.log(hash);

  } else if (action === 'validate') {
    const configPath = join(projectRoot, '.speca', 'config.json');
    const errors = [];

    if (!existsSync(configPath)) {
      exitWithError(`Config file not found: ${configPath}`, ERROR_CODES.FILE_NOT_FOUND);
    }

    let config;
    try {
      config = JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch (e) {
      console.error(JSON.stringify({ valid: false, errors: [`Invalid JSON: ${e.message}`] }));
      process.exit(1);
    }

    const required = ['version', 'spec_paths', 'source_paths', 'threat_model'];
    for (const field of required) {
      if (!(field in config) || config[field] === null || config[field] === undefined) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    if (errors.length > 0) {
      console.error(JSON.stringify({ valid: false, errors }));
      process.exit(1);
    }

    console.log(JSON.stringify({ valid: true }));

  } else if (action === 'init') {
    const stdinData = await readStdin();
    let config;
    try {
      config = JSON.parse(stdinData);
    } catch (e) {
      exitWithError(`Invalid JSON on stdin: ${e.message}`, ERROR_CODES.PARSE_ERROR);
    }

    const specaDir = join(projectRoot, '.speca');
    try {
      mkdirSync(specaDir, { recursive: true });
      writeFileSync(join(specaDir, 'config.json'), JSON.stringify(config, null, 2));
    } catch (e) {
      exitWithError(`Failed to write config: ${e.message}`, ERROR_CODES.WRITE_ERROR);
    }

    console.log(JSON.stringify({ written: join(specaDir, 'config.json') }));

  } else {
    exitWithError(`Unknown action: ${action}`, ERROR_CODES.INVALID_ARGS);
  }
}

async function handleRecord(args, projectRoot) {
  const { values } = parseArgs({
    args,
    options: {
      init: { type: 'boolean' },
      append: { type: 'boolean' },
      'write-batch': { type: 'boolean' },
      'audited-at': { type: 'string' },
      'checklist-version': { type: 'string' },
      'batch-index': { type: 'string' },
    },
    strict: false,
  });

  const flags = [values.init, values.append, values['write-batch']].filter(Boolean);
  if (flags.length !== 1) {
    exitWithError('Exactly one of --init, --append, or --write-batch must be specified', ERROR_CODES.INVALID_ARGS);
  }

  if (values.init) {
    try {
      initFindings(projectRoot, values['audited-at'], values['checklist-version']);
    } catch (e) {
      exitWithError(`Failed to initialize findings: ${e.message}`, ERROR_CODES.WRITE_ERROR);
    }
    console.log(JSON.stringify({ initialized: true }));

  } else if (values.append) {
    const stdinData = await readStdin();
    let finding;
    try {
      finding = JSON.parse(stdinData);
    } catch (e) {
      exitWithError(`Invalid JSON on stdin: ${e.message}`, ERROR_CODES.PARSE_ERROR);
    }
    try {
      appendFinding(projectRoot, finding);
    } catch (e) {
      exitWithError(`Failed to append finding: ${e.message}`, ERROR_CODES.WRITE_ERROR);
    }
    console.log(JSON.stringify({ appended: true }));

  } else if (values['write-batch']) {
    const batchIndex = values['batch-index'];
    if (batchIndex === undefined) exitWithError('--batch-index is required for --write-batch', ERROR_CODES.INVALID_ARGS);

    const stdinData = await readStdin();
    let batch;
    try {
      batch = JSON.parse(stdinData);
    } catch (e) {
      exitWithError(`Invalid JSON on stdin: ${e.message}`, ERROR_CODES.PARSE_ERROR);
    }

    const batchDir = join(projectRoot, '.speca', 'progress', 'audit-batches');
    try {
      mkdirSync(batchDir, { recursive: true });
      writeFileSync(join(batchDir, `batch-${batchIndex}.json`), JSON.stringify(batch, null, 2));
    } catch (e) {
      exitWithError(`Failed to write batch: ${e.message}`, ERROR_CODES.WRITE_ERROR);
    }
    console.log(JSON.stringify({ written: join(batchDir, `batch-${batchIndex}.json`) }));
  }
}

async function handleMerge(args, projectRoot) {
  const { values } = parseArgs({
    args,
    options: {
      'audited-at': { type: 'string' },
      'checklist-version': { type: 'string' },
    },
    strict: false,
  });

  if (!values['audited-at']) exitWithError('--audited-at is required', ERROR_CODES.INVALID_ARGS);
  if (!values['checklist-version']) exitWithError('--checklist-version is required', ERROR_CODES.INVALID_ARGS);

  try {
    mergeFindings(projectRoot, values['audited-at'], values['checklist-version']);
  } catch (e) {
    if (e.code === 'ENOENT') exitWithError(`Required file not found: ${e.message}`, ERROR_CODES.FILE_NOT_FOUND);
    exitWithError(`Failed to merge findings: ${e.message}`, ERROR_CODES.WRITE_ERROR);
  }

  console.log(JSON.stringify({ merged: true }));
}

async function handleReport(args, projectRoot) {
  const { values } = parseArgs({
    args,
    options: {
      format: { type: 'string' },
      output: { type: 'string' },
      'output-dir': { type: 'string' },
      date: { type: 'string' },
      'target-name': { type: 'string' },
    },
    strict: false,
  });

  if (!values.format) exitWithError('--format is required', ERROR_CODES.INVALID_ARGS);

  const formats = values.format.split(',').map(f => f.trim());
  const isMulti = formats.length > 1;

  // --output and --output-dir are mutually exclusive
  if (values.output && values['output-dir']) {
    exitWithError('--output and --output-dir are mutually exclusive', ERROR_CODES.INVALID_ARGS);
  }

  // Multi-format requires --output-dir; single format requires --output
  if (isMulti && values.output) {
    exitWithError('Multi-format (--format md,sarif) requires --output-dir, not --output', ERROR_CODES.INVALID_ARGS);
  }

  // Load input files from projectRoot/.speca/
  const specaDir = join(projectRoot, '.speca');
  let config, findingsData, checklistData;

  try {
    config = JSON.parse(readFileSync(join(specaDir, 'config.json'), 'utf-8'));
  } catch (e) {
    if (e.code === 'ENOENT') exitWithError(`config.json not found in ${specaDir}`, ERROR_CODES.FILE_NOT_FOUND);
    exitWithError(`Failed to parse config.json: ${e.message}`, ERROR_CODES.PARSE_ERROR);
  }

  try {
    findingsData = JSON.parse(readFileSync(join(specaDir, 'findings.json'), 'utf-8'));
  } catch (e) {
    if (e.code === 'ENOENT') exitWithError(`findings.json not found in ${specaDir}`, ERROR_CODES.FILE_NOT_FOUND);
    exitWithError(`Failed to parse findings.json: ${e.message}`, ERROR_CODES.PARSE_ERROR);
  }

  try {
    checklistData = JSON.parse(readFileSync(join(specaDir, 'checklist.json'), 'utf-8'));
  } catch (e) {
    if (e.code === 'ENOENT') exitWithError(`checklist.json not found in ${specaDir}`, ERROR_CODES.FILE_NOT_FOUND);
    exitWithError(`Failed to parse checklist.json: ${e.message}`, ERROR_CODES.PARSE_ERROR);
  }

  const date = values.date ?? new Date().toISOString().slice(0, 10);
  const targetName = values['target-name'] ?? 'Unknown';
  const results = {};

  for (const fmt of formats) {
    if (fmt === 'md') {
      const md = generateReportSkeleton({ config, findings: findingsData, checklist: checklistData, date, targetName });
      const outPath = isMulti
        ? join(values['output-dir'], 'report.md')
        : (values.output ?? join(specaDir, 'report.md'));
      try {
        if (isMulti) mkdirSync(values['output-dir'], { recursive: true });
        writeFileSync(outPath, md);
      } catch (e) {
        exitWithError(`Failed to write report.md: ${e.message}`, ERROR_CODES.WRITE_ERROR);
      }
      results.md = outPath;

    } else if (fmt === 'sarif') {
      const sarif = generateSarif(findingsData, checklistData);
      const outPath = isMulti
        ? join(values['output-dir'], 'report.sarif')
        : (values.output ?? join(specaDir, 'report.sarif'));
      try {
        if (isMulti) mkdirSync(values['output-dir'], { recursive: true });
        writeFileSync(outPath, JSON.stringify(sarif, null, 2));
      } catch (e) {
        exitWithError(`Failed to write report.sarif: ${e.message}`, ERROR_CODES.WRITE_ERROR);
      }
      results.sarif = outPath;

    } else {
      exitWithError(`Unknown format: ${fmt}`, ERROR_CODES.INVALID_ARGS);
    }
  }

  console.log(JSON.stringify({ written: results }));
}

async function handleProgress(args, projectRoot) {
  const { values } = parseArgs({
    args,
    options: {
      phase: { type: 'string' },
      action: { type: 'string' },
    },
    strict: false,
  });

  if (!values.phase) exitWithError('--phase is required', ERROR_CODES.INVALID_ARGS);
  if (!values.action) exitWithError('--action is required', ERROR_CODES.INVALID_ARGS);

  const { phase, action } = values;

  if (action === 'load') {
    let progress;
    try {
      progress = loadProgress(projectRoot, phase);
    } catch (e) {
      exitWithError(`Failed to load progress: ${e.message}`, ERROR_CODES.FILE_NOT_FOUND);
    }
    console.log(JSON.stringify(progress, null, 2));

  } else if (action === 'should-resume') {
    let configHash;
    try {
      configHash = getConfigHash(projectRoot);
    } catch (e) {
      if (e.code === 'ENOENT') exitWithError(`Config file not found`, ERROR_CODES.FILE_NOT_FOUND);
      exitWithError(`Failed to read config: ${e.message}`, ERROR_CODES.PARSE_ERROR);
    }

    let progress;
    try {
      progress = loadProgress(projectRoot, phase);
    } catch (e) {
      exitWithError(`Failed to load progress: ${e.message}`, ERROR_CODES.FILE_NOT_FOUND);
    }

    const resumeAction = shouldResume(progress, configHash);
    console.log(JSON.stringify({ action: resumeAction, config_hash: configHash, progress }));

  } else if (action === 'save') {
    const stdinData = await readStdin();
    let progress;
    try {
      progress = JSON.parse(stdinData);
    } catch (e) {
      exitWithError(`Invalid JSON on stdin: ${e.message}`, ERROR_CODES.PARSE_ERROR);
    }

    const requiredFields = ['phase', 'status', 'updated_at'];
    const missingFields = requiredFields.filter(f => !(f in progress));
    if (missingFields.length > 0) {
      exitWithError(`Missing required fields: ${missingFields.join(', ')}`, ERROR_CODES.INVALID_ARGS);
    }

    // Auto-populate config_hash if missing
    if (!progress.config_hash) {
      try {
        progress.config_hash = getConfigHash(projectRoot);
      } catch (e) {
        // If config doesn't exist, leave config_hash missing
      }
    }

    try {
      saveProgress(projectRoot, phase, progress);
    } catch (e) {
      exitWithError(`Failed to save progress: ${e.message}`, ERROR_CODES.WRITE_ERROR);
    }

    console.log(JSON.stringify({ saved: true }));

  } else {
    exitWithError(`Unknown action: ${action}`, ERROR_CODES.INVALID_ARGS);
  }
}

// ---------------------------------------------------------------------------
// Main entrypoint
// ---------------------------------------------------------------------------

async function main() {
  // Parse top-level args: extract subcommand and --project-root
  const rawArgs = process.argv.slice(2);

  // Find --project-root in args (can appear anywhere)
  let projectRoot = '.';
  const filteredArgs = [];
  for (let i = 0; i < rawArgs.length; i++) {
    if (rawArgs[i] === '--project-root' && i + 1 < rawArgs.length) {
      projectRoot = rawArgs[i + 1];
      i++; // skip value
    } else if (rawArgs[i].startsWith('--project-root=')) {
      projectRoot = rawArgs[i].slice('--project-root='.length);
    } else {
      filteredArgs.push(rawArgs[i]);
    }
  }

  const subcommand = filteredArgs[0];
  const subArgs = filteredArgs.slice(1);

  if (!subcommand) {
    exitWithError('A subcommand is required: query, filter, stats, config, record, merge, report, progress', ERROR_CODES.INVALID_ARGS);
  }

  switch (subcommand) {
    case 'query':
      await handleQuery(subArgs, projectRoot);
      break;
    case 'filter':
      await handleFilter(subArgs, projectRoot);
      break;
    case 'stats':
      await handleStats(subArgs, projectRoot);
      break;
    case 'config':
      await handleConfig(subArgs, projectRoot);
      break;
    case 'record':
      await handleRecord(subArgs, projectRoot);
      break;
    case 'merge':
      await handleMerge(subArgs, projectRoot);
      break;
    case 'report':
      await handleReport(subArgs, projectRoot);
      break;
    case 'progress':
      await handleProgress(subArgs, projectRoot);
      break;
    default:
      exitWithError(`Unknown subcommand: ${subcommand}`, ERROR_CODES.INVALID_ARGS);
  }
}

main().catch((e) => {
  exitWithError(e.message, ERROR_CODES.INVALID_ARGS);
});
