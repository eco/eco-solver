import { parseAbi } from 'viem'

export const CCTPV2MessageTransmitterABI = parseAbi([
  'event MessageSent(bytes message)',
  'function receiveMessage(bytes message, bytes attestation) returns (bool success)',
])
