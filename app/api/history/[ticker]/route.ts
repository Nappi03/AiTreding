import { NextResponse } from 'next/server';
import { getHistoricalCandles } from '@/lib/market-data';

export async function GET(req: Request, props: { params: Promise<{ ticker: string }> }) {
  const params = await props.params;
  try {
    const ticker = params.ticker?.toUpperCase();
    if (!ticker) {
      return NextResponse.json({ error: 'Ticker obbligatorio' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '180', 10);

    const candles = await getHistoricalCandles(ticker, days);
    return NextResponse.json({ ticker, count: candles.length, candles });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
