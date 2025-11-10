import { PublicKey } from '@solana/web3.js';

import { VaultClient } from '../vault-client';

// Mock dependencies
jest.mock('node-vault');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    readFile: jest.fn(),
  },
}));

import * as fs from 'fs';

import vault from 'node-vault';

describe('VaultClient', () => {
  let vaultClient: VaultClient;
  let mockVaultInstance: any;
  let mockLogger: any;

  const mockEndpoint = 'https://vault.example.com';
  const mockTransitPath = 'transit';
  const mockKeyName = 'solana-key';

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    jest.restoreAllMocks();

    // Create mock vault client instance
    mockVaultInstance = {
      token: undefined,
      tokenLookupSelf: jest.fn().mockResolvedValue({ data: { id: 'token-id' } }),
      kubernetesLogin: jest.fn().mockResolvedValue({
        auth: {
          client_token: 'k8s-client-token',
        },
      }),
      write: jest.fn().mockResolvedValue({
        data: {
          signature: 'vault:v1:bW9ja1NpZ25hdHVyZURhdGE=',
        },
      }),
      read: jest.fn().mockResolvedValue({
        data: {
          keys: {
            '1': {
              public_key: 'MCowBQYDK2VwAyEAabcdefghijklmnopqrstuvwxyz123456', // Mock 44-byte base64-encoded DER key
            },
          },
        },
      }),
    };

    // Mock the vault factory function
    (vault as jest.MockedFunction<typeof vault>).mockReturnValue(mockVaultInstance);

    // Mock logger
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize vault client with correct configuration', () => {
      const authConfig = { type: 'token' as const, token: 'test-token' };
      vaultClient = new VaultClient(
        mockEndpoint,
        mockTransitPath,
        mockKeyName,
        authConfig,
        mockLogger,
      );

      expect(vault).toHaveBeenCalledWith({
        apiVersion: 'v1',
        endpoint: mockEndpoint,
      });
    });
  });

  describe('authenticate', () => {
    describe('token authentication', () => {
      it('should authenticate successfully with token', async () => {
        const authConfig = { type: 'token' as const, token: 'test-token' };
        vaultClient = new VaultClient(
          mockEndpoint,
          mockTransitPath,
          mockKeyName,
          authConfig,
          mockLogger,
        );

        await vaultClient.authenticate();

        expect(mockVaultInstance.token).toBe('test-token');
        expect(mockVaultInstance.tokenLookupSelf).toHaveBeenCalledTimes(1);
      });

      it('should throw error if token validation fails', async () => {
        const authConfig = { type: 'token' as const, token: 'invalid-token' };
        vaultClient = new VaultClient(
          mockEndpoint,
          mockTransitPath,
          mockKeyName,
          authConfig,
          mockLogger,
        );

        mockVaultInstance.tokenLookupSelf.mockRejectedValue(new Error('Invalid token'));

        await expect(vaultClient.authenticate()).rejects.toThrow(
          'Failed to authenticate with Vault: Invalid token',
        );
      });
    });

    describe('kubernetes authentication', () => {
      it('should authenticate successfully with jwt string', async () => {
        const authConfig = {
          type: 'kubernetes' as const,
          role: 'solver-role',
          mountPoint: 'kubernetes',
          jwt: 'mock-jwt-token',
        };
        vaultClient = new VaultClient(
          mockEndpoint,
          mockTransitPath,
          mockKeyName,
          authConfig,
          mockLogger,
        );

        await vaultClient.authenticate();

        expect(mockVaultInstance.kubernetesLogin).toHaveBeenCalledWith({
          jwt: 'mock-jwt-token',
          role: 'solver-role',
          mount_point: 'kubernetes',
        });
        expect(mockVaultInstance.token).toBe('k8s-client-token');
      });

      it('should authenticate successfully with jwtPath', async () => {
        const authConfig = {
          type: 'kubernetes' as const,
          role: 'solver-role',
          mountPoint: 'kubernetes',
          jwtPath: '/var/run/secrets/kubernetes.io/serviceaccount/token',
        };
        vaultClient = new VaultClient(
          mockEndpoint,
          mockTransitPath,
          mockKeyName,
          authConfig,
          mockLogger,
        );

        // Mock fs.promises.readFile
        const mockReadFile = jest
          .spyOn(fs.promises, 'readFile')
          .mockResolvedValue('  file-jwt-token  \n' as any);

        await vaultClient.authenticate();

        expect(mockReadFile).toHaveBeenCalledWith(
          '/var/run/secrets/kubernetes.io/serviceaccount/token',
          'utf8',
        );
        expect(mockVaultInstance.kubernetesLogin).toHaveBeenCalledWith({
          jwt: 'file-jwt-token', // Should be trimmed
          role: 'solver-role',
          mount_point: 'kubernetes',
        });
        expect(mockVaultInstance.token).toBe('k8s-client-token');
      });

      it('should throw error if neither jwt nor jwtPath provided', async () => {
        const authConfig = {
          type: 'kubernetes' as const,
          role: 'solver-role',
          mountPoint: 'kubernetes',
        } as any;
        vaultClient = new VaultClient(
          mockEndpoint,
          mockTransitPath,
          mockKeyName,
          authConfig,
          mockLogger,
        );

        await expect(vaultClient.authenticate()).rejects.toThrow(
          'Failed to authenticate with Vault: Kubernetes auth requires either jwt or jwtPath',
        );
      });

      it('should throw error if kubernetesLogin fails', async () => {
        const authConfig = {
          type: 'kubernetes' as const,
          role: 'solver-role',
          mountPoint: 'kubernetes',
          jwt: 'mock-jwt-token',
        };
        vaultClient = new VaultClient(
          mockEndpoint,
          mockTransitPath,
          mockKeyName,
          authConfig,
          mockLogger,
        );

        mockVaultInstance.kubernetesLogin.mockRejectedValue(new Error('Authentication failed'));

        await expect(vaultClient.authenticate()).rejects.toThrow(
          'Failed to authenticate with Vault: Authentication failed',
        );
      });

      it('should throw error if no client token returned', async () => {
        const authConfig = {
          type: 'kubernetes' as const,
          role: 'solver-role',
          mountPoint: 'kubernetes',
          jwt: 'mock-jwt-token',
        };
        vaultClient = new VaultClient(
          mockEndpoint,
          mockTransitPath,
          mockKeyName,
          authConfig,
          mockLogger,
        );

        mockVaultInstance.kubernetesLogin.mockResolvedValue({
          auth: null,
        });

        await expect(vaultClient.authenticate()).rejects.toThrow(
          'Failed to authenticate with Vault: Kubernetes authentication failed: no client token returned',
        );
      });

      it('should throw error if file read fails', async () => {
        const authConfig = {
          type: 'kubernetes' as const,
          role: 'solver-role',
          mountPoint: 'kubernetes',
          jwtPath: '/invalid/path/token',
        };
        vaultClient = new VaultClient(
          mockEndpoint,
          mockTransitPath,
          mockKeyName,
          authConfig,
          mockLogger,
        );

        jest.spyOn(fs.promises, 'readFile').mockRejectedValue(new Error('ENOENT: file not found'));

        await expect(vaultClient.authenticate()).rejects.toThrow(
          'Failed to authenticate with Vault: Failed to read Kubernetes service account token from /invalid/path/token: ENOENT: file not found',
        );
      });
    });

    describe('unsupported auth type', () => {
      it('should throw error for unsupported auth type', async () => {
        const authConfig = { type: 'unsupported' } as any;
        vaultClient = new VaultClient(
          mockEndpoint,
          mockTransitPath,
          mockKeyName,
          authConfig,
          mockLogger,
        );

        await expect(vaultClient.authenticate()).rejects.toThrow(
          'Failed to authenticate with Vault: Unsupported auth type: unsupported',
        );
      });
    });
  });

  describe('sign', () => {
    beforeEach(() => {
      const authConfig = { type: 'token' as const, token: 'test-token' };
      vaultClient = new VaultClient(
        mockEndpoint,
        mockTransitPath,
        mockKeyName,
        authConfig,
        mockLogger,
      );
    });

    it('should sign data successfully and extract 3-part signature', async () => {
      const mockData = new Uint8Array([1, 2, 3, 4, 5]);
      const expectedBase64 = Buffer.from(mockData).toString('base64');

      mockVaultInstance.write.mockResolvedValue({
        data: {
          signature: 'vault:v1:bW9ja1NpZ25hdHVyZURhdGE=',
        },
      });

      const signature = await vaultClient.sign(mockData);

      expect(mockVaultInstance.write).toHaveBeenCalledWith(
        `${mockTransitPath}/sign/${mockKeyName}`,
        {
          input: expectedBase64,
        },
      );

      // Verify signature is correctly extracted and decoded
      expect(signature).toBeInstanceOf(Uint8Array);
      const decodedSignature = Buffer.from(signature).toString('utf8');
      expect(decodedSignature).toBe('mockSignatureData');
    });

    it('should handle signature with more than 3 parts', async () => {
      const mockData = new Uint8Array([1, 2, 3]);

      mockVaultInstance.write.mockResolvedValue({
        data: {
          signature: 'vault:v1:dGVzdDpkYXRh:extra',
        },
      });

      const signature = await vaultClient.sign(mockData);

      // Should extract the 3rd part (index 2)
      expect(signature).toBeInstanceOf(Uint8Array);
      const decodedSignature = Buffer.from(signature).toString('utf8');
      expect(decodedSignature).toBe('test:data');
    });

    it('should throw error for malformed signature with less than 3 parts', async () => {
      const mockData = new Uint8Array([1, 2, 3]);

      mockVaultInstance.write.mockResolvedValue({
        data: {
          signature: 'vault:v1',
        },
      });

      await expect(vaultClient.sign(mockData)).rejects.toThrow(
        'Failed to sign with Vault: Invalid signature format from Vault: vault:v1',
      );
    });

    it('should throw error for signature with only 2 parts', async () => {
      const mockData = new Uint8Array([1, 2, 3]);

      mockVaultInstance.write.mockResolvedValue({
        data: {
          signature: 'vault:v1',
        },
      });

      await expect(vaultClient.sign(mockData)).rejects.toThrow(
        'Failed to sign with Vault: Invalid signature format from Vault: vault:v1',
      );
    });

    it('should throw error for completely malformed signature', async () => {
      const mockData = new Uint8Array([1, 2, 3]);

      mockVaultInstance.write.mockResolvedValue({
        data: {
          signature: 'invalid-format',
        },
      });

      await expect(vaultClient.sign(mockData)).rejects.toThrow(
        'Failed to sign with Vault: Invalid signature format from Vault: invalid-format',
      );
    });

    it('should throw error if no signature returned', async () => {
      const mockData = new Uint8Array([1, 2, 3]);

      mockVaultInstance.write.mockResolvedValue({
        data: {},
      });

      await expect(vaultClient.sign(mockData)).rejects.toThrow(
        'Failed to sign with Vault: Vault sign operation did not return a signature',
      );
    });

    it('should throw error if vault write fails', async () => {
      const mockData = new Uint8Array([1, 2, 3]);

      mockVaultInstance.write.mockRejectedValue(new Error('Vault connection error'));

      await expect(vaultClient.sign(mockData)).rejects.toThrow(
        'Failed to sign with Vault: Vault connection error',
      );
    });
  });

  describe('getPublicKey', () => {
    beforeEach(() => {
      const authConfig = { type: 'token' as const, token: 'test-token' };
      vaultClient = new VaultClient(
        mockEndpoint,
        mockTransitPath,
        mockKeyName,
        authConfig,
        mockLogger,
      );
    });

    it('should retrieve and cache public key', async () => {
      // Create a proper 44-byte DER-encoded public key
      // 12-byte header + 32-byte raw key
      const header = Buffer.from([
        0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
      ]);
      const rawKey = Buffer.from([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
        26, 27, 28, 29, 30, 31, 32,
      ]);
      const derKey = Buffer.concat([header, rawKey]);
      const base64Key = derKey.toString('base64');

      mockVaultInstance.read.mockResolvedValue({
        data: {
          keys: {
            '1': {
              public_key: base64Key,
            },
          },
        },
      });

      const publicKey1 = await vaultClient.getPublicKey();
      const publicKey2 = await vaultClient.getPublicKey();

      // Should only call vault once (cached)
      expect(mockVaultInstance.read).toHaveBeenCalledTimes(1);
      expect(mockVaultInstance.read).toHaveBeenCalledWith(`${mockTransitPath}/keys/${mockKeyName}`);

      // Both calls should return the same instance
      expect(publicKey1).toBe(publicKey2);
      expect(publicKey1).toBeInstanceOf(PublicKey);

      // Verify logger was called
      expect(mockLogger.log).toHaveBeenCalledWith('Vault client public key', {
        public_key: base64Key,
      });
    });

    it('should extract the latest key version', async () => {
      const header = Buffer.from([
        0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
      ]);
      const rawKey = Buffer.alloc(32, 1);
      const derKey = Buffer.concat([header, rawKey]);

      mockVaultInstance.read.mockResolvedValue({
        data: {
          keys: {
            '1': {
              public_key: derKey.toString('base64'),
            },
            '3': {
              public_key: derKey.toString('base64'),
            },
            '2': {
              public_key: derKey.toString('base64'),
            },
          },
        },
      });

      await vaultClient.getPublicKey();

      // Should use version 3 (latest)
      expect(mockVaultInstance.read).toHaveBeenCalledTimes(1);
    });

    it('should throw error if DER key is not 44 bytes', async () => {
      const invalidDerKey = Buffer.alloc(40); // Wrong size
      const base64Key = invalidDerKey.toString('base64');

      mockVaultInstance.read.mockResolvedValue({
        data: {
          keys: {
            '1': {
              public_key: base64Key,
            },
          },
        },
      });

      await expect(vaultClient.getPublicKey()).rejects.toThrow(
        'Failed to get public key from Vault: Expected 44-byte DER-encoded public key from Vault, got 40 bytes',
      );
    });

    it('should throw error if no key data returned', async () => {
      mockVaultInstance.read.mockResolvedValue({
        data: {},
      });

      await expect(vaultClient.getPublicKey()).rejects.toThrow(
        'Failed to get public key from Vault: Vault did not return key information',
      );
    });

    it('should throw error if no key versions found', async () => {
      mockVaultInstance.read.mockResolvedValue({
        data: {
          keys: {},
        },
      });

      await expect(vaultClient.getPublicKey()).rejects.toThrow(
        'Failed to get public key from Vault: No key versions found in Vault',
      );
    });

    it('should throw error if public_key missing in key data', async () => {
      mockVaultInstance.read.mockResolvedValue({
        data: {
          keys: {
            '1': {},
          },
        },
      });

      await expect(vaultClient.getPublicKey()).rejects.toThrow(
        'Failed to get public key from Vault: Public key not found in Vault key data',
      );
    });

    it('should throw error if vault read fails', async () => {
      mockVaultInstance.read.mockRejectedValue(new Error('Connection timeout'));

      await expect(vaultClient.getPublicKey()).rejects.toThrow(
        'Failed to get public key from Vault: Connection timeout',
      );
    });
  });
});
