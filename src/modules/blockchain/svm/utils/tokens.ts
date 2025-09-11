import { web3 } from '@coral-xyz/anchor';

export function getTransferDestination(calldata: Buffer, accounts: web3.AccountMeta[]) {
  const instruction = calldata[0];
  switch (instruction) {
    case 3:
      // Transfer accounts: [source, destination, authority]
      return accounts[1];
    case 12:
      // TransferChecked accounts: [source, mint, destination, authority]
      return accounts[2];
    default:
      throw new Error('Unsupported operation type: ' + instruction);
  }
}
