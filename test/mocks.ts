// Mock implementations for testing

export const mockEvmConfigService = {
  getNetworkByChainId: jest.fn().mockReturnValue({
    chainId: 1,
    name: 'Ethereum',
    supportedTokens: [],
  }),
  getStandardFees: jest.fn().mockReturnValue({
    baseFee: BigInt(10000000000000000),
    percentageFee: 100,
  }),
  supportedChainIds: [1, 10, 137],
};

export const mockFulfillmentConfigService = {
  getExpirationBuffer: jest.fn().mockReturnValue(3600000),
  getRouteAmountLimit: jest.fn().mockReturnValue(BigInt(5000000000000000000)),
  getNativeIntentFees: jest.fn().mockReturnValue({
    baseFee: BigInt(20000000000000000),
    percentageFee: 150,
  }),
  getCrowdLiquidityFees: jest.fn().mockReturnValue({
    baseFee: BigInt(5000000000000000),
    percentageFee: 50,
  }),
};

export const mockBlockchainReaderService = {
  isIntentFunded: jest.fn(),
  getBalance: jest.fn(),
  getTokenBalance: jest.fn(),
};

export const mockBlockchainExecutorService = {
  isChainSupported: jest.fn(),
};

export const mockProverService = {
  validateRoute: jest.fn(),
};
