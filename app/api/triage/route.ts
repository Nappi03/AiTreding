import { NextResponse } from 'next/server';
import { runFastWatchlistTriage } from '@/lib/ai-engine';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const tickers = Array.isArray(body.tickers) ? body.tickers : undefined;

    const results = await runFastWatchlistTriage(tickers);
    return NextResponse.json({ success: true, count: results.length, results });
  } catch (error: any) {
    console.error('Triage error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
