import { getRpcUrl, addressKeys, convertBigIntsToStrings } from '../utils'
import { Chain, InvalidAddressError } from 'viem'

const mockApiKeys = { alchemy: 'alchemy', quicknode: 'quicknode' }

describe('Viem Utils', () => {
  describe('getRpcUrl', () => {
    let defaultOpts
    let customRpcUrls
    let mockChain: Chain
    let mockAlchemyChain: Chain

    beforeEach(() => {
      defaultOpts = { alchemyApiKey: 'alchemy' }
      customRpcUrls = {
        http: ['https://chain-rpc.com'],
      }

      mockChain = {
        id: 10,
        rpcUrls: {
          default: { http: ['https://default-url'], webSocket: ['wss://default-url'] },
          secondary: { http: ['https://secondary-url'], webSocket: ['wss://secondary-url'] },
        },
      } as any
      mockAlchemyChain = {
        rpcUrls: {
          default: { http: ['https://default-url'], webSocket: ['wss://default-url'] },
          alchemy: {
            http: ['https://test.g.alchemy.com/v2'],
            webSocket: ['wss://test.g.alchemy.com/v2'],
          },
        },
      } as any
    })

    describe('when the chain has no secondary RPC URL', () => {
      beforeEach(() => {
        delete mockChain.rpcUrls.secondary
      })

      it('should return the default HTTP URL when websocket is disabled', () => {
        const result = getRpcUrl(mockChain, defaultOpts)
        expect(result).toEqual({ url: mockChain.rpcUrls.default.http[0], isWebsocket: false })
      })

      it('should return the default WebSocket URL when websocket is enabled', () => {
        const result = getRpcUrl(mockChain, { ...defaultOpts, websocketEnabled: true })
        expect(result).toEqual({ url: mockChain.rpcUrls.default.webSocket![0], isWebsocket: true })
      })
    })

    describe('when the chain has a secondary RPC URL', () => {
      it('should return the secondary HTTP URL when websocket is disabled', () => {
        const result = getRpcUrl(mockChain, defaultOpts)
        expect(result).toEqual({ url: mockChain.rpcUrls.secondary.http[0], isWebsocket: false })
      })

      it('should return the secondary WebSocket URL when websocket is enabled', () => {
        const result = getRpcUrl(mockChain, { ...defaultOpts, websocketEnabled: true })
        expect(result).toEqual({
          url: mockChain.rpcUrls.secondary.webSocket![0],
          isWebsocket: true,
        })
      })

      it('should return the secondary HTTP URL when websocket is enabled but does not exist', () => {
        delete mockChain.rpcUrls.secondary.webSocket
        const result = getRpcUrl(mockChain, { ...defaultOpts, websocketEnabled: true })
        expect(result).toEqual({ url: mockChain.rpcUrls.secondary.http[0], isWebsocket: false })
      })

      it('should not append the API key if the URL provided is not from Alchemy', () => {
        const result = getRpcUrl(mockChain, defaultOpts)
        expect(result).toEqual({
          url: mockChain.rpcUrls.secondary.http[0],
          isWebsocket: false,
        })
      })

      it('should append the API key if the URL provided is from Alchemy', () => {
        const result = getRpcUrl(mockAlchemyChain, defaultOpts)
        expect(result).toEqual({
          url: mockAlchemyChain.rpcUrls.alchemy.http[0] + `/${defaultOpts.alchemyApiKey}`,
          isWebsocket: false,
        })
      })
    })

    describe('when their is a custom RPC for the chain', () => {
      it('should return the custom RPC URL for the chain', () => {
        const result = getRpcUrl(mockAlchemyChain, { ...defaultOpts, rpcUrls: customRpcUrls })
        expect(result).toEqual({
          url: customRpcUrls.http[0],
          isWebsocket: false,
        })
      })
    })
  })

  describe('addressKeys', () => {
    const add = '0x6d9EedE368621F173E5c93384CFcCbfeE19f9609'
    const unchecksumedAdd = '0x6d9eede368621f173e5c93384cfccbfee19f9609'
    it('should return empty if the input is empty', () => {
      const result = addressKeys({})
      expect(result).toStrictEqual({})
    })

    it('should throw if a key isn`t a valid eth address', () => {
      const invalidAddress = '0x123'
      expect(() => addressKeys({ [add]: 11, [invalidAddress]: 22 })).toThrow(
        new InvalidAddressError({ address: invalidAddress }),
      )
    })

    it('should checksum all address keys in the top level of the object', () => {
      const input = { [unchecksumedAdd]: 123 }
      const result = addressKeys(input)
      expect(result).toEqual({ [add]: 123 })
    })
  })

  describe('convertBigIntsToStrings', () => {
    it('should return null if the input is null', () => {
      const result = convertBigIntsToStrings(null)
      expect(result).toBeNull()
    })

    it('should return undefined if the input is undefined', () => {
      const result = convertBigIntsToStrings(undefined)
      expect(result).toBeUndefined()
    })

    it('should convert BigInt values to strings', () => {
      const input = { a: BigInt(123), b: 456n }
      const result = convertBigIntsToStrings(input)
      expect(result).toEqual({ a: '123', b: '456' })
    })

    it('should handle nested objects with BigInt values', () => {
      const input = { a: { b: BigInt(123) } }
      const result = convertBigIntsToStrings(input)
      expect(result).toEqual({ a: { b: '123' } })
    })

    it('should handle arrays with BigInt values', () => {
      const input = [BigInt(123), 456n]
      const result = convertBigIntsToStrings(input)
      expect(result).toEqual(['123', '456'])
    })
  })
})
