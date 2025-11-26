import { Enumify } from 'enumify'

class CCIPChainSelectorParams {
  chainID: number
  selectorID: bigint
}

export class CCIPChainSelector extends Enumify {
  static ETHEREUM = new CCIPChainSelector({
    chainID: 1,
    selectorID: 5009297550715157269n,
  })

  static BASE = new CCIPChainSelector({
    chainID: 8453,
    selectorID: 15971525489660198786n,
  })

  static RONIN = new CCIPChainSelector({
    chainID: 2020,
    selectorID: 6916147374840168594n,
  })

  static OPTIMISM = new CCIPChainSelector({
    chainID: 10,
    selectorID: 3734403246176062136n,
  })

  static ARBITRUM = new CCIPChainSelector({
    chainID: 42161,
    selectorID: 4949039107694359620n,
  })

  static POLYGON = new CCIPChainSelector({
    chainID: 137,
    selectorID: 4051577828743386545n,
  })

  static _ = CCIPChainSelector.closeEnum()

  private static selectorIDToSelectorMap = new Map<bigint, CCIPChainSelector>()

  static initializeSelectorIDToSelectorMap() {
    for (const chainSelector of this.getAllCCIPChainSelectors()) {
      this.selectorIDToSelectorMap.set(chainSelector.getSelectorID(), chainSelector)
    }
  }

  private static chainIDToSelectorMap = new Map<number, CCIPChainSelector>()

  static initializeChainIDToSelectorMap() {
    for (const chainSelector of this.getAllCCIPChainSelectors()) {
      this.chainIDToSelectorMap.set(chainSelector.getChainID(), chainSelector)
    }
  }

  static initialize() {
    this.initializeSelectorIDToSelectorMap()
    this.initializeChainIDToSelectorMap()
  }

  constructor(private params: CCIPChainSelectorParams) {
    super()
  }

  static getAllCCIPChainSelectors(): CCIPChainSelector[] {
    return CCIPChainSelector.enumValues as CCIPChainSelector[]
  }

  getCCIPSupportedChains(): number[] {
    return Array.from(CCIPChainSelector.chainIDToSelectorMap.keys())
  }

  static isCCIPSupportedChain(chainID: number): boolean {
    return this.chainIDToSelectorMap.has(chainID)
  }

  static hasSelectorID(selectorID: bigint): boolean {
    return this.selectorIDToSelectorMap.has(selectorID)
  }

  static fromString(enumstr: string): CCIPChainSelector {
    if (!enumstr) {
      throw new Error(`CCIP Chain Selector string is empty`)
    }

    const value = CCIPChainSelector.enumValueOf(enumstr)
    if (value) {
      return value as CCIPChainSelector
    }

    throw new Error(`CCIP Chain Selector invalid enumstr: ${enumstr}`)
  }

  static fromStrings(enumstrs: string[]): CCIPChainSelector[] {
    return enumstrs.map((enumstr) => this.fromString(enumstr))
  }

  static fromChainID(chainID: number): CCIPChainSelector {
    if (!this.isCCIPSupportedChain(chainID)) {
      throw new Error(`CCIP Chain Selector invalid chainID: ${chainID}`)
    }

    return this.chainIDToSelectorMap.get(chainID)!
  }

  static getCCIPSelector(chainID: number): bigint {
    return this.fromChainID(chainID).getSelectorID()
  }

  static fromSelectorID(selectorID: bigint): CCIPChainSelector {
    if (!this.hasSelectorID(selectorID)) {
      throw new Error(`CCIP Chain Selector invalid selectorID: ${selectorID}`)
    }

    return this.selectorIDToSelectorMap.get(selectorID)!
  }

  getChainID(): number {
    return this.params.chainID
  }

  getSelectorID(): bigint {
    return this.params.selectorID
  }

  getSelectorString(): string {
    return this.getSelectorID().toString()
  }

  toString() {
    return this.enumKey
  }
}

CCIPChainSelector.initialize()
