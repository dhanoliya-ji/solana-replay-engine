import { NextResponse } from 'next/server';
import { stopLiveMonitor } from '@/lib/simulation/live-monitor';

export const runtime = 'nodejs';

/**
 * ============================================================================
 * POST /api/live/stop
 * ============================================================================
 * PROBLEM ADDRESSED:
 * Users needed a safe mechanism to halt real-time Solana mainnet monitoring and
 * pause dry-run signal processing at any time.
 *
 * FIX IMPLEMENTED:
 * Disconnects the live event listener and pauses the dry-run engine tick loop.
 * ============================================================================
 */
export async function POST() {
  try {
    const state = stopLiveMonitor();
    return NextResponse.json({ state });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to stop live monitor' },
      { status: 500 }
    );
  }
}
