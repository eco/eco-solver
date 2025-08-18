import { ConfigLoader } from './config-loader';

describe('ConfigLoader', () => {
  beforeEach(() => {
    // Clear the config cache before each test
    ConfigLoader.reload();
  });

  it('should load configuration', () => {
    const config = ConfigLoader.load();
    expect(config).toBeDefined();
    expect(typeof config).toBe('object');
  });

  it('should get configuration by path', () => {
    const value = ConfigLoader.get('aws');
    expect(value).toBeDefined();
  });

  it('should return default value for missing config', () => {
    const value = ConfigLoader.get('missing.config', 'default');
    expect(value).toBe('default');
  });

  it('should check if config exists', () => {
    expect(ConfigLoader.has('aws')).toBe(true);
    expect(ConfigLoader.has('missing.config')).toBe(false);
  });

  it('should handle environment variables', () => {
    process.env.TEST_VAR = 'test-value';
    const config = ConfigLoader.load({
      nodeConfig: '{"test": "${TEST_VAR}"}'
    });
    expect(config.test).toBe('test-value');
    delete process.env.TEST_VAR;
  });

  it('should support util methods', () => {
    const env = ConfigLoader.util.getEnv('NODE_ENV');
    expect(typeof env).toBe('string');
  });
});