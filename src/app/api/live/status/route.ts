import { NextResponse } from 'next/server';
import { getLiveMonitorState } from '@/lib/simulation/live-monitor';

export const runtime = 'nodejs';

/**
 * ============================================================================
 * GET /api/live/status
 * ============================================================================
 * PROBLEM ADDRESSED:
 * Dashboard UI had no endpoint to poll or stream real-time Solana mainnet monitoring
 * stats, active dry-run positions, live PnL, or event logs.
 *
 * FIX IMPLEMENTED:
 * Exposes real-time snapshot of the Live Solana Monitor engine state.
 * ============================================================================
 */
export async function GET() {
  try {
    const state = getLiveMonitorState();
    return NextResponse.json({ state });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retrieve live monitor state' },
      { status: 500 }
    );
  }
}
