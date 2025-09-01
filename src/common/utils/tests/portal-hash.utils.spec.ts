/**
 * Unit tests for PortalHashUtils
 *
 * Tests the hash calculation and vault derivation functionality for the Portal contract system.
 */

import { AddressNormalizer } from '@/common/utils/address-normalizer';

import { PortalHashUtils } from '../portal-hash.utils';

describe('PortalHashUtils', () => {
  describe('getIntentHash', () => {
    it('should compute intent hash with full PortalIntent object', () => {
      const result = PortalHashUtils.getIntentHash({
        destination: BigInt('728126428'),
        route: {
          salt: '0x79eed1a1837e73bfc306ff9f936483406131c426e826b1ae14477bd98f34439b',
          deadline: BigInt('1756712420'),
          portal: AddressNormalizer.normalizeEvm('0xa17fa8126b6a12feb2fe9c19f618fe04d7329074'),
          nativeAmount: BigInt('0'),
          tokens: [
            {
              token: AddressNormalizer.normalizeEvm('0xa614f803b6fd780986a42c78ec9c7f77e6ded13c'),
              amount: BigInt('70000'),
            },
          ],
          calls: [
            {
              target: AddressNormalizer.normalizeEvm('0xa614f803b6fd780986a42c78ec9c7f77e6ded13c'),
              data: '0xa9059cbb00000000000000000000000072bfbe10b4ee6cb5f193acac8c73a7987e86306f0000000000000000000000000000000000000000000000000000000000011170',
              value: BigInt('0'),
            },
          ],
        },
        reward: {
          deadline: BigInt('1756716020'),
          creator: AddressNormalizer.normalizeEvm('0x90F0c8aCC1E083Bcb4F487f84FC349ae8d5e28D7'),
          prover: AddressNormalizer.normalizeEvm('0xde255Aab8e56a6Ae6913Df3a9Bbb6a9f22367f4C'),
          nativeAmount: BigInt('0'),
          tokens: [
            {
              token: AddressNormalizer.normalizeEvm('0x94b008aA00579c1307B0EF2c499aD98a8ce58e58'),
              amount: BigInt('100000'),
            },
          ],
        },
      });

      expect(result).toHaveProperty('intentHash');
      expect(result).toHaveProperty('routeHash');
      expect(result).toHaveProperty('rewardHash');
      expect(result.intentHash).toMatch(/^0x[a-f0-9]{64}$/i);
      expect(result.routeHash).toMatch(/^0x[a-f0-9]{64}$/i);
      expect(result.rewardHash).toMatch(/^0x[a-f0-9]{64}$/i);

      expect(result.intentHash).toBe(
        '0x804705ff93235a960cf7a6aecd1ad5d904090edd660096eb065f6bea6258d1e5',
      );
    });
  });
});
