import { NextResponse } from 'next/server';
import { recordHeartbeat } from '../../../lib/systemShutdown';

export async function POST() {
  recordHeartbeat();
  return NextResponse.json({ ok: true, timestamp: Date.now() });
}

export async function GET() {
  recordHeartbeat();
  return NextResponse.json({ ok: true, timestamp: Date.now() });
}
