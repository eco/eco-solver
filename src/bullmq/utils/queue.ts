import { Queue } from 'bullmq'

export async function removeJobSchedulers(queue: Queue, jobName: string) {
  const repeatableJobs = await queue.getJobSchedulers()

  for (const job of repeatableJobs) {
    if (job.name === jobName) {
      await queue.removeJobScheduler(job.key)
    }
  }
}
