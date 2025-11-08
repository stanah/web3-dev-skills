import * as fs from 'node:fs';
import * as path from 'node:path';
import { ContractMetadata, PipelineConfig, PipelineStats, FetchResult } from './types';
import { SourcifyFetcher } from './sourcify-fetcher';
import { BlockscoutFetcher } from './blockscout-fetcher';
import { EtherscanFetcher } from './etherscan-fetcher';
import { BigQueryExtractor } from './bigquery-extractor';
import { DataNormalizer } from './normalizer';
import { LicenseDetector } from './license-detector';
import { QualityLabeler } from './quality-labeler';

/**
 * Main data collection pipeline orchestrator
 * Coordinates all data fetchers, normalization, filtering, and output
 */

export class DataCollectionPipeline {
  private config: PipelineConfig;
  private sourcifyFetcher?: SourcifyFetcher;
  private blockscoutFetcher?: BlockscoutFetcher;
  private etherscanFetcher?: EtherscanFetcher;
  private bigqueryExtractor?: BigQueryExtractor;
  private normalizer: DataNormalizer;
  private licenseDetector: LicenseDetector;
  private qualityLabeler: QualityLabeler;
  private stats: PipelineStats;

  constructor(config: PipelineConfig) {
    this.config = config;

    // Initialize fetchers
    if (config.sourcify.enabled) {
      this.sourcifyFetcher = new SourcifyFetcher(config.sourcify);
    }

    if (config.blockscout.enabled) {
      this.blockscoutFetcher = new BlockscoutFetcher(config.blockscout);
    }

    if (config.etherscan.enabled) {
      this.etherscanFetcher = new EtherscanFetcher(config.etherscan);
    }

    if (config.bigquery.enabled) {
      this.bigqueryExtractor = new BigQueryExtractor(config.bigquery);
    }

    // Initialize processors
    this.normalizer = new DataNormalizer();
    this.licenseDetector = new LicenseDetector(config.filters);
    this.qualityLabeler = new QualityLabeler(config.quality);

    // Initialize stats
    this.stats = {
      totalFetched: 0,
      successCount: 0,
      errorCount: 0,
      duplicatesRemoved: 0,
      licensedFiltered: 0,
      bySource: {
        sourcify_full: 0,
        sourcify_partial: 0,
        blockscout: 0,
        etherscan: 0,
      },
      byChain: {},
      byLicense: {} as Record<string, number>,
    };
  }

  /**
   * Run the complete pipeline
   */
  async run(): Promise<void> {
    console.log('=== Starting Data Collection Pipeline ===\n');

    // Step 1: Fetch data from all sources
    const allContracts = await this.fetchAllSources();

    if (allContracts.length === 0) {
      console.log('No contracts fetched. Exiting.');
      return;
    }

    console.log(`\nTotal contracts fetched: ${allContracts.length}`);

    // Step 2: Normalize and deduplicate
    console.log('\n=== Step 2: Normalization & Deduplication ===');
    const { unique, stats: dedupeStats } = this.normalizer.normalizeAndDeduplicate(allContracts);
    this.stats.duplicatesRemoved = dedupeStats.duplicates;
    console.log(`Unique contracts: ${unique.length}`);

    // Step 3: License filtering
    console.log('\n=== Step 3: License Filtering ===');
    const { allowed, blocked, researchOnly, stats: licenseStats } = this.licenseDetector.filterByLicense(unique);
    this.stats.licensedFiltered = blocked.length;
    this.stats.byLicense = licenseStats.byLicense;

    console.log(`Allowed for training: ${allowed.length}`);
    console.log(`Research only: ${researchOnly.length}`);
    console.log(`Blocked: ${blocked.length}`);

    // Step 4: Quality labeling
    console.log('\n=== Step 4: Quality Labeling ===');
    const labeled = await this.qualityLabeler.labelContracts(allowed);

    // Step 5: Write output
    console.log('\n=== Step 5: Writing Output ===');
    await this.writeOutput(labeled, researchOnly);

    // Step 6: Generate reports
    console.log('\n=== Step 6: Generating Reports ===');
    await this.generateReports(labeled, researchOnly);

    console.log('\n=== Pipeline Complete ===');
    this.printFinalStats();
  }

  /**
   * Fetch data from all configured sources
   */
  private async fetchAllSources(): Promise<ContractMetadata[]> {
    const allContracts: ContractMetadata[] = [];

    // Phase 1: Sourcify (highest priority)
    if (this.sourcifyFetcher) {
      console.log('\n=== Phase 1: Fetching from Sourcify ===');
      const results = await this.sourcifyFetcher.fetchAll();
      const contracts = this.processResults(results, 'sourcify_full');
      allContracts.push(...contracts);
      console.log(`Sourcify: ${contracts.length} contracts`);
    }

    // Phase 2: Blockscout
    if (this.blockscoutFetcher) {
      console.log('\n=== Phase 2: Fetching from Blockscout ===');
      const results = await this.blockscoutFetcher.fetchAll();
      const contracts = this.processResults(results, 'blockscout');
      allContracts.push(...contracts);
      console.log(`Blockscout: ${contracts.length} contracts`);
    }

    // Phase 3: Etherscan (with address candidates)
    if (this.etherscanFetcher && this.bigqueryExtractor) {
      console.log('\n=== Phase 3: Fetching from Etherscan ===');

      // Get candidate addresses from BigQuery
      console.log('Extracting candidates from BigQuery...');
      const candidates = await this.bigqueryExtractor.extractRecentCandidates(30);

      if (candidates.length > 0) {
        console.log(`Found ${candidates.length} candidate addresses`);
        const addresses = candidates.map((c) => c.address);
        const results = await this.etherscanFetcher.fetchByAddresses(addresses);
        const contracts = this.processResults(results, 'etherscan');
        allContracts.push(...contracts);
        console.log(`Etherscan: ${contracts.length} contracts`);
      } else {
        console.log('No BigQuery candidates available, skipping Etherscan fetch');
      }
    }

    return allContracts;
  }

  /**
   * Process fetch results and extract successful contracts
   */
  private processResults(results: FetchResult[], source: string): ContractMetadata[] {
    const contracts: ContractMetadata[] = [];

    for (const result of results) {
      this.stats.totalFetched++;

      if (result.success && result.data) {
        contracts.push(result.data);
        this.stats.successCount++;

        // Update stats
        this.stats.bySource[result.data.verifiedBy]++;
        this.stats.byChain[result.data.chainId] = (this.stats.byChain[result.data.chainId] || 0) + 1;
      } else {
        this.stats.errorCount++;
        if (result.error && !result.error.retryable) {
          console.warn(`Non-retryable error: ${result.error.message}`);
        }
      }
    }

    return contracts;
  }

  /**
   * Write output in configured format
   */
  private async writeOutput(
    allowed: ContractMetadata[],
    researchOnly: ContractMetadata[]
  ): Promise<void> {
    const outputDir = this.config.output.directory;

    // Create output directory
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write allowed contracts
    if (this.config.output.splitByLicense) {
      await this.writeByLicense(allowed, path.join(outputDir, 'training'));
    } else if (this.config.output.splitByChain) {
      await this.writeByChain(allowed, path.join(outputDir, 'training'));
    } else {
      await this.writeContracts(allowed, path.join(outputDir, 'training.jsonl'));
    }

    // Write research-only contracts
    if (researchOnly.length > 0) {
      await this.writeContracts(researchOnly, path.join(outputDir, 'research-only.jsonl'));
    }

    console.log(`Output written to ${outputDir}`);
  }

  /**
   * Write contracts to JSONL file
   */
  private async writeContracts(contracts: ContractMetadata[], filepath: string): Promise<void> {
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const lines = contracts.map((contract) => JSON.stringify(contract));
    fs.writeFileSync(filepath, lines.join('\n'), 'utf8');
    console.log(`Wrote ${contracts.length} contracts to ${filepath}`);
  }

  /**
   * Write contracts split by license
   */
  private async writeByLicense(contracts: ContractMetadata[], baseDir: string): Promise<void> {
    const byLicense = this.licenseDetector.splitByLicense(contracts);

    for (const [license, licenseContracts] of byLicense) {
      const filename = `${license.toLowerCase().replace(/[^a-z0-9]/g, '-')}.jsonl`;
      const filepath = path.join(baseDir, filename);
      await this.writeContracts(licenseContracts, filepath);
    }
  }

  /**
   * Write contracts split by chain
   */
  private async writeByChain(contracts: ContractMetadata[], baseDir: string): Promise<void> {
    const byChain = new Map<number, ContractMetadata[]>();

    for (const contract of contracts) {
      if (!byChain.has(contract.chainId)) {
        byChain.set(contract.chainId, []);
      }
      byChain.get(contract.chainId)!.push(contract);
    }

    for (const [chainId, chainContracts] of byChain) {
      const filename = `chain-${chainId}.jsonl`;
      const filepath = path.join(baseDir, filename);
      await this.writeContracts(chainContracts, filepath);
    }
  }

  /**
   * Generate reports
   */
  private async generateReports(
    allowed: ContractMetadata[],
    researchOnly: ContractMetadata[]
  ): Promise<void> {
    const reportDir = path.join(this.config.output.directory, 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    // License report
    const allContracts = [...allowed, ...researchOnly];
    const licenseReport = this.licenseDetector.generateLicenseReport(allContracts);
    fs.writeFileSync(path.join(reportDir, 'license-report.md'), licenseReport);

    // Quality report
    const qualityReport = this.qualityLabeler.generateQualityReport(allowed);
    fs.writeFileSync(path.join(reportDir, 'quality-report.md'), qualityReport);

    // Pipeline stats
    const statsReport = this.generateStatsReport();
    fs.writeFileSync(path.join(reportDir, 'pipeline-stats.md'), statsReport);

    console.log(`Reports written to ${reportDir}`);
  }

  /**
   * Generate pipeline statistics report
   */
  private generateStatsReport(): string {
    let report = '# Pipeline Statistics\n\n';

    report += `## Overall\n\n`;
    report += `- Total fetched: ${this.stats.totalFetched}\n`;
    report += `- Successful: ${this.stats.successCount}\n`;
    report += `- Errors: ${this.stats.errorCount}\n`;
    report += `- Duplicates removed: ${this.stats.duplicatesRemoved}\n`;
    report += `- License filtered: ${this.stats.licensedFiltered}\n\n`;

    report += `## By Source\n\n`;
    for (const [source, count] of Object.entries(this.stats.bySource)) {
      if (count > 0) {
        report += `- ${source}: ${count}\n`;
      }
    }

    report += `\n## By Chain\n\n`;
    const sortedChains = Object.entries(this.stats.byChain).sort((a, b) => b[1] - a[1]);
    for (const [chainId, count] of sortedChains) {
      report += `- Chain ${chainId}: ${count}\n`;
    }

    report += `\n## By License\n\n`;
    const sortedLicenses = Object.entries(this.stats.byLicense).sort((a, b) => b[1] - a[1]);
    for (const [license, count] of sortedLicenses) {
      report += `- ${license}: ${count}\n`;
    }

    return report;
  }

  /**
   * Print final statistics
   */
  private printFinalStats(): void {
    console.log('\n--- Final Statistics ---');
    console.log(`Total fetched: ${this.stats.totalFetched}`);
    console.log(`Successful: ${this.stats.successCount}`);
    console.log(`Errors: ${this.stats.errorCount}`);
    console.log(`Duplicates removed: ${this.stats.duplicatesRemoved}`);
    console.log(`License filtered: ${this.stats.licensedFiltered}`);
    console.log(`Final unique contracts: ${this.stats.successCount - this.stats.duplicatesRemoved}`);
  }

  /**
   * Get current statistics
   */
  getStats(): PipelineStats {
    return { ...this.stats };
  }
}

/**
 * Load configuration from file
 */
export function loadConfig(configPath: string): PipelineConfig {
  const content = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(content) as PipelineConfig;
}

/**
 * Create default configuration
 */
export function createDefaultConfig(): PipelineConfig {
  return {
    sourcify: {
      enabled: true,
      baseUrl: 'https://sourcify.dev/server',
      chains: [1, 137, 42161, 10, 8453], // Ethereum, Polygon, Arbitrum, Optimism, Base
      fullMatchOnly: true,
    },
    blockscout: {
      enabled: true,
      instances: [
        { chainId: 100, baseUrl: 'https://gnosis.blockscout.com', name: 'Gnosis Chain' },
        { chainId: 42220, baseUrl: 'https://explorer.celo.org', name: 'Celo' },
      ],
      pageSize: 100,
      maxPages: 10,
    },
    etherscan: {
      enabled: false, // Requires API keys
      instances: [
        { chainId: 1, baseUrl: 'https://api.etherscan.io', name: 'Ethereum' },
        { chainId: 137, baseUrl: 'https://api.polygonscan.com', name: 'Polygon' },
      ],
      rateLimit: {
        requestsPerSecond: 5,
        backoffMultiplier: 2,
        maxRetries: 4,
      },
    },
    bigquery: {
      enabled: false, // Requires Google Cloud setup
      maxResults: 10000,
    },
    output: {
      format: 'jsonl',
      directory: './data/solidity-training-data',
      splitByLicense: true,
      splitByChain: false,
    },
    filters: {
      allowedLicenses: ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'Unlicense'],
      requireABI: false,
    },
    quality: {
      checkReproducibility: false, // Requires solc
      runStaticAnalysis: true,
      staticAnalysisTools: [],
    },
  };
}
