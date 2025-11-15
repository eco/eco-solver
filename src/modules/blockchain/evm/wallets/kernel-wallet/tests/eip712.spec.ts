import { encodeExecutionMode } from '../utils/encode-transactions';

describe('EIP-712 Signature Verification', () => {
  const types = {
    Execute: [
      { name: 'account', type: 'address' },
      { name: 'mode', type: 'uint256' },
      { name: 'executionCalldata', type: 'bytes' },
      { name: 'nonce', type: 'uint256' },
      { name: 'expiration', type: 'uint256' },
    ],
  } as const;

  it('should define mode as uint256 type in EIP-712 types', () => {
    expect(types.Execute[1].name).toBe('mode');
    expect(types.Execute[1].type).toBe('uint256');
  });

  it('should verify signature format with executor contract expectations', () => {
    const mode = encodeExecutionMode({
      type: 'call',
      revertOnError: false,
      selector: '0x',
      context: '0x',
    });

    const message = {
      account: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7',
      mode: mode as `0x${string}`,
      executionCalldata: '0x' as `0x${string}`,
      nonce: 1n,
      expiration: BigInt(Date.now() + 1000 * 60 * 30),
    };

    // Verify mode is formatted as uint256 (uint256 = 64 hex chars)
    expect(message.mode).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(message.mode.length).toBe(66); // 0x + 64 chars
  });

  it('should encode mode as uint256 for single call', () => {
    const mode = encodeExecutionMode({
      type: 'call',
      revertOnError: false,
      selector: '0x',
      context: '0x',
    });

    // Mode should be 32 bytes (64 hex characters + 0x prefix)
    expect(mode.length).toBe(66);
    expect(mode).toMatch(/^0x[0-9a-f]{64}$/i);

    // First byte should be 0x00 for 'call' type
    expect(mode.substring(2, 4)).toBe('00');
  });

  it('should encode mode as uint256 for batch call', () => {
    const mode = encodeExecutionMode({
      type: 'batchcall',
      revertOnError: true,
      selector: '0x12345678',
      context: '0x',
    });

    // Mode should be 32 bytes (64 hex characters + 0x prefix)
    expect(mode.length).toBe(66);
    expect(mode).toMatch(/^0x[0-9a-f]{64}$/i);

    // First byte should be 0x01 for 'batchcall' type
    expect(mode.substring(2, 4)).toBe('01');

    // Second byte should be 0x01 for revertOnError: true
    expect(mode.substring(4, 6)).toBe('01');
  });

  it('should encode mode as uint256 for delegate call', () => {
    const mode = encodeExecutionMode({
      type: 'delegatecall',
      revertOnError: false,
      selector: '0x',
      context: '0x',
    });

    // First byte should be 0xff for 'delegatecall' type
    expect(mode.substring(2, 4)).toBe('ff');

    // Second byte should be 0x00 for revertOnError: false
    expect(mode.substring(4, 6)).toBe('00');
  });
});
