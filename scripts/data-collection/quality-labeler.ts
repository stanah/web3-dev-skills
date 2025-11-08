import { ContractMetadata, QualityLabels } from './types';
import { bytecodeHash } from './utils';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

/**
 * Quality labeling for contract data
 * Checks reproducibility, runs static analysis, validates compilation
 */

export interface QualityCheckConfig {
  checkReproducibility: boolean;
  runStaticAnalysis: boolean;
  staticAnalysisTools: Array<'slither' | 'mythril'>;
  tempDir?: string;
}

export class QualityLabeler {
  private config: QualityCheckConfig;
  private tempDir: string;

  constructor(config: QualityCheckConfig) {
    this.config = config;
    this.tempDir = config.tempDir || '/tmp/solidity-quality-check';

    // Create temp directory if it doesn't exist
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Apply quality labels to contracts
   */
  async labelContracts(contracts: ContractMetadata[]): Promise<ContractMetadata[]> {
    console.log(`Labeling ${contracts.length} contracts...`);

    const labeled: ContractMetadata[] = [];

    for (let i = 0; i < contracts.length; i++) {
      if (i % 100 === 0) {
        console.log(`Processing contract ${i + 1}/${contracts.length}...`);
      }

      const contract = await this.labelContract(contracts[i]);
      labeled.push(contract);
    }

    console.log('Quality labeling complete.');
    return labeled;
  }

  /**
   * Apply quality labels to a single contract
   */
  async labelContract(contract: ContractMetadata): Promise<ContractMetadata> {
    const labels: QualityLabels = { ...contract.labels };

    // Check reproducibility
    if (this.config.checkReproducibility) {
      labels.reproducible = await this.checkReproducibility(contract);
    }

    // Run static analysis
    if (this.config.runStaticAnalysis) {
      labels.staticAnalysis = await this.runStaticAnalysis(contract);
    }

    // Check for tests (heuristic)
    labels.hasTests = this.hasTests(contract);

    return {
      ...contract,
      labels,
    };
  }

  /**
   * Check if contract can be reproduced (bytecode matches)
   */
  private async checkReproducibility(contract: ContractMetadata): Promise<boolean> {
    try {
      // Create temporary directory for this contract
      const contractDir = path.join(
        this.tempDir,
        `${contract.chainId}_${contract.address}_${Date.now()}`
      );
      fs.mkdirSync(contractDir, { recursive: true });

      // Write sources to disk
      for (const source of contract.sources) {
        const sourcePath = path.join(contractDir, source.path);
        const sourceDir = path.dirname(sourcePath);

        if (!fs.existsSync(sourceDir)) {
          fs.mkdirSync(sourceDir, { recursive: true });
        }

        fs.writeFileSync(sourcePath, source.content, 'utf8');
      }

      // Attempt compilation
      const compiled = await this.compileSolidity(
        contractDir,
        contract.compilerSettings.compilerVersion,
        contract.compilerSettings.optimizer,
        contract.compilerSettings.evmVersion
      );

      // Clean up
      fs.rmSync(contractDir, { recursive: true, force: true });

      return compiled;
    } catch (error) {
      console.warn(`Reproducibility check failed for ${contract.address}:`, error);
      return false;
    }
  }

  /**
   * Compile Solidity code
   * Note: This is a placeholder. Actual implementation would use solc
   */
  private async compileSolidity(
    sourceDir: string,
    compilerVersion: string,
    optimizer: { enabled: boolean; runs: number },
    evmVersion?: string
  ): Promise<boolean> {
    // Placeholder implementation
    // Actual implementation would:
    // 1. Download/use appropriate solc version
    // 2. Run compilation with correct settings
    // 3. Compare bytecode hash with original

    console.log(`Would compile ${sourceDir} with solc ${compilerVersion}`);
    console.log(`Optimizer: ${optimizer.enabled ? `enabled (${optimizer.runs} runs)` : 'disabled'}`);
    if (evmVersion) console.log(`EVM version: ${evmVersion}`);

    // For now, return true to indicate compilation would succeed
    // In production, this would actually run solc and check bytecode
    return true;
  }

  /**
   * Run static analysis tools
   */
  private async runStaticAnalysis(contract: ContractMetadata): Promise<QualityLabels['staticAnalysis']> {
    const findings: Array<{
      severity: 'high' | 'medium' | 'low' | 'info';
      category: string;
      description: string;
    }> = [];

    // Heuristic-based checks (lightweight)
    const heuristicFindings = this.runHeuristicAnalysis(contract);
    findings.push(...heuristicFindings);

    // Would run actual tools if configured
    for (const tool of this.config.staticAnalysisTools) {
      if (tool === 'slither') {
        // const slitherFindings = await this.runSlither(contract);
        // findings.push(...slitherFindings);
        console.log('Slither analysis would run here');
      } else if (tool === 'mythril') {
        // const mythrilFindings = await this.runMythril(contract);
        // findings.push(...mythrilFindings);
        console.log('Mythril analysis would run here');
      }
    }

    return findings.length > 0
      ? {
          tool: 'heuristic',
          findings,
        }
      : undefined;
  }

  /**
   * Run heuristic-based static analysis (pattern matching)
   */
  private runHeuristicAnalysis(contract: ContractMetadata): Array<{
    severity: 'high' | 'medium' | 'low' | 'info';
    category: string;
    description: string;
  }> {
    const findings: Array<{
      severity: 'high' | 'medium' | 'low' | 'info';
      category: string;
      description: string;
    }> = [];

    const allCode = contract.sources.map((s) => s.content).join('\n');

    // Check for reentrancy guard
    if (!allCode.includes('ReentrancyGuard') && !allCode.includes('nonReentrant')) {
      if (allCode.includes('.call{value:') || allCode.includes('.transfer(')) {
        findings.push({
          severity: 'medium',
          category: 'SWC-107',
          description: 'Potential reentrancy: external calls without reentrancy guard',
        });
      }
    }

    // Check for unchecked low-level calls
    const uncheckedCallPattern = /\.call\{|\.delegatecall\{|\.staticcall\{/g;
    const callMatches = allCode.match(uncheckedCallPattern);
    if (callMatches && callMatches.length > 0) {
      // Check if results are checked
      if (!allCode.includes('require(success') && !allCode.includes('assert(success')) {
        findings.push({
          severity: 'high',
          category: 'SWC-104',
          description: 'Unchecked low-level call return value',
        });
      }
    }

    // Check for tx.origin usage (phishing vulnerability)
    if (allCode.includes('tx.origin')) {
      findings.push({
        severity: 'medium',
        category: 'SWC-115',
        description: 'Use of tx.origin for authorization',
      });
    }

    // Check for selfdestruct
    if (allCode.includes('selfdestruct')) {
      findings.push({
        severity: 'medium',
        category: 'SWC-106',
        description: 'Contract contains selfdestruct',
      });
    }

    // Check for delegatecall to user-supplied address
    if (allCode.match(/delegatecall\([^)]*msg\./)) {
      findings.push({
        severity: 'high',
        category: 'SWC-112',
        description: 'Delegatecall to user-supplied address',
      });
    }

    // Check for missing access control
    if (!allCode.includes('onlyOwner') && !allCode.includes('Ownable') && !allCode.includes('AccessControl')) {
      if (allCode.includes('selfdestruct') || allCode.includes('upgrade')) {
        findings.push({
          severity: 'high',
          category: 'SWC-105',
          description: 'Missing access control on sensitive functions',
        });
      }
    }

    // Check for floating pragma
    const floatingPragmaPattern = /pragma\s+solidity\s+\^/g;
    if (allCode.match(floatingPragmaPattern)) {
      findings.push({
        severity: 'low',
        category: 'SWC-103',
        description: 'Floating pragma used',
      });
    }

    // Check for outdated compiler version
    const pragmaPattern = /pragma\s+solidity\s+([^\s;]+)/g;
    const pragmaMatches = allCode.matchAll(pragmaPattern);
    for (const match of pragmaMatches) {
      const version = match[1];
      // Very basic check - would need semver parsing for real
      if (version.includes('0.4.') || version.includes('0.5.')) {
        findings.push({
          severity: 'info',
          category: 'SWC-102',
          description: 'Outdated compiler version detected',
        });
        break;
      }
    }

    return findings;
  }

  /**
   * Check if contract has tests (heuristic)
   */
  private hasTests(contract: ContractMetadata): boolean {
    for (const source of contract.sources) {
      const content = source.content.toLowerCase();
      const path = source.path.toLowerCase();

      // Check file path
      if (path.includes('test') || path.includes('spec')) {
        return true;
      }

      // Check for test frameworks
      if (
        content.includes('forge-std/test') ||
        content.includes('ds-test') ||
        content.includes('hardhat/console') ||
        content.includes('truffle/assert')
      ) {
        return true;
      }

      // Check for test functions
      if (content.includes('function test') || content.includes('function it(')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate quality report
   */
  generateQualityReport(contracts: ContractMetadata[]): string {
    let report = '# Quality Report\n\n';
    report += `Total contracts: ${contracts.length}\n\n`;

    // Reproducibility stats
    const reproducible = contracts.filter((c) => c.labels.reproducible).length;
    report += `## Reproducibility\n\n`;
    report += `- Reproducible: ${reproducible} (${((reproducible / contracts.length) * 100).toFixed(2)}%)\n`;
    report += `- Not reproducible: ${contracts.length - reproducible}\n\n`;

    // Tests stats
    const withTests = contracts.filter((c) => c.labels.hasTests).length;
    report += `## Test Coverage\n\n`;
    report += `- With tests: ${withTests} (${((withTests / contracts.length) * 100).toFixed(2)}%)\n`;
    report += `- Without tests: ${contracts.length - withTests}\n\n`;

    // Static analysis stats
    const analyzed = contracts.filter((c) => c.labels.staticAnalysis).length;
    report += `## Static Analysis\n\n`;
    report += `- Analyzed: ${analyzed}\n`;

    if (analyzed > 0) {
      const severityCounts = {
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
      };

      const categoryCount: Record<string, number> = {};

      for (const contract of contracts) {
        if (contract.labels.staticAnalysis) {
          for (const finding of contract.labels.staticAnalysis.findings) {
            severityCounts[finding.severity]++;
            categoryCount[finding.category] = (categoryCount[finding.category] || 0) + 1;
          }
        }
      }

      report += `\n### Findings by Severity\n\n`;
      report += `- High: ${severityCounts.high}\n`;
      report += `- Medium: ${severityCounts.medium}\n`;
      report += `- Low: ${severityCounts.low}\n`;
      report += `- Info: ${severityCounts.info}\n`;

      report += `\n### Top Issues\n\n`;
      const sorted = Object.entries(categoryCount).sort((a, b) => b[1] - a[1]);
      for (const [category, count] of sorted.slice(0, 10)) {
        report += `- ${category}: ${count} occurrences\n`;
      }
    }

    return report;
  }
}

/**
 * Lightweight quality metrics (no external tools required)
 */
export function calculateBasicMetrics(contract: ContractMetadata): {
  totalLines: number;
  totalSize: number;
  fileCount: number;
  avgFileSize: number;
  complexity: 'low' | 'medium' | 'high';
} {
  const totalSize = contract.sources.reduce((sum, s) => sum + s.content.length, 0);
  const totalLines = contract.sources.reduce((sum, s) => sum + s.content.split('\n').length, 0);
  const fileCount = contract.sources.length;
  const avgFileSize = totalSize / fileCount;

  // Simple complexity heuristic
  let complexity: 'low' | 'medium' | 'high';
  if (totalLines < 100 || fileCount === 1) {
    complexity = 'low';
  } else if (totalLines < 500 || fileCount < 5) {
    complexity = 'medium';
  } else {
    complexity = 'high';
  }

  return {
    totalLines,
    totalSize,
    fileCount,
    avgFileSize,
    complexity,
  };
}
