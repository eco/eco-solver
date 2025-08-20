import { registerAs } from '@nestjs/config'
import { EnvironmentSchema } from '@mono-solver/schemas'

export default registerAs('env', () => {
  // Validate environment early - fail fast if invalid
  const validatedEnv = EnvironmentSchema.parse(process.env)

  return {
    nodeEnv: validatedEnv.NODE_ENV,
    port: validatedEnv.PORT,
    isProduction: validatedEnv.NODE_ENV === 'production',
    isDevelopment: validatedEnv.NODE_ENV === 'development',
    isStaging: validatedEnv.NODE_ENV === 'staging',
    isPreproduction: validatedEnv.NODE_ENV === 'preproduction',
    isTest: validatedEnv.NODE_ENV === 'test',
    databaseUrl: validatedEnv.DATABASE_URL,
    redisUrl: validatedEnv.REDIS_URL,
    awsRegion: validatedEnv.AWS_REGION,
  }
})

// Environment-specific configuration factory
export const createEnvFactory = () => ({
  useFactory: () => {
    const env = EnvironmentSchema.parse(process.env)
    
    console.log(`Environment configuration loaded: ${env.NODE_ENV}`)
    return {
      ...env,
      // Additional computed properties
      isProduction: env.NODE_ENV === 'production',
      isDevelopment: env.NODE_ENV === 'development',
      isStaging: env.NODE_ENV === 'staging',
      isPreproduction: env.NODE_ENV === 'preproduction',
      isTest: env.NODE_ENV === 'test',
    }
  },
})