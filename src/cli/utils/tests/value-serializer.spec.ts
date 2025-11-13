import { ValueSerializer } from '../value-serializer';

describe('ValueSerializer', () => {
  let serializer: ValueSerializer;

  beforeEach(() => {
    serializer = new ValueSerializer();
  });

  describe('serialize', () => {
    it('should serialize bigint to string', () => {
      expect(serializer.serialize(BigInt(123456789))).toBe('123456789');
    });

    it('should serialize boolean to "true" or "false"', () => {
      expect(serializer.serialize(true)).toBe('true');
      expect(serializer.serialize(false)).toBe('false');
    });

    it('should serialize numbers to string', () => {
      expect(serializer.serialize(42)).toBe('42');
      expect(serializer.serialize(3.14)).toBe('3.14');
      expect(serializer.serialize(0)).toBe('0');
    });

    it('should serialize strings as-is', () => {
      expect(serializer.serialize('hello')).toBe('hello');
      expect(serializer.serialize('0x123')).toBe('0x123');
    });

    it('should handle null and undefined', () => {
      expect(serializer.serialize(null)).toBe('');
      expect(serializer.serialize(undefined)).toBe('');
    });
  });

  describe('needsQuotes', () => {
    it('should return true for values with spaces', () => {
      expect(serializer.needsQuotes('hello world')).toBe(true);
    });

    it('should return true for values with special characters', () => {
      expect(serializer.needsQuotes('value#comment')).toBe(true);
      expect(serializer.needsQuotes('value$var')).toBe(true);
      expect(serializer.needsQuotes('value"quote')).toBe(true);
    });

    it('should return false for simple values', () => {
      expect(serializer.needsQuotes('localhost')).toBe(false);
      expect(serializer.needsQuotes('3000')).toBe(false);
      expect(serializer.needsQuotes('0x1234')).toBe(false);
    });
  });

  describe('format', () => {
    it('should add quotes for values needing them', () => {
      expect(serializer.format('hello world')).toBe('"hello world"');
    });

    it('should escape existing quotes', () => {
      expect(serializer.format('say "hello"')).toBe('"say \\"hello\\""');
    });

    it('should not add quotes for simple values', () => {
      expect(serializer.format('localhost')).toBe('localhost');
    });
  });
});
