import { NextRequest, NextResponse } from 'next/server';
import { loadLocalNormalizedDataset } from '@/lib/data/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const file = request.nextUrl.searchParams.get('file');
  if (!file) {
    return NextResponse.json({ error: 'Missing file parameter' }, { status: 400 });
  }

  try {
    const dataset = await loadLocalNormalizedDataset(file);
    return NextResponse.json({ dataset });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load local dataset' },
      { status: 500 }
    );
  }
}
