import { web3 } from '@coral-xyz/anchor';
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

import { Intent } from '@/common/interfaces/intent.interface';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import {
  CalldataInstruction,
  CalldataWithAccountsInstruction,
} from '@/modules/blockchain/svm/targets/types/portal-idl-coder.type';
import { toBuffer } from '@/modules/blockchain/svm/utils/buffer';
import { bufferToBytes } from '@/modules/blockchain/svm/utils/converter';
import { portalBorshCoder } from '@/modules/blockchain/svm/utils/portal-borsh-coder';

export async function buildTokenTransferInstructions(
  tokens: Intent['route']['tokens'],
  connection: web3.Connection,
  sender: web3.PublicKey,
  recipients: web3.PublicKey[],
): Promise<web3.TransactionInstruction[]> {
  const instructions: web3.TransactionInstruction[] = [];

  for (const token of tokens) {
    // Denormalize token address to Solana format
    const tokenMint = new web3.PublicKey(AddressNormalizer.denormalizeToSvm(token.token));

    // Get or create associated token accounts
    const sourceATA = await getAssociatedTokenAddress(tokenMint, sender, true);

    for (const recipient of recipients) {
      const destinationATA = recipient;

      // Check if a destination token account exists, create if not
      const destAccountInfo = await connection.getAccountInfo(destinationATA);
      if (!destAccountInfo) {
        // Add instruction to create the associated token account
        const createAccountIx = createAssociatedTokenAccountInstruction(
          sender, // payer
          destinationATA, // associatedToken
          recipient, // owner
          tokenMint, // mint
        );
        instructions.push(createAccountIx);
      }

      // Create transfer instruction
      const transferIx = createTransferInstruction(
        sourceATA,
        destinationATA,
        sender,
        token.amount,
        [],
        TOKEN_PROGRAM_ID,
      );

      instructions.push(transferIx);
    }
  }

  return instructions;
}

export async function getTokenAccounts(
  route: Intent['route'],
  publicKey: web3.PublicKey,
  portalProgramIdlAddress: string,
): Promise<web3.AccountMeta[]> {
  const accounts: web3.AccountMeta[] = [];

  // Add accounts for each token transfer
  // This needs to match VecTokenTransferAccounts structure from Rust
  for (const token of route.tokens) {
    const tokenAddr = AddressNormalizer.denormalizeToSvm(token.token);
    const tokenMint = new web3.PublicKey(tokenAddr);

    // Source token account (solver's)
    const sourceTokenAccount = await getAssociatedTokenAddress(tokenMint, publicKey, true);

    // Destination would be the executor PDA
    const [executorPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from('executor')],
      new web3.PublicKey(portalProgramIdlAddress),
    );

    const destTokenAccount = await getAssociatedTokenAddress(tokenMint, executorPda, true);

    // Add accounts in the order expected by the Rust TokenTransferAccounts struct:
    // [from, to, mint] - exactly 3 accounts per token
    accounts.push(
      { pubkey: sourceTokenAccount, isSigner: false, isWritable: true }, // from
      { pubkey: destTokenAccount, isSigner: false, isWritable: true }, // to
      { pubkey: tokenMint, isSigner: false, isWritable: false }, // mint
    );
  }

  return accounts;
}

export function decodeRouteCall(call: Intent['route']['calls'][number]) {
  const { accounts, calldata } = portalBorshCoder.types.decode<CalldataWithAccountsInstruction>(
    'CalldataWithAccounts',
    toBuffer(call.data),
  );

  const callBuffer = portalBorshCoder.types.encode<CalldataInstruction>('Calldata', {
    data: calldata.data,
    account_count: calldata.account_count,
  });

  const accountsMeta: web3.AccountMeta[] = accounts.map((account) => ({
    pubkey: account.pubkey,
    isSigner: account.is_signer,
    isWritable: account.is_writable,
  }));

  const routeCall: Intent['route']['calls'][number] = {
    ...call,
    data: bufferToBytes(callBuffer),
  };

  return { routeCall, calldata, accounts: accountsMeta };
}

export function decodeRouteCalls(calls: Intent['route']['calls']) {
  return calls.map((call) => decodeRouteCall(call));
}
