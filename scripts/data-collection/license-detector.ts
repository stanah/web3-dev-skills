import { ContractMetadata, LicenseType, PipelineConfig } from './types';

/**
 * License detection and filtering
 * Extracts SPDX license identifiers from source files and filters by allowed licenses
 */

export interface LicenseInfo {
  primary: LicenseType;
  all: LicenseType[];
  isPermissive: boolean;
  isCopyleft: boolean;
  allowedForTraining: boolean;
  warnings: string[];
}

/**
 * License categories
 */
export const LICENSE_CATEGORIES = {
  permissive: [
    'MIT',
    'Apache-2.0',
    'BSD-2-Clause',
    'BSD-3-Clause',
    'MPL-2.0',
    'Unlicense',
    'ISC',
    'BSL-1.0',
  ] as LicenseType[],

  copyleft: [
    'GPL-2.0',
    'GPL-3.0',
    'AGPL-3.0',
    'LGPL-2.1',
    'LGPL-3.0',
  ] as LicenseType[],

  // Licenses commonly allowed for ML training
  trainingFriendly: [
    'MIT',
    'Apache-2.0',
    'BSD-2-Clause',
    'BSD-3-Clause',
    'Unlicense',
    'ISC',
  ] as LicenseType[],

  // Licenses that require research-only use
  researchOnly: [
    'GPL-2.0',
    'GPL-3.0',
    'AGPL-3.0',
  ] as LicenseType[],
};

/**
 * SPDX license identifier patterns
 */
const SPDX_PATTERNS = [
  /SPDX-License-Identifier:\s*([A-Za-z0-9\-.]+)/gi,
  /\/\/\s*License:\s*([A-Za-z0-9\-.]+)/gi,
  /\/\*\*?\s*@license\s+([A-Za-z0-9\-.]+)/gi,
];

export class LicenseDetector {
  private allowedLicenses: Set<LicenseType>;
  private strictMode: boolean;

  constructor(config: PipelineConfig['filters']) {
    this.allowedLicenses = new Set(config.allowedLicenses);
    this.strictMode = false; // Could be made configurable
  }

  /**
   * Detect and analyze licenses in a contract
   */
  detectLicense(contract: ContractMetadata): LicenseInfo {
    const licenses = new Set<LicenseType>();
    const warnings: string[] = [];

    // Add the contract's main license
    if (contract.license && contract.license !== 'Unknown') {
      licenses.add(contract.license);
    }

    // Extract licenses from source files
    for (const source of contract.sources) {
      const sourceLicenses = this.extractLicensesFromSource(source.content);
      sourceLicenses.forEach((license) => licenses.add(license));
    }

    // Determine primary license (most restrictive)
    const allLicenses = Array.from(licenses);
    const primary = this.selectPrimaryLicense(allLicenses);

    // Check if permissive or copyleft
    const isPermissive = LICENSE_CATEGORIES.permissive.includes(primary);
    const isCopyleft = LICENSE_CATEGORIES.copyleft.includes(primary);

    // Check if allowed for training
    const allowedForTraining = this.isAllowedForTraining(allLicenses);

    // Add warnings
    if (allLicenses.length > 1) {
      warnings.push(`Multiple licenses detected: ${allLicenses.join(', ')}`);
    }

    if (isCopyleft) {
      warnings.push(`Copyleft license ${primary} - recommend research-only use`);
    }

    if (primary === 'Unknown') {
      warnings.push('License not detected or unrecognized');
    }

    return {
      primary,
      all: allLicenses,
      isPermissive,
      isCopyleft,
      allowedForTraining,
      warnings,
    };
  }

  /**
   * Extract SPDX license identifiers from source code
   */
  private extractLicensesFromSource(content: string): LicenseType[] {
    const licenses: LicenseType[] = [];

    for (const pattern of SPDX_PATTERNS) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const license = this.normalizeLicense(match[1]);
        if (license !== 'Unknown') {
          licenses.push(license);
        }
      }
    }

    return licenses;
  }

  /**
   * Normalize license string to standard LicenseType
   */
  private normalizeLicense(licenseStr: string): LicenseType {
    const normalized = licenseStr.trim();

    // Direct match
    const directMatch = [
      'MIT',
      'Apache-2.0',
      'BSD-2-Clause',
      'BSD-3-Clause',
      'MPL-2.0',
      'Unlicense',
      'GPL-2.0',
      'GPL-3.0',
      'AGPL-3.0',
      'LGPL-2.1',
      'LGPL-3.0',
    ].find((lic) => normalized === lic || normalized === lic.toLowerCase());

    if (directMatch) {
      return directMatch as LicenseType;
    }

    // Fuzzy matching
    const lower = normalized.toLowerCase();

    if (lower.includes('mit')) return 'MIT';
    if (lower.includes('apache')) return 'Apache-2.0';
    if (lower.includes('bsd-2')) return 'BSD-2-Clause';
    if (lower.includes('bsd-3')) return 'BSD-3-Clause';
    if (lower.includes('bsd')) return 'BSD-3-Clause'; // Default to BSD-3
    if (lower.includes('mpl')) return 'MPL-2.0';
    if (lower.includes('unlicense')) return 'Unlicense';
    if (lower.includes('agpl')) return 'AGPL-3.0';
    if (lower.includes('gpl-3') || lower.includes('gplv3')) return 'GPL-3.0';
    if (lower.includes('gpl-2') || lower.includes('gplv2')) return 'GPL-2.0';
    if (lower.includes('lgpl-3')) return 'LGPL-3.0';
    if (lower.includes('lgpl-2')) return 'LGPL-2.1';
    if (lower.includes('proprietary')) return 'Proprietary';

    return 'Unknown';
  }

  /**
   * Select primary (most restrictive) license
   */
  private selectPrimaryLicense(licenses: LicenseType[]): LicenseType {
    if (licenses.length === 0) return 'Unknown';

    // Priority order (most restrictive first)
    const priority: LicenseType[] = [
      'Proprietary',
      'AGPL-3.0',
      'GPL-3.0',
      'GPL-2.0',
      'LGPL-3.0',
      'LGPL-2.1',
      'MPL-2.0',
      'Apache-2.0',
      'BSD-3-Clause',
      'BSD-2-Clause',
      'MIT',
      'Unlicense',
    ];

    for (const license of priority) {
      if (licenses.includes(license)) {
        return license;
      }
    }

    return licenses[0];
  }

  /**
   * Check if contract is allowed for training based on licenses
   */
  private isAllowedForTraining(licenses: LicenseType[]): boolean {
    // If strictMode, ALL licenses must be training-friendly
    if (this.strictMode) {
      return licenses.every((license) => LICENSE_CATEGORIES.trainingFriendly.includes(license));
    }

    // Otherwise, primary license determines
    const primary = this.selectPrimaryLicense(licenses);
    return LICENSE_CATEGORIES.trainingFriendly.includes(primary);
  }

  /**
   * Filter contracts by allowed licenses
   */
  filterByLicense(contracts: ContractMetadata[]): {
    allowed: ContractMetadata[];
    blocked: ContractMetadata[];
    researchOnly: ContractMetadata[];
    stats: {
      total: number;
      allowed: number;
      blocked: number;
      researchOnly: number;
      byLicense: Record<string, number>;
    };
  } {
    const allowed: ContractMetadata[] = [];
    const blocked: ContractMetadata[] = [];
    const researchOnly: ContractMetadata[] = [];
    const byLicense: Record<string, number> = {};

    for (const contract of contracts) {
      const licenseInfo = this.detectLicense(contract);

      // Count by license
      byLicense[licenseInfo.primary] = (byLicense[licenseInfo.primary] || 0) + 1;

      // Filter
      if (licenseInfo.allowedForTraining && this.allowedLicenses.has(licenseInfo.primary)) {
        allowed.push(contract);
      } else if (LICENSE_CATEGORIES.researchOnly.includes(licenseInfo.primary)) {
        researchOnly.push(contract);
      } else {
        blocked.push(contract);
      }
    }

    const stats = {
      total: contracts.length,
      allowed: allowed.length,
      blocked: blocked.length,
      researchOnly: researchOnly.length,
      byLicense,
    };

    console.log('License filtering stats:', stats);

    return { allowed, blocked, researchOnly, stats };
  }

  /**
   * Generate license report
   */
  generateLicenseReport(contracts: ContractMetadata[]): string {
    const licenseCount: Record<string, number> = {};
    const warnings: string[] = [];

    for (const contract of contracts) {
      const licenseInfo = this.detectLicense(contract);

      licenseCount[licenseInfo.primary] = (licenseCount[licenseInfo.primary] || 0) + 1;

      if (licenseInfo.warnings.length > 0) {
        warnings.push(`${contract.address}: ${licenseInfo.warnings.join(', ')}`);
      }
    }

    let report = '# License Report\n\n';
    report += `Total contracts: ${contracts.length}\n\n`;

    report += '## License Distribution\n\n';
    const sorted = Object.entries(licenseCount).sort((a, b) => b[1] - a[1]);
    for (const [license, count] of sorted) {
      const pct = ((count / contracts.length) * 100).toFixed(2);
      const category = LICENSE_CATEGORIES.permissive.includes(license as LicenseType)
        ? '(Permissive)'
        : LICENSE_CATEGORIES.copyleft.includes(license as LicenseType)
        ? '(Copyleft)'
        : '';
      report += `- ${license} ${category}: ${count} (${pct}%)\n`;
    }

    report += '\n## Training Recommendations\n\n';
    report += '### Approved for Training\n';
    for (const license of LICENSE_CATEGORIES.trainingFriendly) {
      if (licenseCount[license]) {
        report += `- ${license}: ${licenseCount[license]} contracts\n`;
      }
    }

    report += '\n### Research Only\n';
    for (const license of LICENSE_CATEGORIES.researchOnly) {
      if (licenseCount[license]) {
        report += `- ${license}: ${licenseCount[license]} contracts\n`;
      }
    }

    if (warnings.length > 0) {
      report += '\n## Warnings\n\n';
      report += warnings.slice(0, 100).join('\n');
      if (warnings.length > 100) {
        report += `\n... and ${warnings.length - 100} more warnings\n`;
      }
    }

    return report;
  }

  /**
   * Split contracts by license category
   */
  splitByLicense(contracts: ContractMetadata[]): Map<LicenseType, ContractMetadata[]> {
    const split = new Map<LicenseType, ContractMetadata[]>();

    for (const contract of contracts) {
      const licenseInfo = this.detectLicense(contract);
      const primary = licenseInfo.primary;

      if (!split.has(primary)) {
        split.set(primary, []);
      }

      split.get(primary)!.push(contract);
    }

    return split;
  }
}
