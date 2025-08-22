import { Logger } from '@nestjs/common'
import { EcoLogMessage } from '../../common/logging/eco-log-message'
import { GitConfig } from '../eco-config.types'

/**
 * Utility function to download configuration files from a GitHub repository
 * @param gitConfig the git configuration object
 * @param logger optional logger instance
 * @returns the downloaded configuration
 */
export async function downloadGitHubConfigs(
  gitConfig: GitConfig,
  logger?: Logger,
): Promise<Record<string, any>> {
  try {
    const { repo, hash, branch, tag, env, token } = gitConfig
    const assetsPath = `assets/${env}`

    // Determine the ref to use - prioritize hash, then tag, then branch
    const ref = hash || tag || branch || 'main'
    const refType = hash ? 'commit' : tag ? 'tag' : branch ? 'branch' : 'default branch'

    logger?.debug(
      EcoLogMessage.fromDefault({
        message: `Downloading configs from ${repo}@${ref} (${refType})/${assetsPath}`,
      }),
    )

    // Get the directory contents first
    const contentsUrl = `https://api.github.com/repos/${repo}/contents/${assetsPath}?ref=${ref}`
    const headers: HeadersInit = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'eco-solver-config-service',
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const contentsResponse = await fetch(contentsUrl, { headers })
    if (!contentsResponse.ok) {
      throw new Error(`Failed to get directory contents: HTTP ${contentsResponse.status}`)
    }

    const contents = await contentsResponse.json()

    // Handle case where GitHub API returns an error object instead of array
    if (!Array.isArray(contents)) {
      throw new Error(`Directory contents response is not an array: ${JSON.stringify(contents)}`)
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

    // Download all JSON files in parallel
    const configPromises = jsonFiles.map(async (file) => {
      try {
        const fileResponse = await fetch(file.download_url)
        if (!fileResponse.ok) {
          throw new Error(`Failed to download ${file.name}: HTTP ${fileResponse.status}`)
        }
        return await fileResponse.json()
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
