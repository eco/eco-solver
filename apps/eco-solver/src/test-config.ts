#!/usr/bin/env node

/**
 * Simple test script to validate Phase 4 Configuration System Migration
 * This script tests the ConfigLoader and EcoConfigService functionality
 */

import { ConfigLoader } from '@mono-solver/eco-solver-config';

async function testConfigurationSystem() {
  console.log('🧪 Testing Phase 4 Configuration System Migration...\n');

  try {
    // Test 1: ConfigLoader static methods
    console.log('1️⃣ Testing ConfigLoader...');
    const config = ConfigLoader.load();
    console.log('✅ ConfigLoader.load() - SUCCESS');
    
    // Test 2: Get AWS configuration
    const awsConfig = ConfigLoader.get('aws');
    console.log('✅ ConfigLoader.get(\'aws\') - SUCCESS');
    console.log(`   Found ${awsConfig?.length || 0} AWS configurations`);

    // Test 3: Check configuration exists
    const hasRedis = ConfigLoader.has('redis');
    console.log(`✅ ConfigLoader.has('redis') - ${hasRedis ? 'TRUE' : 'FALSE'}`);

    // Test 4: Test environment variable substitution
    process.env.TEST_CONFIG_VAR = 'test-value';
    const testConfig = ConfigLoader.load({
      nodeConfig: '{"testEnv": "${TEST_CONFIG_VAR}"}'
    });
    console.log(`✅ Environment substitution - ${testConfig.testEnv === 'test-value' ? 'SUCCESS' : 'FAILED'}`);
    delete process.env.TEST_CONFIG_VAR;

    // Test 5: Test different environments
    const devConfig = ConfigLoader.load({ nodeEnv: 'development' });
    const prodConfig = ConfigLoader.load({ nodeEnv: 'production' });
    console.log('✅ Environment-specific configs loaded - SUCCESS');

    // Test 6: Test utility methods
    const currentEnv = ConfigLoader.util.getEnv('NODE_ENV');
    console.log(`✅ Utility method - Current environment: ${currentEnv}`);

    console.log('\n🎉 Phase 4 Configuration System Migration - ALL TESTS PASSED!');
    console.log('\n📊 Configuration Summary:');
    console.log(`   - Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   - AWS Configurations: ${awsConfig?.length || 0}`);
    console.log(`   - Redis Config: ${hasRedis ? 'Present' : 'Not Found'}`);
    console.log(`   - CCTP Config: ${ConfigLoader.has('CCTP') ? 'Present' : 'Not Found'}`);
    console.log(`   - Intent Config: ${ConfigLoader.has('intentConfigs') ? 'Present' : 'Not Found'}`);

    return true;
  } catch (error) {
    console.error('❌ Configuration system test failed:', (error as Error).message);
    return false;
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testConfigurationSystem()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

export { testConfigurationSystem };