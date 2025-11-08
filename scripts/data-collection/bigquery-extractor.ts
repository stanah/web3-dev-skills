import { PipelineConfig } from './types';

/**
 * BigQuery candidate extractor
 * Extracts contract addresses from Google Cloud BigQuery public datasets
 *
 * Note: This module provides query templates and helpers.
 * Actual BigQuery execution requires @google-cloud/bigquery package and authentication.
 * For production use, install: npm install @google-cloud/bigquery
 */

export interface BigQueryCandidate {
  address: string;
  chainId: number;
  transactionCount?: number;
  firstSeen?: string;
  lastSeen?: string;
  creationTx?: string;
  deployer?: string;
}

/**
 * Query templates for extracting contract candidates
 */
export const QUERY_TEMPLATES = {
  /**
   * Recent contracts (last N days)
   */
  recentContracts: (days: number, limit: number) => `
    SELECT
      receipt_contract_address AS address,
      MIN(block_timestamp) AS first_seen,
      MAX(block_timestamp) AS last_seen,
      COUNT(*) AS transaction_count,
      ANY_VALUE(from_address) AS deployer,
      ANY_VALUE(hash) AS creation_tx
    FROM \`bigquery-public-data.crypto_ethereum.transactions\`
    WHERE DATE(block_timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY)
      AND receipt_contract_address IS NOT NULL
    GROUP BY address
    ORDER BY transaction_count DESC
    LIMIT ${limit}
  `,

  /**
   * Most active contracts (by transaction count)
   */
  mostActiveContracts: (limit: number) => `
    SELECT
      to_address AS address,
      COUNT(*) AS transaction_count,
      MIN(block_timestamp) AS first_seen,
      MAX(block_timestamp) AS last_seen
    FROM \`bigquery-public-data.crypto_ethereum.transactions\`
    WHERE to_address IS NOT NULL
      AND receipt_status = 1
    GROUP BY address
    HAVING transaction_count > 100
    ORDER BY transaction_count DESC
    LIMIT ${limit}
  `,

  /**
   * Contracts with most unique callers (indicates popular/important contracts)
   */
  popularContracts: (limit: number) => `
    SELECT
      to_address AS address,
      COUNT(DISTINCT from_address) AS unique_callers,
      COUNT(*) AS transaction_count,
      MIN(block_timestamp) AS first_seen,
      MAX(block_timestamp) AS last_seen
    FROM \`bigquery-public-data.crypto_ethereum.transactions\`
    WHERE to_address IS NOT NULL
      AND receipt_status = 1
    GROUP BY address
    HAVING unique_callers > 10
    ORDER BY unique_callers DESC
    LIMIT ${limit}
  `,

  /**
   * Contracts by creation date range
   */
  contractsByDateRange: (startDate: string, endDate: string, limit: number) => `
    SELECT
      receipt_contract_address AS address,
      block_timestamp AS first_seen,
      from_address AS deployer,
      hash AS creation_tx
    FROM \`bigquery-public-data.crypto_ethereum.transactions\`
    WHERE DATE(block_timestamp) BETWEEN '${startDate}' AND '${endDate}'
      AND receipt_contract_address IS NOT NULL
    ORDER BY block_timestamp DESC
    LIMIT ${limit}
  `,

  /**
   * ERC20 token contracts (by Transfer event)
   */
  erc20Contracts: (limit: number) => `
    SELECT DISTINCT
      address,
      MIN(block_timestamp) AS first_seen,
      COUNT(*) AS transfer_count
    FROM \`bigquery-public-data.crypto_ethereum.logs\`
    WHERE topics[SAFE_OFFSET(0)] = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
    GROUP BY address
    ORDER BY transfer_count DESC
    LIMIT ${limit}
  `,

  /**
   * ERC721 NFT contracts
   */
  erc721Contracts: (limit: number) => `
    SELECT DISTINCT
      address,
      MIN(block_timestamp) AS first_seen,
      COUNT(*) AS transfer_count
    FROM \`bigquery-public-data.crypto_ethereum.logs\`
    WHERE topics[SAFE_OFFSET(0)] = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
      AND ARRAY_LENGTH(topics) = 4  -- ERC721 has 3 indexed parameters (from, to, tokenId)
    GROUP BY address
    ORDER BY transfer_count DESC
    LIMIT ${limit}
  `,

  /**
   * DeFi contracts (by common DeFi event signatures)
   */
  defiContracts: (limit: number) => `
    SELECT DISTINCT
      address,
      MIN(block_timestamp) AS first_seen,
      COUNT(*) AS event_count
    FROM \`bigquery-public-data.crypto_ethereum.logs\`
    WHERE topics[SAFE_OFFSET(0)] IN (
      '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822',  -- Swap (Uniswap V2)
      '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67',  -- Swap (Uniswap V3)
      '0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1'   -- Sync (Uniswap V2)
    )
    GROUP BY address
    ORDER BY event_count DESC
    LIMIT ${limit}
  `,

  /**
   * Custom query template (allows user-defined WHERE and ORDER BY clauses)
   */
  custom: (whereClause: string, orderBy: string, limit: number) => `
    SELECT
      to_address AS address,
      MIN(block_timestamp) AS first_seen,
      MAX(block_timestamp) AS last_seen,
      COUNT(*) AS transaction_count
    FROM \`bigquery-public-data.crypto_ethereum.transactions\`
    WHERE ${whereClause}
    GROUP BY address
    ORDER BY ${orderBy}
    LIMIT ${limit}
  `,
};

/**
 * BigQuery extractor class (placeholder for actual BigQuery integration)
 */
export class BigQueryExtractor {
  private projectId?: string;
  private maxResults: number;
  private enabled: boolean;

  constructor(config: PipelineConfig['bigquery']) {
    this.projectId = config.projectId;
    this.maxResults = config.maxResults || 10000;
    this.enabled = config.enabled;
  }

  /**
   * Check if BigQuery is properly configured
   */
  isConfigured(): boolean {
    return this.enabled && !!this.projectId;
  }

  /**
   * Get query for recent contracts
   */
  getRecentContractsQuery(days: number = 30): string {
    return QUERY_TEMPLATES.recentContracts(days, this.maxResults);
  }

  /**
   * Get query for most active contracts
   */
  getMostActiveContractsQuery(): string {
    return QUERY_TEMPLATES.mostActiveContracts(this.maxResults);
  }

  /**
   * Get query for popular contracts
   */
  getPopularContractsQuery(): string {
    return QUERY_TEMPLATES.popularContracts(this.maxResults);
  }

  /**
   * Get query for ERC20 contracts
   */
  getERC20ContractsQuery(): string {
    return QUERY_TEMPLATES.erc20Contracts(this.maxResults);
  }

  /**
   * Get query for ERC721 contracts
   */
  getERC721ContractsQuery(): string {
    return QUERY_TEMPLATES.erc721Contracts(this.maxResults);
  }

  /**
   * Get query for DeFi contracts
   */
  getDeFiContractsQuery(): string {
    return QUERY_TEMPLATES.defiContracts(this.maxResults);
  }

  /**
   * Get query for contracts by date range
   */
  getContractsByDateRangeQuery(startDate: string, endDate: string): string {
    return QUERY_TEMPLATES.contractsByDateRange(startDate, endDate, this.maxResults);
  }

  /**
   * Execute query and return candidate addresses
   *
   * Note: This is a placeholder. For actual implementation:
   * 1. Install @google-cloud/bigquery
   * 2. Set up Google Cloud authentication
   * 3. Implement actual query execution
   *
   * Example implementation:
   * ```typescript
   * import { BigQuery } from '@google-cloud/bigquery';
   *
   * async executeBigQueryQuery(query: string): Promise<BigQueryCandidate[]> {
   *   const bigquery = new BigQuery({ projectId: this.projectId });
   *   const [rows] = await bigquery.query({ query });
   *   return rows.map(row => ({
   *     address: row.address,
   *     chainId: 1, // Ethereum mainnet
   *     transactionCount: row.transaction_count,
   *     firstSeen: row.first_seen,
   *     lastSeen: row.last_seen,
   *     creationTx: row.creation_tx,
   *     deployer: row.deployer,
   *   }));
   * }
   * ```
   */
  async executeQuery(query: string): Promise<BigQueryCandidate[]> {
    if (!this.isConfigured()) {
      console.warn('BigQuery is not configured. Skipping query execution.');
      return [];
    }

    console.log('BigQuery integration not fully implemented.');
    console.log('Query to execute:');
    console.log(query);
    console.log('\nTo use BigQuery:');
    console.log('1. Install: npm install @google-cloud/bigquery');
    console.log('2. Set up Google Cloud authentication');
    console.log('3. Implement the executeQuery method');

    return [];
  }

  /**
   * Extract candidates using recent contracts strategy
   */
  async extractRecentCandidates(days: number = 30): Promise<BigQueryCandidate[]> {
    const query = this.getRecentContractsQuery(days);
    return this.executeQuery(query);
  }

  /**
   * Extract candidates using most active strategy
   */
  async extractMostActiveCandidates(): Promise<BigQueryCandidate[]> {
    const query = this.getMostActiveContractsQuery();
    return this.executeQuery(query);
  }

  /**
   * Extract candidates using popularity strategy
   */
  async extractPopularCandidates(): Promise<BigQueryCandidate[]> {
    const query = this.getPopularContractsQuery();
    return this.executeQuery(query);
  }

  /**
   * Extract ERC20 token candidates
   */
  async extractERC20Candidates(): Promise<BigQueryCandidate[]> {
    const query = this.getERC20ContractsQuery();
    return this.executeQuery(query);
  }

  /**
   * Extract ERC721 NFT candidates
   */
  async extractERC721Candidates(): Promise<BigQueryCandidate[]> {
    const query = this.getERC721ContractsQuery();
    return this.executeQuery(query);
  }

  /**
   * Extract DeFi contract candidates
   */
  async extractDeFiCandidates(): Promise<BigQueryCandidate[]> {
    const query = this.getDeFiContractsQuery();
    return this.executeQuery(query);
  }

  /**
   * Save query results to file for manual execution
   */
  saveQueryToFile(query: string, filename: string): void {
    // This would save the query to a file for manual execution
    console.log(`Query saved to ${filename}`);
  }
}

/**
 * Export query templates for manual use
 */
export function generateBigQueryQueries(config: { maxResults: number }) {
  return {
    recentContracts_30days: QUERY_TEMPLATES.recentContracts(30, config.maxResults),
    recentContracts_90days: QUERY_TEMPLATES.recentContracts(90, config.maxResults),
    mostActiveContracts: QUERY_TEMPLATES.mostActiveContracts(config.maxResults),
    popularContracts: QUERY_TEMPLATES.popularContracts(config.maxResults),
    erc20Contracts: QUERY_TEMPLATES.erc20Contracts(config.maxResults),
    erc721Contracts: QUERY_TEMPLATES.erc721Contracts(config.maxResults),
    defiContracts: QUERY_TEMPLATES.defiContracts(config.maxResults),
  };
}
