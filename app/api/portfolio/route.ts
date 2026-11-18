import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStockQuote, getLiveEurUsdRate } from '@/lib/market-data';

export async function GET() {
  try {
    const [positions, eurUsdRate] = await Promise.all([
      prisma.portfolioPosition.findMany({
        orderBy: { updatedAt: 'desc' },
      }),
      getLiveEurUsdRate(),
    ]);

    let totalPortfolioValueUSD = 0;
    let totalPortfolioCostUSD = 0;

    const enriched = await Promise.all(
      positions.map(async (pos) => {
        try {
          const quote = await getStockQuote(pos.ticker);
          const currentPrice = quote.currentPrice;
          const totalCostUSD = pos.sharesOwned * pos.averageCostUSD;
          const currentValueUSD = pos.sharesOwned * currentPrice;
          const pnlUSD = currentValueUSD - totalCostUSD;
          const pnlPercent = totalCostUSD > 0 ? (pnlUSD / totalCostUSD) * 100 : 0;

          const currentValueEUR = currentValueUSD / eurUsdRate;
          const pnlEUR = pnlUSD / eurUsdRate;

          totalPortfolioValueUSD += currentValueUSD;
          totalPortfolioCostUSD += totalCostUSD;

          // Distance to Stop Loss and Take Profit
          let stopLossDistancePercent: number | null = null;
          if (pos.stopLossPriceUSD) {
            stopLossDistancePercent = parseFloat(
              (((currentPrice - pos.stopLossPriceUSD) / currentPrice) * 100).toFixed(1)
            );
          }

          let takeProfitDistancePercent: number | null = null;
          if (pos.takeProfitPriceUSD) {
            takeProfitDistancePercent = parseFloat(
              (((pos.takeProfitPriceUSD - currentPrice) / currentPrice) * 100).toFixed(1)
            );
          }

          return {
            ...pos,
            currentPriceUSD: currentPrice,
            dayChangePercent: quote.changePercent,
            currentValueUSD: parseFloat(currentValueUSD.toFixed(2)),
            currentValueEUR: parseFloat(currentValueEUR.toFixed(2)),
            pnlUSD: parseFloat(pnlUSD.toFixed(2)),
            pnlEUR: parseFloat(pnlEUR.toFixed(2)),
            pnlPercent: parseFloat(pnlPercent.toFixed(2)),
            stopLossDistancePercent,
            takeProfitDistancePercent,
            isStopLossTriggered: pos.stopLossPriceUSD ? currentPrice <= pos.stopLossPriceUSD : false,
            isTakeProfitTriggered: pos.takeProfitPriceUSD ? currentPrice >= pos.takeProfitPriceUSD : false,
          };
        } catch (err: any) {
          return {
            ...pos,
            currentPriceUSD: null,
            error: err.message,
          };
        }
      })
    );

    const totalPortfolioValueEUR = totalPortfolioValueUSD / eurUsdRate;
    const totalPortfolioPnlUSD = totalPortfolioValueUSD - totalPortfolioCostUSD;
    const totalPortfolioPnlEUR = totalPortfolioPnlUSD / eurUsdRate;
    const totalPortfolioPnlPercent =
      totalPortfolioCostUSD > 0 ? (totalPortfolioPnlUSD / totalPortfolioCostUSD) * 100 : 0;

    return NextResponse.json({
      positions: enriched,
      summary: {
        totalValueUSD: parseFloat(totalPortfolioValueUSD.toFixed(2)),
        totalValueEUR: parseFloat(totalPortfolioValueEUR.toFixed(2)),
        totalPnlUSD: parseFloat(totalPortfolioPnlUSD.toFixed(2)),
        totalPnlEUR: parseFloat(totalPortfolioPnlEUR.toFixed(2)),
        totalPnlPercent: parseFloat(totalPortfolioPnlPercent.toFixed(2)),
        eurUsdRate,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const symbol = (body.ticker || '').trim().toUpperCase();

    if (!symbol) {
      return NextResponse.json({ error: 'Ticker obbligatorio' }, { status: 400 });
    }

    const sharesOwned = parseFloat(body.sharesOwned);
    const averageCostUSD = parseFloat(body.averageCostUSD);

    if (isNaN(sharesOwned) || sharesOwned <= 0) {
      return NextResponse.json({ error: 'Numero di azioni non valido' }, { status: 400 });
    }
    if (isNaN(averageCostUSD) || averageCostUSD <= 0) {
      return NextResponse.json({ error: 'Prezzo medio di carico non valido' }, { status: 400 });
    }

    const quote = await getStockQuote(symbol);

    const position = await prisma.portfolioPosition.upsert({
      where: { ticker: symbol },
      update: {
        sharesOwned,
        averageCostUSD,
        stopLossPriceUSD: body.stopLossPriceUSD ? parseFloat(body.stopLossPriceUSD) : null,
        takeProfitPriceUSD: body.takeProfitPriceUSD ? parseFloat(body.takeProfitPriceUSD) : null,
        notes: body.notes || null,
        name: quote.name,
      },
      create: {
        ticker: symbol,
        name: quote.name,
        sharesOwned,
        averageCostUSD,
        stopLossPriceUSD: body.stopLossPriceUSD ? parseFloat(body.stopLossPriceUSD) : null,
        takeProfitPriceUSD: body.takeProfitPriceUSD ? parseFloat(body.takeProfitPriceUSD) : null,
        notes: body.notes || null,
      },
    });

    return NextResponse.json(position);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ticker = searchParams.get('ticker');

    if (!ticker) {
      return NextResponse.json({ error: 'Ticker obbligatorio' }, { status: 400 });
    }

    await prisma.portfolioPosition.delete({
      where: { ticker: ticker.toUpperCase() },
    });

    return NextResponse.json({ success: true, ticker: ticker.toUpperCase() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
