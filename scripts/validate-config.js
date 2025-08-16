#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${description}: ${filePath}`);
    return true;
  } else {
    console.log(`❌ Missing ${description}: ${filePath}`);
    return false;
  }
}

function checkBuild(project) {
  try {
    console.log(`\n🔧 Testing build for ${project}...`);
    execSync(`npx nx build ${project}`, { 
      cwd: rootDir, 
      stdio: 'pipe' 
    });
    console.log(`✅ Build successful: ${project}`);
    return true;
  } catch (error) {
    console.log(`❌ Build failed: ${project}`);
    console.log(error.stdout?.toString() || error.message);
    return false;
  }
}

function validateConfiguration() {
  console.log('🔍 Validating Configuration Migration...\n');
  
  let allValid = true;
  
  console.log('📁 Environment Files:');
  allValid &= checkFile(path.join(rootDir, '.env.development'), 'Development environment');
  allValid &= checkFile(path.join(rootDir, '.env.production'), 'Production environment');
  allValid &= checkFile(path.join(rootDir, '.env.test'), 'Test environment');
  
  console.log('\n📚 Configuration Library:');
  allValid &= checkFile(path.join(rootDir, 'libs/shared-config/src/index.ts'), 'Config library index');
  allValid &= checkFile(path.join(rootDir, 'libs/shared-config/src/lib/config.service.ts'), 'Config service');
  allValid &= checkFile(path.join(rootDir, 'libs/shared-config/project.json'), 'Config project.json');
  
  console.log('\n⚙️  Build Configuration:');
  allValid &= checkFile(path.join(rootDir, 'apps/eco-solver/webpack.config.js'), 'Webpack config');
  allValid &= checkFile(path.join(rootDir, 'apps/eco-solver/project.json'), 'App project.json');
  
  console.log('\n🏗️  Build Tests:');
  allValid &= checkBuild('shared-config');
  allValid &= checkBuild('eco-solver');
  
  console.log('\n' + '='.repeat(50));
  if (allValid) {
    console.log('🎉 Configuration migration completed successfully!');
    console.log('\n📖 Next steps:');
    console.log('   1. Run: npm run env:dev');
    console.log('   2. Run: npx nx serve eco-solver --configuration=development');
    console.log('   3. Test: http://localhost:3000/api');
  } else {
    console.log('❌ Configuration migration has issues. Please review the errors above.');
  }
  
  return allValid;
}

if (require.main === module) {
  const success = validateConfiguration();
  process.exit(success ? 0 : 1);
}

module.exports = { validateConfiguration };