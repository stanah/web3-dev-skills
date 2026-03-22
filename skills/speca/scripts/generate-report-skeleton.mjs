import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'informational'];
const SEVERITY_LABELS = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', informational: 'Informational' };

/**
 * Generate a Markdown report skeleton with all tables and statistics pre-built.
 * Finding descriptions, recommendations, and reasoning are included from data.
 * The LLM only needs to localize/polish prose sections.
 */
export function generateReportSkeleton({ config, findings, checklist, date, targetName }) {
  const lines = [];

  // Header
  lines.push('# SPECA Security Audit Report');
  lines.push('');
  lines.push(`**Date:** ${date}`);
  lines.push('**Framework:** SPECA v1.0');
  lines.push(`**Target:** ${targetName}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Executive Summary
  lines.push('## Executive Summary');
  lines.push('');
  lines.push('| Severity | Count |');
  lines.push('|----------|-------|');
  for (const sev of SEVERITY_ORDER) {
    const count = findings.findings_by_severity[sev] ?? 0;
    lines.push(`| ${SEVERITY_LABELS[sev]} | ${count} |`);
  }
  lines.push(`| **Total** | **${findings.total_findings}** |`);
  lines.push('');

  const staticCount = checklist.summary?.by_check_type?.static ?? 0;
  const totalChecks = checklist.total_checks ?? 0;
  const coveragePct = totalChecks > 0 ? Math.round((staticCount / totalChecks) * 1000) / 10 : 0;
  lines.push(`**Checklist Coverage:** ${staticCount}/${totalChecks} checks audited (${coveragePct}%)`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Threat Model
  lines.push('## Threat Model');
  lines.push('');
  const actors = config.threat_model?.actors ?? {};
  if (Object.keys(actors).length > 0) {
    lines.push('### Actors');
    lines.push('');
    lines.push('| Actor | Trust Level |');
    lines.push('|-------|------------|');
    for (const [actor, trust] of Object.entries(actors)) {
      lines.push(`| ${actor} | ${trust} |`);
    }
    lines.push('');
  }

  const boundaries = config.threat_model?.boundaries ?? [];
  if (boundaries.length > 0) {
    lines.push('### Trust Boundaries');
    lines.push('');
    for (const b of boundaries) {
      lines.push(`- ${b}`);
    }
    lines.push('');
  }

  const assumptions = config.threat_model?.assumptions ?? [];
  if (assumptions.length > 0) {
    lines.push('### Assumptions');
    lines.push('');
    for (const a of assumptions) {
      lines.push(`- ${a}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // Findings
  lines.push('## Findings');
  lines.push('');

  if (findings.findings.length === 0) {
    lines.push('No findings were identified during this audit.');
    lines.push('');
  } else {
    for (const f of findings.findings) {
      const sevLabel = SEVERITY_LABELS[f.severity] ?? f.severity;
      lines.push(`### [${f.id}] ${f.title} (${sevLabel})`);
      lines.push('');
      lines.push(`**Severity:** ${sevLabel}`);
      lines.push(`**Checklist Item:** ${f.checklist_id}`);
      if (f.requirement_id) {
        lines.push(`**Requirement:** ${f.requirement_id}`);
      }
      lines.push(`**False Positive Risk:** ${f.false_positive_risk ?? 'Unknown'}`);
      lines.push('');
      lines.push('**Description:**');
      lines.push(f.description);
      lines.push('');

      // Proof trace
      const codeRefs = f.proof_trace?.code_refs;
      if (codeRefs?.length) {
        lines.push('**Proof Trace:**');
        for (const ref of codeRefs) {
          lines.push('```solidity');
          lines.push(`// ${ref.file}:${ref.lines[0]}-${ref.lines[1]}`);
          if (ref.snippet) lines.push(ref.snippet);
          lines.push('```');
        }
        lines.push('');
      }

      if (f.proof_trace?.reasoning) {
        lines.push('**Reasoning:**');
        lines.push(f.proof_trace.reasoning);
        lines.push('');
      }

      if (f.recommendation) {
        lines.push('**Recommendation:**');
        lines.push(f.recommendation);
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }
  }

  // Methodology
  lines.push('## Methodology');
  lines.push('');
  lines.push('This audit was performed using the SPECA (SPEcification-to-Checklist Auditing) framework v1.0.');
  lines.push('');
  lines.push('**Pipeline:** `/speca init` -> `/speca extract` -> `/speca map` -> `/speca checklist` -> `/speca audit` -> `/speca test` -> `/speca report`');
  lines.push('');
  lines.push('**Reference:** [SPECA: Scalable LLM-Driven Specification-to-Checklist Auditing of Smart Contracts](https://arxiv.org/abs/2602.07513)');

  return lines.join('\n');
}

// CLI entry point
if (process.argv[1] === import.meta.filename) {
  const { values } = parseArgs({
    options: {
      config: { type: 'string' },
      findings: { type: 'string' },
      checklist: { type: 'string' },
      output: { type: 'string' },
      date: { type: 'string' },
      'target-name': { type: 'string' },
    }
  });

  const config = JSON.parse(readFileSync(values.config, 'utf-8'));
  const findingsData = JSON.parse(readFileSync(values.findings, 'utf-8'));
  const checklistData = JSON.parse(readFileSync(values.checklist, 'utf-8'));

  const md = generateReportSkeleton({
    config,
    findings: findingsData,
    checklist: checklistData,
    date: values.date ?? new Date().toISOString().slice(0, 10),
    targetName: values['target-name'] ?? 'Unknown'
  });

  writeFileSync(values.output, md);
  console.log(`Report skeleton written to ${values.output}`);
}
