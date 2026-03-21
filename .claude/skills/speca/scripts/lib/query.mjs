/**
 * query.mjs — Context-efficient access to speca intermediate files.
 *
 * Provides querySummary, queryBatch, and queryGet for all 6 file types:
 * config, requirements, mapping, checklist, findings, test-results
 */

const FILE_METADATA = {
  config:          { arrayKey: null,          idKey: null },
  requirements:    { arrayKey: 'requirements', idKey: 'id' },
  mapping:         { arrayKey: 'mappings',     idKey: 'requirement_id' },
  checklist:       { arrayKey: 'checklist',    idKey: 'id' },
  findings:        { arrayKey: 'findings',     idKey: 'id' },
  'test-results':  { arrayKey: 'test_files',   idKey: 'checklist_id' },
};

/**
 * Count occurrences of a field value across an array.
 * @param {Array} arr
 * @param {string} field
 * @returns {Record<string, number>}
 */
function countBy(arr, field) {
  const counts = {};
  for (const item of arr) {
    const val = item[field];
    if (val !== undefined && val !== null) {
      counts[val] = (counts[val] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * Return a summary object for the given file type and data.
 * @param {string} fileType
 * @param {object} data
 * @returns {object}
 */
export function querySummary(fileType, data) {
  switch (fileType) {
    case 'config': {
      const tm = data.threat_model ?? {};
      return {
        file: 'config',
        version: data.version,
        language: data.language,
        spec_paths: data.spec_paths,
        source_paths: data.source_paths,
        actor_names: Object.keys(tm.actors ?? {}),
        boundary_count: (tm.boundaries ?? []).length,
        assumption_count: (tm.assumptions ?? []).length,
      };
    }

    case 'requirements': {
      const reqs = data.requirements ?? [];
      return {
        file: 'requirements',
        extracted_at: data.extracted_at,
        total: reqs.length,
        spec_sources: data.spec_sources ?? [],
        by_type: countBy(reqs, 'type'),
        by_severity: countBy(reqs, 'severity_hint'),
      };
    }

    case 'mapping': {
      const mappings = data.mappings ?? [];
      const mapped = mappings.filter(m => m.status === 'mapped').length;
      const dist = { high_0_9_1_0: 0, medium_0_7_0_89: 0, low_0_5_0_69: 0 };
      for (const m of mappings) {
        for (const loc of (m.locations ?? [])) {
          const c = loc.confidence ?? 0;
          if (c >= 0.9) dist.high_0_9_1_0++;
          else if (c >= 0.7) dist.medium_0_7_0_89++;
          else if (c >= 0.5) dist.low_0_5_0_69++;
        }
      }
      return {
        file: 'mapping',
        mapped_at: data.mapped_at,
        total: mappings.length,
        mapped,
        unmapped: mappings.length - mapped,
        source_files: data.source_files ?? [],
        confidence_distribution: dist,
      };
    }

    case 'checklist': {
      const summary = data.summary ?? {};
      return {
        file: 'checklist',
        generated_at: data.generated_at,
        total_checks: summary.total_checks,
        by_priority: summary.by_priority,
        by_check_type: summary.by_check_type,
        unmapped_checks: summary.unmapped_checks,
        threat_model_exclusions: summary.threat_model_exclusions,
      };
    }

    case 'findings': {
      const findings = data.findings ?? [];
      return {
        file: 'findings',
        audited_at: data.audited_at,
        total_findings: findings.length,
        by_severity: data.findings_by_severity ?? countBy(findings, 'severity'),
        checklist_version: data.checklist_version,
      };
    }

    case 'test-results': {
      const summary = data.summary ?? {};
      const testFiles = data.test_files ?? [];
      return {
        file: 'test-results',
        generated_at: data.generated_at,
        total_test_files: testFiles.length,
        total_test_functions: summary.total_test_functions,
        property_tests: summary.property_tests,
        poc_tests: summary.poc_tests,
        compilation_errors: summary.compilation_errors,
      };
    }

    default:
      throw new Error(`querySummary: unsupported file type "${fileType}"`);
  }
}

/**
 * Return a batch (page) of items from an array-typed file.
 * @param {string} fileType
 * @param {object} data
 * @param {number} index  — zero-based batch index
 * @param {number} size   — items per batch
 * @returns {{ meta: object, items: Array }}
 */
export function queryBatch(fileType, data, index, size) {
  const meta = FILE_METADATA[fileType];
  if (!meta || meta.arrayKey === null) {
    throw new Error(`queryBatch: unsupported file type "${fileType}"`);
  }

  const arr = data[meta.arrayKey] ?? [];
  const totalItems = arr.length;
  const totalBatches = size > 0 ? Math.ceil(totalItems / size) : 0;
  const start = index * size;
  const items = arr.slice(start, start + size);

  return {
    meta: {
      fileType,
      batchIndex: index,
      batchSize: size,
      totalItems,
      totalBatches,
    },
    items,
  };
}

/**
 * Return a single item by its ID field.
 * @param {string} fileType
 * @param {object} data
 * @param {string} id
 * @returns {object|null}
 */
export function queryGet(fileType, data, id) {
  const meta = FILE_METADATA[fileType];
  if (!meta || meta.idKey === null) {
    throw new Error(`queryGet: unsupported file type "${fileType}"`);
  }

  const arr = data[meta.arrayKey] ?? [];
  return arr.find(item => item[meta.idKey] === id) ?? null;
}
