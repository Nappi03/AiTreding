import { NextResponse } from 'next/server';
import { getLiveEurUsdRate } from '@/lib/market-data';
import { isWeekendFxMarkupActive, getMarketTradingHoursStatus } from '@/lib/revolut-engine';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const [eurUsdRate, settings, positionsCount, watchlistCount] = await Promise.all([
      getLiveEurUsdRate(),
      prisma.accountSettings.findUnique({ where: { id: 'default' } }),
      prisma.portfolioPosition.count(),
      prisma.watchlist.count(),
    ]);

    const weekend = isWeekendFxMarkupActive();
    const marketHours = getMarketTradingHoursStatus();

    const today = new Date().toISOString().split('T')[0];
    const geoBrief = await prisma.geopoliticalBrief.findUnique({
      where: { date: today },
      select: { marketSentiment: true, createdAt: true },
    });

    return NextResponse.json({
      eurUsdRate,
      weekend,
      marketHours,
      settings: {
        liquidityEur: settings?.availableLiquidityEur ?? 10000,
        riskPercentage: settings?.riskPercentage ?? 1.5,
        revolutPlan: settings?.revolutPlan ?? 'Premium',
        freeTradesRemaining: settings?.freeTradesRemaining ?? 5,
        autoScanEnabled: settings?.autoScanEnabled ?? true,
      },
      counts: {
        positions: positionsCount,
        watchlist: watchlistCount,
      },
      geopoliticalStatus: {
        hasTodayBrief: Boolean(geoBrief),
        sentiment: geoBrief?.marketSentiment || 'NON_GENERATO',
        createdAt: geoBrief?.createdAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
