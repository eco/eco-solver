/**
 * Type helper that recursively transforms all bigint fields to strings
 */
type SerializedBigInt<T> = T extends bigint
  ? string
  : T extends Array<infer U>
    ? Array<SerializedBigInt<U>>
    : T extends object
      ? { [K in keyof T]: SerializedBigInt<T[K]> }
      : T;

export class BigintSerializer {
  private static readonly BIGINT_PREFIX = '$$bigint:';

  /**
   * Serialize data to JSON string with BigInt values prefixed
   * Use this for queue/redis storage where you need to deserialize back to BigInt
   */
  static serialize<T>(data: T): string {
    return JSON.stringify(data, (_, value) => {
      if (typeof value === 'bigint') {
        return `${this.BIGINT_PREFIX}${value.toString()}`;
      }
      return value;
    });
  }

  /**
   * Deserialize JSON string back to original data with BigInt values
   */
  static deserialize<T>(json: string): T {
    return JSON.parse(json, (_, value) => {
      if (typeof value === 'string' && value.startsWith(this.BIGINT_PREFIX)) {
        return BigInt(value.slice(this.BIGINT_PREFIX.length));
      }
      return value;
    });
  }

  /**
   * Serialize data to plain object with BigInt values as strings (no prefix)
   * Use this for MongoDB storage where bigints should remain as plain strings
   */
  static serializeToObject<T>(data: T): SerializedBigInt<T> {
    return JSON.parse(
      JSON.stringify(data, (_, value) => (typeof value === 'bigint' ? value.toString() : value)),
    );
  }
}
