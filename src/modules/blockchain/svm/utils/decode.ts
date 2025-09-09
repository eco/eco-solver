/** Read little-endian u64 from Buffer into bigint */
function readU64LE(buf: Buffer, offset = 0): bigint {
  let n = 0n;
  for (let i = 0; i < 8; i++) n |= BigInt(buf[offset + i]) << (8n * BigInt(i));
  return n;
}

/** Minimal decode for SPL Token instruction data (op 3/12 only) */
export function decodeSplTransferData(data: Buffer) {
  const opcode = data[0];

  if (opcode === 3) {
    // Transfer: [u8 opcode=3][u64 amount LE]
    const amount = readU64LE(data, 1);
    return { kind: 'transfer' as const, opcode, amount };
  }

  if (opcode === 12) {
    // TransferChecked: [u8 opcode=12][u64 amount LE][u8 decimals]
    const amount = readU64LE(data, 1);
    const decimals = data[9];
    return { kind: 'transferChecked' as const, opcode, amount, decimals };
  }

  throw new Error('Unable to decode SplTransferData');
}
