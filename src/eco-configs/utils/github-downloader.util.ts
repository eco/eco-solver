import { Logger } from '@nestjs/common'
import { EcoLogMessage } from '../../common/logging/eco-log-message'
import { GitConfig, GitApp } from '../eco-config.types'
import { createAuthenticatedOctokit } from './github-auth.util'

/**
 * Utility function to download configuration files from a GitHub repository
 * @param gitConfig the git configuration object
 * @param gitApp the GitHub App authentication configuration
 * @param logger optional logger instance
 * @returns the downloaded configuration
 */
export async function downloadGitHubConfigs(
  gitConfig: GitConfig,
  gitApp: GitApp,
  logger?: Logger,
): Promise<Record<string, any>> {
  try {
    const { repo, hash, branch, tag, env } = gitConfig
    const assetsPath = `assets/${env}`

    // Determine the ref to use - prioritize hash, then tag, then branch
    const ref = hash || tag || branch || 'main'
    const refType = hash ? 'commit' : tag ? 'tag' : branch ? 'branch' : 'default branch'

    logger?.debug(
      EcoLogMessage.fromDefault({
        message: `Downloading configs from ${repo}@${ref} (${refType})/${assetsPath} using GitHub App authentication`,
      }),
    )

    // Create authenticated Octokit instance using GitHub App
    const octokit = await createAuthenticatedOctokit(gitApp, logger)
    if (!octokit) {
      throw new Error('Failed to authenticate with GitHub App')
    }

    // Parse repo owner and name
    const [owner, repoName] = repo.split('/')
    if (!owner || !repoName) {
      throw new Error(`Invalid repo format: ${repo}. Expected format: owner/repo`)
    }

    // Get the directory contents using authenticated Octokit
    logger?.debug(
      EcoLogMessage.fromDefault({
        message: `Requesting contents for: owner=${owner}, repo=${repoName}, path=${assetsPath}, ref=${ref}`,
      }),
    )

    // First, let's check what repositories this GitHub App can access
    try {
      const { data: repos } = await octokit.request('GET /installation/repositories')
      const repoNames = repos.repositories.map((r) => r.full_name)
      logger?.debug(
        EcoLogMessage.fromDefault({
          message: `GitHub App has access to repositories: ${repoNames.join(', ')}`,
        }),
      )

      const hasAccess = repos.repositories.some((r) => r.full_name === `${owner}/${repoName}`)
      if (!hasAccess) {
        throw new Error(
          `GitHub App does not have access to repository ${owner}/${repoName}. Available repos: ${repoNames.join(', ')}`,
        )
      }
    } catch (repoCheckError) {
      logger?.error(
        EcoLogMessage.fromDefault({
          message: `Failed to check repository access: ${repoCheckError.message}`,
        }),
      )
    }

    const contentsUrl = `/repos/${owner}/${repoName}/contents/${assetsPath}`
    const { data: contents } = await octokit.request(`GET ${contentsUrl}`, {
      ref: ref,
    })

    // Handle case where GitHub API returns a single file instead of array
    if (!Array.isArray(contents)) {
      throw new Error(`Path ${assetsPath} is not a directory or does not contain multiple files`)
    }

    // Filter for JSON files only
    const jsonFiles = contents.filter((file) => file.type === 'file' && file.name.endsWith('.json'))

    if (jsonFiles.length === 0) {
      logger?.warn(
        EcoLogMessage.fromDefault({
          message: `No JSON files found in ${repo}@${ref} (${refType})/${assetsPath}`,
        }),
      )
      return {}
    }

    // Download all JSON files in parallel using authenticated requests
    const configPromises = jsonFiles.map(async (file) => {
      try {
        // Get file contents using authenticated Octokit
        const fileUrl = `/repos/${owner}/${repoName}/contents/${file.path}`
        const { data: fileData } = await octokit.request(`GET ${fileUrl}`, {
          ref: ref,
        })

        // Decode base64 content if it's a file
        if ('content' in fileData && fileData.type === 'file') {
          const decodedContent = Buffer.from(fileData.content, 'base64').toString('utf8')
          return JSON.parse(decodedContent)
        } else {
          throw new Error(`Unexpected file data structure for ${file.name}`)
        }
      } catch (error) {
        logger?.error(
          EcoLogMessage.fromDefault({
            message: `Failed to download ${file.name}: ${error.message}`,
          }),
        )
        return {}
      }
    })

    const configResults = await Promise.all(configPromises)
    const mergedConfig = configResults.reduce((acc, config) => ({ ...acc, ...config }), {})

    logger?.debug(
      EcoLogMessage.fromDefault({
        message: `Successfully downloaded ${jsonFiles.length} config files from ${repo}@${ref} (${refType})/${assetsPath}`,
      }),
    )

    return mergedConfig
  } catch (error) {
    logger?.error(
      EcoLogMessage.fromDefault({
        message: `Failed to download GitHub configs from ${gitConfig.repo}: ${error.message}`,
      }),
    )
    return {}
  }
}
