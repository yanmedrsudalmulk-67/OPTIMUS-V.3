import { NextRequest, NextResponse } from 'next/server';
import { requestShutdown } from '../../../lib/systemShutdown';

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const immediate = url.searchParams.get('immediate') === '1';
  requestShutdown(immediate);
  return NextResponse.json({ ok: true, shutdown: true });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const immediate = url.searchParams.get('immediate') === '1';
  requestShutdown(immediate);
  return NextResponse.json({ ok: true, shutdown: true });
}
