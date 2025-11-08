import { ContractMetadata } from './types';
import { sourcesHash, extractFunctionSelectors, bytecodeHash } from './utils';

/**
 * Data normalization and deduplication
 * Identifies and merges duplicate contract implementations
 */

export interface DeduplicationStrategy {
  byBytecode: boolean; // Deduplicate by bytecode hash
  bySources: boolean; // Deduplicate by sources hash
  byFunctionSignatures: boolean; // Deduplicate by function signature set
  keepMostRecent: boolean; // Keep most recent when duplicates found
  mergeMetadata: boolean; // Merge metadata from duplicates
}

export interface ContractCluster {
  id: string;
  bytecodeHash?: string;
  sourcesHash?: string;
  functionSignatures?: Set<string>;
  contracts: ContractMetadata[];
  representative: ContractMetadata; // The "canonical" contract to use
  duplicateCount: number;
}

export class DataNormalizer {
  private strategy: DeduplicationStrategy;

  constructor(strategy?: Partial<DeduplicationStrategy>) {
    this.strategy = {
      byBytecode: true,
      bySources: true,
      byFunctionSignatures: true,
      keepMostRecent: true,
      mergeMetadata: true,
      ...strategy,
    };
  }

  /**
   * Normalize and deduplicate contracts
   */
  normalizeAndDeduplicate(contracts: ContractMetadata[]): {
    unique: ContractMetadata[];
    clusters: ContractCluster[];
    stats: {
      total: number;
      unique: number;
      duplicates: number;
      clusters: number;
    };
  } {
    console.log(`Normalizing ${contracts.length} contracts...`);

    // Build clusters
    const clusters = this.buildClusters(contracts);

    // Extract representative contracts
    const unique = clusters.map((cluster) => cluster.representative);

    const stats = {
      total: contracts.length,
      unique: unique.length,
      duplicates: contracts.length - unique.length,
      clusters: clusters.length,
    };

    console.log(`Normalization complete:`, stats);

    return { unique, clusters, stats };
  }

  /**
   * Build clusters of duplicate contracts
   */
  private buildClusters(contracts: ContractMetadata[]): ContractCluster[] {
    const clusters: Map<string, ContractCluster> = new Map();

    for (const contract of contracts) {
      const clusterKey = this.generateClusterKey(contract);

      if (!clusters.has(clusterKey)) {
        // Create new cluster
        const cluster: ContractCluster = {
          id: clusterKey,
          bytecodeHash: this.strategy.byBytecode ? contract.bytecodeHash : undefined,
          sourcesHash: this.strategy.bySources ? sourcesHash(contract.sources) : undefined,
          functionSignatures: this.strategy.byFunctionSignatures
            ? this.extractSignatures(contract)
            : undefined,
          contracts: [contract],
          representative: contract,
          duplicateCount: 0,
        };
        clusters.set(clusterKey, cluster);
      } else {
        // Add to existing cluster
        const cluster = clusters.get(clusterKey)!;
        cluster.contracts.push(contract);
        cluster.duplicateCount++;

        // Update representative if needed
        if (this.shouldReplaceRepresentative(cluster.representative, contract)) {
          cluster.representative = contract;
        }
      }
    }

    // Merge metadata if enabled
    if (this.strategy.mergeMetadata) {
      for (const cluster of clusters.values()) {
        if (cluster.contracts.length > 1) {
          cluster.representative = this.mergeClusterMetadata(cluster);
        }
      }
    }

    return Array.from(clusters.values());
  }

  /**
   * Generate cluster key for grouping similar contracts
   */
  private generateClusterKey(contract: ContractMetadata): string {
    const keys: string[] = [];

    if (this.strategy.byBytecode && contract.bytecodeHash) {
      keys.push(`bc:${contract.bytecodeHash}`);
    }

    if (this.strategy.bySources) {
      keys.push(`src:${sourcesHash(contract.sources)}`);
    }

    if (this.strategy.byFunctionSignatures) {
      const signatures = this.extractSignatures(contract);
      if (signatures && signatures.size > 0) {
        const sortedSigs = Array.from(signatures).sort().join(',');
        keys.push(`sig:${sortedSigs}`);
      }
    }

    // If no keys were generated, use address as fallback
    if (keys.length === 0) {
      keys.push(`addr:${contract.chainId}:${contract.address}`);
    }

    return keys.join('|');
  }

  /**
   * Extract function signatures from contract
   */
  private extractSignatures(contract: ContractMetadata): Set<string> | undefined {
    if (!contract.abi) return undefined;

    try {
      return extractFunctionSelectors(contract.abi);
    } catch (error) {
      console.warn(`Failed to extract signatures for ${contract.address}:`, error);
      return undefined;
    }
  }

  /**
   * Determine if new contract should replace current representative
   */
  private shouldReplaceRepresentative(current: ContractMetadata, candidate: ContractMetadata): boolean {
    if (this.strategy.keepMostRecent) {
      // Prefer contracts with verification timestamp
      const currentTime = current.timestamps.verifiedAt || current.timestamps.collectedAt;
      const candidateTime = candidate.timestamps.verifiedAt || candidate.timestamps.collectedAt;

      if (currentTime && candidateTime) {
        return new Date(candidateTime) > new Date(currentTime);
      }
    }

    // Prefer Sourcify full matches
    if (candidate.verifiedBy === 'sourcify_full' && current.verifiedBy !== 'sourcify_full') {
      return true;
    }

    // Prefer contracts with more complete metadata
    const currentScore = this.scoreCompleteness(current);
    const candidateScore = this.scoreCompleteness(candidate);

    return candidateScore > currentScore;
  }

  /**
   * Score contract metadata completeness
   */
  private scoreCompleteness(contract: ContractMetadata): number {
    let score = 0;

    if (contract.abi && contract.abi.length > 0) score += 10;
    if (contract.bytecodeHash) score += 5;
    if (contract.sources.length > 1) score += contract.sources.length;
    if (contract.timestamps.verifiedAt) score += 3;
    if (contract.creationTx) score += 2;
    if (contract.deployer) score += 2;
    if (contract.labels.reproducible) score += 5;
    if (contract.labels.staticAnalysis) score += 3;

    return score;
  }

  /**
   * Merge metadata from all contracts in cluster
   */
  private mergeClusterMetadata(cluster: ContractCluster): ContractMetadata {
    const representative = { ...cluster.representative };

    // Collect all deployment information
    const deployments: Array<{
      chainId: number;
      address: string;
      creationTx?: string;
      deployer?: string;
    }> = [];

    for (const contract of cluster.contracts) {
      deployments.push({
        chainId: contract.chainId,
        address: contract.address,
        creationTx: contract.creationTx,
        deployer: contract.deployer,
      });
    }

    // Store deployment info in a custom field (would need to extend ContractMetadata type)
    (representative as any).deployments = deployments;

    // Merge quality labels (take best available)
    for (const contract of cluster.contracts) {
      if (contract.labels.reproducible && !representative.labels.reproducible) {
        representative.labels.reproducible = true;
      }

      if (contract.labels.hasTests && !representative.labels.hasTests) {
        representative.labels.hasTests = true;
      }

      if (contract.labels.staticAnalysis && !representative.labels.staticAnalysis) {
        representative.labels.staticAnalysis = contract.labels.staticAnalysis;
      }
    }

    return representative;
  }

  /**
   * Filter out duplicate implementations (simpler version)
   */
  deduplicate(contracts: ContractMetadata[]): ContractMetadata[] {
    const seen = new Set<string>();
    const unique: ContractMetadata[] = [];

    for (const contract of contracts) {
      const key = this.generateClusterKey(contract);

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(contract);
      }
    }

    return unique;
  }

  /**
   * Identify proxy contracts and resolve implementations
   */
  identifyProxies(contracts: ContractMetadata[]): {
    proxies: ContractMetadata[];
    implementations: ContractMetadata[];
    unmapped: ContractMetadata[];
  } {
    const proxies: ContractMetadata[] = [];
    const implementations: ContractMetadata[] = [];
    const unmapped: ContractMetadata[] = [];

    // Common proxy patterns
    const proxyIndicators = [
      'implementation()',
      'upgradeTo(',
      'upgradeToAndCall(',
      '_implementation',
      'ERC1967',
      'TransparentUpgradeableProxy',
      'UUPSUpgradeable',
    ];

    for (const contract of contracts) {
      let isProxy = false;

      // Check source code for proxy patterns
      for (const source of contract.sources) {
        for (const indicator of proxyIndicators) {
          if (source.content.includes(indicator)) {
            isProxy = true;
            break;
          }
        }
        if (isProxy) break;
      }

      // Check ABI for proxy functions
      if (!isProxy && contract.abi) {
        for (const item of contract.abi) {
          if (
            item.type === 'function' &&
            (item.name === 'implementation' || item.name === 'upgradeTo' || item.name === 'upgradeToAndCall')
          ) {
            isProxy = true;
            break;
          }
        }
      }

      if (isProxy) {
        proxies.push(contract);
      } else {
        // Simple heuristic: if bytecode is small, might be a proxy
        if (contract.bytecodeHash && contract.sources.reduce((sum, s) => sum + s.content.length, 0) < 1000) {
          proxies.push(contract);
        } else {
          implementations.push(contract);
        }
      }
    }

    return { proxies, implementations, unmapped };
  }

  /**
   * Sort contracts by preference (for deterministic output)
   */
  sortByPreference(contracts: ContractMetadata[]): ContractMetadata[] {
    return contracts.sort((a, b) => {
      // 1. Prefer Sourcify full matches
      if (a.verifiedBy === 'sourcify_full' && b.verifiedBy !== 'sourcify_full') return -1;
      if (b.verifiedBy === 'sourcify_full' && a.verifiedBy !== 'sourcify_full') return 1;

      // 2. Prefer higher completeness score
      const scoreA = this.scoreCompleteness(a);
      const scoreB = this.scoreCompleteness(b);
      if (scoreA !== scoreB) return scoreB - scoreA;

      // 3. Prefer more recent
      const timeA = a.timestamps.verifiedAt || a.timestamps.collectedAt;
      const timeB = b.timestamps.verifiedAt || b.timestamps.collectedAt;
      return new Date(timeB).getTime() - new Date(timeA).getTime();
    });
  }
}

/**
 * Helper to merge multiple contract lists and deduplicate
 */
export function mergeAndDeduplicate(
  ...contractLists: ContractMetadata[][]
): ContractMetadata[] {
  const normalizer = new DataNormalizer();
  const merged = contractLists.flat();
  return normalizer.deduplicate(merged);
}
