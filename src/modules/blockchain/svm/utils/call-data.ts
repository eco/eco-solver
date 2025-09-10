import { web3 } from '@coral-xyz/anchor';
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { Keypair } from '@solana/web3.js';
import { Hex } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { toBuffer } from '@/modules/blockchain/svm/utils/buffer';

// The first 4 bytes of the data are the content left
export const CONTENT_LENGTH_BYTES_LENGTH = 4;
// The number of accounts is added to the end of the data
export const ACCOUNT_COUNT_BYTES_LENGTH = 1;

export function extractCallData(data: Intent['route']['calls'][number]['data']): Buffer {
  const instructionData = Buffer.from(data.slice(2), 'hex');
  const dataArray = Array.from(instructionData);
  const programData = dataArray
    .slice(CONTENT_LENGTH_BYTES_LENGTH) // Remove CONTENT_LENGTH_BYTES_LENGTH bytes
    .slice(0, ACCOUNT_COUNT_BYTES_LENGTH * -1); // Remove ACCOUNT_COUNT_BYTES_LENGTH bytes

  return Buffer.from(programData);
}

export function prepareRouteCalls(
  calls: Intent['route']['calls'],
  accounts: web3.AccountMeta[],
): Intent['route']['calls'] {
  // [data_length (4 bytes)][instruction_data (variable)][account_count (1 byte)]
  return calls.map((call, callIndex) => {
    const callDataBytes = toBuffer(call.data);
    const dataLength = callDataBytes.readUInt32LE(0);
    const accountCount = callDataBytes[CONTENT_LENGTH_BYTES_LENGTH + dataLength];

    if (accountCount != accounts.length) {
      throw new Error(
        `Account count mismatch for call ${callIndex}: ${accountCount} != ${accounts.length}`,
      );
    }

    const accountsLengthBuffer = Buffer.alloc(CONTENT_LENGTH_BYTES_LENGTH);
    accountsLengthBuffer.writeUInt32LE(accounts.length, 0);

    const accountsBuffer = accounts.map((acc) => {
      // SerializableAccountMeta: { pubkey: [u8; 32], is_signer: bool, is_writable: bool }
      const pubkeyBytes = Buffer.from(acc.pubkey.toBytes());
      const isSignerByte = Buffer.from([acc.isSigner ? 1 : 0]);
      const isWritableByte = Buffer.from([acc.isWritable ? 1 : 0]);
      return Buffer.concat([pubkeyBytes, isSignerByte, isWritableByte]);
    });
    const accountsData = Buffer.concat(accountsBuffer);

    const serializedCalldata = Buffer.concat([callDataBytes, accountsLengthBuffer, accountsData]);

    return {
      ...call,
      data: `0x${serializedCalldata.toString('hex')}` as Hex,
    };
  });
}

export async function buildTokenTransferInstructions(
  intent: Intent,
  connection: web3.Connection,
  senderPublicKey: web3.PublicKey,
): Promise<web3.TransactionInstruction[]> {
  const instructions: web3.TransactionInstruction[] = [];

  for (const token of intent.route.tokens) {
    // Denormalize token address to Solana format
    const tokenMint = new web3.PublicKey(AddressNormalizer.denormalizeToSvm(token.token));

    // Get recipient from first call target (simplified - adjust based on your logic)
    const recipientAddress = intent.route.calls[0]?.target;
    if (!recipientAddress) continue;

    const recipientPublicKey = new web3.PublicKey(
      AddressNormalizer.denormalizeToSvm(recipientAddress),
    );

    // Get or create associated token accounts
    const sourceTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      senderPublicKey,
      false,
      TOKEN_PROGRAM_ID,
    );

    const destinationTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      recipientPublicKey,
      false,
      TOKEN_PROGRAM_ID,
    );

    // Check if destination token account exists, create if not
    const destAccountInfo = await connection.getAccountInfo(destinationTokenAccount);
    if (!destAccountInfo) {
      // Add instruction to create the associated token account
      const createAccountIx = createAssociatedTokenAccountInstruction(
        senderPublicKey, // payer
        destinationTokenAccount, // associatedToken
        recipientPublicKey, // owner
        tokenMint, // mint
      );
      instructions.push(createAccountIx);
    }

    // Create transfer instruction
    const transferIx = createTransferInstruction(
      sourceTokenAccount,
      destinationTokenAccount,
      senderPublicKey,
      token.amount,
      [],
      TOKEN_PROGRAM_ID,
    );

    instructions.push(transferIx);
  }

  return instructions;
}

export async function getTokenAccounts(
  route: Intent['route'],
  keypair: Keypair,
  portalProgramIdlAddress: string,
): Promise<web3.AccountMeta[]> {
  const accounts: web3.AccountMeta[] = [];

  // Add accounts for each token transfer
  // This needs to match VecTokenTransferAccounts structure from Rust
  for (const token of route.tokens) {
    const tokenAddr = AddressNormalizer.denormalizeToSvm(token.token);
    const tokenMint = new web3.PublicKey(tokenAddr);

    // Source token account (solver's)
    const sourceTokenAccount = await getAssociatedTokenAddress(tokenMint, keypair.publicKey);

    // Destination would be the executor PDA
    const [executorPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from('executor')],
      new web3.PublicKey(portalProgramIdlAddress),
    );

    const destTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      executorPda,
      true, // Allow PDA owner
    );

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

export async function getCallAccounts(
  route: Intent['route'],
  recipientKeypair: Keypair,
  portalProgramIdlAddress: string,
): Promise<web3.AccountMeta[]> {
  // Add accounts for calls - these should be separate from token accounts
  const callAccounts: web3.AccountMeta[] = [];

  // Get executor PDA for call accounts
  const EXECUTOR_SEED = Buffer.from('executor');
  const [executorPda] = web3.PublicKey.findProgramAddressSync(
    [EXECUTOR_SEED],
    new web3.PublicKey(portalProgramIdlAddress),
  );

  for (const _call of route.calls) {
    // For SPL token transfer calls we need 4 accounts in this exact order:
    // 1. executor_ata (source) - writable
    // 2. token mint - read-only
    // 3. recipient_ata (destination) - writable
    // 4. executor PDA (authority) - read-only

    // For each token in the route, we need to provide call accounts
    for (const token of route.tokens) {
      const tokenAddr = AddressNormalizer.denormalizeToSvm(token.token);
      const tokenMint = new web3.PublicKey(tokenAddr);

      // Executor's associated token account (source)
      const executorAta = await getAssociatedTokenAddress(
        tokenMint,
        executorPda,
        true, // Allow a PDA owner
      );

      const recipientPubkey = recipientKeypair.publicKey;
      const recipientAta = await getAssociatedTokenAddress(tokenMint, recipientPubkey);

      // Add the 4 accounts needed for the call (matching integration test order exactly)
      callAccounts.push(
        { pubkey: executorAta, isSigner: false, isWritable: true }, // executor_ata (source)
        { pubkey: tokenMint, isSigner: false, isWritable: false }, // token mint
        { pubkey: recipientAta, isSigner: false, isWritable: true }, // recipient_ata (destination)
        { pubkey: executorPda, isSigner: false, isWritable: false }, // executor authority
      );
    }
  }

  return callAccounts;
}
