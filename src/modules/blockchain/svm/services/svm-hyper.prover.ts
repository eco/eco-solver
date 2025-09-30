import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { BN } from '@coral-xyz/anchor';
import { Keypair, PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';

import { Intent } from '@/common/interfaces/intent.interface';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { BlockchainConfigService, SolanaConfigService } from '@/modules/config/services';
import { HyperProver } from '@/modules/prover/provers/hyper.prover';

import { ISvmProver, SvmProveContext } from '../types/svm-prover.types';
import { HYPER_PROVER_CONSTANTS } from '../utils/hyper-prover.constants';
import { HyperProverConfig, HyperProverUtils } from '../utils/hyper-prover.utils';

@Injectable()
export class SvmHyperProver extends HyperProver implements ISvmProver {
  constructor(
    protected readonly blockchainConfigService: BlockchainConfigService,
    protected readonly moduleRef: ModuleRef,
    private readonly solanaConfigService: SolanaConfigService,
  ) {
    super(blockchainConfigService, moduleRef);
  }

  async generateSvmProveInstruction(
    intent: Intent,
    context: SvmProveContext,
  ): Promise<{ instruction: TransactionInstruction; signers: Keypair[] } | null> {
    const sourceChainId = Number(intent.sourceChainId);

    // For Hyper prover, the data should be the source prover address as 32 bytes
    // Get the source prover address (the prover address on the source chain)
    const sourceProverAddress = intent.reward.prover;

    // Convert to 32 bytes - pad or truncate as needed
    const sourceProverBytes = Buffer.alloc(HYPER_PROVER_CONSTANTS.BUFFER_SIZES.SOURCE_PROVER_BYTES);
    const sourceProverBuffer = Buffer.from(
      AddressNormalizer.denormalizeToEvm(sourceProverAddress).slice(2),
      'hex',
    );
    sourceProverBuffer.copy(
      sourceProverBytes,
      HYPER_PROVER_CONSTANTS.BUFFER_SIZES.SOURCE_PROVER_BYTES - sourceProverBuffer.length,
    ); // Right-align (pad left with zeros)

    const proveArgs = {
      prover: new PublicKey(AddressNormalizer.denormalizeToSvm(context.proverAddress)),
      sourceChainDomainId: new BN(sourceChainId),
      intentHashes: [{ 0: Array.from(context.intentHash) }],
      data: sourceProverBytes,
    };

    const hyperlaneConfig: HyperProverConfig = {
      hyperlaneMailbox: this.solanaConfigService.hyperlane?.mailbox,
      noop: this.solanaConfigService.hyperlane?.noop,
      igpProgram: this.solanaConfigService.hyperlane?.igpProgram,
      igpAccount: this.solanaConfigService.hyperlane?.igpAccount,
      overheadIgpAccount: this.solanaConfigService.hyperlane?.overheadIgpAccount,
    };

    // Generate Hyper-specific accounts
    const proverDispatcherPDA = HyperProverUtils.getProverDispatcherPDA(context.proverAddress);
    const outboxPDA = HyperProverUtils.getHyperlaneOutboxPDA(hyperlaneConfig);
    const uniqueMessageKeypair = Keypair.generate(); // Generate a unique keypair for the message
    const dispatchedMessagePDA = HyperProverUtils.getHyperlaneDispatchedMessagePDA(
      uniqueMessageKeypair.publicKey,
      hyperlaneConfig,
    );
    const mailboxProgram = HyperProverUtils.getHyperlaneMailboxProgram(hyperlaneConfig);

    const remainingAccounts = [
      {
        pubkey: context.fulfillMarkerPDA,
        isSigner: false,
        isWritable: false,
      },
      // Hyper prover specific accounts (matching the integration test)
      { pubkey: proverDispatcherPDA, isSigner: false, isWritable: false },
      { pubkey: context.keypair.publicKey, isSigner: true, isWritable: true }, // payer
      { pubkey: outboxPDA, isSigner: false, isWritable: true },
      {
        pubkey: HyperProverUtils.getNoopProgram(hyperlaneConfig),
        isSigner: false,
        isWritable: false,
      },
      { pubkey: uniqueMessageKeypair.publicKey, isSigner: true, isWritable: false },
      { pubkey: dispatchedMessagePDA, isSigner: false, isWritable: true },
      {
        pubkey: new PublicKey(SystemProgram.programId.toString()),
        isSigner: false,
        isWritable: false,
      },
      { pubkey: mailboxProgram, isSigner: false, isWritable: false },
    ];

    const proveIx = await context.portalProgram.methods
      .prove(proveArgs)
      .accounts({
        prover: new PublicKey(AddressNormalizer.denormalizeToSvm(context.proverAddress)),
        dispatcher: context.dispatcherPDA,
      })
      .remainingAccounts(remainingAccounts)
      .instruction();

    return {
      instruction: proveIx,
      signers: [uniqueMessageKeypair],
    };
  }
}
