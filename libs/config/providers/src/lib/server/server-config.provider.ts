import { registerAs } from '@nestjs/config'
import { ServerConfigSchema } from '@libs/config-schemas'

export default registerAs('server', () => {
  const config = {
    url: process.env['SERVER_URL'] || 'http://localhost:3000',
    port: parseInt(process.env['PORT'] || '3000', 10),
    host: process.env['HOST'] || 'localhost',
    enableHttps: process.env['ENABLE_HTTPS'] === 'true',
    requestTimeout: parseInt(process.env['REQUEST_TIMEOUT'] || '30000', 10),
  }

  // Validate with Zod and get strongly-typed result
  return ServerConfigSchema.parse(config)
})