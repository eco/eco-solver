import { EcoConfigService } from '../eco-configs/eco-config.service'
import { EcoError } from '../common/errors/eco-error'
import { EcoTester } from '../common/test-utils/eco-tester/eco-tester'
import { ExecuteSmartWalletArg } from '../transaction/smart-wallets/smart-wallet.types'
import { KernelAccountClientService } from '../transaction/smart-wallets/kernel/kernel-account-client.service'
import { PermitProcessingParams } from './interfaces/permit-processing-params.interface'
import { PermitProcessor } from './permit-processor'
import { PermitTxBuilder } from './permit-tx-builder'
import { SignerKmsService } from '../sign/signer-kms.service'
import { TransactionReceipt } from 'viem'

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
        signature: '0x'.padEnd(132, '1'),
        deadline: '1000',
      },
    },
    owner: '0xowner',
    spender: '0xspender',
    value: 123n,
  }

  beforeAll(async () => {
    $ = EcoTester
      .setupTestFor(PermitProcessor)
      .withProviders([
        PermitTxBuilder,
        KernelAccountClientService,
      ])
      .withMocks([
        EcoConfigService,
        SignerKmsService,
      ])

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

  it('executes transactions when input is valid', async () => {
    const mockExecute = jest.fn().mockResolvedValue('0xtx')
    const mockWait = jest.fn().mockResolvedValue({ transactionHash: '0xtx' } as unknown as TransactionReceipt)

    jest.spyOn(permitTxBuilder, 'getPermitTx').mockReturnValue(fakeTx)
    jest.spyOn(kernelAccountClientService, 'getClient').mockResolvedValue({
      execute: mockExecute,
      waitForTransactionReceipt: mockWait,
    } as any)

    const result = await processor.executeTxs(permitParams)
    expect(result.response?.transactionHash).toEqual('0xtx')
    expect(mockExecute).toHaveBeenCalledWith([fakeTx])
  })
})
