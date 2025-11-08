import { ContractMetadata, ContractSource, FetchResult, PipelineConfig } from './types';
import { sha256, retryWithBackoff, isRetryableHttpError, normalizeAddress, RateLimiter } from './utils';

/**
 * Etherscan family data fetcher
 * Fetches verified contract data from Etherscan and its variants (PolygonScan, Arbiscan, etc.)
 * API docs: https://docs.etherscan.io/api-reference/endpoint/getsourcecode
 */

interface EtherscanSourceResult {
  SourceCode: string;
  ABI: string;
  ContractName: string;
  CompilerVersion: string;
  OptimizationUsed: string;
  Runs: string;
  ConstructorArguments: string;
  EVMVersion: string;
  Library: string;
  LicenseType: string;
  Proxy: string;
  Implementation: string;
  SwarmSource: string;
}

interface EtherscanInstance {
  chainId: number;
  baseUrl: string;
  name: string;
  apiKey?: string;
}

export class EtherscanFetcher {
  private instances: EtherscanInstance[];
  private rateLimiters: Map<string, RateLimiter>;
  private maxRetries: number;
  private backoffMultiplier: number;

  constructor(config: PipelineConfig['etherscan']) {
    this.instances = config.instances;
    this.maxRetries = config.rateLimit.maxRetries || 4;
    this.backoffMultiplier = config.rateLimit.backoffMultiplier || 2;

    // Create rate limiter for each instance
    this.rateLimiters = new Map();
    for (const instance of this.instances) {
      this.rateLimiters.set(
        instance.baseUrl,
        new RateLimiter(config.rateLimit.requestsPerSecond || 5)
      );
    }
  }

  /**
   * Fetch contracts by address list for all configured instances
   */
  async fetchByAddresses(addresses: string[]): Promise<FetchResult[]> {
    const results: FetchResult[] = [];

    for (const instance of this.instances) {
      console.log(`Fetching ${addresses.length} contracts from ${instance.name}...`);
      const instanceResults = await this.fetchInstanceByAddresses(instance, addresses);
      results.push(...instanceResults);
    }

    return results;
  }

  /**
   * Fetch contracts from a specific instance by address list
   */
  private async fetchInstanceByAddresses(
    instance: EtherscanInstance,
    addresses: string[]
  ): Promise<FetchResult[]> {
    const results: FetchResult[] = [];
    const rateLimiter = this.rateLimiters.get(instance.baseUrl)!;

    for (const address of addresses) {
      await rateLimiter.acquire();
      const result = await this.fetchContract(instance, address);
      results.push(result);
    }

    return results;
  }

  /**
   * Fetch a specific contract's source code
   */
  async fetchContract(instance: EtherscanInstance, address: string): Promise<FetchResult> {
    try {
      const normalizedAddress = normalizeAddress(address);

      const sourceData = await this.fetchSourceCode(instance, normalizedAddress);

      // Parse sources
      const sources = this.parseSources(sourceData);

      // Skip if no sources found
      if (sources.length === 0) {
        return {
          success: false,
          error: {
            code: 'NO_SOURCES',
            message: `No sources found for ${normalizedAddress}`,
            retryable: false,
          },
        };
      }

      // Parse ABI
      let abi: any[] | undefined;
      try {
        abi = sourceData.ABI ? JSON.parse(sourceData.ABI) : undefined;
      } catch (error) {
        console.warn(`Failed to parse ABI for ${normalizedAddress}:`, error);
      }

      // Parse compiler version
      const compilerVersion = this.parseCompilerVersion(sourceData.CompilerVersion);

      // Build contract metadata
      const contractMetadata: ContractMetadata = {
        chainId: instance.chainId,
        address: normalizedAddress,
        verifiedBy: 'etherscan',
        compilerSettings: {
          compilerVersion,
          evmVersion: sourceData.EVMVersion || undefined,
          optimizer: {
            enabled: sourceData.OptimizationUsed === '1' || sourceData.OptimizationUsed === 'true',
            runs: parseInt(sourceData.Runs || '200'),
          },
          libraries: this.parseLibraries(sourceData.Library),
        },
        license: this.parseLicense(sourceData.LicenseType),
        sources,
        abi,
        bytecodeHash: '', // Will be filled by quality labeler
        labels: {
          passesCompilation: true, // Etherscan only includes verified contracts
        },
        timestamps: {
          collectedAt: new Date().toISOString(),
        },
      };

      return {
        success: true,
        data: contractMetadata,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'CONTRACT_FETCH_ERROR',
          message: `Failed to fetch contract ${address} from ${instance.name}: ${error.message}`,
          retryable: isRetryableHttpError(error),
        },
      };
    }
  }

  /**
   * Fetch source code from Etherscan API
   */
  private async fetchSourceCode(
    instance: EtherscanInstance,
    address: string
  ): Promise<EtherscanSourceResult> {
    return retryWithBackoff(
      async () => {
        const url = new URL(`${instance.baseUrl}/api`);
        url.searchParams.set('module', 'contract');
        url.searchParams.set('action', 'getsourcecode');
        url.searchParams.set('address', address);

        if (instance.apiKey) {
          url.searchParams.set('apikey', instance.apiKey);
        }

        const response = await fetch(url.toString());

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Check for rate limiting
        if (data.status === '0' && data.message === 'NOTOK') {
          if (data.result?.includes('rate limit')) {
            const error: any = new Error('Rate limited');
            error.response = { status: 429 };
            throw error;
          }
        }

        if (data.status !== '1' || !data.result || data.result.length === 0) {
          throw new Error(data.message || data.result || 'Contract not verified');
        }

        return data.result[0] as EtherscanSourceResult;
      },
      this.maxRetries,
      (error: any) => {
        // Retry on network errors and rate limits
        return isRetryableHttpError(error) || error.message?.includes('rate limit');
      }
    );
  }

  /**
   * Fetch ABI separately (useful if only ABI is needed)
   */
  async fetchABI(instance: EtherscanInstance, address: string): Promise<any[] | null> {
    try {
      const rateLimiter = this.rateLimiters.get(instance.baseUrl)!;
      await rateLimiter.acquire();

      const result = await retryWithBackoff(
        async () => {
          const url = new URL(`${instance.baseUrl}/api`);
          url.searchParams.set('module', 'contract');
          url.searchParams.set('action', 'getabi');
          url.searchParams.set('address', normalizeAddress(address));

          if (instance.apiKey) {
            url.searchParams.set('apikey', instance.apiKey);
          }

          const response = await fetch(url.toString());

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();

          if (data.status !== '1') {
            throw new Error(data.message || data.result || 'Failed to fetch ABI');
          }

          return JSON.parse(data.result);
        },
        this.maxRetries,
        isRetryableHttpError
      );

      return result;
    } catch (error) {
      console.warn(`Failed to fetch ABI for ${address}:`, error);
      return null;
    }
  }

  /**
   * Parse sources from Etherscan response
   */
  private parseSources(sourceData: EtherscanSourceResult): ContractSource[] {
    const sources: ContractSource[] = [];

    // Check if it's multi-file source (JSON format)
    if (sourceData.SourceCode.startsWith('{{') || sourceData.SourceCode.startsWith('{')) {
      try {
        // Remove extra braces if present
        let jsonStr = sourceData.SourceCode;
        if (jsonStr.startsWith('{{')) {
          jsonStr = jsonStr.slice(1, -1);
        }

        const parsed = JSON.parse(jsonStr);

        // Handle standard JSON input format
        if (parsed.sources) {
          for (const [path, source] of Object.entries(parsed.sources)) {
            const content = (source as any).content;
            if (content) {
              sources.push({
                path,
                content,
                sha256: sha256(content),
              });
            }
          }
        }
        // Handle flattened source format
        else {
          for (const [path, content] of Object.entries(parsed)) {
            if (typeof content === 'string') {
              sources.push({
                path,
                content,
                sha256: sha256(content),
              });
            }
          }
        }
      } catch (error) {
        console.warn('Failed to parse multi-file source, treating as single file:', error);
        // Fallback to single file
        sources.push({
          path: `${sourceData.ContractName}.sol`,
          content: sourceData.SourceCode,
          sha256: sha256(sourceData.SourceCode),
        });
      }
    }
    // Single file or flattened
    else if (sourceData.SourceCode.trim()) {
      sources.push({
        path: `${sourceData.ContractName}.sol`,
        content: sourceData.SourceCode,
        sha256: sha256(sourceData.SourceCode),
      });
    }

    return sources;
  }

  /**
   * Parse compiler version (remove 'v' prefix and any '+commit' suffix)
   */
  private parseCompilerVersion(version: string): string {
    let cleaned = version;

    // Remove 'v' prefix
    if (cleaned.startsWith('v')) {
      cleaned = cleaned.slice(1);
    }

    // Remove commit hash
    const plusIndex = cleaned.indexOf('+');
    if (plusIndex !== -1) {
      cleaned = cleaned.slice(0, plusIndex);
    }

    return cleaned;
  }

  /**
   * Parse libraries from Etherscan format (semicolon-separated)
   */
  private parseLibraries(libraryString: string): Record<string, string> | undefined {
    if (!libraryString || libraryString === '') return undefined;

    try {
      const libraries: Record<string, string> = {};
      const pairs = libraryString.split(';');

      for (const pair of pairs) {
        const [name, address] = pair.split(':');
        if (name && address) {
          libraries[name.trim()] = normalizeAddress(address.trim());
        }
      }

      return Object.keys(libraries).length > 0 ? libraries : undefined;
    } catch (error) {
      console.warn('Failed to parse libraries:', error);
      return undefined;
    }
  }

  /**
   * Parse license type to standard SPDX identifier
   */
  private parseLicense(licenseType: string): any {
    if (!licenseType || licenseType === 'None' || licenseType === 'Unknown') {
      return 'Unknown';
    }

    // Map Etherscan license IDs to SPDX identifiers
    const licenseMap: Record<string, string> = {
      '1': 'Unlicense',
      '2': 'MIT',
      '3': 'GPL-2.0',
      '4': 'GPL-3.0',
      '5': 'LGPL-2.1',
      '6': 'LGPL-3.0',
      '7': 'BSD-2-Clause',
      '8': 'BSD-3-Clause',
      '9': 'MPL-2.0',
      '10': 'OSL-3.0',
      '11': 'Apache-2.0',
      '12': 'AGPL-3.0',
      '13': 'BSL-1.0',
      'MIT': 'MIT',
      'Apache-2.0': 'Apache-2.0',
      'GPL-3.0': 'GPL-3.0',
      'GPL-2.0': 'GPL-2.0',
      'AGPL-3.0': 'AGPL-3.0',
      'LGPL-3.0': 'LGPL-3.0',
      'LGPL-2.1': 'LGPL-2.1',
      'BSD-2-Clause': 'BSD-2-Clause',
      'BSD-3-Clause': 'BSD-3-Clause',
      'MPL-2.0': 'MPL-2.0',
      'Unlicense': 'Unlicense',
    };

    return licenseMap[licenseType] || licenseType;
  }
}
