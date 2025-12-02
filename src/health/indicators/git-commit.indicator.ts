import { Injectable, Logger } from '@nestjs/common'
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus'
import { readFileSync } from 'fs'
import { join } from 'path'
import { EcoLogMessage } from '../../common/logging/eco-log-message'

const ECO_ROUTES_PACKAGE_NAME = '@eco-foundation/routes-ts'
@Injectable()
export class GitCommitHealthIndicator extends HealthIndicator {
  private logger = new Logger(GitCommitHealthIndicator.name)
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
    try {
      const commitFile = join(process.cwd(), '.git-commit')
      const hash = readFileSync(commitFile, 'utf-8').trim()
      if (hash) {
        return hash
      }
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Commit hash not found in .git-commit file',
        }),
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withError({
          message: 'Error reading .git-commit file:',
          error,
        }),
      )
    }
    return 'unknown'
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
        EcoLogMessage.fromDefault({
          message: 'Error reading package.json:',
          properties: {
            error,
          },
        }),
      )
      return undefined // Return undefined if there is an error
    }
  }
}
