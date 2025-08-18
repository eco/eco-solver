/**
 * Waits for initialization to be set
 * @param lock the lock to wait for
 * @param interval the interval to check the variable, default 100ms
 * @param timeout the max time to wait before throwing an error, default 10s
 */
export async function waitForInitialization(
  lock: { initialized: boolean },
  interval: number = 100,
  timeout: number = 10000,
) {
  let timeSpent = 0
  while (!lock.initialized) {
    await new Promise((resolve) => setTimeout(resolve, interval))

    if (timeSpent > timeout) {
      throw new Error(`Timeout waiting for initialization`)
    } else {
      timeSpent += interval
    }
  }
}
