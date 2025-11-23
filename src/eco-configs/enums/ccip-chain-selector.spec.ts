import { CCIPChainSelector } from '@/eco-configs/enums/ccip-chain-selector.enum'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoTester } from '@/common/test-utils/eco-tester/eco-tester'
import { TestingModule, Test } from '@nestjs/testing'

let $: EcoTester
let ecoConfigService: EcoConfigService

describe('CCIPChainSelector', () => {
  beforeAll(async () => {

    const mockSource = {
      getConfig: () => ({
        rpcs: {
          keys: {
            '0x1234': '0x1234',
          },
        },
        CCIP :{
          routerAddress: '0xda1513e4BD479AF7Ac192FAc101dD94A7F6F9c0b',
          defaultGasLimit: 300000n,
          allowOutOfOrderExecution: true,
        },
      }),
    }

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: EcoConfigService, useValue: new EcoConfigService([mockSource as any]) },
      ],
    }).compile()

    ecoConfigService = mod.get(EcoConfigService)
  })

  beforeEach(() => {
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Static selectors', () => {
    it('should return the correct selector ID for a given chain ID', () => {
      expect(CCIPChainSelector.getCCIPSelector(1)).toBe(5009297550715157269n)
      expect(CCIPChainSelector.getCCIPSelector(2020)).toBe(6916147374840168594n)
      expect(CCIPChainSelector.getCCIPSelector(8453)).toBe(15971525489660198786n)
    })

    it('should return the correct chain ID from enum instance', () => {
      expect(CCIPChainSelector.OPTIMISM.getChainID()).toBe(10)
      expect(CCIPChainSelector.ARBITRUM.getChainID()).toBe(42161)
    })

    it('should throw for unknown chain IDs', () => {
      expect(() => CCIPChainSelector.getCCIPSelector(999999)).toThrow(/invalid chainID/)
      expect(() => CCIPChainSelector.fromChainID(404)).toThrow(/invalid chainID/)
    })

    it('should throw for unknown selector IDs', () => {
      expect(() => CCIPChainSelector.fromSelectorID(123n)).toThrow(/invalid selectorID/)
    })
  })

  describe('Enum roundtrip', () => {
    it('should roundtrip enum → string → enum', () => {
      const selector = CCIPChainSelector.POLYGON
      const roundtrip = CCIPChainSelector.fromString(selector.toString())
      expect(roundtrip).toBe(selector)
    })

    it('should throw for invalid string keys', () => {
      expect(() => CCIPChainSelector.fromString('INVALID')).toThrow(/invalid enumstr/)
      expect(() => CCIPChainSelector.fromString('')).toThrow(/string is empty/)
    })
  })

  describe('Getters and utilities', () => {
    it('should return string form of selector ID', () => {
      const s = CCIPChainSelector.BASE.getSelectorString()
      expect(s).toBe('15971525489660198786')
    })

    it('should return all supported chain IDs', () => {
      const supported = CCIPChainSelector.prototype.getCCIPSupportedChains()
      expect(supported).toEqual(expect.arrayContaining([1, 10, 137, 2020, 8453, 42161]))
    })

    it('should confirm supported and unsupported chains correctly', () => {
      expect(CCIPChainSelector.isCCIPSupportedChain(137)).toBe(true)
      expect(CCIPChainSelector.isCCIPSupportedChain(99999)).toBe(false)
    })

    it('should confirm selector ID existence correctly', () => {
      expect(CCIPChainSelector.hasSelectorID(5009297550715157269n)).toBe(true)
      expect(CCIPChainSelector.hasSelectorID(0n)).toBe(false)
    })
  })

  describe('Integration with config', () => {
    it('should fetch EcoConfigService values', () => {
      expect(ecoConfigService.getCCIPConfig().routerAddress).toBe('0xda1513e4BD479AF7Ac192FAc101dD94A7F6F9c0b')
      expect(ecoConfigService.getCCIPConfig().defaultGasLimit).toBe(300000n)
      expect(ecoConfigService.getCCIPConfig().allowOutOfOrderExecution).toBe(true)
    })
  })
})
