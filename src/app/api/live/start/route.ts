import { NextRequest, NextResponse } from 'next/server';
import { startLiveMonitor } from '@/lib/simulation/live-monitor';
import type { LiveMonitorSettings } from '@/types/domain';

export const runtime = 'nodejs';

/**
 * ============================================================================
 * POST /api/live/start
 * ============================================================================
 * PROBLEM ADDRESSED:
 * Users could not trigger real-time copy trading on live Solana mainnet data or configure
 * strategy parameters (target wallet, RPC endpoint, TP/SL, Trailing Stop) dynamically.
 *
 * FIX IMPLEMENTED:
 * Accepts strategy configuration and RPC settings, initiating the real-time Solana
 * event stream listener and dry-run copy trading engine.
 * ============================================================================
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<LiveMonitorSettings>;
    const state = startLiveMonitor(body);
    return NextResponse.json({ state });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start live monitor' },
      { status: 500 }
    );
  }
}
