import 'server-only';

import type { NormalizedToken, SimulationJobState, SimulationSettings } from '@/types/domain';
import { runSimulationBridge } from '@/lib/simulation/bridge';

const jobs = new Map<string, SimulationJobState>();
const TTL_MS = 1000 * 60 * 30;

function pruneJobs() {
  const now = Date.now();
  for (const [jobId, job] of jobs.entries()) {
    const end = job.finishedAt ? new Date(job.finishedAt).getTime() : new Date(job.startedAt).getTime();
    if (now - end > TTL_MS) {
      jobs.delete(jobId);
    }
  }
}

export function startSimulationJob(options: {
  localFileName?: string;
  tokensData?: NormalizedToken[];
  params: SimulationSettings;
}) {
  pruneJobs();
  const jobId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  jobs.set(jobId, {
    jobId,
    status: 'queued',
    progress: { processed: 0, total: 0 },
    startedAt
  });

  void (async () => {
    jobs.set(jobId, {
      ...jobs.get(jobId)!,
      status: 'running'
    });

    try {
      const payload = await runSimulationBridge({
        ...options,
        onProgress(info) {
          const current = jobs.get(jobId);
          if (!current) return;
          jobs.set(jobId, {
            ...current,
            status: 'running',
            progress: {
              processed: info.processed,
              total: info.total,
              mint: info.mint
            }
          });
        }
      });

      const current = jobs.get(jobId);
      if (!current) return;
      jobs.set(jobId, {
        ...current,
        status: 'completed',
        finishedAt: new Date().toISOString(),
        progress: {
          processed: payload.summary.tokenCount,
          total: payload.summary.tokenCount
        },
        payload
      });
    } catch (error) {
      const current = jobs.get(jobId);
      if (!current) return;
      jobs.set(jobId, {
        ...current,
        status: 'error',
        finishedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown simulation error'
      });
    }
  })();

  return jobs.get(jobId)!;
}

export function getSimulationJob(jobId: string) {
  pruneJobs();
  return jobs.get(jobId) ?? null;
}
