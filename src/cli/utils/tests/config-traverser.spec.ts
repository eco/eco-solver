import { ConfigTraverser } from '../config-traverser';

describe('ConfigTraverser', () => {
  let traverser: ConfigTraverser;

  beforeEach(() => {
    traverser = new ConfigTraverser();
  });

  it('should traverse simple flat object', () => {
    const config = { host: 'localhost', port: 3000 };
    const result = traverser.traverse(config);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ path: ['host'], value: 'localhost' });
    expect(result).toContainEqual({ path: ['port'], value: 3000 });
  });

  it('should traverse nested objects', () => {
    const config = {
      mongodb: {
        uri: 'mongodb://localhost',
        options: { poolSize: 10 },
      },
    };
    const result = traverser.traverse(config);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({
      path: ['mongodb', 'uri'],
      value: 'mongodb://localhost',
    });
    expect(result).toContainEqual({
      path: ['mongodb', 'options', 'poolSize'],
      value: 10,
    });
  });

  it('should flatten arrays with indexed paths', () => {
    const config = {
      networks: [
        { chainId: 1, name: 'mainnet' },
        { chainId: 10, name: 'optimism' },
      ],
    };
    const result = traverser.traverse(config);

    expect(result).toHaveLength(4);
    expect(result).toContainEqual({
      path: ['networks', '0', 'chainId'],
      value: 1,
    });
    expect(result).toContainEqual({
      path: ['networks', '0', 'name'],
      value: 'mainnet',
    });
    expect(result).toContainEqual({
      path: ['networks', '1', 'chainId'],
      value: 10,
    });
    expect(result).toContainEqual({
      path: ['networks', '1', 'name'],
      value: 'optimism',
    });
  });

  it('should handle empty arrays', () => {
    const config = { items: [] };
    const result = traverser.traverse(config);

    expect(result).toHaveLength(0);
  });

  it('should skip null and undefined values', () => {
    const config = { a: 'value', b: null, c: undefined };
    const result = traverser.traverse(config);

    expect(result).toHaveLength(1);
    expect(result).toContainEqual({ path: ['a'], value: 'value' });
  });

  it('should handle deeply nested structures', () => {
    const config = {
      level1: {
        level2: {
          level3: {
            level4: 'deep-value',
          },
        },
      },
    };
    const result = traverser.traverse(config);

    expect(result).toHaveLength(1);
    expect(result).toContainEqual({
      path: ['level1', 'level2', 'level3', 'level4'],
      value: 'deep-value',
    });
  });
});
