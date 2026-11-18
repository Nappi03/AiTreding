import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runDeepHedgeFundAnalysis } from '@/lib/ai-engine';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ticker = searchParams.get('ticker');

    if (ticker) {
      const latest = await prisma.aiAnalysis.findFirst({
        where: { ticker: ticker.toUpperCase() },
        orderBy: { createdAt: 'desc' },
      });

      if (!latest) {
        return NextResponse.json({ found: false }, { status: 404 });
      }

      return NextResponse.json({
        found: true,
        analysis: {
          ...latest,
          revolutExecutionPlan: JSON.parse(latest.revolutExecutionPlan),
          rawIndicators: JSON.parse(latest.rawIndicators),
        },
      });
    }

    const recent = await prisma.aiAnalysis.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    const parsed = recent.map((r) => ({
      ...r,
      revolutExecutionPlan: JSON.parse(r.revolutExecutionPlan),
      rawIndicators: JSON.parse(r.rawIndicators),
    }));

    return NextResponse.json(parsed);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const ticker = (body.ticker || '').trim().toUpperCase();

    if (!ticker) {
      return NextResponse.json({ error: 'Ticker obbligatorio per avviare Deep Analysis' }, { status: 400 });
    }

    const analysis = await runDeepHedgeFundAnalysis(ticker);
    return NextResponse.json({ success: true, analysis });
  } catch (error: any) {
    console.error(`Deep analysis failed for ticker:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
