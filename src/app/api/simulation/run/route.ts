import { NextRequest, NextResponse } from 'next/server';
import { startSimulationJob } from '@/lib/simulation/job-store';
import type { SimulationSettings, NormalizedToken } from '@/types/domain';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      localFileName?: string;
      tokensData?: NormalizedToken[];
      params?: SimulationSettings;
    };

    if (!body.params) {
      return NextResponse.json({ error: 'Missing simulation settings' }, { status: 400 });
    }

    if (!body.localFileName && !body.tokensData?.length) {
      return NextResponse.json({ error: 'No dataset supplied for simulation' }, { status: 400 });
    }

    const job = startSimulationJob({
      localFileName: body.localFileName,
      tokensData: body.tokensData,
      params: body.params
    });

    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start simulation' },
      { status: 500 }
    );
  }
}
