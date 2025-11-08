import { createHash } from 'node:crypto';
import { ContractSource } from './types';

/**
 * Utility functions for data collection pipeline
 */

/**
 * Calculate SHA256 hash of a string
 */
export function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Calculate hash of bytecode (keccak256 would be ideal, but SHA256 for simplicity)
 */
export function bytecodeHash(bytecode: string): string {
  // Remove 0x prefix if present
  const cleanBytecode = bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode;
  return sha256(cleanBytecode);
}

/**
 * Calculate order-independent hash of all sources
 */
export function sourcesHash(sources: ContractSource[]): string {
  const sortedHashes = sources.map((s) => s.sha256).sort();
  return sha256(sortedHashes.join(','));
}

/**
 * Extract function selectors (4-byte signatures) from ABI
 */
export function extractFunctionSelectors(abi: any[]): Set<string> {
  const selectors = new Set<string>();

  for (const item of abi) {
    if (item.type === 'function') {
      const signature = `${item.name}(${(item.inputs || [])
        .map((i: any) => i.type)
        .join(',')})`;
      const hash = createHash('sha256').update(signature).digest('hex');
      // Take first 4 bytes (8 hex chars)
      selectors.add(hash.slice(0, 8));
    }
  }

  return selectors;
}

/**
 * Exponential backoff delay
 */
export async function exponentialBackoff(
  attempt: number,
  baseDelay: number = 2000,
  maxDelay: number = 16000
): Promise<void> {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 4,
  isRetryable: (error: any) => boolean = () => true
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !isRetryable(error)) {
        throw error;
      }

      await exponentialBackoff(attempt);
    }
  }

  throw lastError;
}

/**
 * Rate limiter using token bucket algorithm
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per second

  constructor(requestsPerSecond: number) {
    this.capacity = requestsPerSecond;
    this.refillRate = requestsPerSecond;
    this.tokens = requestsPerSecond;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  async acquire(): Promise<void> {
    while (true) {
      this.refill();

      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }

      // Wait until next token is available
      const waitTime = (1 - this.tokens) / this.refillRate * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
}

/**
 * Chunk array into batches
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Validate Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Normalize Ethereum address to lowercase with 0x prefix
 */
export function normalizeAddress(address: string): string {
  if (!address.startsWith('0x')) {
    address = '0x' + address;
  }
  return address.toLowerCase();
}

/**
 * Check if HTTP error is retryable
 */
export function isRetryableHttpError(error: any): boolean {
  if (!error.response) return true; // Network errors are retryable

  const status = error.response?.status;
  // Retry on rate limits, server errors, and timeouts
  return status === 429 || status === 503 || status >= 500;
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}
