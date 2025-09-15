import { Hex } from 'viem'
import { StandardMerkleBuilder, AllowanceOrTransfer } from '@/common/permit/standard-merkle-builder'

describe('StandardMerkleBuilder – regression tests', () => {
  const builder = new StandardMerkleBuilder()

  // Hard-coded test vectors
  const permitsByChain: Record<number, AllowanceOrTransfer[]> = {
    10: [
      {
        modeOrExpiration: 0,
        tokenKey: StandardMerkleBuilder.encodeTokenKey('0x0000000000000000000000000b2C639c533813f4Aa9D7837CAf62653d097Ff85' as Hex),
        account: '0x8E995c4Ce907Ca6Afc36937B06861D17eCB1b915',
        amountDelta: 32000n,
      },
    ],
    8453: [
      {
        modeOrExpiration: 0,
        tokenKey: StandardMerkleBuilder.encodeTokenKey('0x000000000000000000000000833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Hex),
        account: '0xcA9d14700B881C4C1B5a19e3b6caF646A8EB34F3',
        amountDelta: 2000n,
      },
    ],
  }

  // Expected outputs — capture once from a known-good run
  const EXPECTED = {
    root: '0x3abe2d41d9d07de14c21f6832fff15ff87aea408d036c390bf57eb29516b19a4' as Hex,
    leaves: {
      10: '0x34d8d9879568164def6591ef8a0945c21744e8745700f59956ac04e4f4b65757' as Hex,
      8453: '0xf6966f996571a7de56a738b1a15cde846e13ec3b33d3decc387b2e578c3c45ca' as Hex,
    }
  }

  it('builds a deterministic root from permits', () => {
    const { response, error } = builder.createCrossChainProofs(permitsByChain)
    expect(error).toBeUndefined()
    expect(response?.merkleRoot).toBe(EXPECTED.root)
    expect(response?.proofsByChainId.get(10n)?.leaf).toBe(EXPECTED.leaves[10])
    expect(response?.proofsByChainId.get(8453n)?.leaf).toBe(EXPECTED.leaves[8453])
  })

  it('verifies each proof against the root', () => {
    const { response } = builder.createCrossChainProofs(permitsByChain)
    for (const [chainId, { leaf, proof }] of response!.proofsByChainId.entries()) {
      const ok = builder.verifyProof(leaf, proof, response!.merkleRoot)
      expect(ok).toBe(true)
    }
  })
})
