import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { RequestSignatureGuard } from './request-signature.guard';
import { SignatureVerificationService } from './signature-verification.service';
import { ConfigFactory } from '@/config/config-factory';
import { getSignatureHeaders } from './signature-headers';
import { mnemonicToAccount } from 'viem/accounts';
import { Hex } from 'viem';
import { DOMAIN, TYPES } from './typed-data';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const canonicalize = require('canonicalize');

describe('RequestSignatureGuard - Integration Tests', () => {
  const TEST_MNEMONIC = 'test test test test test test test test test test test junk';
  const testAccount = mnemonicToAccount(TEST_MNEMONIC);
  const TEST_ADDRESS = testAccount.address.toLowerCase();

  let guard: RequestSignatureGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RequestSignatureGuard, SignatureVerificationService],
    }).compile();

    guard = module.get<RequestSignatureGuard>(RequestSignatureGuard);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createMockExecutionContext = (
    method: string = 'POST',
    url: string = '/api/v1/configuration',
    body: Record<string, unknown> = { key: 'test.key', value: 'test-value' },
    headers: Record<string, unknown> | object = {},
  ): ExecutionContext => {
    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          method,
          url,
          body,
          headers,
        }),
      }),
    } as unknown as ExecutionContext;
  };

  const createRealSignature = async (payload: object, expiryTime: number): Promise<Hex> => {
    const canonicalPayload = canonicalize(payload);

    const signature = await testAccount.signTypedData({
      domain: DOMAIN,
      types: TYPES,
      primaryType: 'Registration',
      message: {
        payload: canonicalPayload,
        expiryTime: BigInt(expiryTime),
      },
    });

    return signature;
  };

  describe('Valid Signatures', () => {
    it('should accept a request with a valid real signature', async () => {
      jest.spyOn(ConfigFactory, 'isRequestSignatureValidationEnabled').mockReturnValue(true);
      jest.spyOn(ConfigFactory, 'getDynamicConfigAllowedAddresses').mockReturnValue([TEST_ADDRESS]);

      const payload = { key: 'test.key', value: 'test-value' };
      const expiryTime = Date.now() + 60000; // 1 minute from now
      const signature = await createRealSignature(payload, expiryTime);

      const mockContext = createMockExecutionContext(
        'POST',
        '/api/v1/configuration',
        payload,
        getSignatureHeaders(signature, testAccount.address, expiryTime),
      );

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should accept a GET request with a valid real signature', async () => {
      jest.spyOn(ConfigFactory, 'isRequestSignatureValidationEnabled').mockReturnValue(true);
      jest.spyOn(ConfigFactory, 'getDynamicConfigAllowedAddresses').mockReturnValue([TEST_ADDRESS]);

      const url = '/api/v1/configuration?key=test.key';
      const payload = { path: url };
      const expiryTime = Date.now() + 60000;
      const signature = await createRealSignature(payload, expiryTime);

      const mockContext = createMockExecutionContext(
        'GET',
        url,
        {},
        getSignatureHeaders(signature, testAccount.address, expiryTime),
      );

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should accept a DELETE request with a valid real signature', async () => {
      jest.spyOn(ConfigFactory, 'isRequestSignatureValidationEnabled').mockReturnValue(true);
      jest.spyOn(ConfigFactory, 'getDynamicConfigAllowedAddresses').mockReturnValue([TEST_ADDRESS]);

      const url = '/api/v1/configuration/test.key';
      const payload = { path: url };
      const expiryTime = Date.now() + 60000;
      const signature = await createRealSignature(payload, expiryTime);

      const mockContext = createMockExecutionContext(
        'DELETE',
        url,
        {},
        getSignatureHeaders(signature, testAccount.address, expiryTime),
      );

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should accept a PUT request with a valid real signature', async () => {
      jest.spyOn(ConfigFactory, 'isRequestSignatureValidationEnabled').mockReturnValue(true);
      jest.spyOn(ConfigFactory, 'getDynamicConfigAllowedAddresses').mockReturnValue([TEST_ADDRESS]);

      const payload = { key: 'test.key', value: 'updated-value' };
      const expiryTime = Date.now() + 60000;
      const signature = await createRealSignature(payload, expiryTime);

      const mockContext = createMockExecutionContext(
        'PUT',
        '/api/v1/configuration',
        payload,
        getSignatureHeaders(signature, testAccount.address, expiryTime),
      );

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should verify a POST request with a valid real signature', async () => {
      jest.spyOn(ConfigFactory, 'isRequestSignatureValidationEnabled').mockReturnValue(true);
      jest.spyOn(ConfigFactory, 'getDynamicConfigAllowedAddresses').mockReturnValue([TEST_ADDRESS]);

      const complexPayload = {
        key: 'complex.key',
        value: {
          nested: {
            property: 'value',
            array: [1, 2, 3],
            boolean: true,
          },
        },
      };
      const expiryTime = Date.now() + 60000;
      const signature = await createRealSignature(complexPayload, expiryTime);

      const mockContext = createMockExecutionContext(
        'POST',
        '/api/v1/configuration',
        complexPayload,
        getSignatureHeaders(signature, testAccount.address, expiryTime),
      );

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should handle case-insensitive address comparison with real signatures', async () => {
      jest.spyOn(ConfigFactory, 'isRequestSignatureValidationEnabled').mockReturnValue(true);
      jest
        .spyOn(ConfigFactory, 'getDynamicConfigAllowedAddresses')
        .mockReturnValue([TEST_ADDRESS.toUpperCase()]);

      const payload = { key: 'test.key', value: 'test-value' };
      const expiryTime = Date.now() + 60000;
      const signature = await createRealSignature(payload, expiryTime);

      // Headers have mixed case address
      const mockContext = createMockExecutionContext(
        'POST',
        '/api/v1/configuration',
        payload,
        getSignatureHeaders(signature, testAccount.address.toUpperCase() as Hex, expiryTime),
      );

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should return true when signature validation is disabled', async () => {
      jest.spyOn(ConfigFactory, 'isRequestSignatureValidationEnabled').mockReturnValue(false);

      const mockContext = createMockExecutionContext();
      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
    });
  });

  describe('Invalid Signatures', () => {
    it('should reject a request with an invalid signature', async () => {
      jest.spyOn(ConfigFactory, 'isRequestSignatureValidationEnabled').mockReturnValue(true);
      jest.spyOn(ConfigFactory, 'getDynamicConfigAllowedAddresses').mockReturnValue([TEST_ADDRESS]);

      const payload = { key: 'test.key', value: 'test-value' };
      const expiryTime = Date.now() + 60000;

      // Create signature for different payload
      const wrongPayload = { key: 'wrong.key', value: 'wrong-value' };
      const signature = await createRealSignature(wrongPayload, expiryTime);

      const mockContext = createMockExecutionContext(
        'POST',
        '/api/v1/configuration',
        payload, // Different payload than what was signed
        getSignatureHeaders(signature, testAccount.address, expiryTime),
      );

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject a request with an expired signature', async () => {
      jest.spyOn(ConfigFactory, 'isRequestSignatureValidationEnabled').mockReturnValue(true);
      jest.spyOn(ConfigFactory, 'getDynamicConfigAllowedAddresses').mockReturnValue([TEST_ADDRESS]);

      const payload = { key: 'test.key', value: 'test-value' };
      const expiryTime = Date.now() - 1000; // Expired 1 second ago
      const signature = await createRealSignature(payload, expiryTime);

      const mockContext = createMockExecutionContext(
        'POST',
        '/api/v1/configuration',
        payload,
        getSignatureHeaders(signature, testAccount.address, expiryTime),
      );

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject a request when address is not in allowed list', async () => {
      jest.spyOn(ConfigFactory, 'isRequestSignatureValidationEnabled').mockReturnValue(true);
      jest
        .spyOn(ConfigFactory, 'getDynamicConfigAllowedAddresses')
        .mockReturnValue(['0x9999999999999999999999999999999999999999']); // Different address

      const payload = { key: 'test.key', value: 'test-value' };
      const expiryTime = Date.now() + 60000;
      const signature = await createRealSignature(payload, expiryTime);

      const mockContext = createMockExecutionContext(
        'POST',
        '/api/v1/configuration',
        payload,
        getSignatureHeaders(signature, testAccount.address, expiryTime),
      );

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject a request with wrong claimed address', async () => {
      jest.spyOn(ConfigFactory, 'isRequestSignatureValidationEnabled').mockReturnValue(true);
      jest.spyOn(ConfigFactory, 'getDynamicConfigAllowedAddresses').mockReturnValue([TEST_ADDRESS]);

      const payload = { key: 'test.key', value: 'test-value' };
      const expiryTime = Date.now() + 60000;
      const signature = await createRealSignature(payload, expiryTime);

      // Claim a different address than the one that signed
      const wrongAddress = '0x1234567890123456789012345678901234567890';

      const mockContext = createMockExecutionContext(
        'POST',
        '/api/v1/configuration',
        payload,
        getSignatureHeaders(signature, wrongAddress, expiryTime),
      );

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject when signature headers are missing', async () => {
      jest.spyOn(ConfigFactory, 'isRequestSignatureValidationEnabled').mockReturnValue(true);
      jest.spyOn(ConfigFactory, 'getDynamicConfigAllowedAddresses').mockReturnValue([TEST_ADDRESS]);

      const mockContext = createMockExecutionContext('POST', '/api/v1/configuration', {}, {});

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject when allowed addresses list is empty', async () => {
      jest.spyOn(ConfigFactory, 'isRequestSignatureValidationEnabled').mockReturnValue(true);
      jest.spyOn(ConfigFactory, 'getDynamicConfigAllowedAddresses').mockReturnValue([]);

      const payload = { key: 'test.key', value: 'test-value' };
      const expiryTime = Date.now() + 60000;
      const signature = await createRealSignature(payload, expiryTime);

      const mockContext = createMockExecutionContext(
        'POST',
        '/api/v1/configuration',
        payload,
        getSignatureHeaders(signature, testAccount.address, expiryTime),
      );

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Multiple Authorized Addresses', () => {
    it('should allow signatures from any authorized address', async () => {
      // Create second test account (account index 1 from same mnemonic)
      const secondAccount = mnemonicToAccount(TEST_MNEMONIC, {
        addressIndex: 1,
      });
      const secondAddress = secondAccount.address.toLowerCase();

      jest.spyOn(ConfigFactory, 'isRequestSignatureValidationEnabled').mockReturnValue(true);
      jest
        .spyOn(ConfigFactory, 'getDynamicConfigAllowedAddresses')
        .mockReturnValue([TEST_ADDRESS, secondAddress]);

      const payload = { key: 'test.key', value: 'test-value' };
      const expiryTime = Date.now() + 60000;

      // Sign with second account

      const canonicalPayload = canonicalize(payload);
      const signature = await secondAccount.signTypedData({
        domain: DOMAIN,
        types: TYPES,
        primaryType: 'Registration',
        message: {
          payload: canonicalPayload,
          expiryTime: BigInt(expiryTime),
        },
      });

      const mockContext = createMockExecutionContext(
        'POST',
        '/api/v1/configuration',
        payload,
        getSignatureHeaders(signature, secondAccount.address, expiryTime),
      );

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
    });
  });
});
