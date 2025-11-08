import { ContractMetadata, ContractSource, FetchResult, PipelineConfig } from './types';
import { sha256, bytecodeHash, retryWithBackoff, isRetryableHttpError, normalizeAddress } from './utils';

/**
 * Sourcify data fetcher
 * Fetches verified contract data from Sourcify repository
 * API docs: https://docs.sourcify.dev/docs/api/
 */

interface SourcifyContract {
  address: string;
  chainId: string;
  status: 'perfect' | 'partial';
}

interface SourcifyFileTree {
  files: Array<{
    name: string;
    path: string;
    content?: string;
  }>;
}

interface SourcifyMetadata {
  compiler: {
    version: string;
  };
  language: string;
  output?: {
    abi?: any[];
    devdoc?: any;
    userdoc?: any;
  };
  settings: {
    compilationTarget: Record<string, string>;
    evmVersion?: string;
    libraries?: Record<string, Record<string, string>>;
    metadata?: any;
    optimizer: {
      enabled: boolean;
      runs: number;
    };
    remappings?: string[];
  };
  sources: Record<
    string,
    {
      keccak256?: string;
      license?: string;
      urls?: string[];
      content?: string;
    }
  >;
  version: number;
}

export class SourcifyFetcher {
  private baseUrl: string;
  private chains: number[];
  private fullMatchOnly: boolean;

  constructor(config: PipelineConfig['sourcify']) {
    this.baseUrl = config.baseUrl || 'https://sourcify.dev/server';
    this.chains = config.chains || [1]; // Default to Ethereum mainnet
    this.fullMatchOnly = config.fullMatchOnly ?? true;
  }

  /**
   * Fetch all verified contracts for configured chains
   */
  async fetchAll(): Promise<FetchResult[]> {
    const results: FetchResult[] = [];

    for (const chainId of this.chains) {
      console.log(`Fetching Sourcify contracts for chain ${chainId}...`);
      const chainResults = await this.fetchChain(chainId);
      results.push(...chainResults);
    }

    return results;
  }

  /**
   * Fetch verified contracts for a specific chain
   */
  private async fetchChain(chainId: number): Promise<FetchResult[]> {
    try {
      const contracts = await this.getVerifiedContracts(chainId);
      console.log(`Found ${contracts.length} verified contracts on chain ${chainId}`);

      const results: FetchResult[] = [];

      for (const contract of contracts) {
        // Skip partial matches if fullMatchOnly is enabled
        if (this.fullMatchOnly && contract.status !== 'perfect') {
          continue;
        }

        const result = await this.fetchContract(chainId, contract.address);
        results.push(result);

        // Small delay to be respectful to the API
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      return results;
    } catch (error) {
      console.error(`Error fetching chain ${chainId}:`, error);
      return [
        {
          success: false,
          error: {
            code: 'CHAIN_FETCH_ERROR',
            message: `Failed to fetch chain ${chainId}: ${error}`,
            retryable: true,
          },
        },
      ];
    }
  }

  /**
   * Get list of verified contracts for a chain
   */
  private async getVerifiedContracts(chainId: number): Promise<SourcifyContract[]> {
    const matchType = this.fullMatchOnly ? 'full_match' : 'any_match';
    const url = `${this.baseUrl}/files/contracts/${chainId}`;

    return retryWithBackoff(
      async () => {
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Filter by match type
        return (data as SourcifyContract[]).filter((contract) => {
          if (this.fullMatchOnly) {
            return contract.status === 'perfect';
          }
          return true;
        });
      },
      4,
      isRetryableHttpError
    );
  }

  /**
   * Fetch a specific contract's data
   */
  async fetchContract(chainId: number, address: string): Promise<FetchResult> {
    try {
      const normalizedAddress = normalizeAddress(address);

      // Fetch metadata and source files
      const [metadata, fileTree] = await Promise.all([
        this.fetchMetadata(chainId, normalizedAddress),
        this.fetchFileTree(chainId, normalizedAddress),
      ]);

      // Parse sources
      const sources = await this.parseSources(metadata, fileTree);

      // Extract compiler settings
      const compilerSettings = {
        compilerVersion: metadata.compiler.version,
        evmVersion: metadata.settings.evmVersion,
        optimizer: metadata.settings.optimizer,
        libraries: this.flattenLibraries(metadata.settings.libraries),
      };

      // Determine license (use the most restrictive one if multiple)
      const license = this.extractLicense(metadata);

      // Build contract metadata
      const contractMetadata: ContractMetadata = {
        chainId,
        address: normalizedAddress,
        verifiedBy: 'sourcify_full',
        compilerSettings,
        license,
        sources,
        abi: metadata.output?.abi,
        bytecodeHash: '', // Will be filled by quality labeler
        labels: {
          passesCompilation: true, // Sourcify only includes compilable contracts
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
          message: `Failed to fetch contract ${address} on chain ${chainId}: ${error.message}`,
          retryable: isRetryableHttpError(error),
        },
      };
    }
  }

  /**
   * Fetch metadata.json for a contract
   */
  private async fetchMetadata(chainId: number, address: string): Promise<SourcifyMetadata> {
    const url = `${this.baseUrl}/files/${chainId}/${address}/metadata.json`;

    return retryWithBackoff(async () => {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    }, 4, isRetryableHttpError);
  }

  /**
   * Fetch file tree for a contract
   */
  private async fetchFileTree(chainId: number, address: string): Promise<SourcifyFileTree> {
    const url = `${this.baseUrl}/files/tree/any/${chainId}/${address}`;

    return retryWithBackoff(async () => {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    }, 4, isRetryableHttpError);
  }

  /**
   * Fetch individual source file
   */
  private async fetchSourceFile(chainId: number, address: string, path: string): Promise<string> {
    const encodedPath = encodeURIComponent(path);
    const url = `${this.baseUrl}/files/${chainId}/${address}/${encodedPath}`;

    return retryWithBackoff(async () => {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.text();
    }, 4, isRetryableHttpError);
  }

  /**
   * Parse sources from metadata and file tree
   */
  private async parseSources(
    metadata: SourcifyMetadata,
    fileTree: SourcifyFileTree
  ): Promise<ContractSource[]> {
    const sources: ContractSource[] = [];

    // Get source files from file tree (filter out metadata.json and other artifacts)
    const sourceFiles = fileTree.files.filter(
      (file) =>
        file.name.endsWith('.sol') ||
        file.name.endsWith('.vy') || // Vyper support
        (metadata.sources[file.path] !== undefined)
    );

    for (const file of sourceFiles) {
      let content = file.content;

      // If content is not in file tree, fetch from metadata or individual file
      if (!content) {
        const metadataSource = metadata.sources[file.path];
        content = metadataSource?.content;
      }

      if (content) {
        sources.push({
          path: file.path,
          content,
          sha256: sha256(content),
        });
      }
    }

    return sources;
  }

  /**
   * Extract most restrictive license from metadata
   */
  private extractLicense(metadata: SourcifyMetadata): any {
    const licenses = new Set<string>();

    for (const source of Object.values(metadata.sources)) {
      if (source.license) {
        licenses.add(source.license);
      }
    }

    // Priority order (most restrictive first)
    const restrictiveLicenses = ['AGPL-3.0', 'GPL-3.0', 'GPL-2.0', 'LGPL-3.0', 'LGPL-2.1'];
    const permissiveLicenses = ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'BSD-2-Clause', 'MPL-2.0', 'Unlicense'];

    for (const license of restrictiveLicenses) {
      if (licenses.has(license)) return license;
    }

    for (const license of permissiveLicenses) {
      if (licenses.has(license)) return license;
    }

    return licenses.size > 0 ? Array.from(licenses)[0] : 'Unknown';
  }

  /**
   * Flatten nested libraries object
   */
  private flattenLibraries(
    libraries?: Record<string, Record<string, string>>
  ): Record<string, string> | undefined {
    if (!libraries) return undefined;

    const flattened: Record<string, string> = {};

    for (const [file, libs] of Object.entries(libraries)) {
      for (const [name, address] of Object.entries(libs)) {
        flattened[`${file}:${name}`] = address;
      }
    }

    return Object.keys(flattened).length > 0 ? flattened : undefined;
  }
}
