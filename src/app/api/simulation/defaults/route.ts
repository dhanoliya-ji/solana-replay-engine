import { NextResponse } from 'next/server';
import { getSimulationDefaults } from '@/lib/simulation/bridge';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ defaults: getSimulationDefaults() });
}
