const mockGetTransactionTargetData = jest.fn()
import { Test, TestingModule } from '@nestjs/testing'
import { BalanceService } from '@/balance/balance.service'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { UtilsIntentService } from '@/intent/utils-intent.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { Hex } from 'viem'
import { EcoError } from '@/common/errors/eco-error'
import { getERC20Selector } from '@/contracts'
import * as chains from 'viem/chains'

jest.mock('@/intent/utils', () => {
  return {
    ...jest.requireActual('@/intent/utils'),
    getTransactionTargetData: mockGetTransactionTargetData,
  }
})
it('should ', async () => {
})
// describe.skip('FeasibilityService', () => {
//   let feasibilityService: any //FeasibilityService
//   let balanceService: DeepMocked<BalanceService>
//   let utilsIntentService: DeepMocked<UtilsIntentService>
//   let ecoConfigService: DeepMocked<EcoConfigService>
//   const mockLogDebug = jest.fn()
//   const mockLogLog = jest.fn()
//   const mockLogError = jest.fn()
//   const address1 = '0x1111111111111111111111111111111111111111'
//   const address2 = '0x2222222222222222222222222222222222222222'

//   const mockData = { model: { intent: { logIndex: 1, hash: '0x123' as Hex } }, solver: {} }

//   beforeEach(async () => {
//     const module: TestingModule = await Test.createTestingModule({
//       providers: [
//         FeasibilityService,
//         { provide: BalanceService, useValue: createMock<BalanceService>() },
//         { provide: UtilsIntentService, useValue: createMock<UtilsIntentService>() },
//         { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
//       ],
//     }).compile()

//     feasibilityService = module.get(FeasibilityService)
//     balanceService = module.get(BalanceService)
//     utilsIntentService = module.get(UtilsIntentService)
//     ecoConfigService = module.get(EcoConfigService)

//     feasibilityService['logger'].debug = mockLogDebug
//     feasibilityService['logger'].log = mockLogLog
//     feasibilityService['logger'].error = mockLogError

//     mockGetTransactionTargetData.mockClear()
//   })

//   describe('on validateExecution', () => {
//     it('should fail if there are no targets to validate', async () => {
//       const mockModel = { route: { calls: [] } }
//       const result = await feasibilityService.validateExecution(mockModel as any, {} as any)
//       expect(result).toEqual({
//         feasable: false,
//         results: { cause: 'route.calls.length != 1' },
//       })
//     })

//     it('should fail if the there are more than one call per intent', async () => {
//       const mockModel = {
//         route: {
//           calls: [
//             { data: '0x', target: address1 },
//             { data: '0x', target: address2 },
//           ],
//         },
//       }
//       const result = await feasibilityService.validateExecution(mockModel as any, {} as any)
//       expect(result).toEqual({
//         feasable: false,
//         results: { cause: 'route.calls.length != 1' },
//       })
//     })

//     it('should fail if the target fails execution', async () => {
//       const mockModel = {
//         route: {
//           calls: [{ data: '0x', target: address1 }],
//         },
//       }
//       jest
//         .spyOn(feasibilityService, 'validateEachExecution')
//         .mockResolvedValue({ solvent: true, profitable: false })
//       let result = await feasibilityService.validateExecution(mockModel as any, {} as any)
//       expect(result).toEqual({
//         feasable: false,
//         results: [{ solvent: true, profitable: false }],
//       })
//     })

//     it('should succeed if all targets succeed', async () => {
//       const mockModel = {
//         route: {
//           calls: [
//             { data: '', target: address1 },
//             //todo not alowing multiples
//             // { data: '', target: address2 },
//           ],
//         },
//       }
//       jest
//         .spyOn(feasibilityService, 'validateEachExecution')
//         .mockResolvedValue({ solvent: true, profitable: true })
//       const result = await feasibilityService.validateExecution(mockModel as any, {} as any)
//       expect(result).toEqual({
//         feasable: true,
//         results: [
//           { solvent: true, profitable: true },
//           //todo not alowing multiples
//           // { solvent: true, profitable: true },
//         ],
//       })
//     })
//   })

//   describe('on validateEachExecution', () => {
//     it('should fail if transaction can`t be destructured', async () => {
//       mockGetTransactionTargetData.mockImplementation(() => null)
//       const result = await feasibilityService.validateEachExecution(
//         mockData.model as any,
//         mockData.solver as any,
//         { data: '0xaa', target: '0xddd' } as any,
//       )
//       expect(mockLogError).toHaveBeenCalledWith({
//         msg: 'feasibility: Invalid transaction data',
//         model: mockData.model,
//         error: EcoError.FeasibilityIntentNoTransactionError.toString(),
//       })
//       expect(result).toBe(false)
//     })

//     it('should fail if the transaction isn`t on a ERC20 contract', async () => {
//       mockGetTransactionTargetData.mockReturnValue({
//         targetConfig: { contractType: 'erc721' },
//       } as any)
//       expect(
//         await feasibilityService.validateEachExecution(
//           mockData.model as any,
//           mockData.solver as any,
//           { data: '0xaa', target: '0xddd' } as any,
//         ),
//       ).toBe(false)
//     })

//     it('should succeed if the transaction is feasable', async () => {
//       mockGetTransactionTargetData.mockReturnValue({
//         targetConfig: { contractType: 'erc20' },
//       } as any)

//       //check false
//       jest
//         .spyOn(feasibilityService, 'handleErc20')
//         .mockResolvedValue({ solvent: false, profitable: false })
//       expect(
//         await feasibilityService.validateEachExecution(
//           mockData.model as any,
//           mockData.solver as any,
//           { data: '0xaa', target: '0xddd' } as any,
//         ),
//       ).toEqual({ solvent: false, profitable: false })

//       //check true
//       jest
//         .spyOn(feasibilityService, 'handleErc20')
//         .mockResolvedValue({ solvent: true, profitable: true })
//       expect(
//         await feasibilityService.validateEachExecution(
//           mockData.model as any,
//           mockData.solver as any,
//           { data: '0xaa', target: '0xddd' } as any,
//         ),
//       ).toEqual({ solvent: true, profitable: true })
//     })
//   })

//   describe('on handleErc20', () => {
//     it('should fail for unsupported selectors', async () => {
//       expect(
//         await feasibilityService.handleErc20(
//           { selector: 'asdf', decodedFunctionData: {} } as any,
//           {} as any,
//           {} as any,
//           {} as any,
//         ),
//       ).toEqual(undefined)
//     })

//     describe('on transfer', () => {
//       const amount = 100n
//       const handleData = {
//         selector: getERC20Selector('transfer'),
//         decodedFunctionData: { args: [address1, amount] },
//       }
//       const mockModel = {
//         route: { source: 1n },
//         reward: { tokens: [{ token: address1, amount: 200n }] },
//       }
//       const mockSolver = { chainID: 1 }
//       it('should fail a transfer where we lack the funds to fulfill', async () => {
//         jest.spyOn(balanceService, 'getTokenBalance').mockResolvedValue({ balance: 0n } as any)
//         expect(
//           await feasibilityService.handleErc20(
//             handleData as any,
//             mockModel as any,
//             {} as any,
//             {} as any,
//           ),
//         ).toEqual({ solvent: false, profitable: false })
//       })

//       it('should fail if we lack a matching source intent contract for the intent', async () => {
//         jest.spyOn(balanceService, 'getTokenBalance').mockResolvedValue({ balance: amount } as any)
//         jest
//           .spyOn(ecoConfigService, 'getIntentSources')
//           .mockReturnValue([{ chainID: mockModel.route.source + 10n } as any])
//         expect(
//           await feasibilityService.handleErc20(
//             handleData as any,
//             mockModel as any,
//             mockSolver as any,
//             {} as any,
//           ),
//         ).toEqual(undefined)
//       })

//       it('should fail if the transfer is not profitable', async () => {
//         jest.spyOn(balanceService, 'getTokenBalance').mockResolvedValue({ balance: amount } as any)
//         jest
//           .spyOn(ecoConfigService, 'getIntentSources')
//           .mockReturnValue([{ chainID: mockModel.route.source } as any])
//         jest.spyOn(feasibilityService, 'isProfitableErc20Transfer').mockReturnValue(false)
//         expect(
//           await feasibilityService.handleErc20(
//             handleData as any,
//             mockModel as any,
//             mockSolver as any,
//             {} as any,
//           ),
//         ).toEqual({ solvent: true, profitable: false })
//       })

//       it('should succeed if the solver is solvent and the transfer is profitable', async () => {
//         jest.spyOn(balanceService, 'getTokenBalance').mockResolvedValue({ balance: amount } as any)
//         jest
//           .spyOn(ecoConfigService, 'getIntentSources')
//           .mockReturnValue([{ chainID: mockModel.route.source } as any])
//         jest.spyOn(feasibilityService, 'isProfitableErc20Transfer').mockReturnValue(true)
//         expect(
//           await feasibilityService.handleErc20(
//             handleData as any,
//             mockModel as any,
//             mockSolver as any,
//             {} as any,
//           ),
//         ).toEqual({ solvent: true, profitable: true })
//       })
//     })
//   })

//   describe('on isProfitableErc20Transfer', () => {
//     const acceptedTokens = [address1, address2] as Hex[]
//     const rewards = [
//       { token: address1 as Hex, amount: 100n },
//       { token: address2 as Hex, amount: 200n },
//     ]
//     const fullfillAmountUSDC = 300n

//     beforeEach(async () => {
//       await feasibilityService.onModuleInit()
//     })

//     it('should return false if non of the reward tokens are accepted', async () => {
//       expect(
//         feasibilityService.isProfitableErc20Transfer(
//           BigInt(chains.base.id),
//           acceptedTokens,
//           [{ token: '0x3' as Hex, amount: 100n }],
//           fullfillAmountUSDC,
//         ),
//       ).toBe(false)
//     })

//     it('should return false if there are no reward tokens', async () => {
//       expect(
//         feasibilityService.isProfitableErc20Transfer(
//           BigInt(chains.base.id),
//           acceptedTokens,
//           [],
//           fullfillAmountUSDC,
//         ),
//       ).toBe(false)
//     })

//     it('should return false if the total reward sum is less than the cost of fulfillment plus a fee', async () => {
//       expect(
//         feasibilityService.isProfitableErc20Transfer(
//           BigInt(chains.base.id),
//           acceptedTokens,
//           rewards,
//           fullfillAmountUSDC + 100n,
//         ),
//       ).toBe(false)
//     })

//     it('should return true if the erc20 transfer is profitable', async () => {
//       expect(
//         feasibilityService.isProfitableErc20Transfer(
//           BigInt(chains.base.id),
//           acceptedTokens,
//           rewards,
//           fullfillAmountUSDC,
//         ),
//       ).toBe(true)
//     })
//   })

//   describe('on normalizeToken', () => {
//     it('should return the correct conversion', async () => {
//       const conversions = [
//         { network: 1n, token: address1, amount: 100n, conv: 100n },
//         { network: 2n, token: address2, amount: 200n, conv: 200n },
//       ]
//       conversions.forEach((conversion) => {
//         expect(
//           feasibilityService.normalizeToken(conversion.network, {
//             token: conversion.token as any,
//             amount: conversion.amount,
//           }),
//         ).toStrictEqual({ token: conversion.token, amount: conversion.conv })
//       })
//     })
//   })

//   describe('on denormalizeToken', () => {
//     it('should return the correct conversion', async () => {
//       const conversions = [
//         { network: 1n, token: address1, amount: 100n, conv: 100n },
//         { network: 2n, token: address2, amount: 200n, conv: 200n },
//       ]
//       conversions.forEach((conversion) => {
//         expect(
//           feasibilityService.deNormalizeToken(conversion.network, {
//             token: conversion.token as any,
//             amount: conversion.amount,
//           }),
//         ).toStrictEqual({ token: conversion.token, amount: conversion.conv })
//       })
//     })
//   })
// })
