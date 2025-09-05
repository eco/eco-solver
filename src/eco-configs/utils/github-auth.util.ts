import { createAppAuth } from '@octokit/auth-app'
import { Octokit } from '@octokit/core'
import { Logger } from '@nestjs/common'
import { EcoLogMessage } from '../../common/logging/eco-log-message'
import { GitApp } from '../eco-config.types'

/**
 * Formats a private key string to ensure proper PEM format
 * @param privateKey the raw private key string
 * @returns properly formatted PEM private key
 */
function formatPrivateKey(privateKey: string): string {
  // Remove any existing headers/footers and whitespace
  const cleanKey = privateKey
    .replace(/-----BEGIN [A-Z\s]+-----/g, '')
    .replace(/-----END [A-Z\s]+-----/g, '')
    .replace(/\s/g, '')

  // Add proper PEM headers and format with line breaks every 64 characters
  const lines: string[] = []
  for (let i = 0; i < cleanKey.length; i += 64) {
    lines.push(cleanKey.substring(i, i + 64))
  }

  return ['-----BEGIN RSA PRIVATE KEY-----', ...lines, '-----END RSA PRIVATE KEY-----'].join('\n')
}

/**
 * Creates an authenticated Octokit instance for GitHub App authentication
 * @param gitConfig the git configuration object
 * @param logger optional logger instance
 * @returns an authenticated Octokit instance or null if authentication fails
 */
export async function createAuthenticatedOctokit(
  gitApp: GitApp,
  logger?: Logger,
): Promise<Octokit | null> {
  try {
    if (!gitApp) {
      logger?.debug(
        EcoLogMessage.fromDefault({
          message: 'No GitHub App config provided, skipping app authentication',
        }),
      )
      return null
    }

    const { appId, privateKey: rawPrivateKey, installationId } = gitApp

    logger?.debug(
      EcoLogMessage.fromDefault({
        message: `Authenticating with GitHub App ${appId} for installation ${installationId}`,
      }),
    )

    // Format the private key properly
    const privateKey = formatPrivateKey(rawPrivateKey)

    const auth = createAppAuth({
      appId,
      privateKey,
      installationId,
    })

    // Get the installation access token first
    const authResult = await auth({ type: 'installation' })
    const token = (authResult as { token: string }).token

    if (!token || typeof token !== 'string') {
      throw new Error('Failed to obtain valid installation access token')
    }

    const octokit = new Octokit({
      auth: token,
      userAgent: 'eco-solver-config-service',
    })

    // Test the authentication by making a simple authenticated request
    try {
      await octokit.request('GET /installation/repositories', {
        per_page: 1,
      })

      logger?.debug(
        EcoLogMessage.fromDefault({
          message: `Successfully authenticated with GitHub App installation ${installationId}`,
        }),
      )
    } catch (testError) {
      logger?.warn(
        EcoLogMessage.fromDefault({
          message: `Authentication test failed but proceeding: ${testError.message}`,
        }),
      )
      // Don't throw here - the token might still work for the intended purpose
    }

    return octokit
  } catch (error) {
    logger?.error(
      EcoLogMessage.fromDefault({
        message: `Failed to authenticate with GitHub App: ${error.message}`,
      }),
    )
    return null
  }
}

/**
 * Gets an installation access token for GitHub API requests
 * @param gitApp the GitHub App authentication configuration
 * @param logger optional logger instance
 * @returns an access token or null if authentication fails
 */
export async function getGitHubAppToken(gitApp: GitApp, logger?: Logger): Promise<string | null> {
  try {
    if (!gitApp) {
      logger?.debug(
        EcoLogMessage.fromDefault({
          message: 'No GitHub App config provided, skipping app authentication',
        }),
      )
      return null
    }

    const { appId, privateKey: rawPrivateKey, installationId } = gitApp

    logger?.debug(
      EcoLogMessage.fromDefault({
        message: `Getting GitHub App token for app ${appId}, installation ${installationId}`,
      }),
    )

    // Format the private key properly
    const privateKey = formatPrivateKey(rawPrivateKey)

    const auth = createAppAuth({
      appId,
      privateKey,
      installationId,
    })

    // Get the installation access token
    const authResult = await auth({ type: 'installation' })
    const token = (authResult as { token: string }).token

    if (!token || typeof token !== 'string') {
      throw new Error('Failed to obtain valid installation access token')
    }

    logger?.debug(
      EcoLogMessage.fromDefault({
        message: 'Successfully obtained GitHub App installation access token',
      }),
    )

    return token
  } catch (error) {
    logger?.error(
      EcoLogMessage.fromDefault({
        message: `Failed to get GitHub App token: ${error.message}`,
      }),
    )
    return null
  }
}
