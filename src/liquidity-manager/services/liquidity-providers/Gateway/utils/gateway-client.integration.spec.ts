import { GatewayHttpClient } from './gateway-client'

// These tests hit Circle Gateway testnet endpoints. Set GATEWAY_API_URL to override if needed.
// Default: https://gateway-api-testnet.circle.com

describe('GatewayHttpClient (integration)', () => {
  const baseUrl = process.env.GATEWAY_API_URL || 'https://gateway-api-testnet.circle.com'
  const client = new GatewayHttpClient(baseUrl)

  // Allow enough time for network calls
  jest.setTimeout(30000)

  it('getInfo returns domains with expected shape', async () => {
    const res = await client.getInfo()
    expect(res).toBeDefined()
    expect(Array.isArray(res.domains)).toBe(true)
    expect(res.domains.length).toBeGreaterThan(0)

    const d = res.domains[0]
    expect(typeof d.domain).toBe('number')
    expect(typeof d.chain).toBe('string')
    expect(typeof d.network).toBe('string')
    // walletContract/minterContract may be undefined depending on domain/role
  })

  it('getBalances returns balances array for a depositor/domain', async () => {
    const info = await client.getInfo()
    const anyDomain = info.domains.find((x) => typeof x.domain === 'number')?.domain
    expect(typeof anyDomain).toBe('number')

    // Use a placeholder depositor. Expect balance entry to exist (likely 0) and be a numeric string
    const depositor = '0x000000000000000000000000000000000000dEaD'
    const resp = await client.getBalances({
      token: 'USDC',
      sources: [{ domain: anyDomain!, depositor }],
    })
    expect(resp).toBeDefined()
    expect(Array.isArray(resp.balances)).toBe(true)

    const entry = resp.balances.find((b) => b.domain === anyDomain)
    // Some environments may echo back only provided sources; ensure we can parse the balance string
    expect(entry).toBeDefined()
    expect(typeof entry!.balance).toBe('string')
    expect(/^[0-9]+$/.test(entry!.balance)).toBe(true)
  })

  it('getBalancesForDepositor returns all-domain balances for a depositor', async () => {
    const depositor = '0xca3C936c60DbF03CFA17a380DC0298E5bEC95107'
    const resp = await (client as any).getBalancesForDepositor('USDC', depositor)
    expect(resp).toBeDefined()
    expect(Array.isArray(resp.balances)).toBe(true)
    // Should include zero or non-zero balances across supported domains
    for (const b of resp.balances) {
      expect(typeof b.domain).toBe('number')
      expect(typeof b.balance).toBe('string')
      expect(/^[0-9]+(\.[0-9]+)?$/.test(b.balance) || /^[0-9]+$/.test(b.balance)).toBe(true)
    }
  })
})
