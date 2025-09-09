export class BigintSerializer {
  private static readonly BIGINT_PREFIX = '$$bigint:';

  static serialize<T>(data: T): string {
    return JSON.stringify(data, (_, value) => {
      if (typeof value === 'bigint') {
        return `${this.BIGINT_PREFIX}${value.toString()}`;
      }
      return value;
    });
  }

  static deserialize<T>(json: string): T {
    return JSON.parse(json, (_, value) => {
      if (typeof value === 'string' && value.startsWith(this.BIGINT_PREFIX)) {
        return BigInt(value.slice(this.BIGINT_PREFIX.length));
      }
      return value;
    });
  }
}
