import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

/**
 * Filter checklist items by priority, type, and return a batch slice.
 */
export function filterChecklist(checklistData, options = {}) {
  const { priority, type, batchIndex, batchSize, includeMeta } = options;

  let items = checklistData.checklist;

  if (priority?.length) {
    items = items.filter(item => priority.includes(item.priority));
  }
  if (type?.length) {
    items = items.filter(item => type.includes(item.check_type));
  }

  const totalFiltered = items.length;

  if (batchIndex !== undefined && batchSize !== undefined) {
    const start = batchIndex * batchSize;
    const sliced = items.slice(start, start + batchSize);

    if (includeMeta) {
      return {
        meta: {
          totalFiltered,
          totalBatches: Math.ceil(totalFiltered / batchSize),
          batchIndex,
          batchSize
        },
        items: sliced
      };
    }
    return sliced;
  }

  if (includeMeta) {
    return { meta: { totalFiltered, totalBatches: 1, batchIndex: 0, batchSize: totalFiltered }, items };
  }
  return items;
}

// CLI entry point
if (process.argv[1] === import.meta.filename) {
  const { values } = parseArgs({
    options: {
      input: { type: 'string' },
      priority: { type: 'string' },
      type: { type: 'string' },
      'batch-index': { type: 'string' },
      'batch-size': { type: 'string' },
      mapping: { type: 'string' },
    }
  });

  const checklistData = JSON.parse(readFileSync(values.input, 'utf-8'));
  const opts = {
    priority: values.priority?.split(','),
    type: values.type?.split(','),
    batchIndex: values['batch-index'] !== undefined ? parseInt(values['batch-index']) : undefined,
    batchSize: values['batch-size'] !== undefined ? parseInt(values['batch-size']) : undefined,
    includeMeta: true
  };

  const result = filterChecklist(checklistData, opts);

  // If mapping file provided, enrich items with code locations
  if (values.mapping) {
    const mappingData = JSON.parse(readFileSync(values.mapping, 'utf-8'));
    const mappingIndex = Object.fromEntries(
      mappingData.mappings.map(m => [m.requirement_id, m])
    );
    for (const item of result.items) {
      const mapping = mappingIndex[item.requirement_id];
      if (mapping) {
        item._locations = mapping.locations;
        item._requirement_text = mapping.requirement_text;
      }
    }
  }

  console.log(JSON.stringify(result, null, 2));
}
