/**
 * IMPORTANT: Do not modify this file.
 * This file allows the app to run without bundling in workspace libraries.
 * Must be contained in the ".nx" folder inside the output path.
 */
const Module = require('module')
const path = require('path')
const fs = require('fs')
const originalResolveFilename = Module._resolveFilename
const distPath = __dirname
const manifest = [
  { module: '@/*', pattern: './src/*' },
  {
    module: 'database',
    exactMatch: 'libs/database/src/index.js',
    pattern: 'libs/database/src/index.ts',
  },
  { module: 'domain', exactMatch: 'libs/domain/src/index.js', pattern: 'libs/domain/src/index.ts' },
  {
    module: 'integrations',
    exactMatch: 'libs/integrations/src/index.js',
    pattern: 'libs/integrations/src/index.ts',
  },
  {
    module: 'messaging',
    exactMatch: 'libs/messaging/src/index.js',
    pattern: 'libs/messaging/src/index.ts',
  },
  {
    module: 'security',
    exactMatch: 'libs/security/src/index.js',
    pattern: 'libs/security/src/index.ts',
  },
  { module: 'shared', exactMatch: 'libs/shared/src/index.js', pattern: 'libs/shared/src/index.ts' },
]

Module._resolveFilename = function (request, parent) {
  let found
  for (const entry of manifest) {
    if (request === entry.module && entry.exactMatch) {
      const entry = manifest.find((x) => request === x.module || request.startsWith(x.module + '/'))
      const candidate = path.join(distPath, entry.exactMatch)
      if (isFile(candidate)) {
        found = candidate
        break
      }
    } else {
      const re = new RegExp(entry.module.replace(/\*$/, '(?<rest>.*)'))
      const match = request.match(re)

      if (match?.groups) {
        const candidate = path.join(distPath, entry.pattern.replace('*', ''), match.groups.rest)
        if (isFile(candidate)) {
          found = candidate
        }
      }
    }
  }
  if (found) {
    const modifiedArguments = [found, ...[].slice.call(arguments, 1)]
    return originalResolveFilename.apply(this, modifiedArguments)
  } else {
    return originalResolveFilename.apply(this, arguments)
  }
}

function isFile(s) {
  try {
    require.resolve(s)
    return true
  } catch (_e) {
    return false
  }
}

// Call the user-defined main.
module.exports = require('./apps/cli-tools/src/main.js')
