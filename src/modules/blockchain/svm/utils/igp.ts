import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';

/**
 * IGP instruction types based on the Rust code
 */
export enum IgpInstruction {
  Init = 0,
  InitIgp = 1,
  InitOverheadIgp = 2,
  PayForGas = 3,
  QuoteGasPayment = 4,
  TransferIgpOwnership = 5,
  TransferOverheadIgpOwnership = 6,
  SetIgpBeneficiary = 7,
  SetDestinationGasOverheads = 8,
  SetGasOracleConfigs = 9,
  Claim = 10,
}

/**
 * Quote gas payment instruction data
 */
export interface QuoteGasPaymentData {
  destinationDomain: number;
  gasAmount: bigint;
}

/**
 * Creates a quote gas payment instruction for the IGP program
 * @param igpProgramId The IGP program ID
 * @param igpAccount The IGP account address (can be derived using deriveIgpAccountPda)
 * @param overheadIgpAccount Optional overhead IGP account address
 * @param destinationDomain The destination domain ID
 * @param gasAmount The gas amount to quote
 * @returns The quote gas payment instruction
 */
export function createQuoteGasPaymentInstruction(
  igpProgramId: PublicKey,
  igpAccount: PublicKey,
  overheadIgpAccount: PublicKey,
  destinationDomain: number,
  gasAmount: bigint,
): TransactionInstruction {
  const instructionData = Buffer.alloc(1 + 4 + 8); // discriminator + u32 + u64
  let offset = 0;

  // Write instruction discriminator
  instructionData.writeUInt8(IgpInstruction.QuoteGasPayment, offset);
  offset += 1;

  // Write destination domain (u32, little-endian)
  instructionData.writeUInt32LE(destinationDomain, offset);
  offset += 4;

  // Write gas amount (u64, little-endian)
  instructionData.writeBigUInt64LE(gasAmount, offset);

  const accounts = [
    {
      pubkey: new PublicKey(SystemProgram.programId.toBase58()),
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: igpAccount,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: overheadIgpAccount,
      isSigner: false,
      isWritable: false,
    },
  ];

  return new TransactionInstruction({
    keys: accounts,
    programId: igpProgramId,
    data: instructionData,
  });
}

/**
 * Simulates a quote gas payment instruction and extracts the result
 * @param connection Solana connection
 * @param instruction The quote gas payment instruction
 * @returns The quoted gas payment amount in lamports
 */
export async function simulateQuoteGasPayment(
  connection: Connection,
  instruction: TransactionInstruction,
  feePayer?: PublicKey,
): Promise<bigint> {
  try {
    // Use 'processed' for simulation to get the freshest blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('processed');
    const dummyFeePayer = feePayer || new PublicKey('11111111111111111111111111111112');

    // Create a transaction with the quote instruction
    const transaction = new Transaction({
      blockhash,
      lastValidBlockHeight,
      feePayer: dummyFeePayer,
    });

    transaction.add(instruction);

    // Simulate the transaction
    const result = await connection.simulateTransaction(transaction);

    if (result.value.err) {
      throw new Error(`Quote gas payment simulation failed: ${JSON.stringify(result.value.err)}`);
    }

    if (result.value.returnData) {
      const returnData = Buffer.from(
        result.value.returnData.data[0],
        result.value.returnData.data[1] as BufferEncoding,
      );

      if (returnData.length >= 8) {
        return returnData.readBigUInt64LE(0);
      }
    }

    throw new Error('No return data from quote gas payment simulation');
  } catch (error) {
    console.error('Simulation error:', error);
    throw new Error(
      `Failed to simulate quote gas payment: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Quotes gas payment for a given destination domain and gas amount
 * @param connection Solana connection
 * @param igpProgramId The IGP program ID
 * @param igpAccount The IGP account address
 * @param overheadIgpAccount Optional overhead IGP account address
 * @param destinationDomain The destination domain ID
 * @param gasAmount The gas amount to quote
 * @returns The quoted gas payment amount in lamports
 */
export async function quoteGasPayment(
  connection: Connection,
  igpProgramId: PublicKey,
  igpAccount: PublicKey,
  overheadIgpAccount: PublicKey,
  destinationDomain: number,
  gasAmount: bigint,
  feePayer?: PublicKey,
): Promise<bigint> {
  const instruction = createQuoteGasPaymentInstruction(
    igpProgramId,
    igpAccount,
    overheadIgpAccount,
    destinationDomain,
    gasAmount,
  );

  return simulateQuoteGasPayment(connection, instruction, feePayer);
}

/**
 * Pay for gas instruction data
 */
export interface PayForGasData {
  messageId: Uint8Array; // 32 bytes (H256)
  destinationDomain: number;
  gasAmount: bigint;
}

/**
 * Creates a pay for gas instruction for the IGP program
 * @param igpProgramId The IGP program ID
 * @param payer The payer account (signer)
 * @param igpProgramDataAccount The IGP program data PDA
 * @param uniqueGasPaymentAccount The unique gas payment account (signer)
 * @param gasPaymentPDA The gas payment PDA (derived from unique account)
 * @param igpAccount The IGP account
 * @param overheadIgpAccount Optional overhead IGP account
 * @param messageId The message ID (32 bytes)
 * @param destinationDomain The destination domain ID
 * @param gasAmount The gas amount
 * @returns The pay for gas instruction
 */
export function createPayForGasInstruction(
  igpProgramId: PublicKey,
  payer: PublicKey,
  igpProgramDataAccount: PublicKey,
  uniqueGasPaymentAccount: PublicKey,
  gasPaymentPDA: PublicKey,
  igpAccount: PublicKey,
  overheadIgpAccount: PublicKey | undefined,
  messageId: Uint8Array,
  destinationDomain: number,
  gasAmount: bigint,
): TransactionInstruction {
  // Prepare instruction data
  const instructionData = Buffer.alloc(1 + 32 + 4 + 8); // discriminator + H256 + u32 + u64
  let offset = 0;

  // Write instruction discriminator
  instructionData.writeUInt8(IgpInstruction.PayForGas, offset);
  offset += 1;

  // Write message ID (32 bytes)
  instructionData.set(messageId, offset);
  offset += 32;

  // Write destination domain (u32, little-endian)
  instructionData.writeUInt32LE(destinationDomain, offset);
  offset += 4;

  // Write gas amount (u64, little-endian)
  instructionData.writeBigUInt64LE(gasAmount, offset);

  // Build accounts array based on Rust instruction structure
  const accounts = [
    {
      pubkey: new PublicKey(SystemProgram.programId.toBase58()), // System program
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: payer, // The payer (signer)
      isSigner: true,
      isWritable: true,
    },
    {
      pubkey: igpProgramDataAccount, // IGP program data
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: uniqueGasPaymentAccount, // Unique gas payment account (signer)
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: gasPaymentPDA, // Gas payment PDA
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: igpAccount, // IGP account
      isSigner: false,
      isWritable: true,
    },
  ];

  // Add overhead IGP account if provided (optional)
  if (overheadIgpAccount) {
    accounts.push({
      pubkey: overheadIgpAccount,
      isSigner: false,
      isWritable: false,
    });
  }

  return new TransactionInstruction({
    keys: accounts,
    programId: igpProgramId,
    data: instructionData,
  });
}

/**
 * Derives the IGP program data PDA
 * Equivalent to igp_program_data_pda_seeds!() macro
 */
export function deriveIgpProgramDataPda(igpProgramId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('hyperlane_igp'), Buffer.from('-'), Buffer.from('program_data')],
    igpProgramId,
  );
}

/**
 * Derives an IGP gas payment account PDA from unique pubkey
 * Equivalent to igp_gas_payment_pda_seeds!(unique_gas_payment_pubkey) macro
 */
export function deriveIgpGasPaymentPda(
  igpProgramId: PublicKey,
  uniqueGasPaymentPubkey: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('hyperlane_igp'),
      Buffer.from('-'),
      Buffer.from('gas_payment'),
      Buffer.from('-'),
      uniqueGasPaymentPubkey.toBuffer(),
    ],
    igpProgramId,
  );
}

/**
 * Quotes gas payment and creates a pay for gas instruction with the quoted amount
 * @param connection Solana connection
 * @param igpProgramId The IGP program ID
 * @param payer The payer account (signer)
 * @param igpAccount The IGP account address
 * @param overheadIgpAccount Optional overhead IGP account address
 * @param messageId The message ID (32 bytes)
 * @param destinationDomain The destination domain ID
 * @param gasAmount The gas amount to quote and pay for
 * @param feePayer Optional fee payer for simulation
 * @returns Object containing the pay for gas instruction, quoted amount, and required accounts
 */
export async function quoteAndCreatePayForGasInstruction(
  connection: Connection,
  igpProgramId: PublicKey,
  payer: PublicKey,
  igpAccount: PublicKey,
  overheadIgpAccount: PublicKey,
  messageId: Uint8Array,
  destinationDomain: number,
  gasAmount: bigint,
  feePayer?: PublicKey,
): Promise<{
  instruction: TransactionInstruction;
  quotedAmount: bigint;
  uniqueGasPaymentKeypair: Keypair;
  gasPaymentPDA: PublicKey;
  igpProgramDataAccount: PublicKey;
}> {
  // Step 1: Quote the gas payment to get the required lamports
  const quotedAmount = await quoteGasPayment(
    connection,
    igpProgramId,
    igpAccount,
    overheadIgpAccount,
    destinationDomain,
    gasAmount,
    feePayer,
  );

  // Step 2: Generate required accounts and PDAs
  const uniqueGasPaymentKeypair = Keypair.generate(); // Generate unique keypair for gas payment
  const uniqueGasPaymentAccount = uniqueGasPaymentKeypair.publicKey;
  const [gasPaymentPDA] = deriveIgpGasPaymentPda(igpProgramId, uniqueGasPaymentAccount);
  const [igpProgramDataAccount] = deriveIgpProgramDataPda(igpProgramId);

  // Step 3: Create the pay for gas instruction
  const instruction = createPayForGasInstruction(
    igpProgramId,
    payer,
    igpProgramDataAccount,
    uniqueGasPaymentAccount,
    gasPaymentPDA,
    igpAccount,
    overheadIgpAccount,
    messageId,
    destinationDomain,
    gasAmount,
  );

  return {
    instruction,
    quotedAmount,
    uniqueGasPaymentKeypair,
    gasPaymentPDA,
    igpProgramDataAccount,
  };
}
