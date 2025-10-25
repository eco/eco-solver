#!/usr/bin/env ts-node
/**
 * Pre-flight check for E2E test environment
 *
 * This script verifies that all required dependencies and services are available
 * before running E2E tests.
 *
 * Usage:
 *   npx ts-node test/e2e/setup/preflight-check.ts
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface Check {
  name: string;
  fn: () => boolean;
  required: boolean;
  errorMessage: string;
}

const checks: Check[] = [
  {
    name: 'Node.js version',
    fn: () => {
      const version = process.version;
      const major = parseInt(version.slice(1).split('.')[0]);
      return major >= 20;
    },
    required: true,
    errorMessage: 'Node.js 20+ is required. Current version: ' + process.version,
  },
  {
    name: 'pnpm installation',
    fn: () => {
      try {
        execSync('which pnpm', { stdio: 'pipe' });
        return true;
      } catch {
        return false;
      }
    },
    required: true,
    errorMessage: 'pnpm is not installed. Run: npm install -g pnpm',
  },
  {
    name: 'Docker availability',
    fn: () => {
      try {
        execSync('docker ps', { stdio: 'pipe' });
        return true;
      } catch {
        return false;
      }
    },
    required: true,
    errorMessage: 'Docker is not running or not accessible. Please start Docker Desktop.',
  },
  {
    name: 'Foundry/Anvil installation',
    fn: () => {
      try {
        execSync('which anvil', { stdio: 'pipe' });
        return true;
      } catch {
        return false;
      }
    },
    required: true,
    errorMessage:
      'Anvil is not installed. Install Foundry: curl -L https://foundry.paradigm.xyz | bash && foundryup',
  },
  {
    name: 'E2E config file exists',
    fn: () => {
      return fs.existsSync(path.join(process.cwd(), 'test', 'config.e2e.yaml'));
    },
    required: true,
    errorMessage: 'test/config.e2e.yaml not found',
  },
  {
    name: 'Jest E2E config exists',
    fn: () => {
      return fs.existsSync(path.join(process.cwd(), 'test', 'jest-e2e.json'));
    },
    required: true,
    errorMessage: 'test/jest-e2e.json not found',
  },
  {
    name: 'node_modules exists',
    fn: () => {
      return fs.existsSync(path.join(process.cwd(), 'node_modules'));
    },
    required: true,
    errorMessage: 'Dependencies not installed. Run: pnpm install',
  },
];

async function runPreflightChecks(): Promise<void> {
  console.log('🚀 Running E2E Test Pre-flight Checks\n');

  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const check of checks) {
    process.stdout.write(`  ${check.name}... `);

    try {
      const result = check.fn();

      if (result) {
        console.log('✅');
        passed++;
      } else {
        console.log(check.required ? '❌' : '⚠️');
        if (check.required) {
          failed++;
          errors.push(`  ❌ ${check.name}: ${check.errorMessage}`);
        }
      }
    } catch (error) {
      console.log(check.required ? '❌' : '⚠️');
      if (check.required) {
        failed++;
        errors.push(`  ❌ ${check.name}: ${check.errorMessage}`);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60) + '\n');

  if (failed > 0) {
    console.log('❌ Pre-flight checks failed:\n');
    errors.forEach((error) => console.log(error));
    console.log('\nPlease fix the above issues before running E2E tests.');
    console.log('See docs/e2e-setup.md for detailed setup instructions.\n');
    process.exit(1);
  }

  console.log('✅ All pre-flight checks passed!');
  console.log('You can now run: pnpm test:e2e\n');
}

// Run checks if executed directly
if (require.main === module) {
  runPreflightChecks().catch((error) => {
    console.error('Pre-flight check failed:', error);
    process.exit(1);
  });
}

export { runPreflightChecks };
