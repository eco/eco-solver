import { RhinestoneErrorCode, RhinestoneMessageType } from '../../enums';
import {
  HelloMessageSchema,
  parseErrorMessage,
  parseHelloMessage,
  parseOkMessage,
} from '../message-schemas';

describe('Message Schemas', () => {
  describe('HelloMessageSchema', () => {
    it('should validate valid Hello message', () => {
      const data = { type: RhinestoneMessageType.Hello, version: 'v1.1' };
      const result = parseHelloMessage(data);
      expect(result).toEqual(data);
    });

    it('should validate different version numbers', () => {
      const data = { type: RhinestoneMessageType.Hello, version: 'v2.5' };
      const result = parseHelloMessage(data);
      expect(result.version).toBe('v2.5');
    });

    it('should reject invalid version format without v prefix', () => {
      const data = { type: RhinestoneMessageType.Hello, version: '1.1' };
      expect(() => parseHelloMessage(data)).toThrow();
    });

    it('should reject version without minor number', () => {
      const data = { type: RhinestoneMessageType.Hello, version: 'v1' };
      expect(() => parseHelloMessage(data)).toThrow();
    });

    it('should reject missing version field', () => {
      const data = { type: RhinestoneMessageType.Hello };
      expect(() => parseHelloMessage(data)).toThrow();
    });

    it('should reject wrong type', () => {
      const data = { type: 'Wrong', version: 'v1.1' };
      expect(() => parseHelloMessage(data)).toThrow();
    });

    it('should reject null data', () => {
      expect(() => parseHelloMessage(null)).toThrow();
    });

    it('should reject non-object data', () => {
      expect(() => parseHelloMessage('string')).toThrow();
    });
  });

  describe('parseOkMessage', () => {
    describe('authentication response (with connectionId)', () => {
      it('should parse Ok with connectionId and add auth context', () => {
        const data = { type: RhinestoneMessageType.Ok, connectionId: 'abc-123-xyz' };
        const result = parseOkMessage(data);

        expect(result.context).toBe('authentication');
        expect(result.type).toBe(RhinestoneMessageType.Ok);
        if (result.context === 'authentication') {
          expect(result.connectionId).toBe('abc-123-xyz');
        }
      });

      it('should handle UUID format connectionId', () => {
        const data = {
          type: RhinestoneMessageType.Ok,
          connectionId: '550e8400-e29b-41d4-a716-446655440000',
        };
        const result = parseOkMessage(data);
        if (result.context === 'authentication') {
          expect(result.connectionId).toBe('550e8400-e29b-41d4-a716-446655440000');
        }
      });

      it('should handle short connectionId (1 char)', () => {
        const data = { type: RhinestoneMessageType.Ok, connectionId: 'x' };
        const result = parseOkMessage(data);
        if (result.context === 'authentication') {
          expect(result.connectionId).toBe('x');
        }
      });

      it('should handle max length connectionId (200 chars)', () => {
        const longId = 'x'.repeat(200);
        const data = { type: RhinestoneMessageType.Ok, connectionId: longId };
        const result = parseOkMessage(data);
        if (result.context === 'authentication') {
          expect(result.connectionId).toBe(longId);
        }
      });

      it('should throw when connectionId empty string', () => {
        const data = { type: RhinestoneMessageType.Ok, connectionId: '' };
        expect(() => parseOkMessage(data)).toThrow('validation failed');
      });

      it('should throw when connectionId too long (>200 chars)', () => {
        const tooLong = 'x'.repeat(201);
        const data = { type: RhinestoneMessageType.Ok, connectionId: tooLong };
        expect(() => parseOkMessage(data)).toThrow();
      });

      it('should throw when connectionId is not a string', () => {
        const data = { type: RhinestoneMessageType.Ok, connectionId: 123 };
        expect(() => parseOkMessage(data)).toThrow();
      });
    });

    describe('action status response (with messageId)', () => {
      it('should parse Ok with messageId and add action context', () => {
        const data = { type: RhinestoneMessageType.Ok, messageId: 'msg-456-def' };
        const result = parseOkMessage(data);

        expect(result.context).toBe('action');
        expect(result.type).toBe(RhinestoneMessageType.Ok);
        if (result.context === 'action') {
          expect(result.messageId).toBe('msg-456-def');
        }
      });

      it('should handle short messageId', () => {
        const data = { type: RhinestoneMessageType.Ok, messageId: 'm' };
        const result = parseOkMessage(data);
        if (result.context === 'action') {
          expect(result.messageId).toBe('m');
        }
      });

      it('should throw when messageId empty', () => {
        const data = { type: RhinestoneMessageType.Ok, messageId: '' };
        expect(() => parseOkMessage(data)).toThrow();
      });

      it('should throw when messageId too long', () => {
        const tooLong = 'm'.repeat(201);
        const data = { type: RhinestoneMessageType.Ok, messageId: tooLong };
        expect(() => parseOkMessage(data)).toThrow();
      });
    });

    describe('invalid Ok messages', () => {
      it('should throw when neither field present', () => {
        const data = { type: RhinestoneMessageType.Ok };
        expect(() => parseOkMessage(data)).toThrow('validation failed');
      });

      it('should throw when type wrong', () => {
        const data = { type: 'Wrong', connectionId: 'abc' };
        expect(() => parseOkMessage(data)).toThrow();
      });

      it('should throw on null data', () => {
        expect(() => parseOkMessage(null)).toThrow();
      });

      it('should throw on non-object data', () => {
        expect(() => parseOkMessage('string')).toThrow();
      });
    });
  });

  describe('parseErrorMessage', () => {
    it('should validate valid Error message', () => {
      const data = {
        type: RhinestoneMessageType.Error,
        errorCode: RhinestoneErrorCode.InvalidApiKey,
        message: 'Invalid API key provided',
      };
      const result = parseErrorMessage(data);
      expect(result).toEqual(data);
    });

    it('should validate Error with optional messageId', () => {
      const data = {
        type: RhinestoneMessageType.Error,
        errorCode: RhinestoneErrorCode.InternalError,
        message: 'Server error',
        messageId: 'msg-123',
      };
      const result = parseErrorMessage(data);
      expect(result.messageId).toBe('msg-123');
    });

    it('should validate all error codes', () => {
      Object.values(RhinestoneErrorCode).forEach((code) => {
        if (typeof code === 'number') {
          const data = {
            type: RhinestoneMessageType.Error,
            errorCode: code,
            message: 'Test error',
          };
          const result = parseErrorMessage(data);
          expect(result.errorCode).toBe(code);
        }
      });
    });

    it('should reject invalid error code', () => {
      const data = {
        type: RhinestoneMessageType.Error,
        errorCode: 99999,
        message: 'Test',
      };
      expect(() => parseErrorMessage(data)).toThrow();
    });

    it('should reject message too long (>1000 chars)', () => {
      const data = {
        type: RhinestoneMessageType.Error,
        errorCode: RhinestoneErrorCode.InternalError,
        message: 'x'.repeat(1001),
      };
      expect(() => parseErrorMessage(data)).toThrow();
    });

    it('should accept message at max length (1000 chars)', () => {
      const data = {
        type: RhinestoneMessageType.Error,
        errorCode: RhinestoneErrorCode.InternalError,
        message: 'x'.repeat(1000),
      };
      const result = parseErrorMessage(data);
      expect(result.message.length).toBe(1000);
    });

    it('should reject missing message field', () => {
      const data = {
        type: RhinestoneMessageType.Error,
        errorCode: RhinestoneErrorCode.InternalError,
      };
      expect(() => parseErrorMessage(data)).toThrow();
    });

    it('should reject empty message', () => {
      const data = {
        type: RhinestoneMessageType.Error,
        errorCode: RhinestoneErrorCode.InternalError,
        message: '',
      };
      expect(() => parseErrorMessage(data)).toThrow();
    });

    it('should reject wrong type', () => {
      const data = {
        type: 'Wrong',
        errorCode: RhinestoneErrorCode.InternalError,
        message: 'Test',
      };
      expect(() => parseErrorMessage(data)).toThrow();
    });

    it('should reject null data', () => {
      expect(() => parseErrorMessage(null)).toThrow();
    });
  });

  describe('Schema validation consistency', () => {
    it('should use same schema for direct validation and parsing', () => {
      const validHello = { type: RhinestoneMessageType.Hello, version: 'v1.1' };

      // Direct schema validation
      const schemaResult = HelloMessageSchema.safeParse(validHello);

      // Parsing function
      const parseResult = parseHelloMessage(validHello);

      expect(schemaResult.success).toBe(true);
      expect(parseResult).toEqual(validHello);
    });

    it('should reject same invalid data in both methods', () => {
      const invalidHello = { type: RhinestoneMessageType.Hello, version: '1.1' };

      const schemaResult = HelloMessageSchema.safeParse(invalidHello);
      expect(schemaResult.success).toBe(false);

      expect(() => parseHelloMessage(invalidHello)).toThrow();
    });
  });
});
