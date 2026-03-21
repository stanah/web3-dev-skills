import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatError, ERROR_CODES } from '../lib/errors.mjs';

describe('formatError', () => {
  it('returns JSON error object', () => {
    const result = formatError('file not found', ERROR_CODES.FILE_NOT_FOUND);
    assert.deepStrictEqual(result, { error: 'file not found', code: 'FILE_NOT_FOUND' });
  });

  it('has all defined error codes', () => {
    const expected = ['FILE_NOT_FOUND', 'INVALID_ARGS', 'UNSUPPORTED_MODE', 'PARSE_ERROR', 'WRITE_ERROR'];
    assert.deepStrictEqual(Object.keys(ERROR_CODES), expected);
  });
});
