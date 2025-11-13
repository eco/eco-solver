export class ValueSerializer {
  /**
   * Serializes a typed value to an environment variable string.
   * Handles BigInt, boolean, number, string, and edge cases.
   */
  public serialize(value: any): string {
    // BigInt - convert to string
    if (typeof value === 'bigint') {
      return value.toString();
    }

    // Boolean - 'true' or 'false'
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }

    // Number - string representation
    if (typeof value === 'number') {
      return String(value);
    }

    // Null/undefined - empty string
    if (value === null || value === undefined) {
      return '';
    }

    // String - return as-is
    if (typeof value === 'string') {
      return value;
    }

    // Object (shouldn't happen after traversal, but handle gracefully)
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    // Default - convert to string
    return String(value);
  }

  /**
   * Determines if a value needs to be quoted in .env file.
   * Quotes values containing spaces, special characters, or quotes.
   */
  public needsQuotes(value: string): boolean {
    return /[\s#"'$]/.test(value);
  }

  /**
   * Formats a value for .env file, adding quotes if needed.
   */
  public format(value: string): string {
    if (this.needsQuotes(value)) {
      // Escape existing quotes
      const escaped = value.replace(/"/g, '\\"');
      return `"${escaped}"`;
    }
    return value;
  }
}
