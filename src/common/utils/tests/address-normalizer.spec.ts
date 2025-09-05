/**
 * Unit tests for AddressNormalizer
 *
 * Tests the address normalization and denormalization functionality for EVM, TVM, and SVM blockchains.
 */

import { TronWeb } from 'tronweb';
import { getAddress, isAddress } from 'viem';

import { UniversalAddress } from '@/common/types/universal-address.type';
import { ChainType } from '@/common/utils/chain-type-detector';
import { EvmAddress } from '@/modules/blockchain/evm/types/address';
import { SvmAddress } from '@/modules/blockchain/svm/types/address.types';
import { TronAddress } from '@/modules/blockchain/tvm/types';

import { AddressNormalizer } from '../address-normalizer';

describe('AddressNormalizer', () => {
  describe('EVM Address Operations', () => {
    // Use only lowercase for testing - viem normalizes to lowercase internally
    const evmAddressLowercase = '0x742d35cc6634c0532925a3b844bc9e7595f0beb6' as EvmAddress;
    // Viem's getAddress returns checksummed format
    const evmAddressChecksummed = getAddress(evmAddressLowercase);

    describe('normalizeEvm', () => {
      it('should normalize a valid EVM address', () => {
        const result = AddressNormalizer.normalizeEvm(evmAddressLowercase);
        // Result should be 32 bytes (padded)
        expect(result.length).toBe(66); // 0x + 64 hex chars (32 bytes)
        expect(result).toMatch(/^0x[a-fA-F0-9]{64}$/);
        // Should contain the original address
        expect(result.toLowerCase()).toContain(evmAddressLowercase.slice(2).toLowerCase());
      });

      it('should handle lowercase EVM addresses', () => {
        const result = AddressNormalizer.normalizeEvm(evmAddressLowercase);
        expect(result.length).toBe(66);
        expect(result).toMatch(/^0x[a-fA-F0-9]{64}$/);
      });

      it('should handle checksummed EVM addresses', () => {
        const result = AddressNormalizer.normalizeEvm(evmAddressChecksummed);
        expect(result.length).toBe(66);
        expect(result).toMatch(/^0x[a-fA-F0-9]{64}$/);
      });

      it('should throw error for invalid EVM address', () => {
        expect(() => AddressNormalizer.normalizeEvm('invalid' as EvmAddress)).toThrow(
          'Invalid EVM address: invalid',
        );
      });

      it('should throw error for address with wrong length', () => {
        expect(() => AddressNormalizer.normalizeEvm('0x123' as EvmAddress)).toThrow(
          'Invalid EVM address: 0x123',
        );
      });
    });

    describe('denormalizeToEvm', () => {
      it('should denormalize to checksummed EVM address', () => {
        const normalized = AddressNormalizer.normalizeEvm(evmAddressLowercase);
        const result = AddressNormalizer.denormalizeToEvm(normalized);
        expect(result).toBe(evmAddressChecksummed);
        expect(result.length).toBe(42); // 0x + 40 hex chars (20 bytes)
      });

      it('should handle addresses with different padding', () => {
        const paddedAddress =
          '0x000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f0beb6' as UniversalAddress;
        const result = AddressNormalizer.denormalizeToEvm(paddedAddress);
        expect(result).toBe(evmAddressChecksummed);
      });

      it('should throw error for invalid hex characters', () => {
        const invalidAddress =
          '0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG' as UniversalAddress;
        expect(() => AddressNormalizer.denormalizeToEvm(invalidAddress)).toThrow();
      });
    });
  });

  describe('TVM (Tron) Address Operations', () => {
    const tronAddressBase58: TronAddress = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' as TronAddress;
    const tronAddressHex = '0x41a614f803b6fd780986a42c78ec9c7f77e6ded13c';
    const tronAddressHexWithoutPrefix = '0x0ae2c6a3c0b35ba8658c1022a19185aebc94851e';

    describe('normalizeTvm', () => {
      it('should normalize a valid Tron base58 address', () => {
        const result = AddressNormalizer.normalizeTvm(tronAddressBase58);
        expect(result).toMatch(/^0x[a-fA-F0-9]{64}$/);
        expect(result.length).toBe(66);
      });

      it('should normalize a valid Tron hex address', () => {
        const result = AddressNormalizer.normalizeTvm(tronAddressHex as TronAddress);
        expect(result).toMatch(/^0x[a-fA-F0-9]{64}$/);
        expect(result.length).toBe(66);
      });

      it('should normalize a valid Tron hex address without prefix', () => {
        const result = AddressNormalizer.normalizeTvm(tronAddressHexWithoutPrefix as TronAddress);
        expect(result).toMatch(/^0x[a-fA-F0-9]{64}$/);
        expect(result.length).toBe(66);
        expect(result).toBe('0x0000000000000000000000410ae2c6a3c0b35ba8658c1022a19185aebc94851e');
      });

      it('should throw error for invalid Tron base58 address', () => {
        expect(() => AddressNormalizer.normalizeTvm('invalidtronaddress' as TronAddress)).toThrow(
          /Failed to normalize TVM address/,
        );
      });

      it('should throw error for invalid Tron hex address', () => {
        expect(() => AddressNormalizer.normalizeTvm('0xinvalidhex' as TronAddress)).toThrow(
          /Failed to normalize TVM address/,
        );
      });
    });

    describe('denormalizeToTvm', () => {
      it('should denormalize to valid Tron base58 address', () => {
        const normalized = AddressNormalizer.normalizeTvm(tronAddressBase58);
        const result = AddressNormalizer.denormalizeToTvm(normalized);
        expect(result).toBe(tronAddressBase58);
        expect(TronWeb.isAddress(result)).toBe(true);
      });

      it('should handle hex addresses with 0x41 prefix correctly', () => {
        const normalized = AddressNormalizer.normalizeTvm(tronAddressHex as TronAddress);
        const result = AddressNormalizer.denormalizeToTvm(normalized);
        expect(TronWeb.isAddress(result)).toBe(true);
      });

      it('should throw error for invalid denormalization', () => {
        // Using an address that TronWeb.isAddress will reject
        const invalidAddress =
          '0x1111111111111111111111111111111111111111111111111111111111111111' as UniversalAddress;
        expect(() => AddressNormalizer.denormalizeToTvm(invalidAddress)).toThrow(
          /Failed to denormalize to TVM address/,
        );
      });
    });
  });

  describe('SVM (Solana) Address Operations', () => {
    const solanaAddress = '11111111111111111111111111111112' as SvmAddress;
    const solanaAddress2 = 'So11111111111111111111111111111111111111112' as SvmAddress;

    describe('normalizeSvm', () => {
      it('should normalize a valid Solana address', () => {
        const result = AddressNormalizer.normalizeSvm(solanaAddress);
        expect(result).toMatch(/^0x[a-fA-F0-9]{64}$/);
        expect(result.length).toBe(66);
      });

      it('should normalize another valid Solana address', () => {
        const result = AddressNormalizer.normalizeSvm(solanaAddress2);
        expect(result).toMatch(/^0x[a-fA-F0-9]{64}$/);
        expect(result.length).toBe(66);
      });

      it('should throw error for invalid Solana address', () => {
        expect(() => AddressNormalizer.normalizeSvm('invalidsolanaaddress')).toThrow(
          /Failed to normalize SVM address/,
        );
      });

      it('should throw error for address with wrong length', () => {
        expect(() => AddressNormalizer.normalizeSvm('short')).toThrow(
          /Failed to normalize SVM address/,
        );
      });
    });

    describe('denormalizeToSvm', () => {
      it('should denormalize to valid Solana address', () => {
        const normalized = AddressNormalizer.normalizeSvm(solanaAddress);
        const result = AddressNormalizer.denormalizeToSvm(normalized);
        expect(result).toBe(solanaAddress);
      });

      it('should maintain address integrity through normalization cycle', () => {
        const normalized = AddressNormalizer.normalizeSvm(solanaAddress2);
        const result = AddressNormalizer.denormalizeToSvm(normalized);
        expect(result).toBe(solanaAddress2);
      });
    });
  });

  describe('Generic normalize and denormalize methods', () => {
    describe('normalize', () => {
      it('should normalize EVM address with ChainType.EVM', () => {
        const evmAddress = '0x742d35cc6634c0532925a3b844bc9e7595f0beb6' as EvmAddress;
        const result = AddressNormalizer.normalize(evmAddress, ChainType.EVM);
        expect(result).toMatch(/^0x[a-fA-F0-9]{64}$/);
      });

      it('should normalize TVM address with ChainType.TVM', () => {
        const tronAddress = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' as TronAddress;
        const result = AddressNormalizer.normalize(tronAddress, ChainType.TVM);
        expect(result).toMatch(/^0x[a-fA-F0-9]{64}$/);
      });

      it('should normalize SVM address with ChainType.SVM', () => {
        const solanaAddress = '11111111111111111111111111111112' as SvmAddress;
        const result = AddressNormalizer.normalize(solanaAddress, ChainType.SVM);
        expect(result).toMatch(/^0x[a-fA-F0-9]{64}$/);
      });

      it('should throw error for unsupported chain type', () => {
        const address = '0x742d35cc6634c0532925a3b844bc9e7595f0beb6';
        expect(() => AddressNormalizer.normalize(address, 'UNKNOWN' as ChainType)).toThrow(
          'Unsupported chain type: UNKNOWN',
        );
      });
    });

    describe('denormalize', () => {
      it('should denormalize to EVM address with ChainType.EVM', () => {
        const evmAddress = '0x742d35cc6634c0532925a3b844bc9e7595f0beb6' as EvmAddress;
        const normalized = AddressNormalizer.normalize(evmAddress, ChainType.EVM);
        const result = AddressNormalizer.denormalize(normalized, ChainType.EVM);
        expect(isAddress(result)).toBe(true);
        expect(result).toBe(getAddress(evmAddress));
      });

      it('should denormalize to TVM address with ChainType.TVM', () => {
        const tronAddress = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' as TronAddress;
        const normalized = AddressNormalizer.normalize(tronAddress, ChainType.TVM);
        const result = AddressNormalizer.denormalize(normalized, ChainType.TVM);
        expect(TronWeb.isAddress(result)).toBe(true);
      });

      it('should denormalize to SVM address with ChainType.SVM', () => {
        const solanaAddress = '11111111111111111111111111111112' as SvmAddress;
        const normalized = AddressNormalizer.normalize(solanaAddress, ChainType.SVM);
        const result = AddressNormalizer.denormalize(normalized, ChainType.SVM);
        expect(result).toBe(solanaAddress);
      });

      it('should throw error for unsupported chain type', () => {
        const normalized =
          '0x000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f0beb6' as UniversalAddress;
        expect(() => AddressNormalizer.denormalize(normalized, 'UNKNOWN' as ChainType)).toThrow(
          'Unsupported chain type: UNKNOWN',
        );
      });
    });
  });

  describe('Round-trip conversions', () => {
    it('should maintain EVM address integrity through normalization/denormalization', () => {
      const originalAddress = '0x742d35cc6634c0532925a3b844bc9e7595f0beb6' as EvmAddress;
      const normalized = AddressNormalizer.normalize(originalAddress, ChainType.EVM);
      const denormalized = AddressNormalizer.denormalize(normalized, ChainType.EVM);
      // Viem returns checksummed addresses
      expect(denormalized).toBe(getAddress(originalAddress));
      expect(denormalized.toLowerCase()).toBe(originalAddress.toLowerCase());
    });

    it('should maintain TVM address integrity through normalization/denormalization', () => {
      const originalAddress = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' as TronAddress;
      const normalized = AddressNormalizer.normalize(originalAddress, ChainType.TVM);
      const denormalized = AddressNormalizer.denormalize(normalized, ChainType.TVM);
      expect(denormalized).toBe(originalAddress);
    });

    it('should maintain SVM address integrity through normalization/denormalization', () => {
      const originalAddress = 'So11111111111111111111111111111111111111112' as SvmAddress;
      const normalized = AddressNormalizer.normalize(originalAddress, ChainType.SVM);
      const denormalized = AddressNormalizer.denormalize(normalized, ChainType.SVM);
      expect(denormalized).toBe(originalAddress);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle invalid Tron addresses', () => {
      // Test various invalid formats
      const invalidAddresses = ['invalidtronaddress123', '0xnotahexaddress', '', '123'];

      invalidAddresses.forEach((addr) => {
        expect(() => AddressNormalizer.normalizeTvm(addr as TronAddress)).toThrow(
          /Failed to normalize TVM address/,
        );
      });
    });

    it('should handle malformed hex in EVM denormalization', () => {
      const invalidHex =
        '0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG' as UniversalAddress;
      expect(() => AddressNormalizer.denormalizeToEvm(invalidHex)).toThrow();
    });

    it('should validate Solana public key creation', () => {
      const invalidBase58 = '!!!invalid!!!';
      expect(() => AddressNormalizer.normalizeSvm(invalidBase58)).toThrow(
        /Failed to normalize SVM address/,
      );
    });

    it('should handle zero addresses for EVM', () => {
      const zeroEvmAddress = '0x0000000000000000000000000000000000000000' as EvmAddress;
      const normalized = AddressNormalizer.normalize(zeroEvmAddress, ChainType.EVM);
      const denormalized = AddressNormalizer.denormalize(normalized, ChainType.EVM);
      expect(denormalized).toBe(zeroEvmAddress);
    });

    it('should properly pad short EVM addresses', () => {
      const address = '0x742d35cc6634c0532925a3b844bc9e7595f0beb6' as EvmAddress;
      const normalized = AddressNormalizer.normalizeEvm(address);
      // Should be padded to 32 bytes
      expect(normalized.length).toBe(66);
      // Should start with 0x followed by 24 zeros (12 bytes of padding)
      expect(normalized.slice(0, 26)).toBe('0x000000000000000000000000');
    });

    it('should handle Tron addresses without 0x prefix', () => {
      // Tron hex address without 0x prefix might be valid base58, test with invalid char
      const invalidTronInput = 'not-a-valid-tron-address!@#$%';
      expect(() => AddressNormalizer.normalizeTvm(invalidTronInput as TronAddress)).toThrow(
        /Failed to normalize TVM address/,
      );
    });
  });
});
