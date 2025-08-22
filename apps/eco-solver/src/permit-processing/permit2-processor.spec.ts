import { EcoConfigService } from '@libs/solver-config'
import { EcoTester } from '@eco-solver/common/test-utils/eco-tester/eco-tester'
import { ExecuteSmartWalletArg } from '@eco-solver/transaction/smart-wallets/smart-wallet.types'
import { TransactionReceipt, zeroAddress } from "viem"
import { Hex } from "viem"
import { KernelAccountClientService } from '@eco-solver/transaction/smart-wallets/kernel/kernel-account-client.service'
import { Permit2DTO } from '@eco-solver/quote/dto/permit2/permit2.dto'
import { Permit2Processor } from '@eco-solver/permit-processing/permit2-processor'
import { Permit2TxBuilder } from '@eco-solver/permit-processing/permit2-tx-builder'
import { SignerKmsService } from '@eco-solver/sign/signer-kms.service'

let $: EcoTester
let processor: Permit2Processor
let builder: Permit2TxBuilder
let kernelAccountClientService: KernelAccountClientService

describe('Permit2Processor', () => {
  const fakeTx: ExecuteSmartWalletArg = {
    to: '0xabc' as const,
    data: '0x123' as const,
    value: 0n,
  }

  const permit: Permit2DTO = {
    permitContract: '0xabc',
    signature: ('0x' + '1'.repeat(130)) as Hex,
    permitData: {
      getDetails: () => [
        {
          token: '0xabc',
          amount: '1000',
          expiration: '9999999999',
          nonce: '1',
        },
      ],
      getSigDeadline: () => 9999999999n,
      getSpender: () => '0xdef',
      batchPermitData: undefined,
    },
  }

  beforeAll(async () => {
    $ = EcoTester.setupTestFor(Permit2Processor)
      .withProviders([Permit2TxBuilder, KernelAccountClientService])
      .withMocks([EcoConfigService, SignerKmsService])

    processor = await $.init<Permit2Processor>()
    builder = $.get<Permit2TxBuilder>(Permit2TxBuilder)
    kernelAccountClientService = $.get<KernelAccountClientService>(KernelAccountClientService)
  })

  it('generates a Permit2 tx', () => {
    jest.spyOn(builder, 'getPermit2Tx').mockReturnValue(fakeTx)

    const result = processor.generateTxs(zeroAddress, permit)
    expect(result.response).toEqual([fakeTx])
  })

  it('executes Permit2 tx', async () => {
    const mockExecute = jest.fn().mockResolvedValue('0xtx')
    const mockWait = jest
      .fn()
      .mockResolvedValue({ transactionHash: '0xtx' } as unknown as TransactionReceipt)

    jest.spyOn(builder, 'getPermit2Tx').mockReturnValue(fakeTx)
    jest.spyOn(kernelAccountClientService, 'getClient').mockResolvedValue({
      execute: mockExecute,
      waitForTransactionReceipt: mockWait,
    } as any)

    const result = await processor.executeTxs(zeroAddress, 1, permit)
    expect(result.response?.transactionHash).toEqual('0xtx')
    expect(mockExecute).toHaveBeenCalledWith([fakeTx])
  })
})
