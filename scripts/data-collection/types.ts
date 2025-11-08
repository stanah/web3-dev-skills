/**
 * Core types for Solidity/Web3 training data collection pipeline
 */

export interface ContractSource {
  path: string;
  content: string;
  sha256: string;
}

export type VerificationSource =
  | 'sourcify_full'
  | 'sourcify_partial'
  | 'blockscout'
  | 'etherscan';

export type LicenseType =
  | 'MIT'
  | 'Apache-2.0'
  | 'BSD-2-Clause'
  | 'BSD-3-Clause'
  | 'MPL-2.0'
  | 'Unlicense'
  | 'GPL-2.0'
  | 'GPL-3.0'
  | 'AGPL-3.0'
  | 'LGPL-2.1'
  | 'LGPL-3.0'
  | 'Proprietary'
  | 'Unknown';

export interface CompilerSettings {
  compilerVersion: string;
  evmVersion?: string;
  optimizer: {
    enabled: boolean;
    runs: number;
  };
  libraries?: Record<string, string>;
}

export interface QualityLabels {
  reproducible?: boolean;
  passesCompilation?: boolean;
  hasTests?: boolean;
  staticAnalysis?: {
    tool: string;
    findings: Array<{
      severity: 'high' | 'medium' | 'low' | 'info';
      category: string; // SWC-XXX
      description: string;
    }>;
  };
}

export interface ContractMetadata {
  chainId: number;
  address: string;
  creationTx?: string;
  deployer?: string;
  verifiedBy: VerificationSource;
  compilerSettings: CompilerSettings;
  license: LicenseType;
  sources: ContractSource[];
  abi?: any[];
  bytecodeHash: string;
  labels: QualityLabels;
  timestamps: {
    verifiedAt?: string;
    firstSeen?: string;
    lastSeen?: string;
    collectedAt: string;
  };
}

export interface PipelineConfig {
  sourcify: {
    enabled: boolean;
    baseUrl: string;
    chains: number[];
    fullMatchOnly: boolean;
  };
  blockscout: {
    enabled: boolean;
    instances: Array<{
      chainId: number;
      baseUrl: string;
      name: string;
    }>;
    pageSize: number;
    maxPages?: number;
  };
  etherscan: {
    enabled: boolean;
    instances: Array<{
      chainId: number;
      baseUrl: string;
      name: string;
      apiKey?: string;
    }>;
    rateLimit: {
      requestsPerSecond: number;
      backoffMultiplier: number;
      maxRetries: number;
    };
  };
  bigquery: {
    enabled: boolean;
    projectId?: string;
    queryTemplate?: string;
    maxResults: number;
  };
  output: {
    format: 'jsonl' | 'parquet';
    directory: string;
    splitByLicense: boolean;
    splitByChain: boolean;
  };
  filters: {
    allowedLicenses: LicenseType[];
    minSourceSize?: number;
    maxSourceSize?: number;
    requireABI: boolean;
  };
  quality: {
    checkReproducibility: boolean;
    runStaticAnalysis: boolean;
    staticAnalysisTools: Array<'slither' | 'mythril'>;
  };
}

export interface FetchResult {
  success: boolean;
  data?: ContractMetadata;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export interface PipelineStats {
  totalFetched: number;
  successCount: number;
  errorCount: number;
  duplicatesRemoved: number;
  licensedFiltered: number;
  bySource: Record<VerificationSource, number>;
  byChain: Record<number, number>;
  byLicense: Record<LicenseType, number>;
}
