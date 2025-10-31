/**
 * Global setup for E2E tests using Docker Compose
 *
 * This setup assumes ALL services are already running via docker-compose:
 * - MongoDB on localhost:27018
 * - Redis on localhost:6380
 * - Anvil Base fork on localhost:8545 (in docker)
 * - Anvil Optimism fork on localhost:9545 (in docker)
 *
 * No services are started - just logs that we're using docker-compose mode.
 */
export default async function globalSetupCompose(): Promise<void> {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║          E2E Test Environment Setup (Compose Mode)        ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  console.log('📦 Using existing docker-compose services:');
  console.log('  ✓ MongoDB on localhost:27018');
  console.log('  ✓ Redis on localhost:6380');
  console.log('  ✓ Anvil Base fork on localhost:8545');
  console.log('  ✓ Anvil Optimism fork on localhost:9545');

  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║          E2E Environment Ready (Compose Mode)             ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  console.log('Note: All services managed by docker-compose');
  console.log('Run "docker-compose -f docker-compose.e2e.yml ps" to verify');
  console.log('');
}
