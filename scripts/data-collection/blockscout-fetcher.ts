import { ContractMetadata, ContractSource, FetchResult, PipelineConfig } from './types';
import { sha256, retryWithBackoff, isRetryableHttpError, normalizeAddress, RateLimiter } from './utils';

/**
 * Blockscout data fetcher
 * Fetches verified contract data from Blockscout explorers
 * API docs: https://docs.blockscout.com/devs/apis/rpc/contract
 */

interface BlockscoutContractListItem {
  Address: string;
  ContractName: string;
  CompilerVersion: string;
  OptimizationUsed: string;
  Runs: string;
  ConstructorArguments?: string;
  EVMVersion?: string;
  Library?: string;
  LicenseType?: string;
  Proxy?: string;
  Implementation?: string;
  SwarmSource?: string;
  VerifiedAt?: string;
}

interface BlockscoutContractSource {
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
  FileName?: string;
  AdditionalSources?: Array<{
    SourceCode: string;
    Filename: string;
  }>;
}

interface BlockscoutInstance {
  chainId: number;
  baseUrl: string;
  name: string;
}

export class BlockscoutFetcher {
  private instances: BlockscoutInstance[];
  private pageSize: number;
  private maxPages?: number;
  private rateLimiter: RateLimiter;

  constructor(config: PipelineConfig['blockscout']) {
    this.instances = config.instances;
    this.pageSize = config.pageSize || 100;
    this.maxPages = config.maxPages;
    this.rateLimiter = new RateLimiter(5); // 5 requests per second default
  }

  /**
   * Fetch all verified contracts from all configured instances
   */
  async fetchAll(): Promise<FetchResult[]> {
    const results: FetchResult[] = [];

    for (const instance of this.instances) {
      console.log(`Fetching Blockscout contracts from ${instance.name} (chain ${instance.chainId})...`);
      const instanceResults = await this.fetchInstance(instance);
      results.push(...instanceResults);
    }

    return results;
  }

  /**
   * Fetch verified contracts from a specific Blockscout instance
   */
  private async fetchInstance(instance: BlockscoutInstance): Promise<FetchResult[]> {
    try {
      // Get list of verified contracts
      const contracts = await this.getVerifiedContracts(instance);
      console.log(`Found ${contracts.length} verified contracts on ${instance.name}`);

      const results: FetchResult[] = [];

      for (const contract of contracts) {
        await this.rateLimiter.acquire();
        const result = await this.fetchContract(instance, contract.Address);
        results.push(result);
      }

      return results;
    } catch (error) {
      console.error(`Error fetching instance ${instance.name}:`, error);
      return [
        {
          success: false,
          error: {
            code: 'INSTANCE_FETCH_ERROR',
            message: `Failed to fetch instance ${instance.name}: ${error}`,
            retryable: true,
          },
        },
      ];
    }
  }

  /**
   * Get list of verified contracts
   */
  private async getVerifiedContracts(instance: BlockscoutInstance): Promise<BlockscoutContractListItem[]> {
    const allContracts: BlockscoutContractListItem[] = [];
    let page = 1;

    while (true) {
      if (this.maxPages && page > this.maxPages) {
        break;
      }

      await this.rateLimiter.acquire();

      try {
        const contracts = await retryWithBackoff(
          async () => {
            const url = new URL(`${instance.baseUrl}/api`);
            url.searchParams.set('module', 'contract');
            url.searchParams.set('action', 'listcontracts');
            url.searchParams.set('page', page.toString());
            url.searchParams.set('offset', this.pageSize.toString());

            const response = await fetch(url.toString());

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.status !== '1') {
              // No more results or error
              if (data.message === 'No contracts found' || !data.result) {
                return [];
              }
              throw new Error(data.message || 'API error');
            }

            return data.result as BlockscoutContractListItem[];
          },
          4,
          isRetryableHttpError
        );

        if (contracts.length === 0) {
          break;
        }

        allContracts.push(...contracts);
        console.log(`Fetched page ${page} (${contracts.length} contracts)`);
        page++;

        // Small delay between pages
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error fetching page ${page}:`, error);
        break;
      }
    }

    return allContracts;
  }

  /**
   * Fetch a specific contract's source code
   */
  async fetchContract(instance: BlockscoutInstance, address: string): Promise<FetchResult> {
    try {
      const normalizedAddress = normalizeAddress(address);

      const sourceData = await retryWithBackoff(
        async () => {
          const url = new URL(`${instance.baseUrl}/api`);
          url.searchParams.set('module', 'contract');
          url.searchParams.set('action', 'getsourcecode');
          url.searchParams.set('address', normalizedAddress);

          const response = await fetch(url.toString());

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();

          if (data.status !== '1' || !data.result || data.result.length === 0) {
            throw new Error(data.message || 'Contract not verified');
          }

          return data.result[0] as BlockscoutContractSource;
        },
        4,
        isRetryableHttpError
      );

      // Parse sources
      const sources = this.parseSources(sourceData);

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
        verifiedBy: 'blockscout',
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
          passesCompilation: true, // Blockscout only includes verified contracts
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
   * Parse sources from Blockscout response
   */
  private parseSources(sourceData: BlockscoutContractSource): ContractSource[] {
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
          path: sourceData.FileName || `${sourceData.ContractName}.sol`,
          content: sourceData.SourceCode,
          sha256: sha256(sourceData.SourceCode),
        });
      }
    }
    // Handle additional sources
    else if (sourceData.AdditionalSources && sourceData.AdditionalSources.length > 0) {
      // Main source
      sources.push({
        path: sourceData.FileName || `${sourceData.ContractName}.sol`,
        content: sourceData.SourceCode,
        sha256: sha256(sourceData.SourceCode),
      });

      // Additional sources
      for (const additionalSource of sourceData.AdditionalSources) {
        sources.push({
          path: additionalSource.Filename,
          content: additionalSource.SourceCode,
          sha256: sha256(additionalSource.SourceCode),
        });
      }
    }
    // Single file
    else {
      sources.push({
        path: sourceData.FileName || `${sourceData.ContractName}.sol`,
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
   * Parse libraries from Blockscout format
   */
  private parseLibraries(libraryString: string): Record<string, string> | undefined {
    if (!libraryString) return undefined;

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
   * Parse license type
   */
  private parseLicense(licenseType: string): any {
    if (!licenseType || licenseType === 'None' || licenseType === 'Unknown') {
      return 'Unknown';
    }

    // Map common license strings to standard SPDX identifiers
    const licenseMap: Record<string, string> = {
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
