import { Injectable } from '@nestjs/common'
import { HealthOperationLogger } from '@/common/logging/loggers'
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus'
import { exec } from 'child_process'
import { readFileSync } from 'fs'
import { join } from 'path'

const ECO_ROUTES_PACKAGE_NAME = '@eco-foundation/routes-ts'
@Injectable()
export class GitCommitHealthIndicator extends HealthIndicator {
  private logger = new HealthOperationLogger('GitCommitHealthIndicator')
  constructor() {
    super()
  }

  async gitCommit(): Promise<HealthIndicatorResult> {
    const npmLib = this.getDependencyVersion(ECO_ROUTES_PACKAGE_NAME)
    return this.getStatus('git-commit', !!npmLib, {
      commitHash: await this.getCommitHash(),
      ecoRoutesVersion: npmLib,
    })
  }

  private async getCommitHash(): Promise<string> {
    return new Promise((resolve, reject) => {
      exec('git rev-parse HEAD', (error, stdout) => {
        if (error) {
          reject(error)
        } else {
          resolve(stdout.trim())
        }
      })
    })
  }

  private getDependencyVersion(
    dependencyName: string,
  ): { version: string; npm: string } | undefined {
    try {
      // Path to the project's package.json file
      const packageJsonPath = join(process.cwd(), 'package.json')

      // Read and parse the package.json file
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

      // Check dependencies and devDependencies for the specified dependency
      const version =
        packageJson.dependencies?.[dependencyName] ||
        packageJson.devDependencies?.[dependencyName] ||
        'undefined'
      return {
        version,
        npm: `https://www.npmjs.com/package/${dependencyName}/v/${version.replace('^', '')}?activeTab=code`,
      }
    } catch (error) {
      this.logger.error(
        {
          healthCheck: 'git-commit',
          status: 'unhealthy',
        },
        'Error reading package.json',
        error as Error,
      )
      return undefined // Return undefined if there is an error
    }
  }
}
