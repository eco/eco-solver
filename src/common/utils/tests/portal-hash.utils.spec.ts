/**
 * Unit tests for PortalHashUtils
 *
 * Tests the hash calculation and vault derivation functionality for the Portal contract system.
 */

import { Intent } from '@/common/interfaces/intent.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';

import { PortalHashUtils } from '../portal-hash.utils';

describe('PortalHashUtils', () => {
  describe('getIntentHash', () => {
    let mockIntent: Intent;

    beforeEach(() => {
      mockIntent = {
        route: {
          salt: '0xf6e28fd5853c0a50cec33eb12dd84b47e01fbf2f1c235717c98791f37e0a89a4',
          deadline: 1756893771n,
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
          deadline: 1756897371n,
          creator:
            '0x000000000000000000000000256B70644f5D77bc8e2bb82C731Ddf747ecb1471' as UniversalAddress,
          prover:
            '0x000000000000000000000000dc9D0C27B0E76F3D7472aC7e10413667B12768Cc' as UniversalAddress,
          nativeAmount: 0n,
          tokens: [
            {
              token:
                '0x000000000000000000000000036CbD53842c5426634e7929541eC2318f3dCF7e' as UniversalAddress,
              amount: 100000n,
            },
          ],
        },
        sourceChainId: 84532n,
        destination: 2494104990n,
        intentHash: '0x60daa2f5fe9cb1a20d8e579f806bb076db830483c0791d84e3cbc542210e4f1f',
      } as const;
    });

    it('should compute intent hash with full PortalIntent object', () => {
      const result = PortalHashUtils.getIntentHash(mockIntent);

      expect(result).toHaveProperty('intentHash');
      expect(result).toHaveProperty('routeHash');
      expect(result).toHaveProperty('rewardHash');

      // Expected hash based on the specific test data
      expect(result.intentHash).toBe(
        '0x95078a3a90665fa977269f9d93e086c91cdd3a7d6530a9a1c835937597190971',
      );
      expect(result.routeHash).toBe(
        '0x378829325d346fe8874fe362393507307c215cb10f1d9710b8c2bf4f209c00c4',
      );
      expect(result.rewardHash).toBe(
        '0x42a830edfa337c22f7ba9b65a2a999c1e000a14f5cdb7060b5d089418cda6f86',
      );
    });
  });
});
