import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import { Chain, Transport } from 'viem';

import { OpenTelemetryService } from './opentelemetry.service';

@Injectable()
export class BlockchainTracingService {
  constructor(private readonly otelService: OpenTelemetryService) {}

  /**
   * Wrap a Viem transport with OpenTelemetry tracing
   * Note: Due to the complexity of Viem's transport system, we'll implement
   * tracing at a higher level in the reader/executor services instead
   */
  wrapTransport(transport: Transport, _chain: Chain): Transport {
    // For now, return the transport as-is
    // Tracing will be implemented at the service level instead
    return transport;
  }

  /**
   * Add method-specific attributes to the span
   */
  private addMethodSpecificAttributes(span: api.Span, method: string, params: any[]): void {
    switch (method) {
      case 'eth_getBalance':
        if (params[0]) {
          span.setAttribute('rpc.eth.address', params[0]);
        }
        break;
      case 'eth_call':
        if (params[0]) {
          span.setAttributes({
            'rpc.eth.to': params[0].to,
            'rpc.eth.from': params[0].from,
            'rpc.eth.data_size': params[0].data ? params[0].data.length : 0,
          });
        }
        break;
      case 'eth_sendRawTransaction':
        span.setAttribute('rpc.eth.transaction_size', params[0] ? params[0].length : 0);
        break;
      case 'eth_getTransactionReceipt':
        if (params[0]) {
          span.setAttribute('rpc.eth.transaction_hash', params[0]);
        }
        break;
      case 'eth_getLogs':
        if (params[0]) {
          span.setAttributes({
            'rpc.eth.from_block': params[0].fromBlock,
            'rpc.eth.to_block': params[0].toBlock,
            'rpc.eth.address': Array.isArray(params[0].address)
              ? params[0].address.join(',')
              : params[0].address,
          });
        }
        break;
      case 'eth_estimateGas':
        if (params[0]) {
          span.setAttributes({
            'rpc.eth.to': params[0].to,
            'rpc.eth.from': params[0].from,
            'rpc.eth.value': params[0].value,
          });
        }
        break;
    }
  }

  /**
   * Create a span for contract reads
   */
  createContractReadSpan(contractAddress: string, functionName: string, chainId: number): api.Span {
    const span = this.otelService.startSpan(`contract.read ${functionName}`, {
      kind: api.SpanKind.CLIENT,
    });

    span.setAttributes({
      'contract.address': contractAddress,
      'contract.function': functionName,
      'contract.chain_id': chainId,
      'contract.operation': 'read',
    });

    return span;
  }

  /**
   * Create a span for contract writes
   */
  createContractWriteSpan(
    contractAddress: string,
    functionName: string,
    chainId: number,
    value?: bigint,
  ): api.Span {
    const span = this.otelService.startSpan(`contract.write ${functionName}`, {
      kind: api.SpanKind.CLIENT,
    });

    span.setAttributes({
      'contract.address': contractAddress,
      'contract.function': functionName,
      'contract.chain_id': chainId,
      'contract.operation': 'write',
      'contract.value': value?.toString() || '0',
    });

    return span;
  }
}
