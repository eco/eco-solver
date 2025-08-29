/**
 * Unit tests for PortalHashUtils
 *
 * Tests the hash calculation and vault derivation functionality for the Portal contract system.
 */

import { PortalHashUtils } from '../portal-hash.utils';

describe('PortalHashUtils', () => {
  describe('getIntentHash', () => {
    it('should compute intent hash with full PortalIntent object', () => {
      const result = PortalHashUtils.getIntentHash({
        destination: BigInt('8453'),
        route: {
          salt: '0xe00330d78c883f2c711f01b5c5ba5ed03a5452c7e6c3146607a6f18e3404f1e4',
          deadline: BigInt('1756385182'),
          portal: '0x90F0c8aCC1E083Bcb4F487f84FC349ae8d5e28D7',
          nativeAmount: BigInt('0'),
          tokens: [
            { token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', amount: BigInt('70000') },
          ],
          calls: [
            {
              target: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
              data: '0xa9059cbb000000000000000000000000256b70644f5d77bc8e2bb82c731ddf747ecb14710000000000000000000000000000000000000000000000000000000000011170',
              value: BigInt('0'),
            },
          ],
        },
        reward: {
          deadline: BigInt('1756385182'),
          creator: '0x90F0c8aCC1E083Bcb4F487f84FC349ae8d5e28D7',
          prover: '0xde255Aab8e56a6Ae6913Df3a9Bbb6a9f22367f4C',
          nativeAmount: BigInt('0'),
          tokens: [
            { token: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', amount: BigInt('100000') },
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
