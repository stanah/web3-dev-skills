import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const SEVERITY_TO_SARIF = {
  critical: 'error',
  high: 'error',
  medium: 'warning',
  low: 'note',
  informational: 'note'
};

/**
 * Generate a SARIF v2.1.0 document from findings and checklist.
 */
export function generateSarif(findingsData, checklistData) {
  const checklistIndex = Object.fromEntries(
    (checklistData.checklist || []).map(c => [c.id, c])
  );

  // Build rules from unique checklist IDs in findings
  const ruleMap = new Map();
  for (const finding of findingsData.findings) {
    if (!ruleMap.has(finding.checklist_id)) {
      const checkItem = checklistIndex[finding.checklist_id];
      const highestSeverity = finding.severity;
      ruleMap.set(finding.checklist_id, {
        id: finding.checklist_id,
        shortDescription: { text: checkItem?.property || finding.title },
        defaultConfiguration: { level: SEVERITY_TO_SARIF[highestSeverity] || 'note' }
      });
    }
  }

  // Build results
  const results = findingsData.findings.map(finding => {
    const result = {
      ruleId: finding.checklist_id,
      level: SEVERITY_TO_SARIF[finding.severity] || 'note',
      message: { text: `${finding.title}: ${finding.description}` }
    };

    const codeRefs = finding.proof_trace?.code_refs;
    if (codeRefs?.length) {
      result.locations = codeRefs.map(ref => ({
        physicalLocation: {
          artifactLocation: { uri: ref.file },
          region: { startLine: ref.lines[0], endLine: ref.lines[1] }
        }
      }));
    }

    return result;
  });

  return {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'speca',
          version: '1.0',
          informationUri: 'https://arxiv.org/abs/2602.07513',
          rules: [...ruleMap.values()]
        }
      },
      results
    }]
  };
}

// CLI entry point
if (process.argv[1] === import.meta.filename) {
  const { values } = parseArgs({
    options: {
      findings: { type: 'string' },
      checklist: { type: 'string' },
      output: { type: 'string' },
    }
  });

  const findingsData = JSON.parse(readFileSync(values.findings, 'utf-8'));
  const checklistData = values.checklist
    ? JSON.parse(readFileSync(values.checklist, 'utf-8'))
    : { checklist: [] };

  const sarif = generateSarif(findingsData, checklistData);
  writeFileSync(values.output, JSON.stringify(sarif, null, 2));
  console.log(`SARIF written to ${values.output}`);
}
