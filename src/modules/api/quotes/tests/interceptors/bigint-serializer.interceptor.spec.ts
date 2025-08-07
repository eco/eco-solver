import { CallHandler, ExecutionContext } from '@nestjs/common';

import { of } from 'rxjs';

import { BigIntSerializerInterceptor } from '../../interceptors/bigint-serializer.interceptor';

describe('BigIntSerializerInterceptor', () => {
  let interceptor: BigIntSerializerInterceptor;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;

  beforeEach(() => {
    interceptor = new BigIntSerializerInterceptor();
    mockExecutionContext = {} as ExecutionContext;
    mockCallHandler = {
      handle: jest.fn(),
    };
  });

  describe('intercept', () => {
    it('should convert bigint values to strings', (done) => {
      const testData = {
        id: BigInt('123456789012345678901234567890'),
        amount: BigInt(1000),
        name: 'Test',
      };

      mockCallHandler.handle = jest.fn().mockReturnValue(of(testData));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result) => {
        expect(result).toEqual({
          id: '123456789012345678901234567890',
          amount: '1000',
          name: 'Test',
        });
        done();
      });
    });

    it('should handle nested objects with bigint values', (done) => {
      const testData = {
        user: {
          id: BigInt(1),
          balance: {
            amount: BigInt('999999999999999999'),
            currency: 'USD',
          },
        },
      };

      mockCallHandler.handle = jest.fn().mockReturnValue(of(testData));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result) => {
        expect(result).toEqual({
          user: {
            id: '1',
            balance: {
              amount: '999999999999999999',
              currency: 'USD',
            },
          },
        });
        done();
      });
    });

    it('should handle arrays with bigint values', (done) => {
      const testData = {
        values: [BigInt(1), BigInt(2), BigInt(3)],
        items: [
          { id: BigInt(100), name: 'Item 1' },
          { id: BigInt(200), name: 'Item 2' },
        ],
      };

      mockCallHandler.handle = jest.fn().mockReturnValue(of(testData));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result) => {
        expect(result).toEqual({
          values: ['1', '2', '3'],
          items: [
            { id: '100', name: 'Item 1' },
            { id: '200', name: 'Item 2' },
          ],
        });
        done();
      });
    });

    it('should handle null and undefined values', (done) => {
      const testData = {
        nullValue: null,
        undefinedValue: undefined,
        bigintValue: BigInt(42),
      };

      mockCallHandler.handle = jest.fn().mockReturnValue(of(testData));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result) => {
        expect(result).toEqual({
          nullValue: null,
          undefinedValue: undefined,
          bigintValue: '42',
        });
        done();
      });
    });

    it('should not modify non-bigint primitive values', (done) => {
      const testData = {
        string: 'hello',
        number: 123,
        boolean: true,
        bigint: BigInt(456),
      };

      mockCallHandler.handle = jest.fn().mockReturnValue(of(testData));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result) => {
        expect(result).toEqual({
          string: 'hello',
          number: 123,
          boolean: true,
          bigint: '456',
        });
        done();
      });
    });

    it('should handle deeply nested structures', (done) => {
      const testData = {
        level1: {
          level2: {
            level3: {
              values: [
                {
                  id: BigInt(1),
                  items: [BigInt(10), BigInt(20)],
                },
              ],
            },
          },
        },
      };

      mockCallHandler.handle = jest.fn().mockReturnValue(of(testData));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result) => {
        expect(result).toEqual({
          level1: {
            level2: {
              level3: {
                values: [
                  {
                    id: '1',
                    items: ['10', '20'],
                  },
                ],
              },
            },
          },
        });
        done();
      });
    });

    it('should handle empty objects and arrays', (done) => {
      const testData = {
        emptyObject: {},
        emptyArray: [],
        bigint: BigInt(0),
      };

      mockCallHandler.handle = jest.fn().mockReturnValue(of(testData));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result) => {
        expect(result).toEqual({
          emptyObject: {},
          emptyArray: [],
          bigint: '0',
        });
        done();
      });
    });
  });
});
