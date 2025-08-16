#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const environments = ['development', 'production', 'test'];
const rootDir = path.resolve(__dirname, '..');

function copyEnvFile(env) {
  const sourceFile = path.join(rootDir, `.env.${env}`);
  const targetFile = path.join(rootDir, '.env');
  
  if (fs.existsSync(sourceFile)) {
    fs.copyFileSync(sourceFile, targetFile);
    console.log(`✅ Copied .env.${env} to .env`);
  } else {
    console.warn(`⚠️  Environment file .env.${env} not found`);
  }
}

function showUsage() {
  console.log(`
Usage: node scripts/setup-env.js [environment]

Environments:
  - development (default)
  - production
  - test

Examples:
  node scripts/setup-env.js development
  node scripts/setup-env.js production
  npm run env:dev
  npm run env:prod
  `);
}

function main() {
  const env = process.argv[2] || 'development';
  
  if (!environments.includes(env)) {
    console.error(`❌ Invalid environment: ${env}`);
    showUsage();
    process.exit(1);
  }
  
  console.log(`🔧 Setting up environment: ${env}`);
  copyEnvFile(env);
  console.log(`🚀 Environment ${env} is ready!`);
}

if (require.main === module) {
  main();
}

module.exports = { copyEnvFile, environments };