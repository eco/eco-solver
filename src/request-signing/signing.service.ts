/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { SignatureGenerator } from '@/request-signing/signature-generator';
import { SignatureHeaders } from '@/request-signing/interfaces/signature-headers.interface';
import { SignedMessage } from '@/request-signing/interfaces/signed-message.interface';

@Injectable()
export class SigningService implements OnModuleInit {
  // private walletAccount: LocalAccount
  // private walletClientDefaultSignerService: WalletClientDefaultSignerService

  constructor(
    private readonly signatureGenerator: SignatureGenerator,
    private readonly moduleRef: ModuleRef,
  ) {}

  async onModuleInit() {
    // this.walletClientDefaultSignerService = this.moduleRef.get(WalletClientDefaultSignerService, {
    //   strict: false,
    // })
    // this.walletAccount = (await this.walletClientDefaultSignerService.getAccount()) as LocalAccount
  }

  getAccountAddress() {
    return '';
    // return this.walletAccount.address
  }

  async getHeaders(payload: object, expiryTime: number): Promise<SignatureHeaders> {
    // return this.signatureGenerator.getHeadersWithWalletClient(
    //   this.walletAccount,
    //   payload,
    //   expiryTime,
    // )
    return {} as SignatureHeaders;
  }

  async signPayload(payload: object, expiryTime: number): Promise<SignedMessage> {
    throw new Error('Not implemented');
    // return this.signatureGenerator.signPayload(this.walletAccount, payload, expiryTime)
  }
}
