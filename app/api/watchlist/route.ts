import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStockQuote } from '@/lib/market-data';
import { calculateStockIndicators } from '@/lib/technical-indicators';

export async function GET() {
  try {
    const watchlist = await prisma.watchlist.findMany({
      orderBy: [{ priorityScore: 'desc' }, { addedAt: 'desc' }],
    });

    const enriched = await Promise.all(
      watchlist.map(async (item) => {
        let quote: any = null;
        try {
          quote = await getStockQuote(item.ticker);
        } catch (quoteErr: any) {
          console.warn(`Impossibile ottenere quote per ${item.ticker}:`, quoteErr?.message);
        }

        let indicators: any = null;
        try {
          const res = await calculateStockIndicators(item.ticker);
          indicators = res.indicators;
        } catch (indErr: any) {
          console.warn(`Impossibile calcolare indicatori per ${item.ticker}:`, indErr?.message);
        }

        return {
          ...item,
          currentPrice: quote?.currentPrice ?? null,
          change: quote?.change ?? 0,
          changePercent: quote?.changePercent ?? 0,
          dayHigh: quote?.dayHigh ?? quote?.currentPrice ?? null,
          dayLow: quote?.dayLow ?? quote?.currentPrice ?? null,
          volume: quote?.volume ?? 0,
          rsi14: indicators?.rsi14 ?? null,
          trend: indicators?.trend ?? 'NEUTRAL',
          sma20: indicators?.sma20 ?? null,
          sma50: indicators?.sma50 ?? null,
          ema200: indicators?.ema200 ?? null,
          atr14: indicators?.atr14 ?? 0,
          supportLevelUSD: indicators?.supportLevelUSD ?? null,
          resistanceLevelUSD: indicators?.resistanceLevelUSD ?? null,
          suggestedStopLossUSD: indicators?.suggestedStopLossUSD ?? null,
          suggestedTakeProfit1USD: indicators?.suggestedTakeProfit1USD ?? null,
          signals: indicators?.technicalSignals ?? [],
        };
      })
    );

    return NextResponse.json(enriched);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { ticker, sector } = await req.json();

    if (!ticker || typeof ticker !== 'string') {
      return NextResponse.json({ error: 'Ticker obbligatorio' }, { status: 400 });
    }

    const symbol = ticker.trim().toUpperCase();

    // Verify ticker on Yahoo Finance
    const quote = await getStockQuote(symbol);

    const created = await prisma.watchlist.upsert({
      where: { ticker: symbol },
      update: {
        name: quote.name,
        sector: sector || 'Equities',
      },
      create: {
        ticker: symbol,
        name: quote.name,
        sector: sector || 'Equities',
        currency: quote.currency || 'USD',
      },
    });

    return NextResponse.json(created);
  } catch (error: any) {
    return NextResponse.json({ error: `Ticker non valido o non reperibile: ${error.message}` }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ticker = searchParams.get('ticker');

    if (!ticker) {
      return NextResponse.json({ error: 'Ticker mancante' }, { status: 400 });
    }

    await prisma.watchlist.delete({
      where: { ticker: ticker.toUpperCase() },
    });

    return NextResponse.json({ success: true, ticker: ticker.toUpperCase() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
