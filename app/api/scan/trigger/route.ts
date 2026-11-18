import { NextResponse } from 'next/server';
import { executeScheduledScan } from '@/lib/scheduler';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const label = body.label || 'SCANSIONE MANUALE';

    const result = await executeScheduledScan(label);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Scan trigger error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
