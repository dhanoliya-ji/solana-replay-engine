import { NextResponse } from 'next/server';
import { listLocalDataFiles } from '@/lib/data/server';

export const runtime = 'nodejs';

export async function GET() {
  const files = await listLocalDataFiles();
  return NextResponse.json({ files });
}
