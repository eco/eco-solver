/**
 * Returns the selector hash of the data, which is the first 4 bytes of the data
 *
 * @param data the hex encoded data
 * @returns
 */
export function getSelectorHash(data: string | undefined): string {
  if (!data || data.length < 10) {
    throw new Error('Data is too short')
  }
  if (!isHex(data)) {
    throw new Error('Data is not hex encoded')
  }
  return '0x' + data.slice(2, 10)
}

/**
 * Check if a string is valid hex
 * @param hex the string to check if it is hex
 * @returns
 */
export function isHex(num: string): boolean {
  return Boolean(num.match(/^0x[0-9a-f]+$/i))
}
