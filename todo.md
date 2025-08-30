# Fix Integration Test Issues

## Problem Analysis
The integration test is failing because:
1. **Database Connection Issues**: Test tries to connect to MongoDB and Redis locally, which aren't running
2. **Intent Structure Mismatch**: The intent structure doesn't match the current Intent interface
3. **No Test Environment Isolation**: Test relies on real database connections instead of mocking

## Tasks

### 1. Create Test-Specific Module for Integration Tests
- [ ] Create a test module that configures MongoDB and Redis for testing without real connections
- [ ] Use in-memory databases or properly mock database connections for integration tests

### 2. Update Intent Structure in Test
- [ ] Fix the intent structure to match the current Intent interface (route.source, route.destination, status field)
- [ ] Remove deprecated fields like sourceChainId and destination
- [ ] Add missing required fields like route.inbox

### 3. Improve Test Configuration
- [ ] Update .env.test to use in-memory or mock database configurations
- [ ] Add proper test timeout handling
- [ ] Ensure test cleanup to prevent Jest from hanging

### 4. Fix Database Connection Strategy for Tests
- [ ] Configure test environment to use MongoMemoryServer for MongoDB
- [ ] Use ioredis-mock or similar for Redis in tests
- [ ] Update configuration schema to support test-specific database settings

### 5. Verify Test Execution
- [ ] Run the test again to confirm it passes
- [ ] Ensure proper cleanup and no hanging processes

## Expected Outcome
- Integration test runs without requiring real MongoDB/Redis instances
- Test completes within timeout limits
- Intent structure matches current interface
- Test provides meaningful validation of the fulfillment flow