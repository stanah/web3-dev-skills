#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import {
  DataCollectionPipeline,
  loadConfig,
  createDefaultConfig,
} from './data-collection/pipeline';
import { generateBigQueryQueries } from './data-collection/bigquery-extractor';
import type { PipelineConfig } from './data-collection/types';

/**
 * CLI for Solidity/Web3 training data collection
 */

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .scriptName('data-collection')
    .usage('$0 <command> [options]')
    .command(
      'run [config]',
      'Run the data collection pipeline',
      (yargs) => {
        return yargs.positional('config', {
          describe: 'Path to configuration file',
          type: 'string',
          default: './data-collection-config.json',
        });
      },
      async (argv) => {
        await runPipeline(argv.config as string);
      }
    )
    .command(
      'init [output]',
      'Initialize a new configuration file',
      (yargs) => {
        return yargs
          .positional('output', {
            describe: 'Path to output configuration file',
            type: 'string',
            default: './data-collection-config.json',
          })
          .option('overwrite', {
            alias: 'o',
            describe: 'Overwrite existing configuration',
            type: 'boolean',
            default: false,
          });
      },
      async (argv) => {
        await initConfig(argv.output as string, argv.overwrite as boolean);
      }
    )
    .command(
      'bigquery:queries [output]',
      'Generate BigQuery SQL queries',
      (yargs) => {
        return yargs
          .positional('output', {
            describe: 'Path to output directory for SQL files',
            type: 'string',
            default: './bigquery-queries',
          })
          .option('max-results', {
            alias: 'm',
            describe: 'Maximum results per query',
            type: 'number',
            default: 10000,
          });
      },
      async (argv) => {
        await generateQueries(argv.output as string, argv['max-results'] as number);
      }
    )
    .command(
      'validate [config]',
      'Validate a configuration file',
      (yargs) => {
        return yargs.positional('config', {
          describe: 'Path to configuration file',
          type: 'string',
          default: './data-collection-config.json',
        });
      },
      async (argv) => {
        await validateConfig(argv.config as string);
      }
    )
    .demandCommand(1, 'You must specify a command')
    .help()
    .alias('h', 'help')
    .version()
    .alias('v', 'version')
    .parse();
}

/**
 * Run the data collection pipeline
 */
async function runPipeline(configPath: string): Promise<void> {
  console.log(`Loading configuration from ${configPath}...`);

  if (!fs.existsSync(configPath)) {
    console.error(`Configuration file not found: ${configPath}`);
    console.log('\nRun "data-collection init" to create a default configuration.');
    process.exit(1);
  }

  try {
    const config = loadConfig(configPath);
    console.log('Configuration loaded successfully.\n');

    const pipeline = new DataCollectionPipeline(config);
    await pipeline.run();

    console.log('\n✓ Pipeline completed successfully!');
  } catch (error) {
    console.error('\n✗ Pipeline failed:', error);
    process.exit(1);
  }
}

/**
 * Initialize a new configuration file
 */
async function initConfig(outputPath: string, overwrite: boolean): Promise<void> {
  if (fs.existsSync(outputPath) && !overwrite) {
    console.error(`Configuration file already exists: ${outputPath}`);
    console.log('Use --overwrite to replace it.');
    process.exit(1);
  }

  const config = createDefaultConfig();

  // Create directory if needed
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(config, null, 2), 'utf8');

  console.log(`✓ Configuration file created: ${outputPath}`);
  console.log('\nNext steps:');
  console.log('1. Edit the configuration to match your needs');
  console.log('2. Add API keys if using Etherscan');
  console.log('3. Configure BigQuery project ID if using BigQuery');
  console.log('4. Run: data-collection run');
}

/**
 * Generate BigQuery SQL queries
 */
async function generateQueries(outputDir: string, maxResults: number): Promise<void> {
  console.log(`Generating BigQuery queries (max ${maxResults} results)...`);

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const queries = generateBigQueryQueries({ maxResults });

  for (const [name, query] of Object.entries(queries)) {
    const filename = `${name}.sql`;
    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, query, 'utf8');
    console.log(`✓ Generated ${filename}`);
  }

  // Create README
  const readme = `# BigQuery Queries for Contract Discovery

This directory contains SQL queries for extracting contract candidates from Google Cloud BigQuery.

## Usage

1. Set up Google Cloud account and enable BigQuery API
2. Go to [BigQuery Console](https://console.cloud.google.com/bigquery)
3. Copy and paste a query from this directory
4. Run the query
5. Export results as CSV or JSON
6. Use the addresses in the results with Etherscan fetcher

## Queries

${Object.keys(queries)
  .map((name) => `- \`${name}.sql\`: ${getQueryDescription(name)}`)
  .join('\n')}

## Notes

- These queries use the public \`bigquery-public-data.crypto_ethereum\` dataset
- Query costs depend on data scanned (usually a few cents per query)
- Results can be combined with the data collection pipeline
- Export format should be compatible with the Etherscan fetcher address list
`;

  fs.writeFileSync(path.join(outputDir, 'README.md'), readme, 'utf8');

  console.log(`\n✓ Queries generated in ${outputDir}`);
  console.log('\nSee README.md for usage instructions.');
}

/**
 * Get description for a query
 */
function getQueryDescription(name: string): string {
  const descriptions: Record<string, string> = {
    recentContracts_30days: 'Contracts created in last 30 days',
    recentContracts_90days: 'Contracts created in last 90 days',
    mostActiveContracts: 'Contracts with most transactions',
    popularContracts: 'Contracts with most unique callers',
    erc20Contracts: 'ERC20 token contracts',
    erc721Contracts: 'ERC721 NFT contracts',
    defiContracts: 'DeFi protocol contracts',
  };

  return descriptions[name] || 'Contract candidates';
}

/**
 * Validate a configuration file
 */
async function validateConfig(configPath: string): Promise<void> {
  console.log(`Validating configuration: ${configPath}`);

  if (!fs.existsSync(configPath)) {
    console.error(`✗ Configuration file not found: ${configPath}`);
    process.exit(1);
  }

  try {
    const config: PipelineConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate sourcify
    if (config.sourcify.enabled) {
      if (!config.sourcify.chains || config.sourcify.chains.length === 0) {
        warnings.push('Sourcify: No chains configured');
      }
    }

    // Validate blockscout
    if (config.blockscout.enabled) {
      if (!config.blockscout.instances || config.blockscout.instances.length === 0) {
        warnings.push('Blockscout: No instances configured');
      }
    }

    // Validate etherscan
    if (config.etherscan.enabled) {
      if (!config.etherscan.instances || config.etherscan.instances.length === 0) {
        errors.push('Etherscan: No instances configured');
      }

      for (const instance of config.etherscan.instances || []) {
        if (!instance.apiKey) {
          warnings.push(`Etherscan (${instance.name}): No API key configured`);
        }
      }
    }

    // Validate bigquery
    if (config.bigquery.enabled) {
      if (!config.bigquery.projectId) {
        errors.push('BigQuery: No project ID configured');
      }
    }

    // Validate output
    if (!config.output.directory) {
      errors.push('Output: No directory specified');
    }

    // Validate filters
    if (!config.filters.allowedLicenses || config.filters.allowedLicenses.length === 0) {
      warnings.push('Filters: No allowed licenses specified');
    }

    // Check if at least one source is enabled
    const sourcesEnabled = [
      config.sourcify.enabled,
      config.blockscout.enabled,
      config.etherscan.enabled,
    ].some((enabled) => enabled);

    if (!sourcesEnabled) {
      errors.push('No data sources enabled');
    }

    // Print results
    if (errors.length === 0 && warnings.length === 0) {
      console.log('✓ Configuration is valid\n');
      printConfigSummary(config);
    } else {
      if (errors.length > 0) {
        console.log('\n✗ Errors:');
        errors.forEach((error) => console.log(`  - ${error}`));
      }

      if (warnings.length > 0) {
        console.log('\n⚠ Warnings:');
        warnings.forEach((warning) => console.log(`  - ${warning}`));
      }

      if (errors.length > 0) {
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('✗ Invalid JSON:', error);
    process.exit(1);
  }
}

/**
 * Print configuration summary
 */
function printConfigSummary(config: PipelineConfig): void {
  console.log('Configuration Summary:');
  console.log('━'.repeat(50));

  console.log('\nData Sources:');
  console.log(`  Sourcify: ${config.sourcify.enabled ? '✓' : '✗'}`);
  if (config.sourcify.enabled) {
    console.log(`    Chains: ${config.sourcify.chains.join(', ')}`);
  }

  console.log(`  Blockscout: ${config.blockscout.enabled ? '✓' : '✗'}`);
  if (config.blockscout.enabled) {
    console.log(`    Instances: ${config.blockscout.instances.length}`);
  }

  console.log(`  Etherscan: ${config.etherscan.enabled ? '✓' : '✗'}`);
  if (config.etherscan.enabled) {
    console.log(`    Instances: ${config.etherscan.instances.length}`);
  }

  console.log(`  BigQuery: ${config.bigquery.enabled ? '✓' : '✗'}`);

  console.log('\nOutput:');
  console.log(`  Directory: ${config.output.directory}`);
  console.log(`  Format: ${config.output.format}`);
  console.log(`  Split by license: ${config.output.splitByLicense ? '✓' : '✗'}`);
  console.log(`  Split by chain: ${config.output.splitByChain ? '✓' : '✗'}`);

  console.log('\nFilters:');
  console.log(`  Allowed licenses: ${config.filters.allowedLicenses.join(', ')}`);
  console.log(`  Require ABI: ${config.filters.requireABI ? '✓' : '✗'}`);

  console.log('\nQuality Checks:');
  console.log(`  Reproducibility: ${config.quality.checkReproducibility ? '✓' : '✗'}`);
  console.log(`  Static analysis: ${config.quality.runStaticAnalysis ? '✓' : '✗'}`);

  console.log('━'.repeat(50));
}

// Run CLI
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
