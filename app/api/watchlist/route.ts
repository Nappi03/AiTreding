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
        try {
          const quote = await getStockQuote(item.ticker);
          const { indicators } = await calculateStockIndicators(item.ticker);

          return {
            ...item,
            currentPrice: quote.currentPrice,
            change: quote.change,
            changePercent: quote.changePercent,
            dayHigh: quote.dayHigh,
            dayLow: quote.dayLow,
            volume: quote.volume,
            rsi14: indicators.rsi14,
            trend: indicators.trend,
            sma20: indicators.sma20,
            sma50: indicators.sma50,
            ema200: indicators.ema200,
            atr14: indicators.atr14,
            supportLevelUSD: indicators.supportLevelUSD,
            resistanceLevelUSD: indicators.resistanceLevelUSD,
            suggestedStopLossUSD: indicators.suggestedStopLossUSD,
            suggestedTakeProfit1USD: indicators.suggestedTakeProfit1USD,
            signals: indicators.technicalSignals,
          };
        } catch (err: any) {
          return {
            ...item,
            currentPrice: null,
            error: err.message,
          };
        }
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
