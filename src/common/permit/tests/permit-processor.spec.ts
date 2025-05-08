import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoError } from '@/common/errors/eco-error'
import { EcoTester } from '@/common/test-utils/eco-tester/eco-tester'
import { ExecuteSmartWalletArg } from '@/transaction/smart-wallets/smart-wallet.types'
import { Hex, TransactionReceipt } from 'viem'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { PermitProcessingParams } from '@/common/permit/interfaces/permit-processing-params.interface'
import { PermitProcessor } from '@/common/permit/permit-processor'
import { PermitTxBuilder } from '@/common/permit/permit-tx-builder'
import { SignerKmsService } from '@/sign/signer-kms.service'

let $: EcoTester
let processor: PermitProcessor
let permitTxBuilder: PermitTxBuilder
let kernelAccountClientService: KernelAccountClientService

describe('PermitProcessor', () => {
  const fakeTx: ExecuteSmartWalletArg = {
    to: '0xabc' as const,
    data: '0x123' as const,
    value: 0n,
  }

  const permitParams: PermitProcessingParams = {
    chainID: 1,
    permit: {
      token: '0xdef',
      data: {
        signature: '0x'.padEnd(132, '1') as Hex,
        deadline: 1000n,
      },
    },
    owner: '0xowner',
    spender: '0xspender',
    value: 123n,
  }

  beforeAll(async () => {
    $ = EcoTester.setupTestFor(PermitProcessor)
      .withProviders([PermitTxBuilder, KernelAccountClientService])
      .withMocks([EcoConfigService, SignerKmsService])

    processor = await $.init<PermitProcessor>()
    permitTxBuilder = $.get<PermitTxBuilder>(PermitTxBuilder)
    kernelAccountClientService = $.get<KernelAccountClientService>(KernelAccountClientService)
  })

  it('returns error if no permits passed', () => {
    const result = processor.generateTxs()
    expect(result).toEqual({ error: EcoError.NoPermitsProvided })
  })

  it('returns error if permits are from multiple chains', () => {
    const params = [
      { ...permitParams, chainID: 1 },
      { ...permitParams, chainID: 2 },
    ]
    const result = processor.generateTxs(...params)
    expect(result).toEqual({ error: EcoError.AllPermitsMustBeOnSameChain })
  })

  it('generates transactions when input is valid', () => {
    jest.spyOn(permitTxBuilder, 'getPermitTx').mockReturnValue(fakeTx)

    const result = processor.generateTxs(permitParams)
    expect(result.response).toEqual([fakeTx])
  })
})
