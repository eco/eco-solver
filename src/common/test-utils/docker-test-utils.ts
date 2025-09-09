import { execSync } from 'child_process'

/**
 * Utility functions for handling Docker availability in tests
 */
export class DockerTestUtils {
  private static dockerAvailable: boolean | null = null
  private static checkPerformed = false

  /**
   * Check if Docker is available and running
   * @returns Promise<boolean> true if Docker is available, false otherwise
   */
  static async isDockerAvailable(): Promise<boolean> {
    if (this.checkPerformed) {
      return this.dockerAvailable ?? false
    }

    try {
      // First check if Docker command exists
      execSync('docker --version', { 
        stdio: 'pipe',
        timeout: 5000 
      })

      // Then check if Docker daemon is running
      execSync('docker info', { 
        stdio: 'pipe',
        timeout: 5000 
      })

      this.dockerAvailable = true
      this.checkPerformed = true
      return true
    } catch (error) {
      this.dockerAvailable = false
      this.checkPerformed = true
      return false
    }
  }

  /**
   * Check if we should skip Docker-dependent tests based on environment or Docker availability
   * @returns Promise<boolean> true if Docker tests should be skipped
   */
  static async shouldSkipDockerTests(): Promise<boolean> {
    // Check environment variables first
    if (process.env.SKIP_DOCKER_TESTS === 'true' || process.env.CI === 'true') {
      return true
    }

    // Then check Docker availability
    return !(await this.isDockerAvailable())
  }

  /**
   * Get a descriptive reason why Docker tests are being skipped
   * @returns Promise<string> reason for skipping
   */
  static async getSkipReason(): Promise<string> {
    if (process.env.SKIP_DOCKER_TESTS === 'true') {
      return 'SKIP_DOCKER_TESTS environment variable is set to true'
    }
    
    if (process.env.CI === 'true') {
      return 'Running in CI environment where Docker may not be available'
    }

    const dockerAvailable = await this.isDockerAvailable()
    if (!dockerAvailable) {
      return 'Docker is not available or not running'
    }

    return 'Unknown reason'
  }

  /**
   * Reset the Docker availability cache (useful for testing)
   */
  static resetCache(): void {
    this.dockerAvailable = null
    this.checkPerformed = false
  }
}