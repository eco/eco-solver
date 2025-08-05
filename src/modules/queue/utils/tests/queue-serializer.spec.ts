import { QueueSerializer } from '../queue-serializer';

describe('QueueSerializer', () => {
  describe('serialize and deserialize', () => {
    it('should serialize and deserialize BigInt values correctly', () => {
      const data = {
        id: 'test-123',
        amount: BigInt(1000000000000000000), // 1e18
        gasPrice: BigInt(20000000000), // 20 gwei
        blockNumber: BigInt(12345678),
      };

      const serialized = QueueSerializer.serialize(data);
      const deserialized = QueueSerializer.deserialize<typeof data>(serialized);

      expect(deserialized.id).toBe(data.id);
      expect(deserialized.amount).toBe(data.amount);
      expect(deserialized.gasPrice).toBe(data.gasPrice);
      expect(deserialized.blockNumber).toBe(data.blockNumber);
      expect(typeof deserialized.amount).toBe('bigint');
      expect(typeof deserialized.gasPrice).toBe('bigint');
      expect(typeof deserialized.blockNumber).toBe('bigint');
    });

    it('should use the special prefix for BigInt serialization', () => {
      const data = {
        value: BigInt(123456789),
      };

      const serialized = QueueSerializer.serialize(data);

      expect(serialized).toContain('$$bigint:');
      expect(serialized).toBe('{"value":"$$bigint:123456789"}');
    });

    it('should handle nested BigInt values correctly', () => {
      const data = {
        transaction: {
          from: '0x1234567890123456789012345678901234567890' as const,
          to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const,
          value: BigInt(5000000000000000000), // 5 ETH
          gasLimit: BigInt(21000),
          details: {
            nonce: BigInt(42),
            maxFeePerGas: BigInt(150000000000), // 150 gwei
            maxPriorityFeePerGas: BigInt(2000000000), // 2 gwei
          },
        },
        metadata: {
          timestamp: Date.now(),
          chainId: BigInt(1),
        },
      };

      const serialized = QueueSerializer.serialize(data);
      const deserialized = QueueSerializer.deserialize<typeof data>(serialized);

      // Check nested structure
      expect(deserialized.transaction.value).toBe(data.transaction.value);
      expect(deserialized.transaction.gasLimit).toBe(data.transaction.gasLimit);
      expect(deserialized.transaction.details.nonce).toBe(data.transaction.details.nonce);
      expect(deserialized.transaction.details.maxFeePerGas).toBe(
        data.transaction.details.maxFeePerGas,
      );
      expect(deserialized.transaction.details.maxPriorityFeePerGas).toBe(
        data.transaction.details.maxPriorityFeePerGas,
      );
      expect(deserialized.metadata.chainId).toBe(data.metadata.chainId);

      // Verify all BigInt types are preserved
      expect(typeof deserialized.transaction.value).toBe('bigint');
      expect(typeof deserialized.transaction.gasLimit).toBe('bigint');
      expect(typeof deserialized.transaction.details.nonce).toBe('bigint');
      expect(typeof deserialized.transaction.details.maxFeePerGas).toBe('bigint');
      expect(typeof deserialized.transaction.details.maxPriorityFeePerGas).toBe('bigint');
      expect(typeof deserialized.metadata.chainId).toBe('bigint');

      // Verify non-BigInt values remain unchanged
      expect(deserialized.transaction.from).toBe(data.transaction.from);
      expect(deserialized.transaction.to).toBe(data.transaction.to);
      expect(typeof deserialized.metadata.timestamp).toBe('number');
    });

    it('should handle arrays with BigInt values', () => {
      const data = {
        values: [BigInt(100), BigInt(200), BigInt(300)],
        mixed: [
          { amount: BigInt(1000), name: 'first' },
          { amount: BigInt(2000), name: 'second' },
        ],
      };

      const serialized = QueueSerializer.serialize(data);
      const deserialized = QueueSerializer.deserialize<typeof data>(serialized);

      expect(deserialized.values).toHaveLength(3);
      expect(deserialized.values[0]).toBe(BigInt(100));
      expect(deserialized.values[1]).toBe(BigInt(200));
      expect(deserialized.values[2]).toBe(BigInt(300));

      expect(deserialized.mixed).toHaveLength(2);
      expect(deserialized.mixed[0].amount).toBe(BigInt(1000));
      expect(deserialized.mixed[1].amount).toBe(BigInt(2000));
      expect(deserialized.mixed[0].name).toBe('first');
      expect(deserialized.mixed[1].name).toBe('second');
    });

    it('should handle edge cases', () => {
      const testCases = [
        {
          name: 'zero BigInt',
          data: { value: BigInt(0) },
          expected: { value: BigInt(0) },
        },
        {
          name: 'negative BigInt',
          data: { value: BigInt(-12345) },
          expected: { value: BigInt(-12345) },
        },
        {
          name: 'very large BigInt',
          data: { value: BigInt('99999999999999999999999999999999999999999999') },
          expected: { value: BigInt('99999999999999999999999999999999999999999999') },
        },
        {
          name: 'mixed types',
          data: {
            bigintValue: BigInt(123),
            numberValue: 456,
            stringValue: 'test',
            booleanValue: true,
            nullValue: null,
            undefinedValue: undefined,
          },
          expected: {
            bigintValue: BigInt(123),
            numberValue: 456,
            stringValue: 'test',
            booleanValue: true,
            nullValue: null,
            undefinedValue: undefined,
          },
        },
      ];

      testCases.forEach(({ data, expected }) => {
        const serialized = QueueSerializer.serialize(data);
        const deserialized = QueueSerializer.deserialize<typeof data>(serialized);

        expect(deserialized).toEqual(expected);

        // Verify BigInt type is preserved
        if ('value' in expected && expected.value !== null && expected.value !== undefined) {
          expect(typeof deserialized.value).toBe('bigint');
        }
      });
    });

    it('should handle the special prefix correctly in edge cases', () => {
      // Test that strings with the prefix in manually created JSON are treated as BigInt
      const manualJson = '{"value":"$$bigint:123","regularString":"normal text"}';
      const deserialized = QueueSerializer.deserialize<{ value: bigint; regularString: string }>(
        manualJson,
      );

      expect(deserialized.value).toBe(BigInt(123));
      expect(typeof deserialized.value).toBe('bigint');
      expect(deserialized.regularString).toBe('normal text');

      // Test that normal strings don't get the prefix during serialization
      const data = {
        normalString: 'just a regular string',
        stringWithNumbers: '123456',
        actualBigInt: BigInt(789),
      };

      const serialized = QueueSerializer.serialize(data);
      const parsed = JSON.parse(serialized);

      // Verify the serialized format
      expect(parsed.normalString).toBe('just a regular string');
      expect(parsed.stringWithNumbers).toBe('123456');
      expect(parsed.actualBigInt).toBe('$$bigint:789');

      // Verify round-trip works correctly
      const roundTrip = QueueSerializer.deserialize<typeof data>(serialized);
      expect(roundTrip.normalString).toBe(data.normalString);
      expect(roundTrip.stringWithNumbers).toBe(data.stringWithNumbers);
      expect(roundTrip.actualBigInt).toBe(data.actualBigInt);
    });

    it('should handle Intent-like structures with BigInt values', () => {
      const intentLikeData = {
        intentId: 'test-intent-123',
        reward: {
          prover: '0x1234567890123456789012345678901234567890' as const,
          creator: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const,
          deadline: BigInt(1234567890),
          nativeValue: BigInt(1000000000000000000), // 1 ETH
          tokens: [
            {
              amount: BigInt(2000000000000000000), // 2 tokens
              token: '0x1111111111111111111111111111111111111111' as const,
            },
          ],
        },
        route: {
          source: BigInt(1), // Ethereum mainnet
          destination: BigInt(10), // Optimism
          salt: '0xabcdef' as const,
          inbox: '0x2222222222222222222222222222222222222222' as const,
          calls: [
            {
              data: '0x123456' as const,
              target: '0x3333333333333333333333333333333333333333' as const,
              value: BigInt(500000000000000000), // 0.5 ETH
            },
          ],
          tokens: [
            {
              amount: BigInt(3000000000000000000), // 3 tokens
              token: '0x4444444444444444444444444444444444444444' as const,
            },
          ],
        },
        status: 'pending',
      };

      const serialized = QueueSerializer.serializeIntent(intentLikeData as any);
      const deserialized = QueueSerializer.deserializeIntent(serialized);

      // Verify all BigInt values are correctly deserialized
      expect(deserialized.reward.deadline).toBe(intentLikeData.reward.deadline);
      expect(deserialized.reward.nativeValue).toBe(intentLikeData.reward.nativeValue);
      expect(deserialized.reward.tokens[0].amount).toBe(intentLikeData.reward.tokens[0].amount);
      expect(deserialized.route.source).toBe(intentLikeData.route.source);
      expect(deserialized.route.destination).toBe(intentLikeData.route.destination);
      expect(deserialized.route.calls[0].value).toBe(intentLikeData.route.calls[0].value);
      expect(deserialized.route.tokens[0].amount).toBe(intentLikeData.route.tokens[0].amount);

      // Verify types
      expect(typeof deserialized.reward.deadline).toBe('bigint');
      expect(typeof deserialized.reward.nativeValue).toBe('bigint');
      expect(typeof deserialized.route.source).toBe('bigint');
      expect(typeof deserialized.route.destination).toBe('bigint');
    });
  });
});
