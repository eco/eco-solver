jest.mock('viem', () => ({
  ...jest.requireActual('viem'),
  http: jest.fn(),
  webSocket: jest.fn(),
  fallback: jest.fn(),
}))

describe('getTransport', () => {
  const mockHttpTransport = { type: 'http' }
  const mockWsTransport = { type: 'ws' }
  const mockFallbackTransport = { type: 'fallback' }

  beforeEach(() => {
    ;(http as jest.Mock).mockClear().mockReturnValue(mockHttpTransport)
    ;(webSocket as jest.Mock).mockClear().mockReturnValue(mockWsTransport)
    ;(fallback as jest.Mock).mockClear().mockReturnValue(mockFallbackTransport)
  })

  it('should return a single http transport for a single http rpc url', () => {
    const rpcUrls = ['http://test.rpc']
    const transport = getTransport(rpcUrls)

    expect(http).toHaveBeenCalledWith(rpcUrls[0], undefined)
    expect(http).toHaveBeenCalledTimes(1)
    expect(webSocket).not.toHaveBeenCalled()
    expect(fallback).not.toHaveBeenCalled()
    expect(transport).toEqual(mockHttpTransport)
  })

  it('should return a fallback transport for multiple http rpc urls', () => {
    const rpcUrls = ['http://test.rpc', 'http://test2.rpc']
    const transport = getTransport(rpcUrls)

    expect(http).toHaveBeenCalledTimes(2)
    expect(http).toHaveBeenCalledWith(rpcUrls[0], undefined)
    expect(http).toHaveBeenCalledWith(rpcUrls[1], undefined)
    expect(webSocket).not.toHaveBeenCalled()
    expect(fallback).toHaveBeenCalledTimes(1)
    expect(fallback).toHaveBeenCalledWith([mockHttpTransport, mockHttpTransport], { rank: true })
    expect(transport).toEqual(mockFallbackTransport)
  })

  it('should return a single websocket transport for a single websocket rpc url', () => {
    const rpcUrls = ['ws://test.rpc']
    const transport = getTransport(rpcUrls, { isWebsocket: true })

    expect(webSocket).toHaveBeenCalledWith(rpcUrls[0], { keepAlive: true, reconnect: true })
    expect(webSocket).toHaveBeenCalledTimes(1)
    expect(http).not.toHaveBeenCalled()
    expect(fallback).not.toHaveBeenCalled()
    expect(transport).toEqual(mockWsTransport)
  })

  it('should return a fallback transport for multiple websocket rpc urls', () => {
    const rpcUrls = ['ws://test.rpc', 'ws://test2.rpc']
    const transport = getTransport(rpcUrls, { isWebsocket: true })

    expect(webSocket).toHaveBeenCalledTimes(2)
    expect(webSocket).toHaveBeenCalledWith(rpcUrls[0], { keepAlive: true, reconnect: true })
    expect(webSocket).toHaveBeenCalledWith(rpcUrls[1], { keepAlive: true, reconnect: true })
    expect(http).not.toHaveBeenCalled()
    expect(fallback).toHaveBeenCalledTimes(1)
    expect(fallback).toHaveBeenCalledWith([mockWsTransport, mockWsTransport], { rank: true })
    expect(transport).toEqual(mockFallbackTransport)
  })

  it('should pass http config to http transport', () => {
    const rpcUrls = ['http://test.rpc']
    const config = { config: { timeout: 1000 } }
    getTransport(rpcUrls, config)
    expect(http).toHaveBeenCalledWith(rpcUrls[0], config.config)
  })

  it('should pass websocket config to websocket transport', () => {
    const rpcUrls = ['ws://test.rpc']
    const config = { isWebsocket: true, config: { key: 'test' } } as const
    getTransport(rpcUrls, config)
    expect(webSocket).toHaveBeenCalledWith(rpcUrls[0], {
      keepAlive: true,
      reconnect: true,
      ...config.config,
    })
  })

  it('should handle an empty array of rpcUrls', () => {
    const transport = getTransport([])
    expect(transport).toBeUndefined()
    expect(http).not.toHaveBeenCalled()
    expect(webSocket).not.toHaveBeenCalled()
    expect(fallback).not.toHaveBeenCalled()
  })
})
