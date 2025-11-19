import { RhinestoneMessageType } from '../../enums';
import { isOkActionStatusMessage, isOkAuthenticationMessage } from '../auth-messages.types';

describe('Type Guards', () => {
  describe('isOkAuthenticationMessage', () => {
    it('should return true for valid auth Ok message', () => {
      const message = {
        type: RhinestoneMessageType.Ok as const,
        context: 'authentication' as const,
        connectionId: 'abc-123-xyz',
      };
      expect(isOkAuthenticationMessage(message)).toBe(true);
    });

    it('should return false for action Ok message', () => {
      const message = {
        type: RhinestoneMessageType.Ok as const,
        context: 'action' as const,
        messageId: 'msg-123',
      };
      expect(isOkAuthenticationMessage(message)).toBe(false);
    });

    it('should return false for message with missing connectionId', () => {
      const message = {
        type: RhinestoneMessageType.Ok as const,
        context: 'authentication' as const,
      };
      expect(isOkAuthenticationMessage(message as any)).toBe(false);
    });

    it('should return false for message with empty connectionId', () => {
      const message = {
        type: RhinestoneMessageType.Ok as const,
        context: 'authentication' as const,
        connectionId: '',
      };
      expect(isOkAuthenticationMessage(message)).toBe(false);
    });

    it('should return false for message with connectionId too long', () => {
      const message = {
        type: RhinestoneMessageType.Ok as const,
        context: 'authentication' as const,
        connectionId: 'x'.repeat(201),
      };
      expect(isOkAuthenticationMessage(message)).toBe(false);
    });

    it('should return true for connectionId at max length (200)', () => {
      const message = {
        type: RhinestoneMessageType.Ok as const,
        context: 'authentication' as const,
        connectionId: 'x'.repeat(200),
      };
      expect(isOkAuthenticationMessage(message)).toBe(true);
    });

    it('should return false for wrong message type', () => {
      const message = {
        type: RhinestoneMessageType.Hello as any,
        context: 'authentication' as const,
        connectionId: 'abc-123',
      };
      expect(isOkAuthenticationMessage(message)).toBe(false);
    });
  });

  describe('isOkActionStatusMessage', () => {
    it('should return true for valid action Ok message', () => {
      const message = {
        type: RhinestoneMessageType.Ok as const,
        context: 'action' as const,
        messageId: 'msg-456',
      };
      expect(isOkActionStatusMessage(message)).toBe(true);
    });

    it('should return false for auth Ok message', () => {
      const message = {
        type: RhinestoneMessageType.Ok as const,
        context: 'authentication' as const,
        connectionId: 'abc-123',
      };
      expect(isOkActionStatusMessage(message)).toBe(false);
    });

    it('should return false for missing messageId', () => {
      const message = {
        type: RhinestoneMessageType.Ok as const,
        context: 'action' as const,
      };
      expect(isOkActionStatusMessage(message as any)).toBe(false);
    });

    it('should return false for empty messageId', () => {
      const message = {
        type: RhinestoneMessageType.Ok as const,
        context: 'action' as const,
        messageId: '',
      };
      expect(isOkActionStatusMessage(message)).toBe(false);
    });

    it('should return false for messageId too long', () => {
      const message = {
        type: RhinestoneMessageType.Ok as const,
        context: 'action' as const,
        messageId: 'm'.repeat(201),
      };
      expect(isOkActionStatusMessage(message)).toBe(false);
    });

    it('should return true for messageId at max length (200)', () => {
      const message = {
        type: RhinestoneMessageType.Ok as const,
        context: 'action' as const,
        messageId: 'm'.repeat(200),
      };
      expect(isOkActionStatusMessage(message)).toBe(true);
    });

    it('should return false for wrong message type', () => {
      const message = {
        type: RhinestoneMessageType.Error as any,
        context: 'action' as const,
        messageId: 'msg-123',
      };
      expect(isOkActionStatusMessage(message)).toBe(false);
    });
  });

  describe('type guard edge cases', () => {
    it('should handle invalid data types gracefully', () => {
      expect(isOkAuthenticationMessage(null as any)).toBe(false);
      expect(isOkAuthenticationMessage(undefined as any)).toBe(false);
      expect(isOkAuthenticationMessage('string' as any)).toBe(false);
      expect(isOkAuthenticationMessage(123 as any)).toBe(false);
      expect(isOkActionStatusMessage(null as any)).toBe(false);
      expect(isOkActionStatusMessage(undefined as any)).toBe(false);
    });
  });
});
