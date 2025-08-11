export async function removeJobSchedulers(queue: Queue, jobName: string) {
  const repeatableJobs = await queue.getJobSchedulers()

  for (const job of repeatableJobs) {
    if (job.name === jobName) {
      await queue.removeJobScheduler(job.key)
    }
  }
}

/**
 * Checks to see if there is a scheduled job of a given name in the queue.
 * @param queue the queue to check
 * @param jobName the name of the job to check
 * @returns
 */
export async function isJobScheduled(queue: Queue, jobName: string): Promise<boolean> {
  const repeatableJobs = await queue.getJobSchedulers()
  return !!repeatableJobs.find((job) => job.name === jobName)
}
