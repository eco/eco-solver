/**
 * Global teardown for E2E tests using Docker Compose
 *
 * This teardown assumes all services are managed by docker-compose.
 * No services are stopped - docker-compose handles cleanup.
 */
export default async function globalTeardownCompose(): Promise<void> {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║          E2E Environment Teardown (Compose Mode)          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  console.log('📦 All services managed by docker-compose');
  console.log('  No cleanup needed - docker-compose handles service lifecycle');

  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║          E2E Environment Teardown Complete                ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  console.log('Run "docker-compose -f docker-compose.e2e.yml down" to stop services');
  console.log('');
}
