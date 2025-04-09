import { Address, privateKeyToAccount } from 'viem/accounts'
import { Chain } from 'viem'
import { createTestClient, Hex, http, parseEther, publicActions } from 'viem'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoLogger } from '@/common/logging/eco-logger'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoTester } from '@/common/test-utils/eco-tester/eco-tester'
import { FeeService } from '@/fee/fee.service'
import { foundry } from 'viem/chains'
import { GaslessIntentRequestDTO } from '@/quote/dto/gasless-intent-request.dto'
import { getModelToken } from '@nestjs/mongoose'
import { IntentInitiationService } from './intent-initiation.service'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { Permit2Processor } from '@/permit-processing/permit2-processor'
import { Permit2TxBuilder } from '@/permit-processing/permit2-tx-builder'
import { PermitProcessor } from '@/permit-processing/permit-processor'
import { PermitTxBuilder } from '@/permit-processing/permit-tx-builder'
import { QuoteIntentModel } from '@/quote/schemas/quote-intent.schema'
import { QuoteService } from '@/quote/quote.service'
import { SignerKmsService } from '@/sign/signer-kms.service'
import { ValidationService } from '@/intent/validation.sevice'

/*
1. Install Foundry (if you haven’t already)
curl -L https://foundry.paradigm.xyz | bash
foundryup

2. Run Anvil (Local EVM chain)
This will run your test chain at http://127.0.0.1:8545
anvil --chain-id 31337 --block-time 1

3. Install Account Abstraction Repository
git clone https://github.com/eth-infinitism/account-abstraction.git
cd account-abstraction
yarn install

4. Build contracts with Foundry
forge build

5. Deploy contracts via Hardhat to localhost
npx hardhat deploy --network localhost

You should see logs like:
==entrypoint addr= 0xAbCd123...

6. Update your config with deployed EntryPoint
Wherever your Kernel client is initialized (e.g., buildChainConfig() or a KernelAccountClientConfig), patch it for Anvil:

entryPoint: {
  address: '0xAbCd123...', // Replace with actual deployed address
  version: '0.7',
}

7. You’re ready to test!

At this point:
	•	Your local Anvil chain is running
	•	Your EntryPoint is deployed
	•	Your tests or backend can now simulate Kernel accounts, permit flows, and gas estimation against localhost.
*/

jest.setTimeout(30000)

class MockSignerKmsService {
  getAccount() {
    return privateKeyToAccount('0x'.padEnd(66, '1') as Hex)
  }
}

describe.skip('IntentInitiationIntegrationTest', () => {
  const logger = new EcoLogger('IntentInitiationIntegrationTestSpec')
  let service: IntentInitiationService
  let kernelService: KernelAccountClientService
  let testClient: ReturnType<typeof createTestClient>
  let account: ReturnType<typeof privateKeyToAccount>

  beforeAll(async () => {
    account = privateKeyToAccount('0x'.padEnd(66, '1') as Hex)

    const mockSource = {
      getConfig: () => ({
        'IntentSource.1': '0x0000000000000000000000000000000000000001',
        'Prover.1': '0x0000000000000000000000000000000000000002',
        'HyperProver.1': '0x0000000000000000000000000000000000000003',
        'Inbox.1': '0x0000000000000000000000000000000000000004',
        safe: {
          owner: account.address,
        },
        alchemy: {
          networks: [
            { id: 1 },
            { id: 137 },
            {
              id: 31337,
              name: 'anvil',
              rpcUrl: 'http://127.0.0.1:8545',
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              blockExplorers: [],
            },
          ],

          apiKey: '',
        },
        eth: {
          pollingInterval: 1000,
        },
      }),
      getSolvers: () => ({
        mockSolver: { chainID: foundry.id },
      }),
    }

    testClient = createTestClient({
      chain: foundry,
      mode: 'anvil',
      transport: http(),
    }).extend(publicActions)

    // Fund account
    await testClient.setBalance({ address: account.address, value: parseEther('10') })

    const $ = EcoTester.setupTestFor(IntentInitiationService)
      .withProviders([
        PermitProcessor,
        Permit2Processor,
        QuoteService,
        PermitTxBuilder,
        Permit2TxBuilder,

        {
          provide: KernelAccountClientService,
          useClass: KernelAccountClientService, // real client
        },
        {
          provide: EcoConfigService,
          useValue: new EcoConfigService([mockSource as any]),
        },
        {
          provide: SignerKmsService,
          useClass: MockSignerKmsService,
        },
        {
          provide: getModelToken(QuoteIntentModel.name),
          useValue: {
            create: jest.fn(),
            findOne: jest.fn(),
            updateOne: jest.fn(),
          },
        },
      ])
      .withMocks([FeeService, ValidationService])

    service = await $.init()
    kernelService = await $.get(KernelAccountClientService)

    // 👇 Override buildChainConfig for chain ID 31337
    const originalBuildChainConfig = kernelService['buildChainConfig'].bind(kernelService)
    jest
      .spyOn(kernelService as any, 'buildChainConfig')
      .mockImplementation(async (chain: Chain) => {
        const config = await originalBuildChainConfig(chain)

        if (chain.id === 31337) {
          return {
            ...config,
            entryPoint: {
              address: '0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108', // your test entryPoint
              version: '0.7',
            },
          }
        }

        return config
      })
  })

  it('should estimate gas and cost for an actual gasless intent (real simulation)', async () => {
    // Use a valid GaslessIntentRequestDTO
    const mockRequest = new GaslessIntentRequestDTO()
    mockRequest.getSourceChainID = () => foundry.id

    // Create mock intent tx (e.g. just self-call with no-op)
    const tx = {
      to: account.address as Address,
      data: '0x',
      value: 0n,
    }

    // Mock method that generates the txs
    jest.spyOn(service, 'generateGaslessIntentTransactions' as any).mockResolvedValue({
      response: [tx],
    })

    const { response: estimatedGasDataForIntentInitiation, error } =
      await service.calculateGasQuoteForIntent(mockRequest)
    expect(error).toBeUndefined()

    const { gasEstimate, gasPrice, gasCost } = estimatedGasDataForIntentInitiation!
    expect(gasEstimate).toBeGreaterThan(0n)
    expect(gasPrice).toBeGreaterThan(0n)
    expect(gasCost).toBeGreaterThan(0n)

    logger.error(
      EcoLogMessage.fromDefault({
        message: `calculateGasQuoteForIntent: estimated gas details`,
        properties: {
          estimatedGas: gasEstimate,
          price: gasPrice,
          totalCost: gasCost,
        },
      }),
    )
  })
})
