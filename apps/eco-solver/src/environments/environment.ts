export const environment = {
  production: false,
  configDir: process.env.NODE_CONFIG_DIR || './config',
  apiUrl: process.env.NX_PUBLIC_API_URL || 'http://localhost:3000',
}
