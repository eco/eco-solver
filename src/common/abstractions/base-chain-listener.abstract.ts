export abstract class BaseChainListener {
  abstract start(): Promise<void>;

  abstract stop(): Promise<void>;
}
