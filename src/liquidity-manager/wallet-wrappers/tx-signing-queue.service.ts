import { Injectable, Logger } from '@nestjs/common'

/**
 * TxSigningQueueService
 *
 * Purpose
 * - Serialize transaction signing/broadcast operations per (wallet, chainId) to prevent nonce collisions.
 * - Preserve throughput by allowing concurrency across different wallets/chains.
 *
 * Mechanism
 * - Keeps a per-key Promise "tail" in a Map, where key = `${wallet}|${chainId}`.
 * - Each enqueue() appends a task to that tail (FIFO), ensuring exclusive execution for the key.
 *
 * Errors
 * - If the task throws, the Promise returned by enqueue() rejects with the same error.
 * - The internal tail never rejects; failures are logged and swallowed to keep the chain moving.
 *
 * Cleanup
 * - After the appended step settles, the service removes the tail entry if it is still the latest.
 *
 * Typical usage
 * - Used by gated client wrappers to guard execute/sendTransaction/writeContract calls only.
 */
@Injectable()
export class TxSigningQueueService {
  private readonly logger = new Logger(TxSigningQueueService.name)
  /**
   * Per-key Promise tails ensuring serialized execution for a wallet+chain pair.
   */
  private readonly tails = new Map<string, Promise<void>>()

  /**
   * Enqueue a task to run under the per-wallet-and-chain gate.
   *
   * Ordering:
   * - Tasks with the same key run strictly in submission order (FIFO).
   * - Tasks with different keys run concurrently.
   *
   * Error propagation:
   * - If task rejects, the returned Promise rejects with the error.
   * - The internal tail swallows the error so subsequent tasks still execute.
   */
  async enqueue<T>(walletAddress: string, chainId: number, task: () => Promise<T>): Promise<T> {
    const key = `${walletAddress.toLowerCase()}|${chainId}`
    const startedAt = Date.now()
    const existingTail = this.tails.get(key) ?? Promise.resolve()

    let resolveResult: (v: T) => void
    let rejectResult: (e: any) => void
    const result = new Promise<T>((resolve, reject) => {
      resolveResult = resolve
      rejectResult = reject
    })

    const run = async () => {
      const waitMs = Date.now() - startedAt
      try {
        this.logger.debug({ message: 'tx-gate: acquired', key, waitMs })
        const ret = await task()
        resolveResult(ret)
      } catch (error) {
        rejectResult(error)
      }
    }

    // Ensure tail never rejects so the chain continues on failures
    const newTail = existingTail.then(run).catch((error) => {
      this.logger.debug({ message: 'tx-gate: failed to execute', key, error })
    })
    this.tails.set(key, newTail)

    newTail.finally(() => {
      if (this.tails.get(key) === newTail) {
        this.tails.delete(key)
      }
    })

    return result
  }
}
