import { GatewayHttpClient } from './gateway-client'

describe('GatewayHttpClient', () => {
  const baseUrl = 'https://gateway-api-testnet.circle.com'
  let client: GatewayHttpClient

  beforeEach(() => {
    client = new GatewayHttpClient(baseUrl)
    // @ts-ignore override global fetch for tests
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('getInfo returns parsed json on 200', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: () => ({ domains: [] }) })
    const res = await client.getInfo()
    expect(res).toEqual({ domains: [] })
    expect(global.fetch).toHaveBeenCalledWith(new URL('/v1/info', baseUrl))
  })

  it('getInfo throws with status and body on non-200', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => 'err',
    })
    await expect(client.getInfo()).rejects.toThrow(/Gateway info failed/i)
  })

  it('getBalances posts body and returns json', async () => {
    const payload = { token: 'USDC', sources: [{ domain: 2, depositor: '0xabc' }] }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: () => ({ balances: [] }) })
    const res = await client.getBalances(payload as any)
    expect(res).toEqual({ balances: [] })
    expect(global.fetch).toHaveBeenCalledWith(
      new URL('/v1/balances', baseUrl),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('getBalances throws with status and body on non-200', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: () => 'bad',
    })
    await expect(client.getBalances({ token: 'USDC', sources: [] } as any)).rejects.toThrow(
      /Gateway balances failed: 400 bad/,
    )
  })

  it('createTransferAttestation posts body and returns json', async () => {
    const payload = { burnIntents: [] }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => ({ attestation: '0x', signature: '0x', transferId: 't1' }),
    })
    const res = await client.createTransferAttestation(payload as any)
    expect(res).toEqual({ attestation: '0x', signature: '0x', transferId: 't1' })
    expect(global.fetch).toHaveBeenCalledWith(
      new URL('/v1/transfers/attestations', baseUrl),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('createTransferAttestation throws with status and body on non-200', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () => 'not found',
    })
    await expect(client.createTransferAttestation({ burnIntents: [] } as any)).rejects.toThrow(
      /Gateway attestation failed: 404 not found/,
    )
  })

  it('encodeBurnIntents throws since endpoint is unavailable', async () => {
    await expect(
      client.encodeBurnIntents({
        token: 'USDC',
        value: '1',
        destination: { domain: 2, recipient: '0x' },
        sources: [],
      } as any),
    ).rejects.toThrow(/not available/i)
  })
})
