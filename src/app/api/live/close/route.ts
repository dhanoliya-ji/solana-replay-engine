import { NextRequest, NextResponse } from 'next/server';
import { closeLivePositionManually, getLiveMonitorState } from '@/lib/simulation/live-monitor';

export const runtime = 'nodejs';

/**
 * ============================================================================
 * POST /api/live/close
 * ============================================================================
 * PROBLEM ADDRESSED:
 * Users had no way to manually exit open dry-run positions prior to automated
 * Take Profit / Stop Loss triggers.
 *
 * FIX IMPLEMENTED:
 * Allows user to force-close any open dry-run position by mint address from the UI.
 * ============================================================================
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { mint?: string; reason?: string };
    if (!body.mint) {
      return NextResponse.json({ error: 'Missing mint address' }, { status: 400 });
    }

    const success = closeLivePositionManually(body.mint, body.reason || 'Manual UI Close');
    const state = getLiveMonitorState();
    return NextResponse.json({ success, state });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to close live position' },
      { status: 500 }
    );
  }
}
