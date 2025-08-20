const fs = require('fs')
const path = require('path')

const configDir = path.join(__dirname, 'apps/eco-solver/config')
const outputDir = path.join(__dirname, 'dist/apps/eco-solver/config')

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

const configFiles = [
  'default.ts',
  'development.ts',
  'production.ts',
  'preproduction.ts',
  'staging.ts',
  'test.ts',
]

configFiles.forEach((filename) => {
  const inputFile = path.join(configDir, filename)
  const outputFile = path.join(outputDir, filename.replace('.ts', '.js'))

  if (fs.existsSync(inputFile)) {
    const content = fs.readFileSync(inputFile, 'utf8')

    // Convert export default to module.exports
    const jsContent = content
      .replace(/^export default/, 'module.exports =')
      .replace(/import.*from.*['"];?/g, '') // Remove import statements
      .replace(/: number/g, '') // Remove TypeScript type annotations
      .replace(/: string/g, '')
      .replace(/: boolean/g, '')
      .replace(/: bigint/g, '')

    fs.writeFileSync(outputFile, jsContent)
    console.log(`Converted ${filename} to ${filename.replace('.ts', '.js')}`)
  }
})

console.log('Config conversion complete')
