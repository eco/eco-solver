#!/usr/bin/env ts-node
/**
 * Script to convert alias imports (@app/*, @lib/*, shared, domain, integrations, etc.)
 * into relative paths within the monorepo to simplify refactor or remove path mapping reliance.
 *
 * Strategy:
 * 1. Build an index of source files by their logical alias tokens.
 * 2. For each .ts source file, parse import declarations.
 * 3. If import path matches an alias, resolve target absolute file path.
 * 4. Compute relative path from importing file to target (without .ts extension if importing index).
 * 5. Replace the import specifier.
 *
 * Notes:
 * - Keeps external module imports untouched.
 * - Skips node_modules.
 * - Handles barrel exports like `export * from '@libs/domain/entities'`.
 */
import * as fs from 'fs'
import * as path from 'path'

const repoRoot = path.resolve(__dirname, '../../')

interface Replacement {
  original: string
  replaced: string
}

const aliasPrefixes = ['@app/', '@lib/']
const rootLibShortcuts = ['shared', 'domain', 'integrations', 'messaging', 'database', 'security']

function isTsSource(file: string) {
  return file.endsWith('.ts') && !file.endsWith('.d.ts')
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue
      walk(full, acc)
    } else if (isTsSource(full)) {
      acc.push(full)
    }
  }
  return acc
}

function resolveAlias(importPath: string, fromFile: string): string | null {
  // @app/<app-name>/src/... OR @app/<something>/../ relative segments
  if (importPath.startsWith('@app/')) {
    // pattern: @app/<project>/... possibly with ../ segments
    const remainder = importPath.substring('@app/'.length)
    const parts = remainder.split('/')
    const project = parts.shift()
    if (!project) return null
    // compute base path for app project
    // apps/<project>/src is the intended root
    const appSrc = path.join(repoRoot, 'apps', project, 'src')
    const subPath = parts.join('/')
    const fullPath = path.normalize(path.join(appSrc, subPath))
    return ensureExistingPath(fullPath)
  }
  if (importPath.startsWith('@lib/')) {
    const remainder = importPath.substring('@lib/'.length) // domain/entities etc.
    const parts = remainder.split('/')
    const lib = parts.shift()
    if (!lib) return null
    const libSrc = path.join(repoRoot, 'libs', lib, 'src')
    const subPath = parts.join('/')
    const fullPath = path.normalize(path.join(libSrc, subPath))
    return ensureExistingPath(fullPath)
  }
  if (rootLibShortcuts.includes(importPath.split('/')[0])) {
    // e.g. shared, shared/utils
    const first = importPath.split('/')[0]
    if (!rootLibShortcuts.includes(first)) return null
    const remainder = importPath.substring(first.length) // may be '' or '/sub/...'
    const libSrc = path.join(repoRoot, 'libs', first, 'src')
    const fullPath = path.normalize(path.join(libSrc, remainder))
    return ensureExistingPath(fullPath)
  }
  return null
}

function ensureExistingPath(p: string): string | null {
  // Try path as file, file.ts, file/index.ts, or directory index
  const candidates: string[] = []
  if (fs.existsSync(p) && fs.statSync(p).isFile()) candidates.push(p)
  if (fs.existsSync(p + '.ts')) candidates.push(p + '.ts')
  if (fs.existsSync(p + '.tsx')) candidates.push(p + '.tsx')
  // index.ts inside directory
  if (fs.existsSync(path.join(p, 'index.ts'))) candidates.push(path.join(p, 'index.ts'))
  if (candidates.length === 0) return null
  // Prefer explicit file over index.
  candidates.sort((a, b) => a.length - b.length)
  return candidates[0]
}

function toRelative(fromFile: string, targetAbs: string): string {
  const fromDir = path.dirname(fromFile)
  let rel = path.relative(fromDir, targetAbs)
  if (rel.startsWith('.')) {
    // ok
  } else {
    rel = './' + rel
  }
  // strip .ts extension
  if (rel.endsWith('.ts')) rel = rel.slice(0, -3)
  if (rel.endsWith('/index')) rel = rel.slice(0, -6) // remove /index
  return rel.replace(/\\/g, '/')
}

function processFile(file: string): Replacement[] | null {
  const original = fs.readFileSync(file, 'utf8')
  let modified = original
  const replacements: Replacement[] = []

  const importExportRegex =
    /(import|export)\s+[^'";]*from\s+['"]([^'"]+)['"];?|import\s+['"]([^'"]+)['"];?/g

  let changed = false
  modified = modified.replace(importExportRegex, (match, _kw, from1, from2) => {
    const spec = from1 || from2
    if (!spec) return match
    // skip relative & package imports
    if (spec.startsWith('.') || spec.startsWith('..')) return match
    const resolved = resolveAlias(spec, file)
    if (!resolved) return match
    const rel = toRelative(file, resolved)
    if (rel === spec) return match
    changed = true
    replacements.push({ original: spec, replaced: rel })
    return match.replace(spec, rel)
  })

  if (changed) {
    fs.writeFileSync(file, modified, 'utf8')
    return replacements
  }
  return null
}

function main() {
  const allTs = [...walk(path.join(repoRoot, 'apps')), ...walk(path.join(repoRoot, 'libs'))]
  const summary: Record<string, Replacement[]> = {}
  for (const file of allTs) {
    const reps = processFile(file)
    if (reps && reps.length) summary[file] = reps
  }
  const reportLines: string[] = []
  Object.entries(summary).forEach(([file, reps]) => {
    reportLines.push(`FILE: ${path.relative(repoRoot, file)}`)
    reps.forEach((r) => reportLines.push(`  ${r.original} -> ${r.replaced}`))
  })
  fs.writeFileSync(
    path.join(repoRoot, 'alias-import-conversion-report.txt'),
    reportLines.join('\n'),
    'utf8',
  )
  console.log(`Converted imports in ${Object.keys(summary).length} files.`)
}

if (require.main === module) {
  main()
}
