/**
 * Waits for initialization to be set
 * @param lock the lock to wait for
 * @param interval the interval to check the variable, default 100ms
 * @param timeout the max time to wait before throwing an error, default 10s
 */
export declare function waitForInitialization(lock: {
    initialized: boolean;
}, interval?: number, timeout?: number): Promise<void>;
