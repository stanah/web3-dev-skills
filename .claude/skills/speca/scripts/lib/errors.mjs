export const ERROR_CODES = {
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  INVALID_ARGS: 'INVALID_ARGS',
  UNSUPPORTED_MODE: 'UNSUPPORTED_MODE',
  PARSE_ERROR: 'PARSE_ERROR',
  WRITE_ERROR: 'WRITE_ERROR',
};

export function formatError(message, code) {
  return { error: message, code };
}

export function exitWithError(message, code) {
  console.error(JSON.stringify(formatError(message, code)));
  process.exit(1);
}
