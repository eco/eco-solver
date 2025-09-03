/**
 * Unit tests for PortalHashUtils
 *
 * Tests the hash calculation and vault derivation functionality for the Portal contract system.
 */

import { Hex } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';

import { PortalHashUtils } from '../portal-hash.utils';

describe('PortalHashUtils', () => {
  describe('getIntentHash', () => {
    let mockIntent: Intent;

    beforeEach(() => {
      mockIntent = {
        intentHash: '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
        destination: BigInt('728126428'),
        sourceChainId: BigInt('1'),
        route: {
          salt: '0x79eed1a1837e73bfc306ff9f936483406131c426e826b1ae14477bd98f34439b' as Hex,
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
              data: '0xa9059cbb00000000000000000000000072bfbe10b4ee6cb5f193acac8c73a7987e86306f0000000000000000000000000000000000000000000000000000000000011170' as Hex,
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
      };
      mockIntent = {
        route: {
          salt: '0xcafdcd4d01fc50a928dce8f20c6bfa743e543061d63d17e93b4096b33880a3f2',
          deadline: 1756886606n,
          portal:
            '0x00000000000000000000004168b97ec37ce234626b456a50751d2e4bc88f4268' as UniversalAddress,
          nativeAmount: 0n,
          tokens: [
            {
              token:
                '0x00000000000000000000004142a1e39aefa49290f2b3f9ed688d7cecf86cd6e0' as UniversalAddress,
              amount: 70000n,
            },
          ],
          calls: [
            {
              target:
                '0x00000000000000000000004142a1e39aefa49290f2b3f9ed688d7cecf86cd6e0' as UniversalAddress,
              data: '0xa9059cbb000000000000000000000000256b70644f5d77bc8e2bb82c731ddf747ecb147100000000000000000000000000000000000000000000000000000000000186a0',
              value: 0n,
            },
          ],
        },
        reward: {
          deadline: 1756890206n,
          creator: AddressNormalizer.normalizeEvm('0x256B70644f5D77bc8e2bb82C731Ddf747ecb1471'),
          prover: AddressNormalizer.normalizeEvm('0xdc9D0C27B0E76F3D7472aC7e10413667B12768Cc'),
          nativeAmount: 0n,
          tokens: [
            {
              token: AddressNormalizer.normalizeEvm('0x036CbD53842c5426634e7929541eC2318f3dCF7e'),
              amount: 100000n,
            },
          ],
        },
        sourceChainId: 84532n,
        destination: 2494104990n,
        intentHash: '0x0000',
      } as const;
    });

    it('should compute intent hash with full PortalIntent object', () => {
      const result = PortalHashUtils.getIntentHash(mockIntent);

      expect(result).toHaveProperty('intentHash');
      expect(result).toHaveProperty('routeHash');
      expect(result).toHaveProperty('rewardHash');

      // Expected hash based on the specific test data
      expect(result.intentHash).toBe(
        '0x3e2d11e85b4c3be90b260e8010534b2fb521719880cb06e02961fd366c8427f7',
      );
    });
  });
});
