import { KMSProviderAWS } from '@eco-foundation/eco-kms-provider-aws';
import { KMSWallets } from '@eco-foundation/eco-kms-wallets';
import { Address } from 'viem';
import { toAccount } from 'viem/accounts';

import { kmsToAccount } from '../kms-account';

jest.mock('viem/accounts');
jest.mock('@eco-foundation/eco-kms-provider-aws');
jest.mock('@eco-foundation/eco-kms-wallets');

describe('kmsToAccount', () => {
  const mockConfig = {
    keyId: 'arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012',
    region: 'us-east-1',
  };

  const mockAddress = '0x1234567890123456789012345678901234567890' as Address;
  const mockPublicKey = '0x04abcdef...';
  const mockProvider = { id: 'provider' };
  const mockKmsWallet = {
    getAddress: jest.fn().mockResolvedValue(mockAddress),
    publicKey: jest.fn().mockResolvedValue(mockPublicKey),
    getPublickey: jest.fn().mockResolvedValue(Buffer.from(mockPublicKey.slice(2), 'hex')),
    getAddressHex: jest.fn().mockResolvedValue(mockAddress),
  };
  const mockAccount = {
    address: mockAddress,
    publicKey: mockPublicKey,
    source: 'custom',
    type: 'local',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock KMS provider
    (KMSProviderAWS as jest.Mock).mockImplementation(() => mockProvider);

    // Mock KMS wallet
    (KMSWallets as jest.Mock).mockImplementation(() => mockKmsWallet);

    // Mock toAccount
    (toAccount as jest.Mock).mockReturnValue(mockAccount);
  });

  describe('account creation', () => {
    it('should create KMS account with required config', async () => {
      const account = await kmsToAccount(mockConfig);

      expect(account).toBe(mockAccount);

      // Verify provider creation
      expect(KMSProviderAWS).toHaveBeenCalledWith({
        region: mockConfig.region,
        credentials: undefined,
      });

      // Verify wallet creation
      expect(KMSWallets).toHaveBeenCalledWith({
        keyId: mockConfig.keyId,
        provider: mockProvider,
      });

      // Verify toAccount was called
      expect(toAccount).toHaveBeenCalled();
    });

    it('should create KMS account with AWS credentials', async () => {
      const configWithCredentials = {
        ...mockConfig,
        credentials: {
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          sessionToken: 'AQoEXAMPLEH4aoAH0gNCAPy...',
        },
      };

      await kmsToAccount(configWithCredentials);

      expect(KMSProviderAWS).toHaveBeenCalledWith({
        region: configWithCredentials.region,
        credentials: configWithCredentials.credentials,
      });
    });
  });

  describe('error handling', () => {
    it('should handle provider creation errors', async () => {
      const error = new Error('Failed to create provider');
      (KMSProviderAWS as jest.Mock).mockImplementation(() => {
        throw error;
      });

      await expect(kmsToAccount(mockConfig)).rejects.toThrow(error);
    });

    it('should handle wallet creation errors', async () => {
      const error = new Error('Failed to create wallet');
      (KMSWallets as jest.Mock).mockImplementation(() => {
        throw error;
      });

      await expect(kmsToAccount(mockConfig)).rejects.toThrow(error);
    });
  });
});
