import { parseAbi } from 'viem'

export const CCTPMessageTransmitterABI = parseAbi([
  'event MessageSent(bytes message)',
  'function receiveMessage(bytes message, bytes attestation) returns (bool success)',
])
