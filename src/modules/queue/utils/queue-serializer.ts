import { Intent } from '@/common/interfaces/intent.interface';

export class QueueSerializer {
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

  static serializeIntent(intent: Intent): string {
    return this.serialize(intent);
  }

  static deserializeIntent(json: string): Intent {
    return this.deserialize<Intent>(json);
  }
}
