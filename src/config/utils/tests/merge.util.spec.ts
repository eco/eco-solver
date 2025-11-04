import mergeWith from 'lodash.mergewith';

import { arrayReplacementCustomizer, mergeWithArrayReplacement } from '@/config/utils/merge.util';

describe('merge.util', () => {
  describe('arrayReplacementCustomizer', () => {
    describe('array replacement behavior', () => {
      it('should replace source array completely when destination is an array', () => {
        const objValue = [1, 2, 3];
        const srcValue = [4, 5];

        const result = arrayReplacementCustomizer(objValue, srcValue);

        expect(result).toEqual([4, 5]);
        expect(result).toBe(srcValue); // Should return exact source array
      });

      it('should replace array when destination is undefined', () => {
        const objValue = undefined;
        const srcValue = [1, 2, 3];

        const result = arrayReplacementCustomizer(objValue, srcValue);

        expect(result).toEqual([1, 2, 3]);
        expect(result).toBe(srcValue);
      });

      it('should replace array when destination is null', () => {
        const objValue = null;
        const srcValue = [1, 2, 3];

        const result = arrayReplacementCustomizer(objValue, srcValue);

        expect(result).toEqual([1, 2, 3]);
        expect(result).toBe(srcValue);
      });

      it('should replace with empty array', () => {
        const objValue = [1, 2, 3];
        const srcValue: any[] = [];

        const result = arrayReplacementCustomizer(objValue, srcValue);

        expect(result).toEqual([]);
        expect(result).toBe(srcValue);
      });

      it('should handle nested arrays (array of arrays)', () => {
        const objValue = [
          [1, 2],
          [3, 4],
        ];
        const srcValue = [[5, 6]];

        const result = arrayReplacementCustomizer(objValue, srcValue);

        expect(result).toEqual([[5, 6]]);
        expect(result).toBe(srcValue);
      });

      it('should handle arrays with mixed types (objects, primitives, null)', () => {
        const objValue = [1, 'two', { three: 3 }];
        const srcValue = [{ a: 1 }, null, undefined, 42, 'string'];

        const result = arrayReplacementCustomizer(objValue, srcValue);

        expect(result).toEqual([{ a: 1 }, null, undefined, 42, 'string']);
        expect(result).toBe(srcValue);
      });

      it('should handle arrays with undefined elements', () => {
        const objValue = [1, 2, 3];
        const srcValue = [undefined, undefined, 3];

        const result = arrayReplacementCustomizer(objValue, srcValue);

        expect(result).toEqual([undefined, undefined, 3]);
        expect(result).toBe(srcValue);
      });

      it('should handle very large arrays', () => {
        const objValue = Array(1000).fill(0);
        const srcValue = Array(2000).fill(1);

        const result = arrayReplacementCustomizer(objValue, srcValue);

        expect(result).toEqual(srcValue);
        expect(result).toBe(srcValue);
        expect(result.length).toBe(2000);
      });

      it('should handle sparse arrays', () => {
        const objValue = [1, 2, 3];
        const srcValue = new Array(5);
        srcValue[0] = 'a';
        srcValue[4] = 'b';

        const result = arrayReplacementCustomizer(objValue, srcValue);

        expect(result).toBe(srcValue);
        expect(result[0]).toBe('a');
        expect(result[1]).toBeUndefined();
        expect(result[4]).toBe('b');
      });
    });

    describe('non-array passthrough', () => {
      it('should return undefined for object values to let mergeWith handle them', () => {
        const objValue = { a: 1 };
        const srcValue = { b: 2 };

        const result = arrayReplacementCustomizer(objValue, srcValue);

        expect(result).toBeUndefined();
      });

      it('should return undefined for string values', () => {
        const objValue = 'hello';
        const srcValue = 'world';

        const result = arrayReplacementCustomizer(objValue, srcValue);

        expect(result).toBeUndefined();
      });

      it('should return undefined for number values', () => {
        const objValue = 42;
        const srcValue = 100;

        const result = arrayReplacementCustomizer(objValue, srcValue);

        expect(result).toBeUndefined();
      });

      it('should return undefined for boolean values', () => {
        const objValue = false;
        const srcValue = true;

        const result = arrayReplacementCustomizer(objValue, srcValue);

        expect(result).toBeUndefined();
      });

      it('should return undefined for null values', () => {
        const objValue = null;
        const srcValue = null;

        const result = arrayReplacementCustomizer(objValue, srcValue);

        expect(result).toBeUndefined();
      });

      it('should return undefined for undefined values', () => {
        const objValue = undefined;
        const srcValue = undefined;

        const result = arrayReplacementCustomizer(objValue, srcValue);

        expect(result).toBeUndefined();
      });

      it('should return undefined for function values', () => {
        const objValue = () => 'hello';
        const srcValue = () => 'world';

        const result = arrayReplacementCustomizer(objValue, srcValue);

        expect(result).toBeUndefined();
      });
    });

    describe('edge cases', () => {
      it('should handle array-like objects (not true arrays)', () => {
        const objValue = [1, 2, 3];
        const srcValue = { 0: 'a', 1: 'b', length: 2 }; // Array-like but not array

        const result = arrayReplacementCustomizer(objValue, srcValue);

        expect(result).toBeUndefined(); // Should not be treated as array
      });

      it('should handle frozen arrays', () => {
        const objValue = [1, 2, 3];
        const srcValue = Object.freeze([4, 5]);

        const result = arrayReplacementCustomizer(objValue, srcValue);

        expect(result).toEqual([4, 5]);
        expect(result).toBe(srcValue);
      });

      it('should handle sealed arrays', () => {
        const objValue = [1, 2, 3];
        const srcValue = Object.seal([4, 5]);

        const result = arrayReplacementCustomizer(objValue, srcValue);

        expect(result).toEqual([4, 5]);
        expect(result).toBe(srcValue);
      });

      it('should not mutate source array', () => {
        const objValue = [1, 2, 3];
        const srcValue = [4, 5];
        const srcValueCopy = [...srcValue];

        arrayReplacementCustomizer(objValue, srcValue);

        expect(srcValue).toEqual(srcValueCopy);
      });

      it('should not mutate destination array', () => {
        const objValue = [1, 2, 3];
        const objValueCopy = [...objValue];
        const srcValue = [4, 5];

        arrayReplacementCustomizer(objValue, srcValue);

        expect(objValue).toEqual(objValueCopy);
      });
    });
  });

  describe('arrayReplacementCustomizer with mergeWith integration', () => {
    describe('simple merge scenarios', () => {
      it('should replace top-level array', () => {
        const target = { items: [1, 2, 3] };
        const source = { items: [4, 5] };

        const result = mergeWith({}, target, source, arrayReplacementCustomizer);

        expect(result.items).toEqual([4, 5]);
        expect(result.items).not.toEqual([4, 5, 3]); // Should NOT be index-merged
      });

      it('should merge objects while replacing arrays', () => {
        const target = { config: { value: 'a' }, items: [1, 2] };
        const source = { config: { extra: 'b' }, items: [3] };

        const result = mergeWith({}, target, source, arrayReplacementCustomizer);

        expect(result.config).toEqual({ value: 'a', extra: 'b' }); // Objects merged
        expect(result.items).toEqual([3]); // Arrays replaced
      });

      it('should handle multiple arrays in same object', () => {
        const target = { arr1: [1, 2], arr2: ['a', 'b'] };
        const source = { arr1: [3], arr2: ['c', 'd', 'e'] };

        const result = mergeWith({}, target, source, arrayReplacementCustomizer);

        expect(result.arr1).toEqual([3]);
        expect(result.arr2).toEqual(['c', 'd', 'e']);
      });

      it('should deep merge objects while replacing arrays', () => {
        const target = {
          level1: {
            level2: {
              value: 'original',
              items: [1, 2],
            },
          },
        };
        const source = {
          level1: {
            level2: {
              extra: 'new',
              items: [3],
            },
          },
        };

        const result = mergeWith({}, target, source, arrayReplacementCustomizer);

        expect(result.level1.level2.value).toBe('original');
        expect(result.level1.level2.extra).toBe('new');
        expect(result.level1.level2.items).toEqual([3]);
      });
    });

    describe('nested structure scenarios', () => {
      it('should replace arrays in deeply nested objects', () => {
        const target = {
          a: {
            b: {
              c: {
                items: [1, 2, 3],
              },
            },
          },
        };
        const source = {
          a: {
            b: {
              c: {
                items: [4],
              },
            },
          },
        };

        const result = mergeWith({}, target, source, arrayReplacementCustomizer);

        expect(result.a.b.c.items).toEqual([4]);
      });

      it('should handle multiple levels of nesting (3+ levels)', () => {
        const target = {
          l1: {
            l2: {
              l3: {
                l4: { items: [1, 2] },
              },
            },
          },
        };
        const source = {
          l1: {
            l2: {
              l3: {
                l4: { items: [3] },
              },
            },
          },
        };

        const result = mergeWith({}, target, source, arrayReplacementCustomizer);

        expect(result.l1.l2.l3.l4.items).toEqual([3]);
      });

      it('should replace arrays at different nesting levels', () => {
        const target = {
          topLevel: [1, 2],
          nested: {
            midLevel: [3, 4],
            deeper: {
              deepLevel: [5, 6],
            },
          },
        };
        const source = {
          topLevel: [7],
          nested: {
            midLevel: [8],
            deeper: {
              deepLevel: [9],
            },
          },
        };

        const result = mergeWith({}, target, source, arrayReplacementCustomizer);

        expect(result.topLevel).toEqual([7]);
        expect(result.nested.midLevel).toEqual([8]);
        expect(result.nested.deeper.deepLevel).toEqual([9]);
      });

      it('should preserve object properties while replacing arrays', () => {
        const target = {
          config: {
            keepThis: 'value',
            items: [1, 2],
            nested: {
              alsoKeep: 'another',
            },
          },
        };
        const source = {
          config: {
            items: [3],
            nested: {
              addThis: 'new',
            },
          },
        };

        const result = mergeWith({}, target, source, arrayReplacementCustomizer);

        expect(result.config.keepThis).toBe('value');
        expect(result.config.items).toEqual([3]);
        expect(result.config.nested.alsoKeep).toBe('another');
        expect(result.config.nested.addThis).toBe('new');
      });

      it('should handle sibling arrays and objects correctly', () => {
        const target = {
          arrayProp: [1, 2],
          objectProp: { a: 1 },
          stringProp: 'hello',
        };
        const source = {
          arrayProp: [3],
          objectProp: { b: 2 },
          stringProp: 'world',
        };

        const result = mergeWith({}, target, source, arrayReplacementCustomizer);

        expect(result.arrayProp).toEqual([3]); // Array replaced
        expect(result.objectProp).toEqual({ a: 1, b: 2 }); // Object merged
        expect(result.stringProp).toBe('world'); // String replaced
      });
    });

    describe('real-world configuration scenarios', () => {
      it('should replace EVM networks array (mimics config-evm-chains.yaml)', () => {
        const baseConfig = {
          evm: {
            networks: [
              { chainId: 1, name: 'Ethereum', rpc: { urls: ['https://eth.llamarpc.com'] } },
              { chainId: 10, name: 'Optimism', rpc: { urls: ['https://mainnet.optimism.io'] } },
            ],
          },
        };
        const overrideConfig = {
          evm: {
            networks: [{ chainId: 137, name: 'Polygon', rpc: { urls: ['https://polygon.rpc'] } }],
          },
        };

        const result = mergeWith({}, baseConfig, overrideConfig, arrayReplacementCustomizer);

        expect(result.evm.networks).toHaveLength(1);
        expect(result.evm.networks[0].chainId).toBe(137);
        expect(result.evm.networks[0].name).toBe('Polygon');
      });

      it('should replace token lists array', () => {
        const baseConfig = {
          tokens: [
            { address: '0x1', symbol: 'USDC', decimals: 6 },
            { address: '0x2', symbol: 'USDT', decimals: 6 },
          ],
        };
        const overrideConfig = {
          tokens: [{ address: '0x3', symbol: 'DAI', decimals: 18 }],
        };

        const result = mergeWith({}, baseConfig, overrideConfig, arrayReplacementCustomizer);

        expect(result.tokens).toHaveLength(1);
        expect(result.tokens[0].symbol).toBe('DAI');
      });

      it('should replace excludeChains array (THE ORIGINAL BUG)', () => {
        const config1 = { excludeChains: [1, 10] };
        const config2 = { excludeChains: [137] };

        const result = mergeWith({}, config1, config2, arrayReplacementCustomizer);

        expect(result.excludeChains).toEqual([137]);
        expect(result.excludeChains).not.toEqual([137, 10]); // The bug that was fixed
      });

      it('should replace listener arrays', () => {
        const baseConfig = {
          evm: {
            listeners: [
              { enabled: true, startBlock: 0 },
              { enabled: false, startBlock: 100 },
            ],
          },
        };
        const overrideConfig = {
          evm: {
            listeners: [{ enabled: true, startBlock: 500 }],
          },
        };

        const result = mergeWith({}, baseConfig, overrideConfig, arrayReplacementCustomizer);

        expect(result.evm.listeners).toHaveLength(1);
        expect(result.evm.listeners[0].startBlock).toBe(500);
      });

      it('should merge prover configs with mixed arrays/objects', () => {
        const baseConfig = {
          provers: [
            {
              type: 'hyper',
              chainConfigs: [
                { chainId: 1, contractAddress: '0x1' },
                { chainId: 10, contractAddress: '0x2' },
              ],
            },
          ],
        };
        const overrideConfig = {
          provers: [
            {
              type: 'hyper',
              chainConfigs: [{ chainId: 137, contractAddress: '0x3' }],
            },
          ],
        };

        const result = mergeWith({}, baseConfig, overrideConfig, arrayReplacementCustomizer);

        expect(result.provers).toHaveLength(1);
        expect(result.provers[0].chainConfigs).toHaveLength(1);
        expect(result.provers[0].chainConfigs[0].chainId).toBe(137);
      });

      it('should handle YAML + env var merge scenario', () => {
        const yamlConfig = {
          evm: {
            networks: [
              { chainId: 1, name: 'Ethereum' },
              { chainId: 10, name: 'Optimism' },
            ],
          },
          port: 3000,
        };
        const envConfig = {
          evm: {
            networks: [{ chainId: 137, name: 'Polygon' }],
          },
          port: 8080,
        };

        const result = mergeWith({}, yamlConfig, envConfig, arrayReplacementCustomizer);

        expect(result.evm.networks).toEqual([{ chainId: 137, name: 'Polygon' }]);
        expect(result.port).toBe(8080);
      });

      it('should handle multiple config source merges (3+ sources)', () => {
        const defaults = { items: [1], value: 'default', obj: { a: 1 } };
        const yaml = { items: [2, 3], value: 'yaml', obj: { b: 2 } };
        const env = { items: [4], obj: { c: 3 } };
        const secrets = { items: [5, 6, 7], obj: { d: 4 } };

        const result = mergeWith({}, defaults, yaml, env, secrets, arrayReplacementCustomizer);

        expect(result.items).toEqual([5, 6, 7]); // Last source wins for arrays
        expect(result.value).toBe('yaml'); // Primitives also last wins
        expect(result.obj).toEqual({ a: 1, b: 2, c: 3, d: 4 }); // Objects merge deeply
      });
    });

    describe('regression tests for original bug', () => {
      it('should replace [1,10] with [137] not [137,10]', () => {
        const result = mergeWith(
          {},
          { excludeChains: [1, 10] },
          { excludeChains: [137] },
          arrayReplacementCustomizer,
        );

        expect(result.excludeChains).toEqual([137]);
        expect(result.excludeChains).not.toEqual([137, 10]);
        expect(result.excludeChains.length).toBe(1);
      });

      it('should not leave old array elements after merge', () => {
        const longArray = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const shortArray = [99];

        const result = mergeWith(
          {},
          { arr: longArray },
          { arr: shortArray },
          arrayReplacementCustomizer,
        );

        expect(result.arr).toEqual([99]);
        expect(result.arr.length).toBe(1);
        expect(result.arr).not.toContain(2);
        expect(result.arr).not.toContain(10);
      });

      it('should completely replace arrays regardless of length', () => {
        const testCases = [
          { source: [1], target: [2, 3, 4], expected: [1] },
          { source: [1, 2, 3], target: [4], expected: [1, 2, 3] },
          { source: [], target: [1, 2], expected: [] },
          { source: [1], target: [], expected: [1] },
        ];

        testCases.forEach(({ source, target, expected }) => {
          const result = mergeWith(
            {},
            { arr: target },
            { arr: source },
            arrayReplacementCustomizer,
          );
          expect(result.arr).toEqual(expected);
        });
      });
    });
  });

  describe('mergeWithArrayReplacement helper', () => {
    it('should merge multiple sources with array replacement', () => {
      const source1 = { a: [1, 2], b: { x: 1 } };
      const source2 = { a: [3], b: { y: 2 } };
      const source3 = { a: [4, 5], b: { z: 3 } };

      const result = mergeWithArrayReplacement(source1, source2, source3);

      expect(result.a).toEqual([4, 5]);
      expect(result.b).toEqual({ x: 1, y: 2, z: 3 });
    });

    it('should handle empty sources array', () => {
      const result = mergeWithArrayReplacement();

      expect(result).toEqual({});
    });

    it('should handle single source', () => {
      const source = { items: [1, 2], value: 'test' };

      const result = mergeWithArrayReplacement(source);

      expect(result).toEqual({ items: [1, 2], value: 'test' });
    });

    it('should apply array replacement to all sources', () => {
      const sources = [
        { arr: [1] },
        { arr: [2, 3] },
        { arr: [4, 5, 6] },
        { arr: [7] },
        { arr: [8, 9] },
      ];

      const result = mergeWithArrayReplacement(...sources);

      expect(result.arr).toEqual([8, 9]); // Last source wins
    });

    it('should maintain merge order (last source wins)', () => {
      const result = mergeWithArrayReplacement(
        { arr: [1], val: 'first' },
        { arr: [2], val: 'second' },
        { arr: [3], val: 'third' },
      );

      expect(result.arr).toEqual([3]);
      expect(result.val).toBe('third');
    });
  });
});
