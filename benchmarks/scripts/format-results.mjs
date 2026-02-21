import { readFileSync } from 'node:fs';

/**
 * Format an evaluation result object as a human-readable markdown string.
 *
 * Sections:
 *  - Header with date, SPECA version, and cases evaluated
 *  - Aggregate detection accuracy table (Recall / Precision / F1)
 *  - Pipeline quality table (extract_coverage, mapping_rate, pattern_coverage) — only if data exists
 *  - Per-case results with TP/FP/FN counts, missed vulnerabilities, and false alarms
 */
export function formatSummary(result) {
  const lines = [];

  // --- Header ---
  lines.push(`# SPECA Evaluation Report`);
  lines.push('');
  lines.push(`- **Date:** ${result.evaluation_date}`);
  lines.push(`- **SPECA Version:** ${result.speca_version}`);
  lines.push(`- **Cases Evaluated:** ${result.cases_evaluated}`);
  lines.push('');

  // --- Aggregate Detection ---
  lines.push(`## Aggregate Detection Accuracy`);
  lines.push('');
  const det = result.aggregate.detection;
  lines.push(`| Metric    | Value |`);
  lines.push(`|-----------|-------|`);
  lines.push(`| Recall    | ${det.recall} |`);
  lines.push(`| Precision | ${det.precision} |`);
  lines.push(`| F1        | ${det.f1} |`);
  lines.push('');

  // --- Pipeline Quality (only if present) ---
  const pipe = result.aggregate.pipeline;
  if (pipe) {
    lines.push(`## Pipeline Quality`);
    lines.push('');
    lines.push(`| Metric           | Value |`);
    lines.push(`|------------------|-------|`);
    lines.push(`| extract_coverage | ${pipe.extract_coverage} |`);
    lines.push(`| mapping_rate     | ${pipe.mapping_rate} |`);
    lines.push(`| pattern_coverage | ${pipe.pattern_coverage} |`);
    lines.push('');
  }

  // --- Per-Case Results ---
  if (result.per_case && result.per_case.length > 0) {
    lines.push(`## Per-Case Results`);
    lines.push('');

    for (const c of result.per_case) {
      const tp = c.details.true_positives.length;
      const fp = c.details.false_positives.length;
      const fn = c.details.false_negatives.length;

      lines.push(`### ${c.case_id}`);
      lines.push('');
      lines.push(`- Recall: ${c.detection.recall} | Precision: ${c.detection.precision} | F1: ${c.detection.f1}`);
      lines.push(`- TP: ${tp} | FP: ${fp} | FN: ${fn}`);

      if (c.details.false_negatives.length > 0) {
        lines.push('');
        lines.push(`**Missed vulnerabilities:**`);
        for (const v of c.details.false_negatives) {
          lines.push(`- ${v}`);
        }
      }

      if (c.details.false_positives.length > 0) {
        lines.push('');
        lines.push(`**False alarms:**`);
        for (const f of c.details.false_positives) {
          lines.push(`- ${f}`);
        }
      }

      lines.push('');
    }
  }

  return lines.join('\n');
}

// CLI entrypoint
if (process.argv[1] === import.meta.filename) {
  const jsonPath = process.argv[2];
  if (!jsonPath) {
    console.error('Usage: node format-results.mjs <evaluation-result.json>');
    process.exit(1);
  }
  const result = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  console.log(formatSummary(result));
}
