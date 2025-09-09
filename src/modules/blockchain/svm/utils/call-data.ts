import { Intent } from '@/common/interfaces/intent.interface';

// TODO: Validate offset
// The first 4 bytes of the data are the content left
const CONTENT_LENGTH_BYTES_LENGTH = 4;
// The number of accounts is added to the end of the data
const ACCOUNT_COUNT_BYTES_LENGTH = 1;

export function extractCallData(data: Intent['route']['calls'][number]['data']): Buffer {
  const instructionData = Buffer.from(data.slice(2), 'hex');
  const dataArray = Array.from(instructionData);
  const programData = dataArray
    .slice(CONTENT_LENGTH_BYTES_LENGTH) // Remove CONTENT_LENGTH_BYTES_LENGTH bytes
    .slice(0, ACCOUNT_COUNT_BYTES_LENGTH * -1); // Remove ACCOUNT_COUNT_BYTES_LENGTH bytes

  return Buffer.from(programData);
}
