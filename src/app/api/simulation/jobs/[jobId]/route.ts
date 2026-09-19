import { NextResponse } from 'next/server';
import { getSimulationJob } from '@/lib/simulation/job-store';

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  const job = getSimulationJob(jobId);

  if (!job) {
    return NextResponse.json({ error: 'Simulation job not found' }, { status: 404 });
  }

  return NextResponse.json({ job });
}
